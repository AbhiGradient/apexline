const normEmail = (value) => String(value || '').trim().toLowerCase();

const isEmail = (value) => value.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const cleanPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const isPhone = (value) => /^[6-9]\d{9}$/.test(value);

const isPincode = (value) => /^[1-9]\d{5}$/.test(value);

const text = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const block = (value, max) => String(value || '').trim().slice(0, max);

const passwordError = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password needs at least one letter and one number.';
  return null;
};

module.exports = { normEmail, isEmail, cleanPhone, isPhone, isPincode, text, block, passwordError };