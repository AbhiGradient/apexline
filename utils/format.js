const site = require('../config/site');

const money = (value) =>
  new Intl.NumberFormat(site.currency.locale, {
    style: 'currency',
    currency: site.currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const imageUrl = (image) => {
  if (!image) return '/images/placeholder.svg';
  return /^https?:\/\//i.test(image) ? image : `/images/products/${image}`;
};

const discountPct = (price, compare) =>
  Number(compare) > Number(price) ? Math.round((1 - Number(price) / Number(compare)) * 100) : 0;

const truncate = (text = '', max = 155) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

const dateShort = (value) =>
  new Date(value).toLocaleDateString(site.currency.locale, { day: 'numeric', month: 'short', year: 'numeric' });

const statusLabel = (s) => String(s).replace(/_/g, ' ');

const statusTone = (s) =>
  ({ delivered: 'is-good', cancelled: 'is-bad', returned: 'is-bad', shipped: 'is-info', out_for_delivery: 'is-info' }[s] || 'is-warn');

module.exports = { money, imageUrl, discountPct, truncate, dateShort, statusLabel, statusTone };