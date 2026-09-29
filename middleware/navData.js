const { query } = require('../config/db');

const TTL = 5 * 60 * 1000;
let cache = { at: 0, data: [] };

const navData = async (req, res, next) => {
  try {
    if (Date.now() - cache.at > TTL) {
      const rows = await query(
        'SELECT id, parent_id, name, slug FROM categories WHERE is_active = 1 ORDER BY sort_order, name'
      );
      const tops = rows
        .filter((r) => !r.parent_id)
        .map((top) => ({ ...top, children: rows.filter((c) => c.parent_id === top.id) }));
      cache = { at: Date.now(), data: tops };
    }
    res.locals.navCategories = cache.data;
    next();
  } catch (err) {
    next(err);
  }
};

navData.clear = () => {
  cache.at = 0;
};

module.exports = navData;