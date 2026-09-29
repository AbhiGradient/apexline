const { query } = require('../config/db');
const { respond } = require('../utils/respond');
const { makeLink, pageInfo } = require('../utils/links');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (value) => parseInt(value, 10) || 0;
const PAGE = 20;

const messages = wrap(async (req, res) => {
  const filter = req.query.filter === 'unread' ? 'unread' : 'all';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const where = filter === 'unread' ? 'WHERE is_read = 0' : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM contact_messages ${where}`);
  const { pages, offset } = pageInfo(total, page, PAGE);
  const items = await query(`SELECT * FROM contact_messages ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [PAGE, offset]);
  res.render('admin/messages', {
    seo: { title: 'Messages', noindex: true },
    items,
    total,
    pages,
    page,
    filter,
    link: makeLink('/admin/messages', { filter: filter === 'unread' ? 'unread' : '' })
  });
});

const toggleRead = wrap(async (req, res) => {
  await query('UPDATE contact_messages SET is_read = 1 - is_read WHERE id = ?', [toId(req.params.id)]);
  respond(req, res, { message: 'Message updated.' });
});

const removeMessage = wrap(async (req, res) => {
  await query('DELETE FROM contact_messages WHERE id = ?', [toId(req.params.id)]);
  respond(req, res, { message: 'Message deleted.' });
});

const subscribers = wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM newsletter_subscribers');
  const { pages, offset } = pageInfo(total, page, PAGE);
  const items = await query('SELECT id, email, created_at FROM newsletter_subscribers ORDER BY id DESC LIMIT ? OFFSET ?', [PAGE, offset]);
  res.render('admin/subscribers', {
    seo: { title: 'Subscribers', noindex: true },
    items,
    total,
    pages,
    page,
    link: makeLink('/admin/subscribers', {})
  });
});

const removeSubscriber = wrap(async (req, res) => {
  await query('DELETE FROM newsletter_subscribers WHERE id = ?', [toId(req.params.id)]);
  respond(req, res, { message: 'Subscriber removed.' });
});

module.exports = { messages, toggleRead, removeMessage, subscribers, removeSubscriber };