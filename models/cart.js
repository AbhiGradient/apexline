const { query } = require('../config/db');
const site = require('../config/site');
const { money } = require('../utils/format');
const Wishlist = require('./wishlist');

const MAX_QTY = 10;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const COLUMNS = `p.id, p.slug, p.name, p.image, p.price, p.compare_price, p.stock, p.sku, p.seller_id, b.name AS brand_name`;

const toItem = (row) => {
  const quantity = row.stock > 0 ? Math.min(row.quantity, row.stock, MAX_QTY) : row.quantity;
  return { ...row, quantity, inStock: row.stock >= 1, lineTotal: round2(Number(row.price) * quantity) };
};

const guestCart = (req) => req.session.cart || {};

const load = async (req) => {
  const user = req.session.user;
  if (user) {
    const rows = await query(
      `SELECT ci.quantity, ${COLUMNS}
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id AND p.status = 'active'
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE ci.user_id = ?
       ORDER BY ci.updated_at DESC`,
      [user.id]
    );
    return rows.map(toItem);
  }

  const cart = guestCart(req);
  const ids = Object.keys(cart).map(Number);
  if (!ids.length) return [];
  const rows = await query(
    `SELECT ${COLUMNS} FROM products p LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.id IN (?) AND p.status = 'active'`,
    [ids]
  );
  return rows.map((row) => toItem({ ...row, quantity: cart[row.id] }));
};

const add = async (req, product, qty) => {
  const user = req.session.user;
  if (user) {
    const rows = await query('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [user.id, product.id]);
    const next = Math.min((rows[0] ? rows[0].quantity : 0) + qty, MAX_QTY, product.stock);
    await query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [user.id, product.id, next]
    );
    return next;
  }
  const cart = { ...guestCart(req) };
  const next = Math.min((cart[product.id] || 0) + qty, MAX_QTY, product.stock);
  cart[product.id] = next;
  req.session.cart = cart;
  return next;
};

const remove = async (req, productId) => {
  const user = req.session.user;
  if (user) return query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [user.id, productId]);
  const cart = { ...guestCart(req) };
  delete cart[productId];
  req.session.cart = cart;
  return null;
};

const setQty = async (req, productId, qty) => {
  if (!qty || qty < 1) return remove(req, productId);
  const [product] = await query("SELECT id, stock FROM products WHERE id = ? AND status = 'active' LIMIT 1", [productId]);
  if (!product) return remove(req, productId);
  const next = Math.max(1, Math.min(qty, MAX_QTY, Math.max(product.stock, 1)));
  const user = req.session.user;
  if (user) {
    return query('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', [next, user.id, productId]);
  }
  req.session.cart = { ...guestCart(req), [productId]: next };
  return null;
};

const merge = async (userId, cart) => {
  const ids = Object.keys(cart).map(Number);
  if (!ids.length) return;
  const products = await query("SELECT id, stock FROM products WHERE id IN (?) AND status = 'active'", [ids]);
  for (const product of products) {
    const rows = await query('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, product.id]);
    const next = Math.min((rows[0] ? rows[0].quantity : 0) + cart[product.id], MAX_QTY, product.stock);
    if (next > 0) {
      await query(
        `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [userId, product.id, next]
      );
    }
  }
};

const count = async (req) => {
  const user = req.session.user;
  if (user) {
    const [row] = await query('SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE user_id = ?', [user.id]);
    return Number(row.n);
  }
  return Object.values(guestCart(req)).reduce((sum, qty) => sum + Number(qty), 0);
};

const refreshCounts = async (req) => {
  const user = req.session.user;
  const cartCount = await count(req);
  const wishCount = user && user.role === 'customer' ? await Wishlist.count(user.id) : 0;
  req.session.cartCount = cartCount;
  req.session.wishCount = wishCount;
  return { cartCount, wishCount };
};

const evaluateCoupon = async (code, subtotal, userId) => {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const fail = (message) => ({ ok: false, code: clean, message, discount: 0 });

  const [coupon] = await query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [clean]);
  if (!coupon || !coupon.is_active) return fail('This coupon code is not valid.');
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return fail('This coupon has expired.');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return fail('This coupon has reached its usage limit.');
  if (subtotal < Number(coupon.min_order)) return fail(`Spend ${money(coupon.min_order)} or more to use ${coupon.code}.`);

  if (userId) {
    const used = await query(
      "SELECT 1 FROM orders WHERE user_id = ? AND coupon_code = ? AND status <> 'cancelled' LIMIT 1",
      [userId, coupon.code]
    );
    if (used.length) return fail('You have already used this coupon.');
  }

  let discount = coupon.type === 'percent' ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = round2(Math.min(discount, subtotal));
  return { ok: true, code: coupon.code, discount, message: `${coupon.code} applied. You save ${money(discount)}.` };
};

const totals = (items, coupon) => {
  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = coupon && coupon.ok ? coupon.discount : 0;
  const afterDiscount = round2(subtotal - discount);
  const shipping = !items.length || afterDiscount >= site.shipping.freeAbove ? 0 : site.shipping.flatFee;
  return {
    subtotal,
    discount,
    shipping,
    tax: round2((afterDiscount * site.gstRate) / (100 + site.gstRate)),
    total: round2(afterDiscount + shipping),
    freeShipGap: Math.max(0, round2(site.shipping.freeAbove - afterDiscount)),
    count: items.reduce((sum, item) => sum + item.quantity, 0)
  };
};

module.exports = {
  MAX_QTY,
  round2,
  load,
  add,
  remove,
  setQty,
  merge,
  count,
  refreshCounts,
  evaluateCoupon,
  totals
};