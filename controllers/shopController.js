const Product = require('../models/product');
const Catalog = require('../models/catalog');
const site = require('../config/site');
const seo = require('../utils/seo');
const faqs = require('../config/faqs');
const h = require('../utils/format');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const shopperId = (req) => (req.session.user && req.session.user.role === 'customer' ? req.session.user.id : null);
const notFound = (message = 'This page could not be found.') => Object.assign(new Error(message), { status: 404 });

const SORTS = [
  ['relevance', 'Featured'],
  ['popular', 'Best selling'],
  ['newest', 'Newest'],
  ['discount', 'Biggest discount'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated']
];

const toNumber = (value) => {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseFilters = (req, defaultSort) => ({
  brand: String(req.query.brand || '').slice(0, 80),
  min: toNumber(req.query.min),
  max: toNumber(req.query.max),
  inStock: req.query.instock === '1',
  sort: SORTS.some(([key]) => key === req.query.sort) ? req.query.sort : defaultSort,
  requestedSort: SORTS.some(([key]) => key === req.query.sort) ? req.query.sort : '',
  page: Math.max(1, parseInt(req.query.page, 10) || 1)
});

const makeLink = (path, state) => (overrides = {}) => {
  const params = new URLSearchParams();
  Object.entries({ ...state, ...overrides }).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined && value !== false) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const pagePath = (path, page) => `${site.url}${path}${page > 1 ? `?page=${page}` : ''}`;

const renderListing = async (req, res, cfg) => {
  const f = parseFilters(req, cfg.defaultSort || 'relevance');
  const base = cfg.filters || {};
  const filters = {
    ...base,
    brandSlug: base.brandSlug || f.brand || null,
    min: f.min,
    max: f.max,
    inStock: f.inStock,
    sort: f.sort
  };

  const state = {
    ...(cfg.hidden || {}),
    brand: base.brandSlug ? '' : f.brand,
    min: f.min,
    max: f.max,
    instock: f.inStock ? '1' : '',
    sort: f.requestedSort
  };
  const link = makeLink(cfg.path, state);

  const [result, brands] = await Promise.all([
    Product.list(filters, { page: f.page }),
    Product.facetBrands(filters)
  ]);

  if (f.page > result.pages) return res.redirect(302, link({ page: result.pages > 1 ? result.pages : null }));

  const uid = shopperId(req);
  const fallback = result.total === 0 ? await Product.select({ sort: 'popular' }, 4) : [];
  await Promise.all([Product.markWished(result.items, uid), Product.markWished(fallback, uid)]);

  if (cfg.onResults) cfg.onResults(result.total, uid);

  const title = cfg.title + (result.page > 1 ? ` - Page ${result.page}` : '');
  const jsonLd = [
    seo.breadcrumbLd(cfg.breadcrumbs),
    seo.collectionLd(cfg.title, cfg.description, cfg.path),
    ...(result.items.length ? [seo.itemListLd(cfg.title, result.items)] : [])
  ];

  res.render('pages/listing', {
    seo: {
      title,
      description: cfg.description,
      keywords: cfg.keywords,
      canonical: pagePath(cfg.path, result.page),
      prev: result.page > 1 ? pagePath(cfg.path, result.page - 1) : null,
      next: result.page < result.pages ? pagePath(cfg.path, result.page + 1) : null,
      noindex: Boolean(cfg.noindex),
      image: result.items[0] ? h.imageUrl(result.items[0].image) : null,
      jsonLd
    },
    q: cfg.hidden && cfg.hidden.q ? cfg.hidden.q : '',
    heading: cfg.heading,
    intro: cfg.intro || '',
    children: cfg.children || [],
    breadcrumbs: cfg.breadcrumbs,
    items: result.items,
    total: result.total,
    pages: result.pages,
    page: result.page,
    link,
    pagePath: cfg.path,
    brands,
    lockBrand: Boolean(base.brandSlug),
    hidden: cfg.hidden || {},
    current: f,
    sortOptions: SORTS,
    fallback,
    isSearch: Boolean(cfg.isSearch),
    seoText: cfg.seoText || ''
  });
};

const home = wrap(async (req, res) => {
  const uid = shopperId(req);
  const [categories, deals, bestsellers, arrivals, featured, vehicles, brands, recommended] = await Promise.all([
    Catalog.topCategories(),
    Product.select({ onSale: true, sort: 'discount' }, 4),
    Product.select({ sort: 'popular' }, 8),
    Product.select({ sort: 'newest' }, 8),
    Product.select({ featured: true, sort: 'popular' }, 1),
    Catalog.allVehicles(),
    Catalog.allBrands(),
    uid ? Product.recommendedForUser(uid, 8) : []
  ]);

  await Promise.all([deals, bestsellers, arrivals, recommended].map((set) => Product.markWished(set, uid)));

  res.render('pages/home', {
    seo: {
      rawTitle: `${site.name} | Buy Performance Car Parts & Mods Online in India`,
      description:
        'Buy performance air filters, cold air intakes, exhausts, ECU tuners, coilovers, brake pads and alloy wheels online. Fitment support, GST invoice and 12-month warranty.',
      keywords:
        'performance car parts india, car modification parts online, air filter, cold air intake, cat back exhaust, ecu tuner, coilovers, brake pads, alloy wheels',
      image: bestsellers[0] ? h.imageUrl(bestsellers[0].image) : null,
      jsonLd: [seo.faqLd(faqs), seo.itemListLd('Best selling performance parts', bestsellers)]
    },
    categories,
    deals,
    bestsellers,
    arrivals,
    recommended,
    hero: featured[0] || bestsellers[0] || null,
    vehicles,
    brands,
    faqs
  });
});

const shop = wrap((req, res) =>
  renderListing(req, res, {
    path: '/shop',
    title: 'Shop All Performance Car Parts',
    heading: 'All Performance Parts',
    intro: 'Browse every air filter, intake, exhaust, tuner, suspension, brake and wheel upgrade in the Apexline catalogue.',
    description: 'Shop all performance car parts online in India: air filters, intakes, exhausts, ECU tuners, coilovers, brakes and wheels.',
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Shop', url: '/shop' }]
  })
);

const category = wrap(async (req, res) => {
  const cat = await Catalog.categoryBySlug(req.params.slug);
  if (!cat) throw notFound('That category does not exist.');
  const [family, parent] = await Promise.all([Catalog.categoryFamily(cat), Catalog.categoryParent(cat)]);
  const path = `/category/${cat.slug}`;
  const breadcrumbs = [{ name: 'Home', url: '/' }];
  if (parent) breadcrumbs.push({ name: parent.name, url: `/category/${parent.slug}` });
  breadcrumbs.push({ name: cat.name, url: path });

  return renderListing(req, res, {
    path,
    title: cat.meta_title || `${cat.name} Online in India`,
    heading: cat.name,
    intro: cat.description,
    description: cat.meta_description || `Buy ${cat.name.toLowerCase()} online. ${cat.description}`,
    keywords: `${cat.name.toLowerCase()}, buy ${cat.name.toLowerCase()} online, ${cat.name.toLowerCase()} india`,
    filters: { categoryIds: family.ids },
    children: family.children,
    breadcrumbs
  });
});

const search = wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (!q) return res.redirect('/shop');

  const filters = { q };
  const hidden = { q, cat: '' };
  if (req.query.cat) {
    const cat = await Catalog.categoryBySlug(String(req.query.cat));
    if (cat) {
      filters.categoryIds = (await Catalog.categoryFamily(cat)).ids;
      hidden.cat = cat.slug;
    }
  }

  return renderListing(req, res, {
    path: '/search',
    title: `Search results for "${q}"`,
    heading: `Results for "${q}"`,
    description: `Search results for ${q} at ${site.name}.`,
    filters,
    hidden,
    isSearch: true,
    noindex: true,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Search', url: '/search' }],
    onResults: (total, uid) => Product.logSearch(q, total, uid).catch(() => {})
  });
});

