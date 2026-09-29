const fs = require('fs');
const path = require('path');
const site = require('../config/site');
const Catalog = require('../models/catalog');
const h = require('../utils/format');

const STATIC_PATHS = [
  '/shop', '/deals', '/brands', '/vehicles', '/support', '/faq', '/about', '/contact',
  '/shipping-policy', '/return-policy', '/privacy-policy', '/terms', '/sitemap'
];

const PRODUCT_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
const TTL = 60 * 60 * 1000;
let xmlCache = { at: 0, body: '' };

const xmlEscape = (value) =>
  String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

const day = (value) => new Date(value).toISOString().slice(0, 10);

const entry = (loc, { lastmod, freq = 'weekly', priority = '0.5', image, title } = {}) =>
  `<url><loc>${xmlEscape(site.url + loc)}</loc>` +
  (lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : '') +
  `<changefreq>${freq}</changefreq><priority>${priority}</priority>` +
  (image
    ? `<image:image><image:loc>${xmlEscape(image)}</image:loc><image:title>${xmlEscape(title)}</image:title></image:image>`
    : '') +
  '</url>';

const sitemapImage = (image) => {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return fs.existsSync(path.join(PRODUCT_DIR, path.basename(image))) ? `${site.url}/images/products/${image}` : null;
};

const buildXml = async () => {
  const [categories, brands, vehicles, products] = await Promise.all([
    Catalog.sitemapCategories(),
    Catalog.allBrands(),
    Catalog.allVehicles(),
    Catalog.sitemapProducts()
  ]);

  const urls = [
    entry('/', { freq: 'daily', priority: '1.0' }),
    ...STATIC_PATHS.map((p) => entry(p, { priority: p === '/shop' || p === '/deals' ? '0.9' : '0.5' })),
    ...categories.map((c) => entry(`/category/${c.slug}`, { freq: 'daily', priority: '0.8' })),
    ...brands.map((b) => entry(`/brand/${b.slug}`, { priority: '0.6' })),
    ...vehicles.map((v) => entry(`/vehicle/${v.slug}`, { priority: '0.6' })),
    ...products.map((p) =>
      entry(`/product/${p.slug}`, { lastmod: p.updated_at, priority: '0.7', image: sitemapImage(p.image), title: p.name })
    )
  ];

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' +
    urls.join('') +
    '</urlset>'
  );
};

const robots = (req, res) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /account',
    'Disallow: /admin',
    'Disallow: /seller',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /wishlist',
    'Disallow: /search',
    'Disallow: /api/',
    '',
    `Sitemap: ${site.url}/sitemap.xml`
  ];
  res.type('text/plain').send(lines.join('\n'));
};

const sitemapXml = async (req, res, next) => {
  try {
    if (Date.now() - xmlCache.at > TTL) xmlCache = { at: Date.now(), body: await buildXml() };
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(xmlCache.body);
  } catch (err) {
    next(err);
  }
};

const sitemapHtml = async (req, res, next) => {
  try {
    const [brands, vehicles, products] = await Promise.all([
      Catalog.allBrands(),
      Catalog.allVehicles(),
      Catalog.sitemapProducts()
    ]);
    res.render('pages/sitemap', {
      seo: {
        title: 'Sitemap',
        description: `Every category, brand, vehicle and product page on ${site.name}.`
      },
      brands,
      vehicles,
      products,
      staticLinks: [
        ['Shop All', '/shop'], ['Deals', '/deals'], ['Brands', '/brands'], ['Shop by Vehicle', '/vehicles'],
        ['Support', '/support'], ['FAQs', '/faq'], ['About Us', '/about'], ['Contact', '/contact'],
        ['Shipping Policy', '/shipping-policy'], ['Returns and Refunds', '/return-policy'],
        ['Privacy Policy', '/privacy-policy'], ['Terms and Conditions', '/terms']
      ],
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Sitemap', url: '/sitemap' }]
    });
  } catch (err) {
    next(err);
  }
};

const clearSitemapCache = () => {
  xmlCache.at = 0;
};

module.exports = { robots, sitemapXml, sitemapHtml, clearSitemapCache };