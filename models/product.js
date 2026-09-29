const { query } = require('../config/db');
const site = require('../config/site');

const LIST_COLUMNS = `p.id, p.slug, p.name, p.image, p.price, p.compare_price, p.stock, p.rating_avg, p.rating_count,
  p.sold_count, p.is_featured, p.short_description, p.created_at,
  b.name AS brand_name, b.slug AS brand_slug, c.name AS category_name, c.slug AS category_slug`;

const FROM = `FROM products p
  JOIN sellers s ON s.id = p.seller_id AND s.status = 'active'
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories pc ON pc.id = c.parent_id
  LEFT JOIN brands b ON b.id = p.brand_id`;

const HAY = `CONCAT_WS(' ', p.name, p.keywords, p.short_description, b.name, c.name, pc.name)`;
const HAY_COMPACT = `REPLACE(REPLACE(REPLACE(${HAY}, ' ', ''), '-', ''), ',', '')`;

const STOP_WORDS = new Set(['for', 'and', 'the', 'with', 'a', 'an', 'of', 'in', 'to', 'my']);

const escapeLike = (v) => String(v).replace(/[\\%_]/g, '\\$&');
const like = (v) => `%${escapeLike(v)}%`;

const tokenize = (text) => {
  const all = [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}-]+/u)
        .map((t) => t.replace(/^-+|-+$/g, ''))
        .filter(Boolean)
    )
  ];
  const meaningful = all.filter((t) => !STOP_WORDS.has(t));
  return (meaningful.length ? meaningful : all).slice(0, 6);
};

const singular = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

const tokenClause = (token) => {
  const parts = [];
  const params = [];
  [...new Set([token, singular(token)])].forEach((variant) => {
    parts.push(`${HAY} LIKE ?`);
    params.push(like(variant));
    const compact = variant.replace(/-/g, '');
    if (compact.length >= 5) {
      parts.push(`${HAY_COMPACT} LIKE ?`);
      params.push(like(compact));
    }
  });
  return { sql: `(${parts.join(' OR ')})`, params };
};

const buildWhere = (f = {}) => {
  const where = ["p.status = 'active'"];
  const params = [];

  if (f.categoryIds && f.categoryIds.length) {
    where.push('p.category_id IN (?)');
    params.push(f.categoryIds);
  }
  if (f.brandSlug) {
    where.push('b.slug = ?');
    params.push(f.brandSlug);
  }
  if (f.vehicleId) {
    where.push(
      `(EXISTS (SELECT 1 FROM product_fitment f1 WHERE f1.product_id = p.id AND f1.vehicle_id = ?)
        OR NOT EXISTS (SELECT 1 FROM product_fitment f2 WHERE f2.product_id = p.id))`
    );
    params.push(f.vehicleId);
  }
  if (f.min != null) {
    where.push('p.price >= ?');
    params.push(f.min);
  }
  if (f.max != null) {
    where.push('p.price <= ?');
    params.push(f.max);
  }
  if (f.inStock) where.push('p.stock > 0');
  if (f.onSale) where.push('p.compare_price IS NOT NULL AND p.compare_price > p.price');
  if (f.featured) where.push('p.is_featured = 1');

  tokenize(f.q).forEach((token) => {
    const clause = tokenClause(token);
    where.push(clause.sql);
    params.push(...clause.params);
  });

  return { sql: where.join(' AND '), params };
};

const orderBy = (f = {}) => {
  const sort = f.sort || 'relevance';
  if (sort === 'relevance' && f.q) {
    const phrase = String(f.q).toLowerCase();
    const compact = phrase.replace(/[\s-]+/g, '');
    return {
      sql: `(p.name LIKE ?) * 8 + (p.keywords LIKE ?) * 4 + (${HAY_COMPACT} LIKE ?) * 2 + p.is_featured DESC, p.sold_count DESC, p.id DESC`,
      params: [like(phrase), like(phrase), like(compact)]
    };
  }
  const map = {
    popular: 'p.sold_count DESC, p.id DESC',
    newest: 'p.created_at DESC, p.id DESC',
    price_asc: 'p.price ASC, p.id DESC',
    price_desc: 'p.price DESC, p.id DESC',
    rating: 'p.rating_avg DESC, p.rating_count DESC, p.sold_count DESC',
    discount: '(p.compare_price - p.price) / p.compare_price DESC, p.sold_count DESC'
  };
  return { sql: map[sort] || 'p.is_featured DESC, p.sold_count DESC, p.id DESC', params: [] };
};

const fetchRows = (filters, limit, offset = 0) => {
  const w = buildWhere(filters);
  const o = orderBy(filters);
  return query(
    `SELECT ${LIST_COLUMNS} ${FROM} WHERE ${w.sql} ORDER BY ${o.sql} LIMIT ? OFFSET ?`,
    [...w.params, ...o.params, limit, offset]
  );
};

const select = (filters, limit = 8) => fetchRows(filters, limit, 0);

