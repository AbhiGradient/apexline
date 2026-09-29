const { query } = require('../config/db');

const escapeLike = (v) => String(v).replace(/[\\%_]/g, '\\$&');
const like = (v) => `%${escapeLike(v)}%`;
const first = (rows) => rows[0] || null;

const categoryBySlug = async (slug) =>
  first(await query('SELECT * FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]));

const categoryParentById = async (id) =>
  first(await query('SELECT id, name, slug FROM categories WHERE id = ? LIMIT 1', [id]));

const categoryFamily = async (category) => {
  const children = await query(
    'SELECT id, name, slug FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order, name',
    [category.id]
  );
  return { ids: [category.id, ...children.map((c) => c.id)], children };
};

const categoryParent = async (category) =>
  category.parent_id
    ? first(await query('SELECT id, name, slug FROM categories WHERE id = ? LIMIT 1', [category.parent_id]))
    : null;

const topCategories = () =>
  query(
    `SELECT c.id, c.name, c.slug, c.description,
       (SELECT COUNT(*) FROM products p
          WHERE p.status = 'active'
            AND (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))) AS product_count,
       (SELECT p.image FROM products p
          WHERE p.status = 'active' AND p.image IS NOT NULL
            AND (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))
          ORDER BY p.sold_count DESC LIMIT 1) AS cover_image
     FROM categories c
     WHERE c.parent_id IS NULL AND c.is_active = 1
     ORDER BY c.sort_order, c.name`
  );

const allBrands = () =>
  query(
    `SELECT b.id, b.name, b.slug, b.description, COUNT(p.id) AS product_count
     FROM brands b
     LEFT JOIN products p ON p.brand_id = b.id AND p.status = 'active'
     GROUP BY b.id, b.name, b.slug, b.description
     ORDER BY b.name`
  );

const brandBySlug = async (slug) => first(await query('SELECT * FROM brands WHERE slug = ? LIMIT 1', [slug]));

const allVehicles = () =>
  query(
    `SELECT v.*,
       (SELECT COUNT(*) FROM product_fitment f
          JOIN products p ON p.id = f.product_id AND p.status = 'active'
          WHERE f.vehicle_id = v.id) AS product_count
     FROM vehicles v
     ORDER BY v.make, v.model`
  );

const vehicleBySlug = async (slug) => first(await query('SELECT * FROM vehicles WHERE slug = ? LIMIT 1', [slug]));

const searchCategories = (term, limit = 3) =>
  query('SELECT name, slug FROM categories WHERE is_active = 1 AND name LIKE ? ORDER BY name LIMIT ?', [like(term), limit]);

const searchBrands = (term, limit = 2) =>
  query('SELECT name, slug FROM brands WHERE name LIKE ? ORDER BY name LIMIT ?', [like(term), limit]);

const sitemapProducts = () =>
  query(
    `SELECT p.slug, p.name, p.image, p.updated_at
     FROM products p
     JOIN sellers s ON s.id = p.seller_id AND s.status = 'active'
     WHERE p.status = 'active'
     ORDER BY p.id`
  );

const sitemapCategories = () => query('SELECT slug, name FROM categories WHERE is_active = 1 ORDER BY sort_order, name');

module.exports = {
  categoryBySlug,
  categoryFamily,
  categoryParent,
  topCategories,
  allBrands,
  brandBySlug,
  allVehicles,
  vehicleBySlug,
  searchCategories,
  searchBrands,
  sitemapProducts,
  sitemapCategories
};