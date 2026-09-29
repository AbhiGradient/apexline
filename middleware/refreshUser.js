const { query } = require('../config/db');

const INTERVAL = 5 * 60 * 1000;

module.exports = async (req, res, next) => {
  const user = req.session.user;
  if (!user || Date.now() - (req.session.checkedAt || 0) < INTERVAL) return next();
  try {
    const [row] = await query('SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1', [user.id]);
    if (!row || !row.is_active) {
      return req.session.destroy(() => {
        res.clearCookie('apx.sid');
        res.redirect('/login');
      });
    }
    req.session.user = { id: row.id, name: row.name, email: row.email, role: row.role };
    req.session.checkedAt = Date.now();
    return next();
  } catch (err) {
    return next(err);
  }
};