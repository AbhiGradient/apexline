const slugify = require('slugify');
const { query } = require('../config/db');
const navData = require('../middleware/navData');
const { clearSitemapCache } = require('./seoController');
const v = require('../utils/validate');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toSlug = (value) => slugify(value, { lower: true, strict: true }).slice(0, 120);
const pad = (n) => String(n).padStart(2, '0');

const toInputDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parentOptions = async ({ editId }) => {
  const rows = await query(
    'SELECT id, name FROM categories WHERE parent_id IS NULL AND id <> ? ORDER BY sort_order, name',
    [editId || 0]
  );
  return [['', 'None (top level)'], ...rows.map((r) => [String(r.id), r.name])];
};

const defs = {
  categories: {
    title: 'Categories',
    singular: 'category',
    table: 'categories',
    slug: (values) => values.name,
    listSql: `SELECT c.*, p.name AS parent_name, (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
              FROM categories c LEFT JOIN categories p ON p.id = c.parent_id ORDER BY c.sort_order, c.name`,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'parent_id', label: 'Parent category', type: 'select', options: parentOptions },
      { name: 'description', label: 'Description', type: 'textarea', max: 300 },
      { name: 'sort_order', label: 'Sort order', type: 'number', int: true, default: 0 },
      { name: 'meta_title', label: 'SEO title', type: 'text', max: 160, hint: 'Shown in Google results. Leave empty to use the name.' },
      { name: 'meta_description', label: 'SEO description', type: 'textarea', max: 300 },
      { name: 'is_active', label: 'Visible in store', type: 'checkbox', default: 1 }
    ],
    columns: [['name', 'Name'], ['parent_name', 'Parent'], ['sort_order', 'Order', 'num'], ['product_count', 'Products', 'num'], ['is_active', 'Visible', 'bool']],
    validate: async (values, { editId }) => {
      if (editId && values.parent_id) {
        const [{ kids }] = await query('SELECT COUNT(*) AS kids FROM categories WHERE parent_id = ?', [editId]);
        if (kids) return ['A category that has sub-categories cannot become a sub-category.'];
      }
      return [];
    },
    canDelete: async (id) => {
      const [{ kids }] = await query('SELECT COUNT(*) AS kids FROM categories WHERE parent_id = ?', [id]);
      const [{ items }] = await query('SELECT COUNT(*) AS items FROM products WHERE category_id = ?', [id]);
      if (kids) return 'This category has sub-categories. Move or delete them first.';
      if (items) return 'Products still use this category. Move them first, or untick "Visible in store" to hide it.';
      return null;
    }
  },
  brands: {
    title: 'Brands',
    singular: 'brand',
    table: 'brands',
    slug: (values) => values.name,
    listSql: `SELECT b.*, (SELECT COUNT(*) FROM products WHERE brand_id = b.id) AS product_count FROM brands b ORDER BY b.name`,
    fields: [
      { name: 'name', label: 'Brand name', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Description', type: 'textarea', max: 300 }
    ],
    columns: [['name', 'Name'], ['slug', 'Slug'], ['product_count', 'Products', 'num']]
  },
  vehicles: {
    title: 'Vehicles',
    singular: 'vehicle',
    table: 'vehicles',
    slug: (values) => `${values.make} ${values.model}`,
    listSql: `SELECT v.*, (SELECT COUNT(*) FROM product_fitment WHERE vehicle_id = v.id) AS product_count FROM vehicles v ORDER BY v.make, v.model`,
    fields: [
      { name: 'make', label: 'Make', type: 'text', required: true, max: 60 },
      { name: 'model', label: 'Model', type: 'text', required: true, max: 80 },
      { name: 'year_from', label: 'Year from', type: 'number', int: true, required: true, min: 1980 },
      { name: 'year_to', label: 'Year to (optional)', type: 'number', int: true, nullable: true, min: 1980 }
    ],
    columns: [['make', 'Make'], ['model', 'Model'], ['year_from', 'From', 'num'], ['product_count', 'Matched parts', 'num']]
  },
  coupons: {
    title: 'Coupons',
    singular: 'coupon',
    table: 'coupons',
    listSql: 'SELECT * FROM coupons ORDER BY id DESC',
    fields: [
      { name: 'code', label: 'Code', type: 'text', required: true, max: 30, upper: true },
      { name: 'type', label: 'Type', type: 'select', required: true, options: async () => [['percent', 'Percent off'], ['flat', 'Flat amount off']] },
      { name: 'value', label: 'Value', type: 'number', required: true, min: 0.01, hint: 'Percent (1 to 100) or rupees, depending on type.' },
      { name: 'min_order', label: 'Minimum order (₹)', type: 'number', default: 0 },
      { name: 'max_discount', label: 'Maximum discount (₹)', type: 'number', nullable: true },
      { name: 'usage_limit', label: 'Total usage limit', type: 'number', int: true, nullable: true },
      { name: 'expires_at', label: 'Expires at', type: 'datetime' },
      { name: 'is_active', label: 'Active', type: 'checkbox', default: 1 }
    ],
    columns: [['code', 'Code'], ['type', 'Type'], ['value', 'Value', 'num'], ['min_order', 'Min order', 'money'], ['used_count', 'Used', 'num'], ['expires_at', 'Expires', 'date'], ['is_active', 'Active', 'bool']],
    validate: async (values) => (values.type === 'percent' && values.value > 100 ? ['A percent coupon cannot exceed 100.'] : [])
  }
};

