const crypto = require('crypto');
const { pool, query } = require('../config/db');
const Cart = require('./cart');

const userError = (message) => Object.assign(new Error(message), { user: true });

const newOrderNumber = () => {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `APX${stamp}-${crypto.randomInt(100000, 999999)}`;
};

const place = async ({ userId, address, paymentMethod, couponCode }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [lines] = await conn.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.sku, p.image, p.price, p.stock, p.seller_id, p.status
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ? ORDER BY p.id FOR UPDATE`,
      [userId]
    );
    if (!lines.length) throw userError('Your cart is empty.');

    for (const line of lines) {
      if (line.status !== 'active' || line.stock < line.quantity) {
        throw userError(`${line.name} is no longer available in the quantity you chose. Please update your cart.`);
      }
    }

    const items = lines.map((line) => ({ ...line, lineTotal: Cart.round2(Number(line.price) * line.quantity) }));
    const subtotal = Cart.round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const coupon = couponCode ? await Cart.evaluateCoupon(couponCode, subtotal, userId) : null;
    if (coupon && !coupon.ok) throw userError(coupon.message);
    const t = Cart.totals(items, coupon);

    if (coupon) {
      const [used] = await conn.query(
        'UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
        [coupon.code]
      );
      if (!used.affectedRows) throw userError('This coupon has reached its usage limit.');
    }

    const online = paymentMethod !== 'cod';
    const orderNumber = newOrderNumber();
    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, user_id, status, payment_method, payment_status, subtotal, shipping_fee, tax_amount,
         discount_amount, total, coupon_code, ship_name, ship_phone, ship_line1, ship_line2, ship_city,
         ship_state, ship_postal_code, ship_country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, userId, online ? 'confirmed' : 'placed', paymentMethod, online ? 'paid' : 'pending',
        t.subtotal, t.shipping, t.tax, t.discount, t.total, coupon ? coupon.code : null,
        address.full_name, address.phone, address.line1, address.line2, address.city, address.state,
        address.postal_code, address.country
      ]
    );
    const orderId = orderResult.insertId;
    const status = online ? 'confirmed' : 'placed';

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items
          (order_id, product_id, seller_id, product_name, product_sku, product_image, unit_price, quantity, line_total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.seller_id, item.name, item.sku, item.image, item.price, item.quantity, item.lineTotal, status]
      );
      const [stock] = await conn.query(
        'UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.quantity, item.product_id, item.quantity]
      );
      if (!stock.affectedRows) throw userError(`${item.name} just sold out. Please update your cart.`);
    }

    await conn.query('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [
      orderId,
      status,
      online ? 'Order placed and payment received' : 'Order placed, pay on delivery'
    ]);
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    await conn.commit();
    return orderNumber;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const listForUser = async (userId, limit = 50) => {
  const orders = await query('SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC, id DESC LIMIT ?', [userId, limit]);
  if (!orders.length) return orders;
  const items = await query(
    'SELECT order_id, product_id, product_name, product_image, quantity FROM order_items WHERE order_id IN (?)',
    [orders.map((o) => o.id)]
  );
  orders.forEach((o) => {
    o.items = items.filter((i) => i.order_id === o.id);
  });
  return orders;
};

const findForUser = async (userId, orderNumber) => {
  const [order] = await query('SELECT * FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1', [orderNumber, userId]);
  if (!order) return null;

  const [items, history] = await Promise.all([
    query(
      `SELECT oi.*, p.slug AS product_slug FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id]
    ),
    query('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id', [order.id])
  ]);

  const ids = items.map((i) => i.product_id).filter(Boolean);
  const reviewed = ids.length
    ? new Set((await query('SELECT product_id FROM reviews WHERE user_id = ? AND product_id IN (?)', [userId, ids])).map((r) => r.product_id))
    : new Set();
  items.forEach((i) => {
    i.reviewed = reviewed.has(i.product_id);
  });

  return { ...order, items, history };
};

const cancel = async (userId, orderNumber) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE order_number = ? AND user_id = ? FOR UPDATE', [orderNumber, userId]);
    if (!order) throw userError('Order not found.');

    const [items] = await conn.query('SELECT product_id, quantity, status FROM order_items WHERE order_id = ?', [order.id]);
    const cancellable = ['placed', 'confirmed'];
    if (!cancellable.includes(order.status) || items.some((i) => !cancellable.includes(i.status))) {
      throw userError('This order has already been packed or shipped and can no longer be cancelled.');
    }

    for (const item of items) {
      if (item.product_id) {
        await conn.query(
          'UPDATE products SET stock = stock + ?, sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?',
          [item.quantity, item.quantity, item.product_id]
        );
      }
    }
    if (order.coupon_code) {
      await conn.query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?', [order.coupon_code]);
    }
    await conn.query("UPDATE order_items SET status = 'cancelled' WHERE order_id = ?", [order.id]);
    await conn.query(
      "UPDATE orders SET status = 'cancelled', payment_status = IF(payment_status = 'paid', 'refunded', payment_status) WHERE id = ?",
      [order.id]
    );
    await conn.query('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [
      order.id,
      'cancelled',
      'Cancelled by customer'
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const addReview = async (userId, orderNumber, productId, { rating, title, body }) => {
  const eligible = await query(
    `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = ? AND o.order_number = ? AND oi.product_id = ? AND oi.status = 'delivered' LIMIT 1`,
    [userId, orderNumber, productId]
  );
  if (!eligible.length) throw userError('You can review a product once it has been delivered.');

  await query(
    `INSERT INTO reviews (product_id, user_id, rating, title, body) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title), body = VALUES(body)`,
    [productId, userId, rating, title || null, body || null]
  );
  await query(
    `UPDATE products p SET
       p.rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = p.id),
       p.rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = p.id)
     WHERE p.id = ?`,
    [productId]
  );
};

module.exports = { place, listForUser, findForUser, cancel, addReview };