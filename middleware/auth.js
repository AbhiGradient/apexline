const requireLogin = (req, res, next, as = '') => {
  if (req.session.user) return next();
  req.flash('info', 'Please sign in to continue.');
  const target = req.method === 'GET' ? req.originalUrl : '/';
  res.redirect(`/login?next=${encodeURIComponent(target)}${as ? `&as=${as}` : ''}`);
};

const requireRole = (...roles) => (req, res, next) => {
  const user = req.session.user;
  if (!user) return requireLogin(req, res, next, roles.length === 1 ? roles[0] : '');
  if (!roles.includes(user.role)) {
    const err = new Error('You do not have permission to view this page.');
    err.status = 403;
    return next(err);
  }
  next();
};

const requireGuest = (req, res, next) => {
  if (!req.session.user) return next();
  const home = { admin: '/admin', seller: '/seller' }[req.session.user.role] || '/account';
  res.redirect(home);
};

const safeNext = (value, fallback = '/') =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;

module.exports = { requireLogin, requireRole, requireGuest, safeNext };