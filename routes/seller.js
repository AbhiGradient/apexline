const router = require('express').Router();
const manage = require('../controllers/manageController');
const productRoutes = require('./productRoutes');
const { requireRole } = require('../middleware/auth');
const sellerContext = require('../middleware/seller');

router.use('/seller', requireRole('seller'), sellerContext);

router.get('/seller', manage.sellerDashboard);
router.get('/seller/orders', manage.sellerOrders);
router.post('/seller/orders/items/:id/status', manage.sellerItemStatus);
productRoutes(router, '/seller');

module.exports = router;