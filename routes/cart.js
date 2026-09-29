const router = require('express').Router();
const cart = require('../controllers/cartController');
const { requireRole } = require('../middleware/auth');

router.get('/cart', cart.shopperOnly, cart.view);
router.post('/cart/add', cart.shopperOnly, cart.add);
router.post('/cart/update', cart.shopperOnly, cart.update);
router.post('/cart/remove', cart.shopperOnly, cart.remove);
router.post('/cart/save-for-later', cart.shopperOnly, cart.saveForLater);
router.post('/cart/coupon', cart.shopperOnly, cart.applyCoupon);
router.post('/cart/coupon/remove', cart.shopperOnly, cart.removeCoupon);

router.get('/wishlist', requireRole('customer'), cart.wishlistPage);
router.post('/wishlist/toggle', cart.toggleWishlist);

module.exports = router;