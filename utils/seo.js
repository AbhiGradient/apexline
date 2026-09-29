const site = require('../config/site');

const productImageUrl = (image) => {
  if (!image) return `${site.url}/images/og-default.jpg`;
  return /^https?:\/\//i.test(image) ? image : `${site.url}/images/products/${image}`;
};

const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${site.url}${item.url}`
  }))
});

const itemListLd = (name, products) => ({
  '@type': 'ItemList',
  name,
  itemListElement: products.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${site.url}/product/${p.slug}`,
    name: p.name
  }))
});

const faqLd = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a }
  }))
});

const collectionLd = (name, description, path) => ({
  '@type': 'CollectionPage',
  name,
  description,
  url: `${site.url}${path}`,
  isPartOf: { '@id': `${site.url}/#website` }
});

const productLd = (p, { gallery, reviews }) => {
  const url = `${site.url}/product/${p.slug}`;
  const free = Number(p.price) >= site.shipping.freeAbove;
  const node = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    description: p.short_description,
    sku: p.sku,
    url,
    image: gallery.map((g) => (/^https?:\/\//i.test(g.src) ? g.src : `${site.url}${g.src}`)),
    category: p.category_name,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: site.currency.code,
      price: Number(p.price).toFixed(2),
      priceValidUntil: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      itemCondition: 'https://schema.org/NewCondition',
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: p.store_name },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: site.returnDays
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: free ? 0 : site.shipping.flatFee, currency: site.currency.code },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' }
        }
      }
    }
  };

  if (p.brand_name) node.brand = { '@type': 'Brand', name: p.brand_name };

  if (Number(p.rating_count) > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating_avg).toFixed(1),
      reviewCount: Number(p.rating_count)
    };
  }
  if (reviews.length) {
    node.review = reviews.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      author: { '@type': 'Person', name: r.name },
      name: r.title || undefined,
      reviewBody: r.body || undefined,
      datePublished: new Date(r.created_at).toISOString().slice(0, 10)
    }));
  }
  return node;
};

module.exports = { productImageUrl, breadcrumbLd, itemListLd, faqLd, collectionLd, productLd };