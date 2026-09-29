const router = require('express').Router();
const shop = require('../controllers/shopController');

router.get('/', shop.home);
router.get('/shop', shop.shop);
router.get('/category/:slug', shop.category);
router.get('/product/:slug', shop.product);
router.get('/search', shop.search);
router.get('/deals', shop.deals);
router.get('/brands', shop.brands);
router.get('/brand/:slug', shop.brand);
router.get('/vehicles', shop.vehicles);
router.get('/vehicles/find', shop.vehicleFind);
router.get('/vehicle/:slug', shop.vehicle);

module.exports = router;