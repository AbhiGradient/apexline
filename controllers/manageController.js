const Product = require('../models/manageProduct');
const Orders = require('../models/manageOrder');
const { clearSitemapCache } = require('./seoController');
const { respond } = require('../utils/respond');
const { makeLink } = require('../utils/links');
const v = require('../utils/validate');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isAdmin = (req) => req.session.user.role === 'admin';
const baseOf = (req) => (isAdmin(req) ? '/admin' : '/seller');
const scopeOf = (req) => (isAdmin(req) ? null : req.seller.id);
const priv = (title) => ({ title, noindex: true });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const toId = (value) => parseInt(value, 10) || 0;
const round2 = (n) => Math.round(n * 100) / 100;

const STATUSES = ['active', 'draft', 'archived'];
const IMAGE_FILE = /^[\w][\w.-]*\.(jpe?g|png|webp|avif|gif|svg)$/i;
const IMAGE_URL = /^https:\/\/\S+$/i;
const validImage = (value) => value.length <= 255 && (IMAGE_FILE.test(value) || IMAGE_URL.test(value));

const blank = {
  name: '', category_id: '', brand_id: '', sku: '', short_description: '', description: '', price: '',
  compare_price: '', stock: 0, image: '', keywords: '', status: 'active', is_featured: 0, meta_title: '', meta_description: ''
};

const bodyToForm = (b) => ({
  name: b.name || '', category_id: b.category_id || '', brand_id: b.brand_id || '', sku: b.sku || '',
  short_description: b.short_description || '', description: b.description || '', price: b.price || '',
  compare_price: b.compare_price || '', stock: b.stock || 0, image: b.image || '', keywords: b.keywords || '',
  status: STATUSES.includes(b.status) ? b.status : 'active', is_featured: b.is_featured === '1' ? 1 : 0,
  meta_title: b.meta_title || '', meta_description: b.meta_description || ''
});

const renderForm = async (req, res, { mode, p, images = '', specs = '', fitment = [], errors = [], status = 200, sellerId = '' }) => {
  const options = await Product.formOptions(isAdmin(req));
  res.status(status).render('manage/product-form', {
    seo: priv(mode === 'new' ? 'Add product' : 'Edit product'),
    base: baseOf(req),
    admin: isAdmin(req),
    mode,
    p,
    images,
    specs,
    fitment,
    errors,
    sellerId,
    ...options
  });
};

const parseProduct = async (req, existing) => {
  const b = req.body;
  const admin = isAdmin(req);
  const errors = [];
  const compareRaw = String(b.compare_price ?? '').trim();

  const d = {
    name: v.text(b.name, 200),
    category_id: toId(b.category_id),
    brand_id: toId(b.brand_id) || null,
    sku: String(b.sku || '').trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 40),
    short_description: v.text(b.short_description, 300),
    description: v.block(b.description, 5000),
    price: round2(Number(b.price)),
    compare_price: compareRaw === '' ? null : round2(Number(compareRaw)),
    stock: Number(b.stock),
    image: String(b.image || '').trim() || null,
    keywords: v.text(b.keywords, 400) || null,
    status: STATUSES.includes(b.status) ? b.status : 'draft',
    is_featured: admin ? (b.is_featured === '1' ? 1 : 0) : existing ? existing.is_featured : 0,
    meta_title: v.text(b.meta_title, 160) || null,
    meta_description: v.text(b.meta_description, 300) || null
  };

  if (d.name.length < 3) errors.push('Enter a product name of at least 3 characters.');
  if (!(await Product.categoryExists(d.category_id))) errors.push('Choose a category.');
  if (d.brand_id && !(await Product.brandExists(d.brand_id))) errors.push('That brand does not exist.');
  if (!(d.price > 0 && d.price <= 10000000)) errors.push('Enter a price between 1 and 1,00,00,000.');
  if (d.compare_price !== null && !(Number.isFinite(d.compare_price) && d.compare_price > d.price)) {
    errors.push('MRP must be higher than the selling price, or left empty.');
  }
  if (!(Number.isInteger(d.stock) && d.stock >= 0 && d.stock <= 100000)) errors.push('Stock must be a whole number from 0 to 100000.');
  if (d.short_description.length < 10) errors.push('Write a short description of at least 10 characters.');
  if (d.description.length < 20) errors.push('Write a full description of at least 20 characters.');
  if (d.image && !validImage(d.image)) errors.push('Main image must be a filename like part.jpg or a full https:// URL.');

  const images = String(b.images || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (images.length > 8) errors.push('Add at most 8 extra images.');
  images.forEach((img) => {
    if (!validImage(img)) errors.push(`Extra image "${img.slice(0, 40)}" must be a filename like part.jpg or an https:// URL.`);
  });

  const specs = [];
  String(b.specs || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const at = line.indexOf(':');
    const key = at > 0 ? line.slice(0, at).trim() : '';
    const value = at > 0 ? line.slice(at + 1).trim() : '';
    if (!key || !value || key.length > 80 || value.length > 200) {
      errors.push(`Specification "${line.slice(0, 40)}" must look like Material: Stainless steel.`);
    } else {
      specs.push([key, value]);
    }
  });
  if (specs.length > 20) errors.push('Add at most 20 specifications.');

  const fitment = await Product.validVehicleIds(
    [].concat(b.vehicles || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  );

  if (!d.sku) d.sku = `APX-${Date.now().toString(36).toUpperCase()}`;
  if (await Product.skuTaken(d.sku, existing ? existing.id : 0)) errors.push(`SKU ${d.sku} is already used by another product.`);

  return { d, images, specs, fitment, errors };
};