const deals = wrap((req, res) =>
  renderListing(req, res, {
    path: '/deals',
    title: 'Deals on Performance Car Parts',
    heading: 'Deals and Discounts',
    intro: 'Marked-down performance parts, sorted by the biggest savings.',
    description: 'Save on performance car parts: discounted air filters, exhausts, ECU tuners, coilovers and more.',
    keywords: 'car parts deals, performance parts discount, car modification offers',
    filters: { onSale: true },
    defaultSort: 'discount',
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Deals', url: '/deals' }]
  })
);

const brands = wrap(async (req, res) => {
  const list = await Catalog.allBrands();
  res.render('pages/brands', {
    seo: {
      title: 'Performance Car Part Brands',
      description: 'Shop performance car parts by brand: VortexFlow, BoostLab, Stanceworks, Redzone, Voltaic and Apexline.',
      jsonLd: [seo.breadcrumbLd([{ name: 'Home', url: '/' }, { name: 'Brands', url: '/brands' }])]
    },
    brands: list,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Brands', url: '/brands' }]
  });
});

const brand = wrap(async (req, res) => {
  const found = await Catalog.brandBySlug(req.params.slug);
  if (!found) throw notFound('That brand does not exist.');
  const path = `/brand/${found.slug}`;
  return renderListing(req, res, {
    path,
    title: `${found.name} Performance Parts`,
    heading: found.name,
    intro: found.description,
    description: `Shop ${found.name} performance car parts online. ${found.description}`,
    keywords: `${found.name.toLowerCase()}, ${found.name.toLowerCase()} car parts, buy ${found.name.toLowerCase()} online`,
    filters: { brandSlug: found.slug },
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Brands', url: '/brands' }, { name: found.name, url: path }]
  });
});

