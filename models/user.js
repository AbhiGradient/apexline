const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const DUMMY_HASH = bcrypt.hashSync('apexline-timing-guard', 12);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const findByEmail = async (email) => (await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]))[0] || null;

const findById = async (id) => (await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]))[0] || null;

const create = async ({ name, email, phone, password }) => {
  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')",
    [name, email, phone || null, hash]
  );
  return result.insertId;
};

const verify = async (email, password) => {
  const user = await findByEmail(email);
  const match = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  return user && match && user.is_active ? user : null;
};

const touchLogin = (id) => query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);

const updateProfile = (id, { name, phone }) =>
  query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, id]);

const changePassword = async (id, password) =>
  query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 12), id]);

const createResetToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
  await query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE))',
    [userId, sha256(token)]
  );
  return token;
};

const findValidReset = async (token) =>
  (
    await query(
      `SELECT pr.id, pr.user_id, u.name, u.email
       FROM password_resets pr JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > NOW() AND u.is_active = 1
       LIMIT 1`,
      [sha256(token)]
    )
  )[0] || null;

const consumeReset = async (resetId, userId, password) => {
  await changePassword(userId, password);
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetId]);
};

module.exports = {
  findByEmail,
  findById,
  create,
  verify,
  touchLogin,
  updateProfile,
  changePassword,
  createResetToken,
  findValidReset,
  consumeReset
};