const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pages = require('../controllers/pagesController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please wait a few minutes and try again.'
});

router.get('/about', pages.staticPage('about'));
router.get('/shipping-policy', pages.staticPage('shipping'));
router.get('/return-policy', pages.staticPage('returns'));
router.get('/privacy-policy', pages.staticPage('privacy'));
router.get('/terms', pages.staticPage('terms'));

router.get('/support', pages.support);
router.get('/faq', pages.faq);

router.get('/contact', pages.contactPage);
router.post('/contact', limiter, pages.contactSend);
router.post('/newsletter', limiter, pages.newsletter);

router.get('/guides', pages.guideIndex);
router.get('/guides/:slug', pages.guide);

module.exports = router;