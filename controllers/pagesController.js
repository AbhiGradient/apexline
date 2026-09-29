const { query } = require('../config/db');
const site = require('../config/site');
const pages = require('../config/pages');
const guides = require('../config/guides');
const faqs = require('../config/faqs');
const Product = require('../models/product');
const seo = require('../utils/seo');
const v = require('../utils/validate');
const { respond } = require('../utils/respond');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const crumbs = (name, url) => [{ name: 'Home', url: '/' }, { name, url }];
const shopperId = (req) => (req.session.user && req.session.user.role === 'customer' ? req.session.user.id : null);

const staticPage = (key) => (req, res) => {
  const page = pages[key];
  const path = `/${page.slug}`;
  const breadcrumbs = crumbs(page.title, path);
  res.render('pages/static', {
    seo: {
      title: page.title,
      description: page.description,
      jsonLd: [
        seo.breadcrumbLd(breadcrumbs),
        {
          '@type': page.schema || 'WebPage',
          name: page.title,
          url: `${site.url}${path}`,
          description: page.description,
          dateModified: '2026-09-29',
          isPartOf: { '@id': `${site.url}/#website` }
        }
      ]
    },
    page,
    breadcrumbs
  });
};

const support = (req, res) => {
  const breadcrumbs = crumbs('Support', '/support');
  res.render('pages/support', {
    seo: {
      title: 'Help Centre and Support',
      description: `Get help with orders, delivery, returns and choosing the right part. Call ${site.contact.phone}.`,
      jsonLd: [seo.breadcrumbLd(breadcrumbs)]
    },
    breadcrumbs
  });
};

const faq = (req, res) => {
  const breadcrumbs = crumbs('FAQs', '/faq');
  res.render('pages/faq', {
    seo: {
      title: 'Frequently Asked Questions',
      description: 'Answers about fitment, warranty, legality, delivery, returns, GST invoices and payment methods for performance car parts.',
      jsonLd: [seo.breadcrumbLd(breadcrumbs), seo.faqLd(faqs)]
    },
    faqs,
    breadcrumbs
  });
};

const contactValues = (req) => {
  const u = req.session.user;
  return { name: u ? u.name : '', email: u ? u.email : '', subject: '', message: '' };
};

const renderContact = (req, res, { values, errors = [], status = 200 }) => {
  const breadcrumbs = crumbs('Contact', '/contact');
  res.status(status).render('pages/contact', {
    seo: {
      title: 'Contact Us',
      description: `Contact ${site.name} for fitment advice, order help or seller applications. Call ${site.contact.phone}.`,
      jsonLd: [
        seo.breadcrumbLd(breadcrumbs),
        {
          '@type': 'ContactPage',
          name: `Contact ${site.name}`,
          url: `${site.url}/contact`,
          isPartOf: { '@id': `${site.url}/#website` }
        }
      ]
    },
    breadcrumbs,
    values,
    errors
  });
};

const contactPage = (req, res) => renderContact(req, res, { values: contactValues(req) });

const contactSend = wrap(async (req, res) => {
  const thanks = 'Thanks for getting in touch. Your message has reached our team and we will reply by email.';
  if (String(req.body.website || '').trim()) {
    req.flash('success', thanks);
    return res.redirect('/contact');
  }

  const values = {
    name: v.text(req.body.name, 120),
    email: v.normEmail(req.body.email),
    subject: v.text(req.body.subject, 160),
    message: v.block(req.body.message, 3000)
  };
  const errors = [];
  if (values.name.length < 2) errors.push('Enter your name.');
  if (!v.isEmail(values.email)) errors.push('Enter a valid email address.');
  if (values.message.length < 10) errors.push('Write a message of at least 10 characters.');
  if (errors.length) return renderContact(req, res, { values, errors, status: 422 });

  await query('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)', [
    values.name,
    values.email,
    values.subject || null,
    values.message
  ]);
  req.flash('success', thanks);
  return res.redirect('/contact');
});

const newsletter = wrap(async (req, res) => {
  const email = v.normEmail(req.body.email);
  if (!v.isEmail(email)) return respond(req, res, { status: 422, ok: false, message: 'Enter a valid email address.' });
  await query('INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)', [email]);
  return respond(req, res, { message: 'Thanks for subscribing. You are on the build list.', data: { reset: true } });
});

const guideIndex = (req, res) => {
  const breadcrumbs = crumbs('Guides', '/guides');
  res.render('pages/guides', {
    seo: {
      title: 'Performance Car Parts Buying Guides',
      description: 'Plain-English guides on air filters, cold air intakes, exhausts and suspension, written for Indian car owners.',
      jsonLd: [seo.breadcrumbLd(breadcrumbs), seo.itemListLd('Buying guides', guides.map((g) => ({ slug: `../guides/${g.slug}`, name: g.title })))]
    },
    guides,
    breadcrumbs
  });
};

const guide = wrap(async (req, res, next) => {
  const g = guides.find((x) => x.slug === req.params.slug);
  if (!g) return next();

  const uid = shopperId(req);
  const products = await Product.select({ q: g.productQuery, sort: 'popular' }, 4);
  await Product.markWished(products, uid);

  const path = `/guides/${g.slug}`;
  const breadcrumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides' }, { name: g.title, url: path }];

  return res.render('pages/guide', {
    seo: {
      title: g.title,
      description: g.description,
      type: 'article',
      jsonLd: [
        seo.breadcrumbLd(breadcrumbs),
        {
          '@type': 'Article',
          headline: g.title,
          description: g.description,
          datePublished: g.published,
          dateModified: g.updated,
          image: `${site.url}/images/og-default.jpg`,
          mainEntityOfPage: `${site.url}${path}`,
          author: { '@type': 'Organization', name: site.name, url: site.url },
          publisher: { '@id': `${site.url}/#organization` }
        }
      ]
    },
    g,
    products,
    others: guides.filter((x) => x.slug !== g.slug).slice(0, 3),
    breadcrumbs
  });
});

module.exports = { staticPage, support, faq, contactPage, contactSend, newsletter, guideIndex, guide };