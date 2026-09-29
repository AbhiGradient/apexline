const Data = require('../models/adminData');
const Orders = require('../models/manageOrder');
const Product = require('../models/manageProduct');
const { respond } = require('../utils/respond');
const { makeLink } = require('../utils/links');
const v = require('../utils/validate');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const priv = (title) => ({ title, noindex: true });
const toId = (value) => parseInt(value, 10) || 0;
const pageOf = (req) => Math.max(1, parseInt(req.query.page, 10) || 1);

const ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const dashboard = wrap(async (req, res) => {
  const [overview, recent, lowStock, searches] = await Promise.all([
    Data.overview(),
    Data.recentOrders(6),
    Product.lowStock(null, 8),
    Data.searchInsights()
  ]);
  res.render('admin/dashboard', { seo: priv('Admin Dashboard'), o: overview, recent, lowStock, searches });
});

const users = wrap(async (req, res) => {
  const role = ['customer', 'seller', 'admin'].includes(req.query.role) ? req.query.role : '';
  const q = String(req.query.q || '').trim().slice(0, 80);
  const result = await Data.users({ role, q }, pageOf(req));
  res.render('admin/users', {
    seo: priv('Users'),
    items: result.items,
    total: result.total,
    pages: result.pages,
    page: result.page,
    filters: { role, q },
    link: makeLink('/admin/users', { role, q })
  });
});

const toggleUser = wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (id === req.session.user.id) return respond(req, res, { status: 409, ok: false, message: 'You cannot deactivate your own account.' });
  const changed = await Data.toggleUser(id);
  return respond(req, res, changed
    ? { message: 'User status updated. Deactivated users are signed out within 5 minutes.' }
    : { status: 409, ok: false, message: 'The admin account cannot be deactivated.' });
});

const renderSellers = async (res, { values, errors = [], status = 200 }) =>
  res.status(status).render('admin/sellers', { seo: priv('Sellers'), sellers: await Data.sellers(), values, errors });

const blankSeller = { name: '', email: '', phone: '', store_name: '', gstin: '' };

const sellers = wrap((req, res) => renderSellers(res, { values: blankSeller }));

const createSeller = wrap(async (req, res) => {
  const values = {
    name: v.text(req.body.name, 80),
    email: v.normEmail(req.body.email),
    phone: v.cleanPhone(req.body.phone),
    store_name: v.text(req.body.store_name, 140),
    gstin: String(req.body.gstin || '').trim().toUpperCase()
  };
  const password = String(req.body.password || '');
  const errors = [];

  if (values.name.length < 2) errors.push('Enter the seller contact name.');
  if (values.store_name.length < 3) errors.push('Enter a store name of at least 3 characters.');
  if (!v.isEmail(values.email)) errors.push('Enter a valid email address.');
  if (values.phone && !v.isPhone(values.phone)) errors.push('Enter a valid 10-digit mobile number.');
  if (values.gstin && !/^[0-9A-Z]{15}$/.test(values.gstin)) errors.push('GSTIN must be 15 letters and digits, or left empty.');
  const problem = v.passwordError(password);
  if (problem) errors.push(problem);

  if (!errors.length) {
    try {
      await Data.createSeller({ name: values.name, email: values.email, phone: values.phone, password, storeName: values.store_name, gstin: values.gstin });
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      errors.push('An account with this email already exists.');
    }
  }

  if (errors.length) return renderSellers(res, { values, errors, status: 422 });
  req.flash('success', `Seller ${values.store_name} created. Share the email and password with them securely.`);
  return res.redirect('/admin/sellers');
});

const sellerStatus = wrap(async (req, res) => {
  const status = ['active', 'suspended'].includes(req.body.status) ? req.body.status : null;
  if (!status) return respond(req, res, { status: 422, ok: false, message: 'Choose a valid status.' });
  await Data.setSellerStatus(toId(req.params.id), status);
  return respond(req, res, { message: `Seller ${status === 'active' ? 'activated' : 'suspended'}. Suspended sellers' products are hidden from the store.` });
});

const orders = wrap(async (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
  const q = String(req.query.q || '').trim().slice(0, 80);
  const result = await Orders.adminList({ status, q }, pageOf(req));
  res.render('admin/orders', {
    seo: priv('All Orders'),
    items: result.items,
    total: result.total,
    pages: result.pages,
    page: result.page,
    filters: { status, q },
    statuses: ORDER_STATUSES,
    link: makeLink('/admin/orders', { status, q })
  });
});

const order = wrap(async (req, res, next) => {
  const found = await Orders.adminFind(req.params.orderNumber);
  if (!found) return next();
  return res.render('admin/order', {
    seo: priv(`Order ${found.order_number}`),
    order: found,
    paymentStatuses: PAYMENT_STATUSES,
    steps: (status) => Orders.nextSteps(status, true)
  });
});

const itemStatus = wrap(async (req, res) => {
  try {
    await Orders.updateItem({ itemId: toId(req.params.id), status: String(req.body.status), sellerId: null, admin: true });
    return respond(req, res, { message: 'Order item updated.' });
  } catch (err) {
    if (!err.user) throw err;
    return respond(req, res, { status: 409, ok: false, message: err.message });
  }
});

const orderPayment = wrap(async (req, res) => {
  if (!PAYMENT_STATUSES.includes(req.body.payment_status)) {
    return respond(req, res, { status: 422, ok: false, message: 'Choose a valid payment status.' });
  }
  await Orders.setPayment(req.params.orderNumber, req.body.payment_status);
  return respond(req, res, { message: 'Payment status updated.' });
});

module.exports = { dashboard, users, toggleUser, sellers, createSeller, sellerStatus, orders, order, itemStatus, orderPayment };