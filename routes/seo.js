const router = require('express').Router();
const seo = require('../controllers/seoController');

router.get('/robots.txt', seo.robots);
router.get('/sitemap.xml', seo.sitemapXml);
router.get('/sitemap', seo.sitemapHtml);

module.exports = router;