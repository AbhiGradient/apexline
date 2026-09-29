const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const sent = Buffer.from(String((req.body && req.body._csrf) || req.get('x-csrf-token') || ''));
  const stored = Buffer.from(req.session.csrf || '');

  if (!stored.length || sent.length !== stored.length || !crypto.timingSafeEqual(sent, stored)) {
    const err = new Error('Your session expired. Please go back, refresh the page and try again.');
    err.status = 403;
    return next(err);
  }
  next();
};