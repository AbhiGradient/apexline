const slugify = require('slugify');
const { pool, query } = require('../config/db');
const { pageInfo } = require('../utils/links');

const PAGE = 20;
const escapeLike = (v) => String(v).replace(/[\\%_]/g, '\\$&');
const like = (v) => `%${escapeLike(v)}%`;

const filterSql = ({ sellerId, status, q }) => {
  const where = ['1 = 1'];
  const params = [];
  if (sellerId) {
    where.push('p.seller_id = ?');
    params.push(sellerId);
  }
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(like(q), like(q));
  }
  return { sql: where.join(' AND '), params };
};

const list = async (filters, page = 1) => {
  const f = filterSql(filters);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM products p WHERE ${f.sql}`, f.params);
  const { pages, offset } = pageInfo(total, page, PAGE);
  const items = await query(
    `SELECT p.id, p.slug, p.name, p.sku, p.image, p.price, p.stock, p.status, p.is_featured,
       c.name AS category_name, s.store_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN sellers s ON s.id = p.seller_id
     WHERE ${f.sql}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...f.params, PAGE, offset]
  );
  return { items, total, pages, page };
};

const find = async (id, sellerId = null) => {
  const rows = await query(
    `SELECT p.*, s.store_name FROM products p JOIN sellers s ON s.id = p.seller_id
     WHERE p.id = ? ${sellerId ? 'AND p.seller_id = ?' : ''} LIMIT 1`,
    sellerId ? [id, sellerId] : [id]
  );
  if (!rows[0]) return null;
  const [images, specs, fit] = await Promise.all([
    query('SELECT image FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [id]),
    query('SELECT spec_key, spec_value FROM product_specs WHERE product_id = ? ORDER BY sort_order, id', [id]),
    query('SELECT vehicle_id FROM product_fitment WHERE product_id = ?', [id])
  ]);
  return { ...rows[0], images, specs, fitment: fit.map((f) => f.vehicle_id) };
};

const uniqueSlug = async (conn, name) => {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 190) || 'product';
  let slug = base;
  let n = 1;
  for (;;) {
    const [rows] = await conn.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
};

const save = async ({ id, sellerId, data, images, specs, fitment }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const cols = [
      data.category_id, data.brand_id, data.name, data.sku, data.short_description, data.description,
      data.price, data.compare_price, data.stock, data.image, data.keywords, data.status, data.is_featured,
      data.meta_title, data.meta_description
    ];
    let productId = id;

    if (id) {
      await conn.query(
        `UPDATE products SET category_id = ?, brand_id = ?, name = ?, sku = ?, short_description = ?, description = ?,
           price = ?, compare_price = ?, stock = ?, image = ?, keywords = ?, status = ?, is_featured = ?,
           meta_title = ?, meta_description = ? WHERE id = ?`,
        [...cols, id]
      );
    } else {
      const slug = await uniqueSlug(conn, data.name);
      const [result] = await conn.query(
        `INSERT INTO products (category_id, brand_id, name, sku, short_description, description, price, compare_price,
           stock, image, keywords, status, is_featured, meta_title, meta_description, seller_id, slug)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...cols, sellerId, slug]
      );
      productId = result.insertId;
    }

    await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    if (images.length) {
      await conn.query('INSERT INTO product_images (product_id, image, alt, sort_order) VALUES ?', [
        images.map((image, i) => [productId, image, data.name, i])
      ]);
    }
    await conn.query('DELETE FROM product_specs WHERE product_id = ?', [productId]);
    if (specs.length) {
      await conn.query('INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES ?', [
        specs.map(([key, value], i) => [productId, key, value, i])
      ]);
    }
    await conn.query('DELETE FROM product_fitment WHERE product_id = ?', [productId]);
    if (fitment.length) {
      await conn.query('INSERT INTO product_fitment (product_id, vehicle_id) VALUES ?', [
        fitment.map((vehicleId) => [productId, vehicleId])
      ]);
    }

    await conn.commit();
    return productId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const scoped = (sellerId) => (sellerId ? [' AND seller_id = ?', [sellerId]] : ['', []]);

const setStock = (id, sellerId, stock) => {
  const [sql, extra] = scoped(sellerId);
  return query(`UPDATE products SET stock = ? WHERE id = ?${sql}`, [stock, id, ...extra]);
};

const setStatus = (id, sellerId, status) => {
  const [sql, extra] = scoped(sellerId);
  return query(`UPDATE products SET status = ? WHERE id = ?${sql}`, [status, id, ...extra]);
};

const sellerStats = async (sellerId) => {
  const [[p], [o]] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'active'), 0) AS active,
         COALESCE(SUM(status = 'active' AND stock <= 5), 0) AS low
       FROM products WHERE seller_id = ? AND status <> 'archived'`,
      [sellerId]
    ),
    query(
      `SELECT COALESCE(SUM(status IN ('placed','confirmed','packed')), 0) AS to_ship,
         COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','returned') THEN line_total END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN line_total END), 0) AS delivered
       FROM order_items WHERE seller_id = ?`,
      [sellerId]
    )
  ]);
  return { total: Number(p.total), active: Number(p.active), low: Number(p.low), toShip: Number(o.to_ship), revenue: Number(o.revenue), delivered: Number(o.delivered) };
};

const lowStock = (sellerId = null, limit = 8) => {
  const [sql, extra] = scoped(sellerId);
  return query(
    `SELECT id, slug, name, stock FROM products WHERE status = 'active' AND stock <= 5${sql} ORDER BY stock, name LIMIT ?`,
    [...extra, limit]
  );
};

const topProducts = (sellerId, limit = 5) =>
  query(
    `SELECT id, slug, name, sold_count, price FROM products
     WHERE seller_id = ? AND status <> 'archived' ORDER BY sold_count DESC, id DESC LIMIT ?`,
    [sellerId, limit]
  );

const categoryTree = async () => {
  const rows = await query('SELECT id, parent_id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, name');
  return rows.filter((r) => !r.parent_id).map((top) => ({ ...top, children: rows.filter((c) => c.parent_id === top.id) }));
};

const formOptions = async (admin) => {
  const [categories, brands, vehicles, sellers] = await Promise.all([
    categoryTree(),
    query('SELECT id, name FROM brands ORDER BY name'),
    query('SELECT id, make, model FROM vehicles ORDER BY make, model'),
    admin ? query("SELECT id, store_name FROM sellers WHERE status = 'active' ORDER BY store_name") : []
  ]);
  return { categories, brands, vehicles, sellers };
};

const allSellers = () => query('SELECT id, store_name FROM sellers ORDER BY store_name');

const exists = async (sql, params) => (await query(sql, params)).length > 0;

const categoryExists = (id) => exists('SELECT 1 FROM categories WHERE id = ? AND is_active = 1', [id]);
const brandExists = (id) => exists('SELECT 1 FROM brands WHERE id = ?', [id]);
const sellerActive = (id) => exists("SELECT 1 FROM sellers WHERE id = ? AND status = 'active'", [id]);
const skuTaken = (sku, id) => exists('SELECT 1 FROM products WHERE sku = ? AND id <> ?', [sku, id || 0]);

const validVehicleIds = async (ids) =>
  ids.length ? (await query('SELECT id FROM vehicles WHERE id IN (?)', [ids])).map((r) => r.id) : [];

module.exports = {
  list,
  find,
  save,
  setStock,
  setStatus,
  sellerStats,
  lowStock,
  topProducts,
  formOptions,
  allSellers,
  categoryExists,
  brandExists,
  sellerActive,
  skuTaken,
  validVehicleIds
};