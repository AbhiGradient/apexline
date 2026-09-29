const User = require('../models/user');
const Address = require('../models/address');
const Order = require('../models/order');
const Product = require('../models/product');
const { query } = require('../config/db');
const { states } = require('../config/geo');
const { safeNext } = require('../middleware/auth');
const v = require('../utils/validate');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const HOME = { admin: '/admin', seller: '/seller' };
const priv = (title) => ({ title, noindex: true });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

const dashboard = wrap(async (req, res) => {
  const { id, role } = req.session.user;
  if (role !== 'customer') return res.redirect(HOME[role]);

  const [[stats], recent, recommended, viewed] = await Promise.all([
    query(
      `SELECT (SELECT COUNT(*) FROM orders WHERE user_id = ?) AS orders,
              (SELECT COUNT(*) FROM addresses WHERE user_id = ?) AS addresses,
              (SELECT COUNT(*) FROM wishlist_items WHERE user_id = ?) AS wishlist`,
      [id, id, id]
    ),
    Order.listForUser(id, 3),
    Product.recommendedForUser(id, 4),
    Product.recentlyViewed(id, 4)
  ]);
  await Product.markWished([...recommended, ...viewed], id);

  res.render('account/index', { seo: priv('Your Account'), stats, recent, recommended, viewed });
});

const profile = wrap(async (req, res) => {
  const account = await User.findById(req.session.user.id);
  res.render('account/profile', { seo: priv('Login & Security'), account, errors: [], pwErrors: [] });
});

const updateProfile = wrap(async (req, res) => {
  const name = v.text(req.body.name, 80);
  const phone = v.cleanPhone(req.body.phone);
  const errors = [];
  if (name.length < 2) errors.push('Enter your full name.');
  if (phone && !v.isPhone(phone)) errors.push('Enter a valid 10-digit mobile number.');

  if (errors.length) {
    const account = { ...(await User.findById(req.session.user.id)), name, phone };
    return res.status(422).render('account/profile', { seo: priv('Login & Security'), account, errors, pwErrors: [] });
  }
  await User.updateProfile(req.session.user.id, { name, phone });
  req.session.user.name = name;
  req.flash('success', 'Profile updated.');
  return res.redirect('/account/profile');
});

const changePassword = wrap(async (req, res) => {
  const { id, email } = req.session.user;
  const current = String(req.body.current || '');
  const password = String(req.body.password || '');
  const pwErrors = [];

  if (!(await User.verify(email, current))) pwErrors.push('Your current password is incorrect.');
  const problem = v.passwordError(password);
  if (problem) pwErrors.push(problem);
  if (password !== String(req.body.confirm || '')) pwErrors.push('New passwords do not match.');

  if (pwErrors.length) {
    const account = await User.findById(id);
    return res.status(422).render('account/profile', { seo: priv('Login & Security'), account, errors: [], pwErrors });
  }
  await User.changePassword(id, password);
  req.flash('success', 'Password changed.');
  return res.redirect('/account/profile');
});

const addressList = wrap(async (req, res) => {
  const addresses = await Address.list(req.session.user.id);
  res.render('account/addresses', { seo: priv('Your Addresses'), addresses });
});

