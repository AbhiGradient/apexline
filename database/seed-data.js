const brands = [
  { name: 'Apexline', description: 'In-house performance range for street and track builds.' },
  { name: 'VortexFlow', description: 'Air filters and intake systems tuned for real airflow gains.' },
  { name: 'BoostLab', description: 'Forced induction, ECU tuning and ignition upgrades.' },
  { name: 'Stanceworks', description: 'Suspension, wheels and handling hardware.' },
  { name: 'Redzone', description: 'Brake pads, discs and stopping-power upgrades.' },
  { name: 'Voltaic', description: 'Lighting and electrical upgrades.' }
];

const categories = [
  { name: 'Air Intake & Filters', slug: 'air-intake', description: 'Air filters, cold air intakes and intake accessories for better throttle response.' },
  { name: 'Exhaust Systems', slug: 'exhaust', description: 'Cat-back systems, downpipes and mufflers for flow and sound.' },
  { name: 'Engine & ECU Tuning', slug: 'engine-ecu', description: 'ECU tuners, spark plugs and engine upgrades.' },
  { name: 'Turbo & Boost', slug: 'turbo-boost', description: 'Intercoolers, blow-off valves and forced induction parts.' },
  { name: 'Suspension', slug: 'suspension', description: 'Coilovers, sway bars and handling upgrades.' },
  { name: 'Brakes', slug: 'brakes', description: 'Brake pads and discs for stronger, fade-resistant stopping.' },
  { name: 'Wheels & Tyres', slug: 'wheels', description: 'Lightweight alloy wheels and fitment hardware.' },
  { name: 'Lighting', slug: 'lighting', description: 'LED headlight bulbs and lighting upgrades.' },
  { name: 'Air Filters', slug: 'air-filters', parent: 'air-intake', description: 'Washable and high-flow air filters for petrol and diesel cars.' },
  { name: 'Cold Air Intakes', slug: 'cold-air-intakes', parent: 'air-intake', description: 'Complete cold air intake kits for extra airflow.' },
  { name: 'Cat-Back Exhausts', slug: 'cat-back-exhausts', parent: 'exhaust', description: 'Stainless cat-back and axle-back exhaust systems.' },
  { name: 'Downpipes', slug: 'downpipes', parent: 'exhaust', description: 'High-flow downpipes for turbocharged engines.' },
  { name: 'ECU Tuners', slug: 'ecu-tuners', parent: 'engine-ecu', description: 'Piggyback ECU tuners and remap hardware.' },
  { name: 'Spark Plugs', slug: 'spark-plugs', parent: 'engine-ecu', description: 'Iridium and performance spark plugs.' },
  { name: 'Intercoolers', slug: 'intercoolers', parent: 'turbo-boost', description: 'Front-mount intercoolers for lower intake temperatures.' },
  { name: 'Blow-Off Valves', slug: 'blow-off-valves', parent: 'turbo-boost', description: 'Adjustable blow-off valves for turbo cars.' },
  { name: 'Coilovers', slug: 'coilovers', parent: 'suspension', description: 'Height and damping adjustable coilover kits.' },
  { name: 'Sway Bars', slug: 'sway-bars', parent: 'suspension', description: 'Anti-roll bars to reduce body roll.' },
  { name: 'Brake Pads', slug: 'brake-pads', parent: 'brakes', description: 'Ceramic and semi-metallic performance pads.' },
  { name: 'Brake Discs', slug: 'brake-discs', parent: 'brakes', description: 'Slotted and drilled brake discs.' },
  { name: 'Alloy Wheels', slug: 'alloy-wheels', parent: 'wheels', description: 'Flow-formed and forged alloy wheel sets.' },
  { name: 'LED Headlight Bulbs', slug: 'led-headlight-bulbs', parent: 'lighting', description: 'Bright, long-life LED headlight upgrades.' }
];

const vehicles = [
  ['Maruti Suzuki', 'Swift', 2018, null],
  ['Hyundai', 'i20 N Line', 2021, null],
  ['Hyundai', 'Creta', 2020, null],
  ['Tata', 'Nexon', 2020, null],
  ['Mahindra', 'Thar', 2020, null],
  ['Mahindra', 'Scorpio-N', 2022, null],
  ['Skoda', 'Slavia', 2022, null],
  ['Volkswagen', 'Virtus', 2022, null],
  ['Honda', 'City', 2020, null],
  ['Toyota', 'Fortuner', 2016, null]
];

