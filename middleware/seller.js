const { query } = require('../config/db');

const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

module.exports = async (req, res, next) => {
  try {
    const [seller] = await query('SELECT * FROM sellers WHERE user_id = ? LIMIT 1', [req.session.user.id]);
    if (!seller) throw forbidden('No seller profile is linked to this account.');
    if (seller.status !== 'active') throw forbidden('Your seller account is not active. Please contact the store admin.');
    req.seller = seller;
    res.locals.seller = seller;
    next();
  } catch (err) {
    next(err);
  }
};