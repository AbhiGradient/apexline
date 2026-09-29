const slugify = require('slugify');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { pageInfo } = require('../utils/links');

const PAGE = 20;
const escapeLike = (v) => String(v).replace(/[\\%_]/g, '\\$&');
const like = (v) => `%${escapeLike(v)}%`;

const overview = async () => {
  const [[u], [o], [p], [m]] = await Promise.all([
    query(`SELECT COALESCE(SUM(role = 'customer'), 0) AS customers, COALESCE(SUM(role = 'seller'), 0) AS sellers FROM users`),
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status IN ('placed','confirmed','packed')), 0) AS pending,
         COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','returned') THEN total END), 0) AS revenue
       FROM orders`
    ),
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'active'), 0) AS active,
         COALESCE(SUM(status = 'active' AND stock <= 5), 0) AS low FROM products`
    ),
    query(
      `SELECT (SELECT COUNT(*) FROM contact_messages WHERE is_read = 0) AS unread,
              (SELECT COUNT(*) FROM newsletter_subscribers) AS subscribers`
    )
  ]);
  return {
    customers: Number(u.customers), sellers: Number(u.sellers),
    orders: Number(o.total), pending: Number(o.pending), revenue: Number(o.revenue),
    products: Number(p.total), active: Number(p.active), low: Number(p.low),
    unread: Number(m.unread), subscribers: Number(m.subscribers)
  };
};

const recentOrders = (limit = 6) =>
  query(
    `SELECT o.order_number, o.status, o.total, o.placed_at, o.ship_name
     FROM orders o ORDER BY o.placed_at DESC, o.id DESC LIMIT ?`,
    [limit]
  );

const searchInsights = async () => {
  const [top, empty] = await Promise.all([
    query(
      `SELECT term, COUNT(*) AS searches, MAX(results_count) AS results FROM search_logs
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY term ORDER BY searches DESC, term LIMIT 10`
    ),
    query(
      `SELECT term, COUNT(*) AS searches FROM search_logs
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY term HAVING MAX(results_count) = 0 ORDER BY searches DESC, term LIMIT 10`
    )
  ]);
  return { top, empty };
};

const users = async ({ role, q }, page = 1) => {
  const where = ['1 = 1'];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (q) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(like(q), like(q));
  }
  const sql = where.join(' AND ');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM users WHERE ${sql}`, params);
  const { pages, offset } = pageInfo(total, page, PAGE);
  const items = await query(
    `SELECT id, name, email, phone, role, is_active, created_at, last_login_at FROM users
     WHERE ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE, offset]
  );
  return { items, total, pages, page };
};

const toggleUser = async (id) => {
  const result = await query("UPDATE users SET is_active = 1 - is_active WHERE id = ? AND role <> 'admin'", [id]);
  return result.affectedRows > 0;
};

const sellers = () =>
  query(
    `SELECT s.id, s.store_name, s.slug, s.gstin, s.status, s.created_at, u.name, u.email, u.is_active,
       (SELECT COUNT(*) FROM products WHERE seller_id = s.id AND status <> 'archived') AS products,
       (SELECT COALESCE(SUM(line_total), 0) FROM order_items
          WHERE seller_id = s.id AND status NOT IN ('cancelled','returned')) AS sales
     FROM sellers s JOIN users u ON u.id = s.user_id ORDER BY s.id`
  );

const setSellerStatus = (id, status) => query('UPDATE sellers SET status = ? WHERE id = ?', [status, id]);

const createSeller = async ({ name, email, phone, password, storeName, gstin }) => {
  const hash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [user] = await conn.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'seller')",
      [name, email, phone || null, hash]
    );
    const base = slugify(storeName, { lower: true, strict: true }) || 'seller';
    let slug = base;
    let n = 1;
    for (;;) {
      const [rows] = await conn.query('SELECT id FROM sellers WHERE slug = ? LIMIT 1', [slug]);
      if (!rows.length) break;
      n += 1;
      slug = `${base}-${n}`;
    }
    await conn.query(
      "INSERT INTO sellers (user_id, store_name, slug, gstin, status) VALUES (?, ?, ?, ?, 'active')",
      [user.insertId, storeName, slug, gstin || null]
    );
    await conn.commit();
    return user.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { overview, recentOrders, searchInsights, users, toggleUser, sellers, setSellerStatus, createSeller };