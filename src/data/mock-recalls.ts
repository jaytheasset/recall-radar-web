export type RecallCategory =
  | 'baby-kids'
  | 'battery-electronics'
  | 'food-allergy'
  | 'household-appliance';

export type MockRecall = {
  slug: string;
  title: string;
  brand: string;
  category: RecallCategory;
  categoryLabel: string;
  productName: string;
  noticeDate: string;
  agency: string;
  recallNumber: string;
  summary: string;
  hazard: string;
  remedy: string;
  modelNumbers: string[];
  upcs: string[];
  lotCodes: string[];
  keywords: string[];
};

export const mockRecalls: MockRecall[] = [
  {
    slug: 'brightnest-convertible-crib-rail-guard',
    title: 'BrightNest Convertible Crib Rail Guard Recall',
    brand: 'BrightNest',
    category: 'baby-kids',
    categoryLabel: 'Baby and Kids',
    productName: 'Convertible Crib Rail Guard',
    noticeDate: '2026-01-18',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-1001',
    summary: 'Local mock recall for a crib rail accessory sold for convertible cribs.',
    hazard: 'Small fasteners may loosen and create a choking hazard.',
    remedy: 'Stop using the rail guard and verify the official notice before requesting a repair kit.',
    modelNumbers: ['BN-CRG-24', 'BN-CRG-30'],
    upcs: ['800555010014'],
    lotCodes: ['BN24A', 'BN24B'],
    keywords: ['crib', 'rail guard', 'nursery', 'baby product recalls']
  },
  {
    slug: 'littlesteps-silicone-teether-clip',
    title: 'LittleSteps Silicone Teether Clip Recall',
    brand: 'LittleSteps',
    category: 'baby-kids',
    categoryLabel: 'Baby and Kids',
    productName: 'Silicone Teether Clip',
    noticeDate: '2025-11-06',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-1002',
    summary: 'Local mock recall for a silicone teether clip in soft pastel colors.',
    hazard: 'The clip clasp may detach during use.',
    remedy: 'Keep the teether clip away from children and verify next steps with the official recall notice.',
    modelNumbers: ['LS-TC-12'],
    upcs: ['800555010021'],
    lotCodes: ['LSTC925', 'LSTC1025'],
    keywords: ['teether', 'clip', 'infant', 'baby product recalls']
  },
  {
    slug: 'voltedge-20v-lithium-battery-pack',
    title: 'VoltEdge 20V Lithium Battery Pack Recall',
    brand: 'VoltEdge',
    category: 'battery-electronics',
    categoryLabel: 'Battery and Electronics',
    productName: '20V Lithium Battery Pack',
    noticeDate: '2025-09-22',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-2001',
    summary: 'Local mock recall for removable lithium battery packs used with cordless tools.',
    hazard: 'Battery cells may overheat while charging.',
    remedy: 'Stop charging the battery pack and verify replacement instructions with the official notice.',
    modelNumbers: ['VEB-20', 'VEB-20XR'],
    upcs: ['800555020013'],
    lotCodes: ['VE0525', 'VE0625'],
    keywords: ['battery recalls', 'lithium battery', 'cordless tool', 'charger']
  },
  {
    slug: 'chargehub-usb-c-power-bank',
    title: 'ChargeHub USB-C Power Bank Recall',
    brand: 'ChargeHub',
    category: 'battery-electronics',
    categoryLabel: 'Battery and Electronics',
    productName: 'USB-C Power Bank',
    noticeDate: '2025-08-14',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-2002',
    summary: 'Local mock recall for a portable power bank sold online.',
    hazard: 'The enclosure may crack and expose internal battery components.',
    remedy: 'Stop using the power bank and verify refund or replacement instructions with the official notice.',
    modelNumbers: ['CH-PB10K', 'CH-PB20K'],
    upcs: ['800555020020'],
    lotCodes: ['CHB1025'],
    keywords: ['battery recalls', 'usb-c', 'power bank', 'electronics']
  },
  {
    slug: 'sunnyharvest-almond-granola-bars',
    title: 'SunnyHarvest Almond Granola Bars Allergy Recall',
    brand: 'SunnyHarvest',
    category: 'food-allergy',
    categoryLabel: 'Food and Allergy',
    productName: 'Almond Granola Bars',
    noticeDate: '2026-02-04',
    agency: 'Mock FDA notice',
    recallNumber: 'RR-MOCK-3001',
    summary: 'Local mock recall for packaged granola bars with undeclared peanut allergen.',
    hazard: 'The product may contain undeclared peanuts.',
    remedy: 'Do not consume if allergic or sensitive to peanuts and verify the official notice for return details.',
    modelNumbers: [],
    upcs: ['800555030012'],
    lotCodes: ['SH-A1225', 'SH-A0126'],
    keywords: ['food allergy recalls', 'granola', 'peanut', 'undeclared allergen']
  },
  {
    slug: 'greentable-chicken-soup-cups',
    title: 'GreenTable Chicken Soup Cups Allergy Recall',
    brand: 'GreenTable',
    category: 'food-allergy',
    categoryLabel: 'Food and Allergy',
    productName: 'Chicken Soup Cups',
    noticeDate: '2025-12-09',
    agency: 'Mock USDA FSIS notice',
    recallNumber: 'RR-MOCK-3002',
    summary: 'Local mock recall for ready-to-heat soup cups with undeclared milk and egg.',
    hazard: 'The product may contain undeclared milk and egg allergens.',
    remedy: 'Do not consume if allergic or sensitive to milk or egg and verify the official notice.',
    modelNumbers: [],
    upcs: ['800555030029'],
    lotCodes: ['GT-SOUP-2411'],
    keywords: ['food allergy recalls', 'soup', 'milk', 'egg', 'undeclared allergen']
  },
  {
    slug: 'homewarm-countertop-air-fryer',
    title: 'HomeWarm Countertop Air Fryer Recall',
    brand: 'HomeWarm',
    category: 'household-appliance',
    categoryLabel: 'Household Appliance',
    productName: 'Countertop Air Fryer',
    noticeDate: '2025-10-28',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-4001',
    summary: 'Local mock recall for a compact air fryer sold for home kitchens.',
    hazard: 'The control panel may overheat during extended use.',
    remedy: 'Stop using the appliance and verify the official notice for repair or refund instructions.',
    modelNumbers: ['HW-AF4', 'HW-AF6'],
    upcs: ['800555040011'],
    lotCodes: ['HWAF25Q3'],
    keywords: ['household appliance', 'air fryer', 'kitchen', 'overheat']
  },
  {
    slug: 'cleanwave-portable-dehumidifier',
    title: 'CleanWave Portable Dehumidifier Recall',
    brand: 'CleanWave',
    category: 'household-appliance',
    categoryLabel: 'Household Appliance',
    productName: 'Portable Dehumidifier',
    noticeDate: '2025-07-17',
    agency: 'Mock CPSC notice',
    recallNumber: 'RR-MOCK-4002',
    summary: 'Local mock recall for a small-room portable dehumidifier.',
    hazard: 'Internal wiring may short circuit.',
    remedy: 'Unplug the dehumidifier and verify disposal or replacement steps with the official recall notice.',
    modelNumbers: ['CW-DH30', 'CW-DH45'],
    upcs: ['800555040028'],
    lotCodes: ['CWDH0725'],
    keywords: ['household appliance', 'dehumidifier', 'electrical', 'short circuit']
  }
];

export const categoryRoutes = [
  {
    href: '/baby-product-recalls',
    label: 'Baby Product Recalls',
    category: 'baby-kids'
  },
  {
    href: '/battery-recalls',
    label: 'Battery Recalls',
    category: 'battery-electronics'
  },
  {
    href: '/food-allergy-recalls',
    label: 'Food Allergy Recalls',
    category: 'food-allergy'
  }
] as const;