const brandBlurb = {
  Apexline: 'Backed by a 12-month warranty and free fitment support from our build team.',
  VortexFlow: 'Flow-tested design with a 12-month warranty and free fitment guidance.',
  BoostLab: 'Engineered for reliable power gains, with a 12-month warranty and expert setup help.',
  Stanceworks: 'Built for daily drivability and track days, with a 12-month warranty.',
  Redzone: 'Tested for fade resistance and low dust, with a 12-month warranty.',
  Voltaic: 'Plug-and-play install with a 12-month warranty and fitment guidance.'
};

const products = [
  {
    name: 'VortexFlow Washable Panel Air Filter', category: 'air-filters', brand: 'VortexFlow',
    price: 3499, compare: 4299, stock: 60, image: 'vortexflow-panel-air-filter.jpg', featured: true,
    short: 'Reusable high-flow drop-in panel air filter that improves airflow and can be washed and re-oiled.',
    keywords: 'air filter, airfilter, air-filter, panel filter, washable air filter, drop in filter',
    specs: [['Type', 'Drop-in panel'], ['Media', 'Multi-layer cotton gauze'], ['Reusable', 'Washable and re-oilable'], ['Warranty', '12 months']],
    fit: ['maruti-suzuki-swift', 'hyundai-i20-n-line', 'honda-city']
  },
  {
    name: 'VortexFlow Conical Air Filter 76mm', category: 'air-filters', brand: 'VortexFlow',
    price: 2799, compare: 3299, stock: 45, image: 'vortexflow-conical-air-filter.jpg', featured: false,
    short: '76mm neck cone air filter for aftermarket intake pipes with a larger surface area than stock.',
    keywords: 'air filter, airfilter, cone filter, conical filter, 76mm filter, intake filter',
    specs: [['Type', 'Conical universal'], ['Neck Diameter', '76 mm'], ['Height', '150 mm'], ['Reusable', 'Yes']],
    fit: []
  },
  {
    name: 'VortexFlow Drop-In Air Filter for Creta and Nexon', category: 'air-filters', brand: 'VortexFlow',
    price: 2299, compare: null, stock: 38, image: 'vortexflow-creta-nexon-air-filter.jpg', featured: false,
    short: 'Direct-fit replacement air filter that keeps the stock airbox and lifts mid-range airflow.',
    keywords: 'air filter, airfilter, creta air filter, nexon air filter, drop in air filter, replacement filter',
    specs: [['Type', 'Drop-in replacement'], ['Fitment', 'Direct fit, no cutting'], ['Reusable', 'Yes'], ['Warranty', '12 months']],
    fit: ['hyundai-creta', 'tata-nexon']
  },
  {
    name: 'Apexline Air Filter Cleaning and Oil Kit', category: 'air-filters', brand: 'Apexline',
    price: 1299, compare: 1599, stock: 90, image: 'apexline-air-filter-cleaning-kit.jpg', featured: false,
    short: 'Cleaner and filter oil set to service reusable cotton air filters every 20,000 km.',
    keywords: 'air filter cleaner, airfilter cleaning kit, filter oil, air filter service, maintenance kit',
    specs: [['Contents', 'Cleaner 355 ml + Oil 237 ml'], ['Suits', 'Cotton gauze filters'], ['Service Interval', 'About 20,000 km']],
    fit: []
  },
  {
    name: 'VortexFlow Cold Air Intake Kit for Turbo Hatchbacks', category: 'cold-air-intakes', brand: 'VortexFlow',
    price: 12999, compare: 15499, stock: 22, image: 'vortexflow-cold-air-intake.jpg', featured: true,
    short: 'Mandrel-bent aluminium intake pipe with heat shield and high-flow cone filter for sharper throttle response.',
    keywords: 'cold air intake, cai, intake kit, air intake, turbo intake, airfilter kit',
    specs: [['Pipe Material', 'Polished aluminium'], ['Filter', 'High-flow cone'], ['Heat Shield', 'Included'], ['Install Time', 'About 60 minutes']],
    fit: ['hyundai-i20-n-line', 'maruti-suzuki-swift']
  },
  {
    name: 'Apexline Carbon Fibre Airbox Intake', category: 'cold-air-intakes', brand: 'Apexline',
    price: 18999, compare: null, stock: 10, image: 'apexline-carbon-airbox.jpg', featured: false,
    short: 'Sealed carbon fibre airbox that isolates the filter from engine bay heat for denser intake air.',
    keywords: 'carbon airbox, carbon intake, cold air intake, air intake, sealed airbox',
    specs: [['Material', '3K carbon fibre'], ['Sealing', 'Silicone gasket'], ['Finish', 'Gloss clear coat']],
    fit: ['skoda-slavia', 'volkswagen-virtus']
  },
  {
    name: 'Apexline Stainless Cat-Back Exhaust 2.5 inch', category: 'cat-back-exhausts', brand: 'Apexline',
    price: 27999, compare: 32999, stock: 14, image: 'apexline-cat-back-exhaust.jpg', featured: true,
    short: 'T304 stainless mandrel-bent cat-back system with a deep tone and no drone at highway speeds.',
    keywords: 'exhaust, cat back exhaust, catback, stainless exhaust, performance exhaust, exhaust system',
    specs: [['Material', 'T304 stainless steel'], ['Pipe Diameter', '2.5 inch'], ['Tip', 'Burnt titanium 4 inch'], ['Sound', 'Deep, low drone']],
    fit: ['skoda-slavia', 'volkswagen-virtus', 'honda-city']
  },
  {
    name: 'Apexline High-Flow Downpipe with Catalytic Converter', category: 'downpipes', brand: 'Apexline',
    price: 32999, compare: null, stock: 8, image: 'apexline-downpipe.jpg', featured: false,
    short: 'Fast-spooling 3 inch downpipe with a high-flow cat that keeps the car road legal.',
    keywords: 'downpipe, turbo downpipe, high flow cat, exhaust downpipe',
    specs: [['Pipe Diameter', '3 inch'], ['Catalytic Converter', '200 cell high-flow'], ['Material', 'T304 stainless']],
    fit: ['skoda-slavia', 'volkswagen-virtus']
  },
  {
    name: 'Apexline Universal Axle-Back Muffler 3 inch', category: 'cat-back-exhausts', brand: 'Apexline',
    price: 8499, compare: 9999, stock: 30, image: 'apexline-axle-back-muffler.jpg', featured: false,
    short: 'Straight-through stainless muffler for a richer tone without changing the rest of the exhaust.',
    keywords: 'muffler, axle back, exhaust muffler, universal muffler, exhaust tip',
    specs: [['Inlet', '3 inch'], ['Body', 'Stainless steel'], ['Fitment', 'Universal weld-on']],
    fit: []
  },
  {
    name: 'BoostLab Piggyback ECU Tuner', category: 'ecu-tuners', brand: 'BoostLab',
    price: 17999, compare: 20999, stock: 18, image: 'boostlab-piggyback-ecu.jpg', featured: true,
    short: 'Plug-and-play piggyback module with three power maps and a phone app for live adjustment.',
    keywords: 'ecu tuner, piggyback ecu, tuning box, remap, chip tuning, power tuner',
    specs: [['Maps', '3 selectable'], ['Install', 'Plug and play harness'], ['Control', 'Bluetooth app'], ['Warranty', '12 months']],
    fit: ['mahindra-thar', 'mahindra-scorpio-n', 'toyota-fortuner']
  },
  {
    name: 'BoostLab Iridium Spark Plug Set of 4', category: 'spark-plugs', brand: 'BoostLab',
    price: 2499, compare: null, stock: 75, image: 'boostlab-iridium-spark-plugs.jpg', featured: false,
    short: 'Fine-wire iridium plugs for a stable spark, smoother idle and longer service life.',
    keywords: 'spark plug, iridium spark plug, ignition, plug set, engine tuning',
    specs: [['Electrode', 'Iridium fine wire'], ['Quantity', '4 pieces'], ['Service Life', 'Up to 60,000 km']],
    fit: ['maruti-suzuki-swift', 'honda-city']
  },
  {
    name: 'BoostLab Front-Mount Intercooler Kit', category: 'intercoolers', brand: 'BoostLab',
    price: 38999, compare: 44999, stock: 6, image: 'boostlab-front-mount-intercooler.jpg', featured: false,
    short: 'Bar-and-plate front-mount intercooler kit that drops intake temperatures under sustained boost.',
    keywords: 'intercooler, fmic, front mount intercooler, turbo cooling, boost',
    specs: [['Core', 'Bar and plate'], ['Core Size', '600 x 300 x 76 mm'], ['Piping', 'Aluminium with silicone couplers']],
    fit: ['mahindra-thar', 'toyota-fortuner']
  },
  {
    name: 'BoostLab Adjustable Blow-Off Valve', category: 'blow-off-valves', brand: 'BoostLab',
    price: 6999, compare: null, stock: 20, image: 'boostlab-blow-off-valve.jpg', featured: false,
    short: 'Billet aluminium blow-off valve with adjustable spring preload and a crisp release sound.',
    keywords: 'blow off valve, bov, turbo bov, boost valve, turbo sound',
    specs: [['Body', 'CNC billet aluminium'], ['Adjustment', 'Spring preload'], ['Flange', 'Universal 25 mm']],
    fit: []
  },
  {
    name: 'Stanceworks Adjustable Coilover Kit', category: 'coilovers', brand: 'Stanceworks',
    price: 42999, compare: 49999, stock: 9, image: 'stanceworks-coilover-kit.jpg', featured: true,
    short: 'Monotube coilovers with 32-way damping and height adjustment for road and track setups.',
    keywords: 'coilovers, coilover kit, lowering springs, suspension kit, adjustable suspension',
    specs: [['Damping', '32-way adjustable'], ['Height Drop', '30 to 60 mm'], ['Construction', 'Monotube, zinc-plated body']],
    fit: ['maruti-suzuki-swift', 'hyundai-i20-n-line', 'honda-city']
  },
  {
    name: 'Stanceworks Front Sway Bar 25mm', category: 'sway-bars', brand: 'Stanceworks',
    price: 7999, compare: null, stock: 16, image: 'stanceworks-sway-bar.jpg', featured: false,
    short: 'Thicker anti-roll bar that reduces body roll and sharpens turn-in on twisty roads.',
    keywords: 'sway bar, anti roll bar, stabiliser bar, handling upgrade, suspension',
    specs: [['Diameter', '25 mm'], ['Bushings', 'Polyurethane'], ['Finish', 'Powder coated']],
    fit: ['skoda-slavia', 'volkswagen-virtus', 'hyundai-creta']
  },
  {
    name: 'Redzone Ceramic Brake Pads Front Set', category: 'brake-pads', brand: 'Redzone',
    price: 4499, compare: 5299, stock: 55, image: 'redzone-ceramic-brake-pads.jpg', featured: false,
    short: 'Low-dust ceramic pads with strong initial bite and quiet, fade-resistant braking.',
    keywords: 'brake pads, ceramic brake pads, front brake pads, braking upgrade',
    specs: [['Compound', 'Ceramic'], ['Position', 'Front axle'], ['Dust', 'Low']],
    fit: ['hyundai-creta', 'tata-nexon', 'honda-city']
  },
  {
    name: 'Redzone Slotted Brake Discs Pair', category: 'brake-discs', brand: 'Redzone',
    price: 9999, compare: 11999, stock: 25, image: 'redzone-slotted-brake-discs.jpg', featured: false,
    short: 'Slotted, zinc-coated discs that clear gas and water for consistent stopping in all conditions.',
    keywords: 'brake discs, brake rotors, slotted discs, slotted rotors, braking upgrade',
    specs: [['Design', 'Slotted'], ['Coating', 'Zinc anti-rust'], ['Quantity', '2 discs']],
    fit: ['skoda-slavia', 'volkswagen-virtus', 'mahindra-scorpio-n']
  },
  {
    name: 'Stanceworks 17 inch Flow-Formed Alloy Wheel Set of 4', category: 'alloy-wheels', brand: 'Stanceworks',
    price: 59999, compare: 68999, stock: 7, image: 'stanceworks-17-alloy-wheels.jpg', featured: true,
    short: 'Lightweight flow-formed 17 inch alloys that cut unsprung weight and sharpen handling.',
    keywords: 'alloy wheels, 17 inch alloys, flow formed wheels, rims, wheel set',
    specs: [['Size', '17 x 7.5 inch'], ['Construction', 'Flow-formed'], ['Quantity', 'Set of 4'], ['Finish', 'Gunmetal']],
    fit: ['skoda-slavia', 'volkswagen-virtus', 'honda-city']
  },
  {
    name: 'Voltaic 6000K LED Headlight Bulbs H4 Pair', category: 'led-headlight-bulbs', brand: 'Voltaic',
    price: 3499, compare: 4499, stock: 80, image: 'voltaic-led-headlight-bulbs.jpg', featured: false,
    short: 'Plug-and-play 6000K LED bulbs with a focused beam pattern and built-in fan cooling.',
    keywords: 'led headlight, h4 led bulb, headlight bulb, led bulbs, car lighting',
    specs: [['Fitment', 'H4 base'], ['Colour Temperature', '6000K'], ['Output', '9000 lumens per pair']],
    fit: ['mahindra-thar', 'maruti-suzuki-swift']
  }
];

const coupons = [
  { code: 'WELCOME10', type: 'percent', value: 10, min_order: 999, max_discount: 1500 },
  { code: 'TRACKDAY500', type: 'flat', value: 500, min_order: 7999, max_discount: null }
];

module.exports = { brands, categories, vehicles, brandBlurb, products, coupons };