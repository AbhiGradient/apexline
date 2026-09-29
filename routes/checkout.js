const router = require('express').Router();
const checkout = require('../controllers/checkoutController');
const { requireRole } = require('../middleware/auth');

const customer = requireRole('customer');

router.get('/checkout', customer, checkout.index);
router.post('/checkout/place', customer, checkout.place);
router.get('/checkout/success/:orderNumber', customer, checkout.success);

module.exports = router;