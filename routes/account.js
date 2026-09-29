const router = require('express').Router();
const account = require('../controllers/accountController');
const { requireLogin, requireRole } = require('../middleware/auth');

const customer = requireRole('customer');

router.use('/account', requireLogin);

router.get('/account', account.dashboard);
router.get('/account/profile', account.profile);
router.post('/account/profile', account.updateProfile);
router.post('/account/password', account.changePassword);

router.get('/account/addresses', customer, account.addressList);
router.get('/account/addresses/new', customer, account.addressNew);
router.post('/account/addresses', customer, account.addressCreate);
router.get('/account/addresses/:id/edit', customer, account.addressEdit);
router.post('/account/addresses/:id', customer, account.addressUpdate);
router.post('/account/addresses/:id/delete', customer, account.addressDelete);
router.post('/account/addresses/:id/default', customer, account.addressDefault);

router.get('/account/orders', customer, account.orders);
router.get('/account/orders/:orderNumber', customer, account.order);
router.post('/account/orders/:orderNumber/cancel', customer, account.cancelOrder);
router.post('/account/orders/:orderNumber/review', customer, account.review);

module.exports = router;