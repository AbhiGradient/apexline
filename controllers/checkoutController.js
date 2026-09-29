const Cart = require('../models/cart');
const Address = require('../models/address');
const Order = require('../models/order');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const priv = (title) => ({ title, noindex: true });

const METHODS = [
  ['cod', 'Cash on delivery', 'Pay when your order arrives.'],
  ['upi', 'UPI', 'Pay with any UPI app.'],
  ['card', 'Credit or debit card', 'Visa, Mastercard and RuPay.'],
  ['netbanking', 'Net banking', 'All major Indian banks.']
];

const index = wrap(async (req, res) => {
  const userId = req.session.user.id;
  const items = await Cart.load(req);
  if (!items.length) {
    req.flash('info', 'Your cart is empty.');
    return res.redirect('/cart');
  }
  const unavailable = items.find((item) => !item.inStock);
  if (unavailable) {
    req.flash('error', `${unavailable.name} is out of stock. Please remove it to continue.`);
    return res.redirect('/cart');
  }

  const addresses = await Address.list(userId);
  if (!addresses.length) {
    req.flash('info', 'Add a delivery address to continue.');
    return res.redirect('/account/addresses/new?next=/checkout');
  }

  const subtotal = Cart.round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const coupon = req.session.coupon ? await Cart.evaluateCoupon(req.session.coupon, subtotal, userId) : null;
  if (coupon && !coupon.ok) delete req.session.coupon;

  const wanted = parseInt(req.query.address, 10);
  const selected = addresses.find((a) => a.id === wanted) || addresses.find((a) => a.is_default) || addresses[0];

  return res.render('pages/checkout', {
    seo: priv('Checkout'),
    items,
    addresses,
    selected,
    coupon: coupon && coupon.ok ? coupon : null,
    t: Cart.totals(items, coupon),
    methods: METHODS
  });
});

const place = wrap(async (req, res) => {
  const userId = req.session.user.id;
  const address = await Address.find(userId, parseInt(req.body.address_id, 10));
  const method = METHODS.find(([key]) => key === req.body.payment_method);

  if (!address || !method) {
    req.flash('error', 'Choose a delivery address and a payment method.');
    return res.redirect('/checkout');
  }

  try {
    const orderNumber = await Order.place({
      userId,
      address,
      paymentMethod: method[0],
      couponCode: req.session.coupon || null
    });
    delete req.session.coupon;
    await Cart.refreshCounts(req);
    return res.redirect(`/checkout/success/${encodeURIComponent(orderNumber)}`);
  } catch (err) {
    if (!err.user) throw err;
    req.flash('error', err.message);
    return res.redirect('/cart');
  }
});

const success = wrap(async (req, res, next) => {
  const order = await Order.findForUser(req.session.user.id, req.params.orderNumber);
  if (!order) return next();
  return res.render('pages/order-success', { seo: priv('Order placed'), order });
});

module.exports = { index, place, success };