const blankAddress = { label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', state: 'Maharashtra', postal_code: '', is_default: 0 };

const parseAddress = (body) => {
  const a = {
    label: v.text(body.label, 40) || 'Home',
    full_name: v.text(body.full_name, 120),
    phone: v.cleanPhone(body.phone),
    line1: v.text(body.line1, 190),
    line2: v.text(body.line2, 190) || null,
    city: v.text(body.city, 80),
    state: v.text(body.state, 80),
    postal_code: String(body.postal_code || '').replace(/\s/g, ''),
    country: 'India',
    is_default: body.is_default === '1'
  };
  const errors = [];
  if (a.full_name.length < 2) errors.push('Enter the recipient name.');
  if (!v.isPhone(a.phone)) errors.push('Enter a valid 10-digit mobile number.');
  if (a.line1.length < 3) errors.push('Enter the street address.');
  if (a.city.length < 2) errors.push('Enter the city.');
  if (!states.includes(a.state)) errors.push('Choose a state.');
  if (!v.isPincode(a.postal_code)) errors.push('Enter a valid 6-digit PIN code.');
  return { a, errors };
};

const addressForm = (res, { mode, a, errors = [], nextUrl = '', status = 200 }) =>
  res.status(status).render('account/address-form', {
    seo: priv(mode === 'new' ? 'Add Address' : 'Edit Address'),
    mode,
    a,
    errors,
    states,
    nextUrl,
    action: mode === 'new' ? '/account/addresses' : `/account/addresses/${a.id}`
  });

const addressNew = (req, res) => addressForm(res, { mode: 'new', a: blankAddress, nextUrl: safeNext(req.query.next, '') });

const addressCreate = wrap(async (req, res) => {
  const userId = req.session.user.id;
  const nextUrl = safeNext(req.body.next, '');
  const { a, errors } = parseAddress(req.body);
  if ((await Address.count(userId)) >= Address.MAX_ADDRESSES) errors.push(`You can save up to ${Address.MAX_ADDRESSES} addresses.`);
  if (errors.length) return addressForm(res, { mode: 'new', a, errors, nextUrl, status: 422 });

  await Address.create(userId, a);
  req.flash('success', 'Address saved.');
  return res.redirect(nextUrl || '/account/addresses');
});

const addressEdit = wrap(async (req, res) => {
  const a = await Address.find(req.session.user.id, parseInt(req.params.id, 10));
  if (!a) throw notFound('Address not found.');
  addressForm(res, { mode: 'edit', a });
});

const addressUpdate = wrap(async (req, res) => {
  const userId = req.session.user.id;
  const id = parseInt(req.params.id, 10);
  if (!(await Address.find(userId, id))) throw notFound('Address not found.');
  const { a, errors } = parseAddress(req.body);
  if (errors.length) return addressForm(res, { mode: 'edit', a: { ...a, id }, errors, status: 422 });

  await Address.update(userId, id, a);
  req.flash('success', 'Address updated.');
  return res.redirect('/account/addresses');
});

const addressDelete = wrap(async (req, res) => {
  await Address.remove(req.session.user.id, parseInt(req.params.id, 10));
  req.flash('success', 'Address removed.');
  res.redirect('/account/addresses');
});

const addressDefault = wrap(async (req, res) => {
  await Address.setDefault(req.session.user.id, parseInt(req.params.id, 10));
  req.flash('success', 'Default address updated.');
  res.redirect('/account/addresses');
});

const orders = wrap(async (req, res) => {
  const list = await Order.listForUser(req.session.user.id);
  res.render('account/orders', { seo: priv('Your Orders'), orders: list });
});

const order = wrap(async (req, res) => {
  const found = await Order.findForUser(req.session.user.id, req.params.orderNumber);
  if (!found) throw notFound('We could not find that order.');
  res.render('account/order', { seo: priv(`Order ${found.order_number}`), order: found });
});

const cancelOrder = wrap(async (req, res) => {
  try {
    await Order.cancel(req.session.user.id, req.params.orderNumber);
    req.flash('success', 'Your order has been cancelled.');
  } catch (err) {
    if (!err.user) throw err;
    req.flash('error', err.message);
  }
  res.redirect(`/account/orders/${encodeURIComponent(req.params.orderNumber)}`);
});

const review = wrap(async (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  const back = `/account/orders/${encodeURIComponent(req.params.orderNumber)}`;
  if (!(rating >= 1 && rating <= 5)) {
    req.flash('error', 'Choose a rating from 1 to 5.');
    return res.redirect(back);
  }
  try {
    await Order.addReview(req.session.user.id, req.params.orderNumber, parseInt(req.body.product_id, 10), {
      rating,
      title: v.text(req.body.title, 140),
      body: v.block(req.body.body, 2000)
    });
    req.flash('success', 'Thanks for your review.');
  } catch (err) {
    if (!err.user) throw err;
    req.flash('error', err.message);
  }
  return res.redirect(back);
});

module.exports = {
  dashboard,
  profile,
  updateProfile,
  changePassword,
  addressList,
  addressNew,
  addressCreate,
  addressEdit,
  addressUpdate,
  addressDelete,
  addressDefault,
  orders,
  order,
  cancelOrder,
  review
};