const Cart = require('../models/cart');
const Wishlist = require('../models/wishlist');
const { query } = require('../config/db');
const { respond } = require('../utils/respond');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (value) => parseInt(value, 10) || 0;
const priv = (title) => ({ title, noindex: true });

const shopperOnly = (req, res, next) => {
  const user = req.session.user;
  if (user && user.role !== 'customer') {
    return respond(req, res, {
      status: 403,
      ok: false,
      message: 'Seller and admin accounts cannot shop. Please use a customer account.',
      redirect: user.role === 'admin' ? '/admin' : '/seller'
    });
  }
  return next();
};

const findAvailable = async (productId) =>
  (
    await query(
      `SELECT p.id, p.name, p.stock FROM products p
       JOIN sellers s ON s.id = p.seller_id AND s.status = 'active'
       WHERE p.id = ? AND p.status = 'active' LIMIT 1`,
      [productId]
    )
  )[0] || null;

const currentCoupon = async (req, items) => {
  const code = req.session.coupon;
  if (!code) return null;
  const subtotal = Cart.round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const coupon = await Cart.evaluateCoupon(code, subtotal, req.session.user && req.session.user.id);
  if (!coupon || !coupon.ok) delete req.session.coupon;
  return coupon;
};

const view = wrap(async (req, res) => {
  const items = await Cart.load(req);
  const coupon = await currentCoupon(req, items);
  await Cart.refreshCounts(req);
  res.render('pages/cart', { seo: priv('Shopping Cart'), items, coupon, t: Cart.totals(items, coupon) });
});

const add = wrap(async (req, res) => {
  const product = await findAvailable(toId(req.body.product_id));
  if (!product) return respond(req, res, { status: 404, ok: false, message: 'This product is unavailable.' });
  if (product.stock < 1) return respond(req, res, { status: 409, ok: false, message: 'Sorry, this item is out of stock.' });

  const qty = Math.max(1, Math.min(toId(req.body.quantity) || 1, Cart.MAX_QTY));
  await Cart.add(req, product, qty);
  const { cartCount } = await Cart.refreshCounts(req);

  if (req.body.buy_now === '1') {
    return respond(req, res, { redirect: '/checkout', data: { cartCount, redirect: '/checkout' } });
  }
  return respond(req, res, {
    message: `Added to cart. You have ${cartCount} item${cartCount === 1 ? '' : 's'} in your cart.`,
    data: { cartCount }
  });
});

const update = wrap(async (req, res) => {
  await Cart.setQty(req, toId(req.body.product_id), toId(req.body.quantity));
  await Cart.refreshCounts(req);
  respond(req, res, { redirect: '/cart' });
});

const remove = wrap(async (req, res) => {
  await Cart.remove(req, toId(req.body.product_id));
  await Cart.refreshCounts(req);
  respond(req, res, { message: 'Item removed from your cart.', redirect: '/cart' });
});

const saveForLater = wrap(async (req, res) => {
  const user = req.session.user;
  if (!user) return respond(req, res, { ok: false, message: 'Sign in to save items for later.', redirect: '/login?next=/cart' });
  const productId = toId(req.body.product_id);
  await Wishlist.add(user.id, productId);
  await Cart.remove(req, productId);
  await Cart.refreshCounts(req);
  return respond(req, res, { message: 'Moved to your wishlist.', redirect: '/cart' });
});

const applyCoupon = wrap(async (req, res) => {
  const items = await Cart.load(req);
  const subtotal = Cart.round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const coupon = await Cart.evaluateCoupon(req.body.code, subtotal, req.session.user && req.session.user.id);
  if (!coupon) return respond(req, res, { ok: false, message: 'Enter a coupon code.', redirect: '/cart' });
  if (coupon.ok) req.session.coupon = coupon.code;
  return respond(req, res, { ok: coupon.ok, message: coupon.message, redirect: '/cart' });
});

const removeCoupon = (req, res) => {
  delete req.session.coupon;
  respond(req, res, { message: 'Coupon removed.', redirect: '/cart' });
};

const wishlistPage = wrap(async (req, res) => {
  const items = await Wishlist.list(req.session.user.id);
  await Cart.refreshCounts(req);
  res.render('pages/wishlist', { seo: priv('Your Wishlist'), items });
});

const toggleWishlist = wrap(async (req, res) => {
  const user = req.session.user;
  if (!user) {
    return respond(req, res, {
      status: 401,
      ok: false,
      message: 'Sign in to save items to your wishlist.',
      redirect: '/login?next=/wishlist',
      data: { redirect: '/login?next=/wishlist' }
    });
  }
  const product = await findAvailable(toId(req.body.product_id));
  if (!product) return respond(req, res, { status: 404, ok: false, message: 'This product is unavailable.' });

  const active = await Wishlist.toggle(user.id, product.id);
  const { wishCount } = await Cart.refreshCounts(req);
  return respond(req, res, {
    message: active ? 'Saved to your wishlist.' : 'Removed from your wishlist.',
    data: { active, wishCount }
  });
});

module.exports = {
  shopperOnly,
  view,
  add,
  update,
  remove,
  saveForLater,
  applyCoupon,
  removeCoupon,
  wishlistPage,
  toggleWishlist
};