const vehicles = wrap(async (req, res) => {
  const list = await Catalog.allVehicles();
  const groups = list.reduce((acc, v) => {
    (acc[v.make] = acc[v.make] || []).push(v);
    return acc;
  }, {});
  res.render('pages/vehicles', {
    seo: {
      title: 'Shop Performance Parts by Vehicle',
      description: 'Find performance parts that fit your car: Swift, i20 N Line, Creta, Nexon, Thar, Scorpio-N, Slavia, Virtus, City and Fortuner.',
      jsonLd: [seo.breadcrumbLd([{ name: 'Home', url: '/' }, { name: 'Vehicles', url: '/vehicles' }])]
    },
    groups,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Vehicles', url: '/vehicles' }]
  });
});

const vehicleFind = (req, res) => {
  const slug = String(req.query.vehicle || '');
  res.redirect(/^[a-z0-9-]{2,160}$/.test(slug) ? `/vehicle/${slug}` : '/vehicles');
};

const vehicle = wrap(async (req, res) => {
  const found = await Catalog.vehicleBySlug(req.params.slug);
  if (!found) throw notFound('That vehicle is not in our fitment list yet.');
  const path = `/vehicle/${found.slug}`;
  const name = `${found.make} ${found.model}`;
  return renderListing(req, res, {
    path,
    title: `Performance Parts for ${name}`,
    heading: `Parts for ${name}`,
    intro: `Upgrades matched to the ${name}, plus universal parts that fit most cars.`,
    description: `Buy performance parts for the ${name}: air filters, intakes, exhausts, suspension and brakes with fitment support.`,
    keywords: `${name.toLowerCase()} modifications, ${name.toLowerCase()} performance parts, ${name.toLowerCase()} air filter, ${name.toLowerCase()} exhaust`,
    filters: { vehicleId: found.id },
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Vehicles', url: '/vehicles' }, { name, url: path }]
  });
});

const product = wrap(async (req, res) => {
  const p = await Product.findBySlug(req.params.slug);
  if (!p) throw notFound('This product is no longer available.');

  const uid = shopperId(req);
  const [detail, related, viewed] = await Promise.all([
    Product.details(p.id),
    Product.related(p, 8),
    uid ? Product.recentlyViewed(uid, 6, p.id) : []
  ]);
  await Product.markWished([p, ...related, ...viewed], uid);
  Product.recordView(p.id, uid).catch(() => {});

  const gallery = [
    { src: h.imageUrl(p.image), alt: p.name },
    ...detail.images.map((i) => ({ src: h.imageUrl(i.image), alt: i.alt || p.name }))
  ];

  const parent = p.category_parent_id ? await Catalog.categoryParentById(p.category_parent_id) : null;
  const breadcrumbs = [{ name: 'Home', url: '/' }];
  if (parent) breadcrumbs.push({ name: parent.name, url: `/category/${parent.slug}` });
  breadcrumbs.push({ name: p.category_name, url: `/category/${p.category_slug}` }, { name: p.name, url: `/product/${p.slug}` });

  const inStock = p.stock > 0;
  res.render('pages/product', {
    seo: {
      rawTitle: p.meta_title || `${p.name} Price in India | ${site.shortName}`,
      description: p.meta_description || p.short_description,
      keywords: p.keywords,
      image: gallery[0].src,
      imageAlt: p.name,
      type: 'product',
      meta: [
        ['product:price:amount', Number(p.price).toFixed(2)],
        ['product:price:currency', site.currency.code],
        ['product:availability', inStock ? 'in stock' : 'out of stock'],
        ['product:condition', 'new']
      ],
      jsonLd: [seo.breadcrumbLd(breadcrumbs), seo.productLd(p, { gallery, reviews: detail.reviews })]
    },
    product: p,
    gallery,
    specs: detail.specs,
    fitment: detail.vehicles,
    reviews: detail.reviews,
    related,
    viewed,
    breadcrumbs
  });
});

module.exports = { home, shop, category, search, deals, brands, brand, vehicles, vehicleFind, vehicle, product };