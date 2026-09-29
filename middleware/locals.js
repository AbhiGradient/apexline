const crypto = require('crypto');
const site = require('../config/site');
const helpers = require('../utils/format');

module.exports = (req, res, next) => {
  res.locals.site = site;
  res.locals.h = helpers;
  res.locals.user = req.session.user || null;
  res.locals.cartCount = req.session.cartCount || 0;
  res.locals.wishCount = req.session.wishCount || 0;
  res.locals.flash = req.session.flash || null;
  res.locals.currentPath = req.path;
  res.locals.canonical = `${site.url}${req.path === '/' ? '' : req.path}`;
  res.locals.seo = {};
  res.locals.q = '';

  res.locals.csrfToken = () => {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
    return req.session.csrf;
  };

  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };

  if (req.session.flash) delete req.session.flash;
  next();
};