const parseValues = async (def, body, ctx) => {
  const values = {};
  const errors = [];

  for (const f of def.fields) {
    const raw = body[f.name];
    const s = String(raw ?? '').trim();

    if (f.type === 'checkbox') {
      values[f.name] = raw === '1' ? 1 : 0;
    } else if (f.type === 'number') {
      if (s === '') {
        if (f.required) errors.push(`${f.label} is required.`);
        values[f.name] = f.nullable ? null : f.default ?? 0;
      } else {
        const n = Number(s);
        if (!Number.isFinite(n) || n < (f.min ?? 0)) errors.push(`${f.label} must be a valid number.`);
        else values[f.name] = f.int ? Math.floor(n) : Math.round(n * 100) / 100;
      }
    } else if (f.type === 'select') {
      const allowed = (await f.options(ctx)).map((o) => o[0]);
      if (!allowed.includes(s)) errors.push(`Choose a valid ${f.label.toLowerCase()}.`);
      else values[f.name] = s === '' ? null : s;
    } else if (f.type === 'datetime') {
      if (s === '') values[f.name] = null;
      else if (Number.isNaN(new Date(s).getTime())) errors.push(`${f.label} is not a valid date.`);
      else values[f.name] = `${s.replace('T', ' ')}:00`;
    } else {
      let text = f.type === 'textarea' ? v.block(s, f.max || 300) : v.text(s, f.max || 120);
      if (f.upper) text = text.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (f.required && !text) errors.push(`${f.label} is required.`);
      values[f.name] = text || null;
    }
  }

  if (def.validate && !errors.length) errors.push(...(await def.validate(values, ctx)));
  return { values, errors };
};

const uniqueSlug = async (def, source) => {
  const base = toSlug(source) || def.singular;
  let slug = base;
  let n = 1;
  for (;;) {
    const rows = await query(`SELECT id FROM ${def.table} WHERE slug = ? LIMIT 1`, [slug]);
    if (!rows.length) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
};

const blankValues = (def) =>
  Object.fromEntries(def.fields.map((f) => [f.name, f.default ?? '']));

const rowToValues = (def, row) =>
  Object.fromEntries(
    def.fields.map((f) => {
      const value = row[f.name];
      if (f.type === 'datetime') return [f.name, toInputDate(value)];
      if (f.type === 'checkbox') return [f.name, value ? 1 : 0];
      return [f.name, value === null || value === undefined ? '' : String(value)];
    })
  );

const render = async (req, res, { def, entity, editing = null, values, errors = [], status = 200 }) => {
  const rows = await query(def.listSql);
  const choices = {};
  for (const f of def.fields.filter((x) => x.type === 'select')) {
    choices[f.name] = await f.options({ editId: editing ? editing.id : 0 });
  }
  res.status(status).render('admin/crud', {
    seo: { title: def.title, noindex: true },
    def,
    entity,
    rows,
    editing,
    values,
    errors,
    choices
  });
};

const refreshCaches = () => {
  navData.clear();
  clearSitemapCache();
};

const notFound = () => Object.assign(new Error('Record not found.'), { status: 404 });

const list = wrap(async (req, res) => {
  const def = defs[req.params.entity];
  const editId = parseInt(req.query.edit, 10) || 0;
  let editing = null;
  if (editId) {
    [editing] = await query(`SELECT * FROM ${def.table} WHERE id = ? LIMIT 1`, [editId]);
    if (!editing) throw notFound();
  }
  await render(req, res, {
    def,
    entity: req.params.entity,
    editing,
    values: editing ? rowToValues(def, editing) : blankValues(def)
  });
});

const create = wrap(async (req, res) => {
  const entity = req.params.entity;
  const def = defs[entity];
  const { values, errors } = await parseValues(def, req.body, { editId: 0 });

  if (!errors.length) {
    try {
      const cols = Object.keys(values);
      const params = Object.values(values);
      if (def.slug) {
        cols.push('slug');
        params.push(await uniqueSlug(def, def.slug(values)));
      }
      await query(`INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      errors.push(`A ${def.singular} with that name or code already exists.`);
    }
  }

  if (errors.length) return render(req, res, { def, entity, values: req.body, errors, status: 422 });
  refreshCaches();
  req.flash('success', `${def.singular[0].toUpperCase()}${def.singular.slice(1)} added.`);
  return res.redirect(`/admin/${entity}`);
});

const update = wrap(async (req, res) => {
  const entity = req.params.entity;
  const def = defs[entity];
  const id = parseInt(req.params.id, 10) || 0;
  const [existing] = await query(`SELECT * FROM ${def.table} WHERE id = ? LIMIT 1`, [id]);
  if (!existing) throw notFound();

  const { values, errors } = await parseValues(def, req.body, { editId: id });

  if (!errors.length) {
    try {
      const cols = Object.keys(values);
      await query(`UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(values), id]);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      errors.push(`A ${def.singular} with that name or code already exists.`);
    }
  }

  if (errors.length) return render(req, res, { def, entity, editing: existing, values: req.body, errors, status: 422 });
  refreshCaches();
  req.flash('success', `${def.singular[0].toUpperCase()}${def.singular.slice(1)} updated.`);
  return res.redirect(`/admin/${entity}`);
});

const remove = wrap(async (req, res) => {
  const entity = req.params.entity;
  const def = defs[entity];
  const id = parseInt(req.params.id, 10) || 0;

  const blocked = def.canDelete ? await def.canDelete(id) : null;
  if (blocked) {
    req.flash('error', blocked);
    return res.redirect(`/admin/${entity}`);
  }
  try {
    await query(`DELETE FROM ${def.table} WHERE id = ?`, [id]);
    refreshCaches();
    req.flash('success', `${def.singular[0].toUpperCase()}${def.singular.slice(1)} deleted.`);
  } catch (err) {
    if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
    req.flash('error', `This ${def.singular} is still in use and cannot be deleted.`);
  }
  return res.redirect(`/admin/${entity}`);
});

module.exports = { list, create, update, remove };