const sellerDashboard = wrap(async (req, res) => {
  const id = req.seller.id;
  const [stats, lowStock, top, recent] = await Promise.all([
    Product.sellerStats(id),
    Product.lowStock(id),
    Product.topProducts(id),
    Orders.sellerItems(id, 'all', 1, 6)
  ]);
  res.render('seller/dashboard', { seo: priv('Seller Dashboard'), stats, lowStock, top, recent: recent.items });
});

const productList = wrap(async (req, res) => {
  const admin = isAdmin(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filters = {
    sellerId: admin ? toId(req.query.seller) || null : req.seller.id,
    status: STATUSES.includes(req.query.status) ? req.query.status : '',
    q: String(req.query.q || '').trim().slice(0, 80)
  };
  const [result, sellers] = await Promise.all([Product.list(filters, page), admin ? Product.allSellers() : []]);
  res.render('manage/products', {
    seo: priv('Products'),
    base: baseOf(req),
    admin,
    sellers,
    filters: { ...filters, seller: filters.sellerId || '' },
    items: result.items,
    total: result.total,
    pages: result.pages,
    page: result.page,
    link: makeLink(`${baseOf(req)}/products`, { q: filters.q, status: filters.status, seller: admin ? filters.sellerId : '' })
  });
});

const productNew = wrap((req, res) => renderForm(req, res, { mode: 'new', p: blank }));

const productCreate = wrap(async (req, res) => {
  const admin = isAdmin(req);
  const parsed = await parseProduct(req, null);
  const sellerId = admin ? toId(req.body.seller_id) : req.seller.id;
  if (admin && !(await Product.sellerActive(sellerId))) parsed.errors.push('Choose the seller who owns this product.');

  if (parsed.errors.length) {
    return renderForm(req, res, {
      mode: 'new',
      p: bodyToForm(req.body),
      images: req.body.images || '',
      specs: req.body.specs || '',
      fitment: parsed.fitment,
      errors: parsed.errors,
      status: 422,
      sellerId
    });
  }

  await Product.save({ sellerId, data: parsed.d, images: parsed.images, specs: parsed.specs, fitment: parsed.fitment });
  clearSitemapCache();
  req.flash(
    'success',
    parsed.d.status === 'active'
      ? 'Product published. It now appears in the store and in search.'
      : `Product saved as ${parsed.d.status}. It is not visible in the store yet.`
  );
  return res.redirect(`${baseOf(req)}/products`);
});

const productEdit = wrap(async (req, res) => {
  const found = await Product.find(toId(req.params.id), scopeOf(req));
  if (!found) throw notFound('Product not found.');
  await renderForm(req, res, {
    mode: 'edit',
    p: found,
    images: found.images.map((i) => i.image).join('\n'),
    specs: found.specs.map((s) => `${s.spec_key}: ${s.spec_value}`).join('\n'),
    fitment: found.fitment
  });
});

const productUpdate = wrap(async (req, res) => {
  const id = toId(req.params.id);
  const existing = await Product.find(id, scopeOf(req));
  if (!existing) throw notFound('Product not found.');
  const parsed = await parseProduct(req, existing);

  if (parsed.errors.length) {
    return renderForm(req, res, {
      mode: 'edit',
      p: { ...bodyToForm(req.body), id, slug: existing.slug, store_name: existing.store_name },
      images: req.body.images || '',
      specs: req.body.specs || '',
      fitment: parsed.fitment,
      errors: parsed.errors,
      status: 422
    });
  }

  await Product.save({ id, data: parsed.d, images: parsed.images, specs: parsed.specs, fitment: parsed.fitment });
  clearSitemapCache();
  req.flash('success', 'Product updated.');
  return res.redirect(`${baseOf(req)}/products`);
});

const productStock = wrap(async (req, res) => {
  const stock = parseInt(req.body.stock, 10);
  if (!(stock >= 0 && stock <= 100000)) return respond(req, res, { status: 422, ok: false, message: 'Enter a stock number from 0 to 100000.' });
  await Product.setStock(toId(req.params.id), scopeOf(req), stock);
  return respond(req, res, { message: 'Stock updated.' });
});

const productStatus = wrap(async (req, res) => {
  if (!STATUSES.includes(req.body.status)) return respond(req, res, { status: 422, ok: false, message: 'Choose a valid status.' });
  await Product.setStatus(toId(req.params.id), scopeOf(req), req.body.status);
  clearSitemapCache();
  return respond(req, res, { message: `Product moved to ${req.body.status}.` });
});

const sellerOrders = wrap(async (req, res) => {
  const tab = Object.keys(Orders.TABS).includes(req.query.tab) ? req.query.tab : 'open';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const [result, counts] = await Promise.all([Orders.sellerItems(req.seller.id, tab, page), Orders.sellerCounts(req.seller.id)]);
  res.render('manage/order-items', {
    seo: priv('Orders to Ship'),
    tab,
    counts,
    items: result.items,
    pages: result.pages,
    page: result.page,
    link: makeLink('/seller/orders', { tab: tab === 'open' ? '' : tab }),
    steps: (status) => Orders.nextSteps(status, false)
  });
});

const sellerItemStatus = wrap(async (req, res) => {
  try {
    await Orders.updateItem({ itemId: toId(req.params.id), status: String(req.body.status), sellerId: req.seller.id, admin: false });
    return respond(req, res, { message: 'Order item updated.' });
  } catch (err) {
    if (!err.user) throw err;
    return respond(req, res, { status: 409, ok: false, message: err.message });
  }
});

module.exports = {
  sellerDashboard,
  productList,
  productNew,
  productCreate,
  productEdit,
  productUpdate,
  productStock,
  productStatus,
  sellerOrders,
  sellerItemStatus
};