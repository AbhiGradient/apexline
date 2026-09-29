const router = require('express').Router();
const api = require('../controllers/apiController');

router.get('/api/csrf', api.csrf);
router.get('/api/suggest', api.suggest);

module.exports = router;