const list = async (filters, { page = 1, pageSize = site.pageSize } = {}) => {
  const w = buildWhere(filters);
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${FROM} WHERE ${w.sql}`, w.params);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const items = await fetchRows(filters, pageSize, (page - 1) * pageSize);
  return { items, total, pages, page };
};

const facetBrands = (filters) => {
  const w = buildWhere({ ...filters, brandSlug: null });
  return query(
    `SELECT b.name, b.slug, COUNT(*) AS total ${FROM} WHERE ${w.sql} AND b.id IS NOT NULL
     GROUP BY b.id, b.name, b.slug ORDER BY b.name`,
    w.params
  );
};

const findBySlug = async (slug) => {
  const rows = await query(
    `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
       c.name AS category_name, c.slug AS category_slug, c.parent_id AS category_parent_id,
       s.store_name, s.slug AS seller_slug
     FROM products p
     JOIN sellers s ON s.id = p.seller_id AND s.status = 'active'
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.slug = ? AND p.status = 'active'
     LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
};

const details = async (productId) => {
  const [images, specs, vehicles, reviews] = await Promise.all([
    query('SELECT image, alt FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [productId]),
    query('SELECT spec_key, spec_value FROM product_specs WHERE product_id = ? ORDER BY sort_order, id', [productId]),
    query(
      `SELECT v.make, v.model, v.slug, v.year_from, v.year_to
       FROM product_fitment f JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.product_id = ? ORDER BY v.make, v.model`,
      [productId]
    ),
    query(
      `SELECT r.rating, r.title, r.body, r.created_at, u.name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 10`,
      [productId]
    )
  ]);
  return { images, specs, vehicles, reviews };
};

const related = (product, limit = 8) =>
  query(
    `SELECT ${LIST_COLUMNS} ${FROM}
     WHERE p.status = 'active' AND p.id <> ? AND COALESCE(c.parent_id, c.id) = ?
     ORDER BY (p.category_id = ?) DESC, p.sold_count DESC
     LIMIT ?`,
    [product.id, product.category_parent_id || product.category_id, product.category_id, limit]
  );

const recordView = async (productId, userId) => {
  await query('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [productId]);
  if (userId) {
    await query(
      `INSERT INTO recently_viewed (user_id, product_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP`,
      [userId, productId]
    );
  }
};

const recentlyViewed = (userId, limit = 6, excludeId = 0) =>
  query(
    `SELECT ${LIST_COLUMNS} ${FROM}
     JOIN recently_viewed rv ON rv.product_id = p.id AND rv.user_id = ?
     WHERE p.status = 'active' AND p.id <> ?
     ORDER BY rv.viewed_at DESC
     LIMIT ?`,
    [userId, excludeId, limit]
  );

const SEEN = `SELECT product_id FROM recently_viewed WHERE user_id = ?
  UNION SELECT product_id FROM wishlist_items WHERE user_id = ?
  UNION SELECT product_id FROM cart_items WHERE user_id = ?`;

const recommendedForUser = (userId, limit = 8) =>
  query(
    `SELECT ${LIST_COLUMNS} ${FROM}
     WHERE p.status = 'active' AND p.stock > 0
       AND COALESCE(c.parent_id, c.id) IN (
         SELECT COALESCE(c2.parent_id, c2.id)
         FROM (${SEEN}) seen
         JOIN products p2 ON p2.id = seen.product_id
         JOIN categories c2 ON c2.id = p2.category_id)
       AND p.id NOT IN (${SEEN})
     ORDER BY p.sold_count DESC, p.id DESC
     LIMIT ?`,
    [userId, userId, userId, userId, userId, userId, limit]
  );

const markWished = async (items, userId) => {
  items.forEach((p) => {
    p.wished = false;
  });
  if (!userId || !items.length) return items;
  const rows = await query('SELECT product_id FROM wishlist_items WHERE user_id = ? AND product_id IN (?)', [
    userId,
    items.map((p) => p.id)
  ]);
  const wished = new Set(rows.map((r) => r.product_id));
  items.forEach((p) => {
    p.wished = wished.has(p.id);
  });
  return items;
};

const suggest = (term, limit = 5) => {
  const w = buildWhere({ q: term });
  return query(
    `SELECT p.name, p.slug, c.name AS category_name ${FROM}
     WHERE ${w.sql}
     ORDER BY (p.name LIKE ?) DESC, p.sold_count DESC
     LIMIT ?`,
    [...w.params, like(term), limit]
  );
};

const logSearch = (term, resultsCount, userId) =>
  query('INSERT INTO search_logs (term, results_count, user_id) VALUES (?, ?, ?)', [
    term.slice(0, 120),
    resultsCount,
    userId || null
  ]);

module.exports = {
  tokenize,
  list,
  select,
  facetBrands,
  findBySlug,
  details,
  related,
  recordView,
  recentlyViewed,
  recommendedForUser,
  markWished,
  suggest,
  logSearch
};