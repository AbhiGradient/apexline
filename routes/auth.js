const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const { requireGuest } = require('../middleware/auth');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts. Please wait a few minutes and try again.'
});

router.get('/login', requireGuest, auth.loginPage);
router.post('/login', limiter, requireGuest, auth.login);

router.get('/register', requireGuest, auth.registerPage);
router.post('/register', limiter, requireGuest, auth.register);

router.get('/forgot-password', requireGuest, auth.forgotPage);
router.post('/forgot-password', limiter, requireGuest, auth.forgot);

router.get('/reset-password/:token', auth.resetPage);
router.post('/reset-password/:token', limiter, auth.reset);

router.post('/logout', auth.logout);

module.exports = router;