const wantsJson = (req) =>
  req.get('X-Requested-With') === 'fetch' || (req.get('Accept') || '').includes('application/json');

const backTo = (req) => {
  try {
    const url = new URL(req.get('Referer'));
    return url.host === req.get('Host') ? `${url.pathname}${url.search}` : '/';
  } catch (err) {
    return '/';
  }
};

const respond = (req, res, { status = 200, ok = true, message, redirect, data = {} }) => {
  if (wantsJson(req)) return res.status(status).json({ ok, message, ...data });
  if (message) req.flash(ok ? 'success' : 'error', message);
  return res.redirect(redirect || backTo(req));
};

module.exports = { respond, wantsJson };