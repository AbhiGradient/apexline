const Product = require('../models/product');
const Catalog = require('../models/catalog');

const csrf = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ token: res.locals.csrfToken() });
};

const suggest = async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 60);
    if (term.length < 2) return res.json([]);

    const [products, categories, brands] = await Promise.all([
      Product.suggest(term, 5),
      Catalog.searchCategories(term, 3),
      Catalog.searchBrands(term, 2)
    ]);

    res.set('Cache-Control', 'public, max-age=60');
    res.json([
      ...products.map((p) => ({ label: p.name, type: p.category_name, url: `/product/${p.slug}` })),
      ...categories.map((c) => ({ label: c.name, type: 'Category', url: `/category/${c.slug}` })),
      ...brands.map((b) => ({ label: b.name, type: 'Brand', url: `/brand/${b.slug}` }))
    ]);
  } catch (err) {
    next(err);
  }
};

module.exports = { csrf, suggest };