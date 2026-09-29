const User = require('../models/user');
const Cart = require('../models/cart');
const mailer = require('../utils/mailer');
const site = require('../config/site');
const v = require('../utils/validate');
const { safeNext } = require('../middleware/auth');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const TABS = ['customer', 'seller', 'admin'];
const HOME = { admin: '/admin', seller: '/seller' };
const pickTab = (value) => (TABS.includes(value) ? value : 'customer');
const seoPrivate = (title) => ({ title, noindex: true });

const startSession = (req, user) =>
  new Promise((resolve, reject) => {
    const guestCart = req.session.cart || {};
    req.session.regenerate(async (err) => {
      if (err) return reject(err);
      req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      try {
        if (user.role === 'customer') await Cart.merge(user.id, guestCart);
        await User.touchLogin(user.id);
        await Cart.refreshCounts(req);
        return req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      } catch (e) {
        return reject(e);
      }
    });
  });

const loginPage = (req, res) =>
  res.render('auth/login', {
    seo: seoPrivate('Sign in'),
    as: pickTab(req.query.as),
    nextUrl: safeNext(req.query.next, ''),
    email: '',
    error: ''
  });

const login = wrap(async (req, res) => {
  const as = pickTab(req.body.as);
  const email = v.normEmail(req.body.email);
  const password = String(req.body.password || '');
  const nextUrl = safeNext(req.body.next, '');
  const fail = (error) => res.status(401).render('auth/login', { seo: seoPrivate('Sign in'), as, nextUrl, email, error });

  if (!email || !password) return fail('Enter your email and password.');
  const user = await User.verify(email, password);
  if (!user) return fail('Incorrect email or password.');
  if (user.role !== as) return fail(`This is a ${user.role} account. Please use the ${user.role[0].toUpperCase()}${user.role.slice(1)} tab to sign in.`);

  await startSession(req, user);
  req.flash('success', `Welcome back, ${user.name.split(' ')[0]}.`);
  return res.redirect(HOME[user.role] || nextUrl || '/');
});

const registerPage = (req, res) =>
  res.render('auth/register', {
    seo: seoPrivate('Create your account'),
    errors: [],
    values: { name: '', email: '', phone: '' },
    nextUrl: safeNext(req.query.next, '')
  });

const register = wrap(async (req, res) => {
  const values = {
    name: v.text(req.body.name, 80),
    email: v.normEmail(req.body.email),
    phone: v.cleanPhone(req.body.phone)
  };
  const password = String(req.body.password || '');
  const nextUrl = safeNext(req.body.next, '');
  const errors = [];

  if (values.name.length < 2) errors.push('Enter your full name.');
  if (!v.isEmail(values.email)) errors.push('Enter a valid email address.');
  if (values.phone && !v.isPhone(values.phone)) errors.push('Enter a valid 10-digit mobile number.');
  const passwordProblem = v.passwordError(password);
  if (passwordProblem) errors.push(passwordProblem);
  if (password !== String(req.body.confirm || '')) errors.push('Passwords do not match.');

  const exists = 'An account with this email already exists. Try signing in instead.';
  if (!errors.length && (await User.findByEmail(values.email))) errors.push(exists);

  const rerender = () =>
    res.status(422).render('auth/register', { seo: seoPrivate('Create your account'), errors, values, nextUrl });
  if (errors.length) return rerender();

  let id;
  try {
    id = await User.create({ ...values, password });
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    errors.push(exists);
    return rerender();
  }

  await startSession(req, { id, name: values.name, email: values.email, role: 'customer' });
  req.flash('success', `Welcome to ${site.shortName}, ${values.name.split(' ')[0]}.`);
  return res.redirect(nextUrl || '/');
});

const forgotPage = (req, res) => res.render('auth/forgot', { seo: seoPrivate('Forgot password'), sent: false, email: '' });

const forgot = wrap(async (req, res) => {
  const email = v.normEmail(req.body.email);
  const user = v.isEmail(email) ? await User.findByEmail(email) : null;
  if (user && user.is_active) {
    const token = await User.createResetToken(user.id);
    await mailer
      .sendPasswordReset(user, `${site.url}/reset-password/${token}`)
      .catch((err) => console.error('Reset email failed:', err.message));
  }
  res.render('auth/forgot', { seo: seoPrivate('Forgot password'), sent: true, email });
});

const validToken = (token) => /^[a-f0-9]{64}$/.test(token);

const resetPage = wrap(async (req, res) => {
  const reset = validToken(req.params.token) ? await User.findValidReset(req.params.token) : null;
  res.status(reset ? 200 : 400).render('auth/reset', {
    seo: seoPrivate('Reset password'),
    valid: Boolean(reset),
    token: req.params.token,
    errors: []
  });
});

const reset = wrap(async (req, res) => {
  const found = validToken(req.params.token) ? await User.findValidReset(req.params.token) : null;
  const render = (status, errors) =>
    res.status(status).render('auth/reset', { seo: seoPrivate('Reset password'), valid: Boolean(found), token: req.params.token, errors });
  if (!found) return render(400, []);

  const password = String(req.body.password || '');
  const errors = [];
  const problem = v.passwordError(password);
  if (problem) errors.push(problem);
  if (password !== String(req.body.confirm || '')) errors.push('Passwords do not match.');
  if (errors.length) return render(422, errors);

  await User.consumeReset(found.id, found.user_id, password);
  req.flash('success', 'Password updated. You can sign in with your new password.');
  return res.redirect('/login');
});

const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('apx.sid');
    res.redirect('/');
  });
};

module.exports = { loginPage, login, registerPage, register, forgotPage, forgot, resetPage, reset, logout };