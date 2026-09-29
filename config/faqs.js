const site = require('./site');
const { money } = require('../utils/format');

module.exports = [
  {
    q: 'How do I know a part fits my car?',
    a: 'Use Shop by Vehicle to see parts matched to your model. Every product page lists the cars it fits, and universal parts are clearly marked. If you are unsure, call our team on ' + site.contact.phone + ' before ordering.'
  },
  {
    q: 'Do performance air filters really improve performance?',
    a: 'A high-flow air filter improves airflow and throttle response, and the gain is usually modest on its own. Results vary by engine, and combining a filter with a cold air intake, exhaust or ECU tune gives a more noticeable change.'
  },
  {
    q: 'Will modifications void my car warranty?',
    a: 'That depends on your manufacturer and dealer. Bolt-on parts are usually easy to reverse, but always check your warranty terms before fitting anything.'
  },
  {
    q: 'Are your parts road legal in India?',
    a: 'We sell emission-compliant parts such as high-flow catalytic converters. Some modifications may need approval from your local RTO, so check the rules for your state before fitting.'
  },
  {
    q: 'How long does delivery take and what does it cost?',
    a: 'Most orders arrive in 3 to 7 business days across India. Shipping is free above ' + money(site.shipping.freeAbove) + ' and ' + money(site.shipping.flatFee) + ' below that.'
  },
  {
    q: 'What is your return policy?',
    a: 'Unused parts in original packaging can be returned within ' + site.returnDays + ' days of delivery. Every product also carries a ' + site.warrantyMonths + '-month warranty against manufacturing defects.'
  },
  {
    q: 'Do you provide a GST invoice?',
    a: 'Yes. All prices include ' + site.gstRate + '% GST and a tax invoice is generated with every order.'
  },
  {
    q: 'Which payment methods can I use?',
    a: 'You can pay by cash on delivery, UPI, debit or credit card, or net banking.'
  }
];