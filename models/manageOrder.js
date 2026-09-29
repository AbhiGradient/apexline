const { pool, query } = require('../config/db');
const { pageInfo } = require('../utils/links');

const STAGES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];
const TABS = {
  open: ['placed', 'confirmed', 'packed'],
  shipped: ['shipped'],
  delivered: ['delivered'],
  closed: ['cancelled', 'returned'],
  all: null
};

const userError = (message) => Object.assign(new Error(message), { user: true });
const escapeLike = (v) => String(v).replace(/[\\%_]/g, '\\$&');
const like = (v) => `%${escapeLike(v)}%`;

const nextSteps = (status, admin) => {
  const steps = [];
  const i = STAGES.indexOf(status);
  if (i >= 0 && i < STAGES.length - 1) steps.push(STAGES[i + 1]);
  if (['placed', 'confirmed'].includes(status)) steps.push('cancelled');
  if (admin && status === 'delivered') steps.push('returned');
  return steps;
};

const allowed = (current, next, admin) => nextSteps(current, admin).includes(next);

const sellerItems = async (sellerId, tab = 'open', page = 1, size = 20) => {
  const statuses = TABS[tab] || null;
  const where = `oi.seller_id = ?${statuses ? ' AND oi.status IN (?)' : ''}`;
  const params = statuses ? [sellerId, statuses] : [sellerId];
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM order_items oi WHERE ${where}`, params);
  const { pages, offset } = pageInfo(total, page, size);
  const items = await query(
    `SELECT oi.id, oi.product_name, oi.product_sku, oi.product_image, oi.unit_price, oi.quantity, oi.line_total, oi.status,
       o.order_number, o.placed_at, o.payment_method, o.payment_status,
       o.ship_name, o.ship_phone, o.ship_line1, o.ship_line2, o.ship_city, o.ship_state, o.ship_postal_code
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE ${where}
     ORDER BY o.placed_at ${tab === 'open' ? 'ASC' : 'DESC'}, oi.id DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items, total, pages, page };
};

const sellerCounts = async (sellerId) => {
  const rows = await query('SELECT status, COUNT(*) AS n FROM order_items WHERE seller_id = ? GROUP BY status', [sellerId]);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  const sum = (list) => list.reduce((t, s) => t + (by[s] || 0), 0);
  return Object.fromEntries(Object.entries(TABS).map(([tab, list]) => [tab, list ? sum(list) : sum(Object.keys(by))]));
};

const updateItem = async ({ itemId, status, sellerId, admin }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query('SELECT * FROM order_items WHERE id = ? FOR UPDATE', [itemId]);
    if (!item || (sellerId && item.seller_id !== sellerId)) throw userError('Order item not found.');
    if (!allowed(item.status, status, admin)) throw userError(`An item that is ${item.status} cannot be changed to ${status}.`);

    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [item.order_id]);

    await conn.query('UPDATE order_items SET status = ? WHERE id = ?', [status, itemId]);
    if (status === 'cancelled' && item.product_id) {
      await conn.query('UPDATE products SET stock = stock + ?, sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?', [
        item.quantity,
        item.quantity,
        item.product_id
      ]);
    }

    const [rows] = await conn.query('SELECT status FROM order_items WHERE order_id = ?', [order.id]);
    const active = rows.map((r) => r.status).filter((s) => !['cancelled', 'returned'].includes(s));
    let orderStatus;
    if (!active.length) orderStatus = rows.some((r) => r.status === 'returned') ? 'returned' : 'cancelled';
    else orderStatus = STAGES[Math.min(...active.map((s) => STAGES.indexOf(s)))];

    let payment = order.payment_status;
    if (orderStatus === 'delivered' && order.payment_method === 'cod' && payment === 'pending') payment = 'paid';
    if (['cancelled', 'returned'].includes(orderStatus) && payment === 'paid') payment = 'refunded';

    if (orderStatus === 'cancelled' && order.status !== 'cancelled' && order.coupon_code) {
      await conn.query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?', [order.coupon_code]);
    }

    await conn.query('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?', [orderStatus, payment, order.id]);
    await conn.query('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [
      order.id,
      orderStatus,
      `${item.product_name} marked ${status}`.slice(0, 200)
    ]);

    await conn.commit();
    return orderStatus;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const adminList = async ({ status, q }, page = 1, size = 20) => {
  const where = ['1 = 1'];
  const params = [];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(o.order_number LIKE ? OR u.email LIKE ? OR o.ship_name LIKE ?)');
    params.push(like(q), like(q), like(q));
  }
  const sql = where.join(' AND ');
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id WHERE ${sql}`,
    params
  );
  const { pages, offset } = pageInfo(total, page, size);
  const items = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_method, o.payment_status, o.total, o.placed_at, o.ship_name, u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE ${sql} ORDER BY o.placed_at DESC, o.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items, total, pages, page };
};

const adminFind = async (orderNumber) => {
  const [order] = await query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_number = ? LIMIT 1`,
    [orderNumber]
  );
  if (!order) return null;
  const [items, history] = await Promise.all([
    query(
      `SELECT oi.*, s.store_name FROM order_items oi JOIN sellers s ON s.id = oi.seller_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id]
    ),
    query('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id', [order.id])
  ]);
  return { ...order, items, history };
};

const setPayment = (orderNumber, status) =>
  query('UPDATE orders SET payment_status = ? WHERE order_number = ?', [status, orderNumber]);

module.exports = { STAGES, TABS, nextSteps, sellerItems, sellerCounts, updateItem, adminList, adminFind, setPayment };