const { query } = require('../config/db');

const MAX_ADDRESSES = 10;

const list = (userId) => query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]);

const find = async (userId, id) =>
  (await query('SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]))[0] || null;

const count = async (userId) => (await query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [userId]))[0].n;

const fields = (a) => [a.label, a.full_name, a.phone, a.line1, a.line2, a.city, a.state, a.postal_code, a.country];

const create = async (userId, a) => {
  const makeDefault = a.is_default || (await count(userId)) === 0;
  if (makeDefault) await query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
  const result = await query(
    `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state, postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, ...fields(a), makeDefault ? 1 : 0]
  );
  return result.insertId;
};

const update = async (userId, id, a) => {
  if (a.is_default) await query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
  await query(
    `UPDATE addresses SET label = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?,
       postal_code = ?, country = ?, is_default = IF(?, 1, is_default)
     WHERE id = ? AND user_id = ?`,
    [...fields(a), a.is_default ? 1 : 0, id, userId]
  );
};

const setDefault = async (userId, id) => {
  await query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
  await query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
};

const remove = async (userId, id) => {
  const address = await find(userId, id);
  if (!address) return;
  await query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
  if (address.is_default) {
    await query('UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  }
};

module.exports = { MAX_ADDRESSES, list, find, count, create, update, setDefault, remove };