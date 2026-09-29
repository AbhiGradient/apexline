const manage = require('../controllers/manageController');

module.exports = (router, base) => {
  router.get(`${base}/products`, manage.productList);
  router.get(`${base}/products/new`, manage.productNew);
  router.post(`${base}/products`, manage.productCreate);
  router.get(`${base}/products/:id/edit`, manage.productEdit);
  router.post(`${base}/products/:id`, manage.productUpdate);
  router.post(`${base}/products/:id/stock`, manage.productStock);
  router.post(`${base}/products/:id/status`, manage.productStatus);
};