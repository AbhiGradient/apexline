require('dotenv').config();

module.exports = {
  name: 'Apexline Motorworks',
  shortName: 'Apexline',
  tagline: 'Performance parts engineered for the street and the track',
  description:
    'Shop performance car parts online: air filters, cold air intakes, exhausts, ECU tuners, coilovers, brakes, wheels and more, with fitment support for popular Indian cars.',
  url: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  locale: 'en_IN',
  currency: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  contact: {
    phone: '+(91)-7558666663',
    email: 'support@apexline.local',
    city: 'Pune',
    region: 'Maharashtra',
    country: 'IN'
  },
  shipping: { freeAbove: 4999, flatFee: 199 },
  gstRate: 18,
  pageSize: 12,
  returnDays: 7,
  warrantyMonths: 12,
  themeColor: '#0b0b0c',
  socials: {
    facebook: 'https://www.facebook.com/share/1D6xXfp61p/',
    x: 'https://x.com/Abhishek012546',
    instagram: 'https://www.instagram.com/its_abhisheksapkale',
    youtube: 'https://www.youtube.com/@AbhishekSapkale_06'
  }
};