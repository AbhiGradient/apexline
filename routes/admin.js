const inbox = require('../controllers/inboxController');
const router = require('express').Router();
const admin = require('../controllers/adminController');
const crud = require('../controllers/crudController');
const productRoutes = require('./productRoutes');
const { requireRole } = require('../middleware/auth');

router.use('/admin', requireRole('admin'));

router.get('/admin', admin.dashboard);
productRoutes(router, '/admin');

router.get('/admin/orders', admin.orders);
router.get('/admin/orders/:orderNumber', admin.order);
router.post('/admin/orders/items/:id/status', admin.itemStatus);
router.post('/admin/orders/:orderNumber/payment', admin.orderPayment);

router.get('/admin/users', admin.users);
router.post('/admin/users/:id/toggle', admin.toggleUser);

router.get('/admin/sellers', admin.sellers);
router.post('/admin/sellers', admin.createSeller);
router.post('/admin/sellers/:id/status', admin.sellerStatus);

const entity = '/admin/:entity(categories|brands|vehicles|coupons)';
router.get(entity, crud.list);
router.post(entity, crud.create);
router.post(`${entity}/:id`, crud.update);
router.post(`${entity}/:id/delete`, crud.remove);

router.get('/admin/messages', inbox.messages);
router.post('/admin/messages/:id/read', inbox.toggleRead);
router.post('/admin/messages/:id/delete', inbox.removeMessage);
router.get('/admin/subscribers', inbox.subscribers);
router.post('/admin/subscribers/:id/delete', inbox.removeSubscriber);

module.exports = router;