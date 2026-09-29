const { query } = require('../config/db');

const list = (userId) =>
  query(
    `SELECT p.id, p.slug, p.name, p.image, p.price, p.compare_price, p.stock, p.rating_avg, p.rating_count,
       b.name AS brand_name, 1 AS wished
     FROM wishlist_items w
     JOIN products p ON p.id = w.product_id AND p.status = 'active'
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId]
  );

const toggle = async (userId, productId) => {
  const rows = await query('SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
  if (rows.length) {
    await query('DELETE FROM wishlist_items WHERE id = ?', [rows[0].id]);
    return false;
  }
  await query('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [userId, productId]);
  return true;
};

const add = (userId, productId) =>
  query('INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [userId, productId]);

const count = async (userId) =>
  (await query('SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id = ?', [userId]))[0].n;

module.exports = { list, toggle, add, count };