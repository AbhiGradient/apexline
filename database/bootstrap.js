const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const { baseConfig } = require('../config/db');
const site = require('../config/site');
const data = require('./seed-data');

const toSlug = (value) => slugify(value, { lower: true, strict: true });

async function connect() {
  try {
    return await mysql.createConnection({ ...baseConfig, multipleStatements: true });
  } catch (err) {
    if (err.code !== 'ER_BAD_DB_ERROR') throw err;
    const { database, ...rest } = baseConfig;
    const conn = await mysql.createConnection({ ...rest, multipleStatements: true });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${database}\``);
    return conn;
  }
}

async function seed(conn) {
  const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM users');
  if (total > 0) return false;

  const env = process.env;
  const [adminHash, sellerHash] = await Promise.all([
    bcrypt.hash(env.ADMIN_PASSWORD || 'Admin@12345', 12),
    bcrypt.hash(env.SELLER_PASSWORD || 'Seller@12345', 12)
  ]);

  const [adminRes] = await conn.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [env.ADMIN_NAME || 'Store Admin', (env.ADMIN_EMAIL || 'admin@apexline.local').toLowerCase(), adminHash, 'admin']
  );
  const [sellerUserRes] = await conn.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [env.SELLER_NAME || 'Apexline Racing Seller', (env.SELLER_EMAIL || 'seller@apexline.local').toLowerCase(), sellerHash, 'seller']
  );
  const [sellerRes] = await conn.query(
    'INSERT INTO sellers (user_id, store_name, slug, description, status) VALUES (?, ?, ?, ?, ?)',
    [
      sellerUserRes.insertId,
      'Apexline Racing',
      'apexline-racing',
      'Official Apexline storefront for performance parts, tested and supported by our build team.',
      'active'
    ]
  );
  const sellerId = sellerRes.insertId;

  const brandId = {};
  for (const b of data.brands) {
    const [r] = await conn.query('INSERT INTO brands (name, slug, description) VALUES (?, ?, ?)', [
      b.name,
      toSlug(b.name),
      b.description
    ]);
    brandId[b.name] = r.insertId;
  }

  const categoryId = {};
  for (const [i, c] of data.categories.entries()) {
    const [r] = await conn.query(
      'INSERT INTO categories (parent_id, name, slug, description, sort_order, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        c.parent ? categoryId[c.parent] : null,
        c.name,
        c.slug,
        c.description,
        i,
        `${c.name} | ${site.shortName}`,
        c.description
      ]
    );
    categoryId[c.slug] = r.insertId;
  }

  const vehicleId = {};
  for (const [make, model, from, to] of data.vehicles) {
    const slug = toSlug(`${make} ${model}`);
    const [r] = await conn.query(
      'INSERT INTO vehicles (make, model, year_from, year_to, slug) VALUES (?, ?, ?, ?, ?)',
      [make, model, from, to, slug]
    );
    vehicleId[slug] = r.insertId;
  }

  for (const [i, p] of data.products.entries()) {
    const description = `${p.short} ${data.brandBlurb[p.brand]}`;
    const [r] = await conn.query(
      `INSERT INTO products
        (seller_id, category_id, brand_id, name, slug, sku, short_description, description, price, compare_price,
         stock, image, keywords, is_featured, sold_count, meta_title, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        categoryId[p.category],
        brandId[p.brand],
        p.name,
        toSlug(p.name),
        `APX-${String(i + 1).padStart(4, '0')}`,
        p.short,
        description,
        p.price,
        p.compare,
        p.stock,
        p.image,
        p.keywords,
        p.featured ? 1 : 0,
        ((i * 37) % 180) + 20,
        `${p.name} | Buy Online in India | ${site.shortName}`,
        p.short
      ]
    );
    const productId = r.insertId;

    if (p.specs.length) {
      await conn.query('INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES ?', [
        p.specs.map(([k, v], n) => [productId, k, v, n])
      ]);
    }
    if (p.fit.length) {
      await conn.query('INSERT INTO product_fitment (product_id, vehicle_id) VALUES ?', [
        p.fit.map((slug) => [productId, vehicleId[slug]])
      ]);
    }
  }

  for (const c of data.coupons) {
    await conn.query(
      'INSERT INTO coupons (code, type, value, min_order, max_discount) VALUES (?, ?, ?, ?, ?)',
      [c.code, c.type, c.value, c.min_order, c.max_discount]
    );
  }

  return true;
}

async function bootstrap() {
  const conn = await connect();
  try {
    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    return { seeded: await seed(conn) };
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  require('dotenv').config();
  bootstrap()
    .then(({ seeded }) => {
      console.log(seeded ? 'Database created and seeded.' : 'Database ready, existing data kept.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database setup failed:', err.message);
      process.exit(1);
    });
}

module.exports = { bootstrap };