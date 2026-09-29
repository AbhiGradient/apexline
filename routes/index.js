const fs = require('fs');
const path = require('path');
const router = require('express').Router();

['seo', 'api', 'auth', 'account', 'cart', 'checkout', 'seller', 'admin', 'pages', 'shop'].forEach((name) => {
  const file = path.join(__dirname, `${name}.js`);
  if (fs.existsSync(file)) router.use(require(file));
});

module.exports = router;