const site = require('./site');
const { money } = require('../utils/format');

const updated = '29 September 2026';
const phone = site.contact.phone;
const email = site.contact.email;

module.exports = {
  about: {
    slug: 'about',
    title: 'About Us',
    schema: 'AboutPage',
    updated,
    description: `${site.name} is a ${site.contact.city}-based online store for performance car parts: air filters, intakes, exhausts, ECU tuners, suspension, brakes and wheels.`,
    intro: `${site.name} is an online store for car performance mods, run from ${site.contact.city}, ${site.contact.region}. We sell parts that make everyday cars quicker, sharper and better sounding, and we are open about the trade-offs.`,
    sections: [
      {
        h: 'What we sell',
        p: ['Our catalogue covers the upgrades most owners start with, plus the parts that make them work together.'],
        list: ['Air filters and cold air intakes', 'Cat-back exhausts and downpipes', 'ECU tuners and spark plugs', 'Intercoolers and blow-off valves', 'Coilovers and sway bars', 'Brake pads and discs', 'Alloy wheels and LED lighting']
      },
      {
        h: 'How we run the store',
        list: [
          'Fitment first. Every product page lists the cars it fits, or says clearly that the part is universal.',
          'Honest claims. We describe what a part changes and we do not print invented horsepower numbers.',
          `Fair pricing. Prices include ${site.gstRate}% GST, and shipping is free above ${money(site.shipping.freeAbove)}.`,
          `Real support. Call ${phone} and talk to a person before you buy.`
        ]
      },
      {
        h: 'Sell with us',
        p: ['Approved sellers list their own products on Apexline. Seller accounts are created by our team, so use the contact page to apply.']
      }
    ]
  },

  shipping: {
    slug: 'shipping-policy',
    title: 'Shipping Policy',
    updated,
    description: `Delivery times and charges across India. Free shipping above ${money(site.shipping.freeAbove)}, otherwise ${money(site.shipping.flatFee)}.`,
    intro: 'This page explains how and when your order reaches you.',
    sections: [
      { h: 'Delivery areas', p: ['We deliver across India to any address our courier partners serve.'] },
      { h: 'Order processing', p: ['Most orders are confirmed and handed to the courier within one business day of being placed. Made-to-order items are marked on the product page.'] },
      { h: 'Delivery time', p: ['Once shipped, delivery normally takes 3 to 7 business days depending on your location.'] },
      { h: 'Shipping charges', p: [`Shipping is free on orders of ${money(site.shipping.freeAbove)} or more after discounts. Below that, a flat ${money(site.shipping.flatFee)} is charged at checkout.`] },
      { h: 'Tracking', p: ['Sign in and open Your Orders to follow each order from placed to delivered.'] },
      { h: 'Damaged or wrong items', p: [`If a parcel arrives damaged or you receive the wrong item, contact us within 48 hours of delivery with photos. Call ${phone} or use the contact page.`] }
    ]
  },

  returns: {
    slug: 'return-policy',
    title: 'Returns and Refunds',
    updated,
    description: `Return unused parts within ${site.returnDays} days of delivery. Every product carries a ${site.warrantyMonths}-month warranty against manufacturing defects.`,
    intro: `You can return most parts within ${site.returnDays} days of delivery. Please read the conditions below.`,
    sections: [
      {
        h: 'What can be returned',
        list: ['The part is unused, uninstalled and in its original packaging.', 'All accessories, manuals and fasteners are included.', `The return is requested within ${site.returnDays} days of delivery.`]
      },
      {
        h: 'What cannot be returned',
        list: ['Parts that have been installed, used or modified.', 'Parts damaged after delivery.', 'Electronic tuners that have been connected to a vehicle.']
      },
      { h: 'How to start a return', p: [`Contact us through the contact page or call ${phone} with your order number. We will confirm the return and arrange pickup or share the return address.`] },
      { h: 'Refunds', p: ['Once the returned part passes inspection, refunds are sent to the original payment method within 5 to 7 business days. Cash on delivery orders are refunded by bank transfer.'] },
      { h: 'Warranty', p: [`Every part carries a ${site.warrantyMonths}-month warranty against manufacturing defects. Wear from normal use, accident damage and incorrect installation are not covered.`] }
    ]
  },

  privacy: {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    updated,
    description: `How ${site.name} collects, uses and protects your personal information.`,
    intro: `This policy explains what personal information ${site.name} collects and how we use it.`,
    sections: [
      {
        h: 'What we collect',
        list: [
          'Account details: name, email address, mobile number and password.',
          'Delivery addresses you save or use at checkout.',
          'Your cart, wishlist, orders and recently viewed products.',
          'Search terms, which may be linked to your account when you are signed in.',
          'Messages you send us and the email you give for our newsletter.'
        ]
      },
      {
        h: 'How we use it',
        list: ['To process, deliver and support your orders.', 'To keep your account and cart working.', 'To suggest relevant products.', 'To send the newsletter, only if you subscribed.', 'To prevent fraud and keep the store secure.']
      },
      {
        h: 'Cookies',
        p: [
          'We use one essential cookie that keeps you signed in and remembers your cart. We do not use advertising or tracking cookies.',
          'Our pages load fonts from Google Fonts, so your browser contacts Google servers when a page opens.'
        ]
      },
      {
        h: 'Who can see your information',
        p: ['Sellers receive the name, phone number and delivery address of customers who buy their products, so they can ship the order. Courier partners and, when online payments are enabled, payment providers also receive what they need to do their job. We may share information when the law requires it. We do not sell your personal data.']
      },
      { h: 'Security', p: ['Passwords are stored using strong one-way hashing, and we never see them in readable form. No online service can promise perfect security, so please choose a unique password.'] },
      { h: 'Your choices', p: [`You can view and edit your details under Your Account. To ask us to delete your account or data, or to unsubscribe from the newsletter, email ${email}.`] },
      { h: 'Keeping records', p: ['We keep order records for as long as needed for accounting, warranty and legal reasons.'] },
      { h: 'Contact', p: [`Questions about this policy? Email ${email} or call ${phone}.`] }
    ]
  },

  terms: {
    slug: 'terms',
    title: 'Terms and Conditions',
    updated,
    description: `The terms that apply when you browse or buy from ${site.name}.`,
    intro: `By using ${site.name} you agree to these terms.`,
    sections: [
      { h: 'Accounts', p: ['Keep your password private. You are responsible for activity on your account. We may suspend accounts that are misused.'] },
      { h: 'Prices and payment', p: [`All prices are in Indian rupees and include ${site.gstRate}% GST. We may correct pricing errors and will tell you before shipping if an order is affected.`] },
      { h: 'Orders and cancellation', p: ['An order is accepted when we confirm it. You can cancel from Your Orders until it is packed. If a part is out of stock after you order, we will refund you in full.'] },
      { h: 'Fitment and product information', p: ['We take care to list accurate fitment and specifications. Always confirm that a part suits your exact car and variant, and call us if you are unsure. Performance gains vary by vehicle and setup.'] },
      { h: 'Modifications and the law', p: ['You are responsible for making sure any modification you fit complies with the rules that apply to your vehicle, including noise, emissions and registration rules in your state. Some changes may need approval from your local transport authority.'] },
      { h: 'Warranty and returns', p: ['Warranty and return terms are described in our Returns and Refunds page.'] },
      { h: 'Limits of liability', p: ['Parts must be installed correctly, ideally by a qualified mechanic. To the extent the law allows, we are not liable for damage caused by incorrect installation, misuse or track use, and our liability is limited to the price paid for the part.'] },
      { h: 'Changes to these terms', p: ['We may update these terms. The date at the top shows the latest version.'] },
      { h: 'Governing law', p: [`These terms are governed by the laws of India, and the courts of ${site.contact.city} have jurisdiction.`] }
    ]
  }
};