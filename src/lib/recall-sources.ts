export type RecallSourceId =
  | 'CPSC'
  | 'FDA'
  | 'FR_RAPPELCONSO'
  | 'CA_RECALLS'
  | 'EU_SAFETY_GATE'
  | 'UK_FSA'
  | 'AU_PRODUCT_SAFETY'
  | 'NZ_PRODUCT_SAFETY'
  | 'HK_CFS'
  | 'FSANZ_FOOD_RECALLS'
  | 'Mock';
export type CurrentCoverageSourceId = Exclude<RecallSourceId, 'Mock'>;
export type RecallSourceType = 'official-api' | 'sample';

export type RecallSourceOption = {
  value: CurrentCoverageSourceId;
  label: string;
};

export type RecallSourceSearchIntent = {
  sourceIds: CurrentCoverageSourceId[];
  remainingQuery: string;
  isSourceOnly: boolean;
};

export type RecallSourceConfig = {
  id: RecallSourceId;
  marketCode: string;
  marketLabel: string;
  agencyLabel: string;
  sourceType: RecallSourceType;
  displayLabel: string;
  noticeTypeLabel: string;
  productScopeLabel: string;
  identifierTypes: string[];
  supportsImages: boolean;
  supportsDistributionDetails: boolean;
  rawPayloadNotes: string;
  officialSourceLabel: string;
  placeholderLabel: string;
  reasonLabel: string;
  actionLabel: string;
  quantityLabel: string;
  distributionLabel: string;
  defaultActionFallback: string;
  verificationIntro: string;
  verificationChecklist: string[];
  sparseIdentificationCopy: string;
  officialVerificationCopy: string;
};

const DEFAULT_ACTION_FALLBACK = 'Review the official notice for current instructions.';

const sourceConfigs: Record<RecallSourceId, RecallSourceConfig> = {
  CPSC: {
    id: 'CPSC',
    marketCode: 'US',
    marketLabel: 'United States',
    agencyLabel: 'CPSC',
    sourceType: 'official-api',
    displayLabel: 'United States · CPSC',
    noticeTypeLabel: 'Consumer product notice',
    productScopeLabel: 'Consumer products',
    identifierTypes: ['model number', 'item number', 'UPC/barcode', 'RN/date details', 'recall number'],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'CPSC raw payloads can include Products, ProductUPCs, Images, Retailers, Importers, Manufacturers, ManufacturerCountries, Hazards, and Remedies.',
    officialSourceLabel: 'Source: United States · CPSC',
    placeholderLabel: 'Product recall notice',
    reasonLabel: 'Hazard',
    actionLabel: 'Action',
    quantityLabel: 'Units',
    distributionLabel: 'Sold at',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, or official notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Model number or item number',
      'UPC/barcode if listed',
      'Product photos and label location',
      'Sold-at or distribution details',
      'Notice date and recall number',
      'Remedy/action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected models, lots, dates, distribution, and remedies.'
  },
  FDA: {
    id: 'FDA',
    marketCode: 'US',
    marketLabel: 'United States',
    agencyLabel: 'FDA / openFDA',
    sourceType: 'official-api',
    displayLabel: 'United States · FDA / openFDA',
    noticeTypeLabel: 'Food enforcement notice',
    productScopeLabel: 'Food and enforcement',
    identifierTypes: ['UPC/barcode', 'lot/batch code', 'best-by/use-by date', 'recall number'],
    supportsImages: false,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'FDA/openFDA food enforcement raw payloads can include product_description, code_info, product_quantity, distribution_pattern, classification, status, and recall_number.',
    officialSourceLabel: 'Source: United States · FDA / openFDA',
    placeholderLabel: 'Food enforcement notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    quantityLabel: 'Quantity',
    distributionLabel: 'Distribution',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, package, receipt, lot code, or official notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product description',
      'Recalling firm or brand/company',
      'UPC/barcode if listed',
      'Lot, batch, or code information',
      'Best-by, use-by, or expiration date if listed',
      'Ingredient or allergen details when relevant',
      'Distribution details',
      'Recall number, classification, and status',
      'Instructions in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official notice, package label, and lot or date code carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected lots, dates, distribution, product quantity, classification, status, and instructions.'
  },
  FR_RAPPELCONSO: {
    id: 'FR_RAPPELCONSO',
    marketCode: 'FR',
    marketLabel: 'France',
    agencyLabel: 'RappelConso',
    sourceType: 'official-api',
    displayLabel: 'France · RappelConso',
    noticeTypeLabel: 'Product recall notice',
    productScopeLabel: 'Food, consumer products, vehicles, and other recall notices',
    identifierTypes: [
      'GTIN / barcode',
      'model number',
      'lot / batch code',
      'expiration / use-by / best-before date',
      'distribution details',
      'recall reference'
    ],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'RappelConso raw payloads can include numero_fiche, rappel_guid, categorie_produit, marque_produit, modeles_ou_references, identification_produits, zone_geographique_de_vente, distributeurs, motif_rappel, risques_encourus, conduites_a_tenir_par_le_consommateur, and liens_vers_les_images.',
    officialSourceLabel: 'Source: France · RappelConso',
    placeholderLabel: 'RappelConso notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    quantityLabel: 'Quantity',
    distributionLabel: 'Distribution',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, GTIN/barcode, lot code, or official notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'GTIN/barcode if listed',
      'Model, lot, batch, or date details if listed',
      'Distribution or sales area details',
      'Product photos or label details if available',
      'Recall reference and publication date',
      'Instructions in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official RappelConso notice, product label, and lot or date code carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected products, identifiers, dates, distribution, and consumer instructions.'
  },
  CA_RECALLS: {
    id: 'CA_RECALLS',
    marketCode: 'CA',
    marketLabel: 'Canada',
    agencyLabel: 'Recalls and Safety Alerts',
    sourceType: 'official-api',
    displayLabel: 'Canada · Recalls and Safety Alerts',
    noticeTypeLabel: 'Recall and safety alert',
    productScopeLabel: 'Consumer products, food, health products, vehicles, and safety alerts',
    identifierTypes: [
      'UPC / barcode',
      'model number',
      'lot / batch code',
      'expiration / best-before / use-by date',
      'product number / item number',
      'DIN / NPN',
      'recall or alert id',
      'distribution details'
    ],
    supportsImages: false,
    supportsDistributionDetails: false,
    rawPayloadNotes:
      'Canada Recalls and Safety Alerts open-data records include NID, Title, URL, Organization, Product, Issue, What you should do, Category, Recall class, Last updated, and Archived. Detailed affected product tables and images are not included in the selected JSON feed.',
    officialSourceLabel: 'Source: Canada · Recalls and Safety Alerts',
    placeholderLabel: 'Canada recall notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    quantityLabel: 'Quantity',
    distributionLabel: 'Distribution',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, UPC/barcode, lot code, model details, or official notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'UPC/barcode if listed',
      'Model, item, lot, batch, or date details if listed',
      'Affected product size, variant, or package details',
      'Distribution or affected market details',
      'Recall or alert id and publication date',
      'Instructions in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected products, identifiers, dates, distribution, classification, and instructions.'
  },
  EU_SAFETY_GATE: {
    id: 'EU_SAFETY_GATE',
    marketCode: 'EU',
    marketLabel: 'European Union',
    agencyLabel: 'Safety Gate',
    sourceType: 'official-api',
    displayLabel: 'European Union · Safety Gate',
    noticeTypeLabel: 'Safety Gate alert',
    productScopeLabel: 'Dangerous non-food consumer products',
    identifierTypes: [
      'Safety Gate reference',
      'barcode',
      'model number',
      'batch number',
      'product name',
      'brand/company',
      'risk type',
      'notifying country',
      'country of origin',
      'countries concerned'
    ],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'EU Safety Gate raw payloads can include notification reference, reporting country, product category, brands, barcodes, model types, batch numbers, product versions, risk details, measures, traceability, and official product photos.',
    officialSourceLabel: 'Source: European Union · Safety Gate',
    placeholderLabel: 'Safety Gate notice',
    reasonLabel: 'Risk',
    actionLabel: 'Measure',
    quantityLabel: 'Quantity',
    distributionLabel: 'Market details',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, barcode, model, batch information, product photos, or official Safety Gate alert. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Safety Gate reference',
      'Barcode if listed',
      'Model or batch details if listed',
      'Product photos and package details',
      'Notifying country and country of origin',
      'Measure/action in the official alert'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
    officialVerificationCopy:
      'Use the official Safety Gate alert to confirm affected products, identifiers, risks, measures, notifying country, country of origin, and countries concerned.'
  },
  UK_FSA: {
    id: 'UK_FSA',
    marketCode: 'UK',
    marketLabel: 'United Kingdom',
    agencyLabel: 'FSA Food Alerts',
    sourceType: 'official-api',
    displayLabel: 'United Kingdom · FSA Food Alerts',
    noticeTypeLabel: 'Food alert',
    productScopeLabel: 'Food, allergy, and food alerts for action',
    identifierTypes: [
      'FSA alert reference',
      'allergen',
      'pathogen or contamination reason',
      'batch or lot code',
      'best-before / use-by date',
      'pack size',
      'product name',
      'brand/company'
    ],
    supportsImages: false,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'UK FSA Food Alerts records can include notation, title, description, alertURL, reportingBusiness, otherBusiness, problem risk statements, allergens/pathogens, productDetails, batchDescription, actionTaken, consumerAdvice, relatedMedia, status, and alert type.',
    officialSourceLabel: 'Source: United Kingdom · FSA Food Alerts',
    placeholderLabel: 'FSA food alert',
    reasonLabel: 'Reason',
    actionLabel: 'Consumer action',
    quantityLabel: 'Pack or quantity',
    distributionLabel: 'Market details',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your food package, label, lot or batch code, use-by or best-before date, allergen information, and official FSA notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'FSA alert reference',
      'Pack size or package description',
      'Batch, lot, best-before, or use-by details if listed',
      'Allergen, pathogen, or contamination reason',
      'Point-of-sale or customer notice details',
      'Consumer action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official FSA notice, food label, and batch or date code carefully.',
    officialVerificationCopy:
      'Use the official FSA notice to confirm affected products, pack sizes, batches, dates, allergens or risks, and consumer action.'
  },
  AU_PRODUCT_SAFETY: {
    id: 'AU_PRODUCT_SAFETY',
    marketCode: 'AU',
    marketLabel: 'Australia',
    agencyLabel: 'Product Safety Australia',
    sourceType: 'official-api',
    displayLabel: 'Australia · Product Safety Australia',
    noticeTypeLabel: 'Product safety recall',
    productScopeLabel: 'Consumer products and product safety recalls',
    identifierTypes: [
      'model number',
      'item number',
      'barcode',
      'batch or lot code',
      'product name',
      'brand/company',
      'sale dates',
      'trader or supplier details'
    ],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'Product Safety Australia records are collected from the official recalls listing AJAX view and official recall detail pages. Detail pages can include product description, brand, supplier, defects, hazards, consumer action, traders, sale dates, locations sold, manufacturer country, categories, and official product images.',
    officialSourceLabel: 'Source: Australia · Product Safety Australia',
    placeholderLabel: 'Product Safety Australia recall',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    quantityLabel: 'Quantity',
    distributionLabel: 'Sold by / where',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, model information, sale dates, supplier details, and official Product Safety Australia notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Model, item, barcode, batch, or lot details if listed',
      'Product photo and label details',
      'Supplier or trader details',
      'Sale dates and location sold if listed',
      'Reason, hazard, and consumer action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official Product Safety Australia notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected products, identifiers, sale dates, traders, locations sold, hazards, and consumer action.'
  },
  NZ_PRODUCT_SAFETY: {
    id: 'NZ_PRODUCT_SAFETY',
    marketCode: 'NZ',
    marketLabel: 'New Zealand',
    agencyLabel: 'Product Safety',
    sourceType: 'official-api',
    displayLabel: 'New Zealand · Product Safety',
    noticeTypeLabel: 'Product safety recall',
    productScopeLabel: 'Consumer products and product safety recalls',
    identifierTypes: [
      'model number',
      'SKU',
      'barcode',
      'batch or lot code',
      'product name',
      'brand/company',
      'supplier details',
      'sale dates'
    ],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'Product Safety New Zealand records are collected from the official recalled-products listing pages and official recall detail pages. Detail pages can include product identifiers, supplier contact, responsible agency, hazard, consumer action, categories, and official product images.',
    officialSourceLabel: 'Source: New Zealand · Product Safety',
    placeholderLabel: 'Product Safety New Zealand recall',
    reasonLabel: 'Hazard',
    actionLabel: 'Action',
    quantityLabel: 'Quantity',
    distributionLabel: 'Product identifiers / sold by',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, model information, supplier details, and official Product Safety New Zealand notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Model, SKU, barcode, batch, lot, or item details if listed',
      'Product photo and label details',
      'Supplier contact details',
      'Sale dates or seller details if listed',
      'Hazard and action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official Product Safety New Zealand notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected products, identifiers, sale dates, suppliers, hazards, and consumer action.'
  },
  HK_CFS: {
    id: 'HK_CFS',
    marketCode: 'HK',
    marketLabel: 'Hong Kong',
    agencyLabel: 'Centre for Food Safety',
    sourceType: 'official-api',
    displayLabel: 'Hong Kong · Centre for Food Safety',
    noticeTypeLabel: 'Food alert',
    productScopeLabel: 'Food alerts and allergy alerts',
    identifierTypes: [
      'batch number',
      'lot code',
      'best-before / use-by / expiry date',
      'pack size',
      'net weight',
      'product name',
      'brand/company',
      'importer or retailer details'
    ],
    supportsImages: false,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'Hong Kong Centre for Food Safety records are collected from the official English DATA.GOV.HK XML food-alert feed plus official CFS annual HTML archive and detail pages. Detail pages can include food product, product description, brand, origin, pack size, batch/date identifiers, reason for issuing alert, CFS action, trade advice, consumer advice, and further information links.',
    officialSourceLabel: 'Source: Hong Kong · Centre for Food Safety',
    placeholderLabel: 'Hong Kong CFS food alert',
    reasonLabel: 'Reason',
    actionLabel: 'Consumer action',
    quantityLabel: 'Pack / batch details',
    distributionLabel: 'Importer / retailer / origin',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your food package, brand, batch, best-before, use-by or expiry date, importer, retailer, and official Centre for Food Safety notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Batch, lot, best-before, use-by, expiry, or manufacture date if listed',
      'Pack size, net weight, or package description',
      'Importer, retailer, distributor, or place of origin if listed',
      'Allergen, contamination, or food-safety reason',
      'Consumer action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official CFS notice, package label, and batch or date code carefully.',
    officialVerificationCopy:
      'Use the official CFS notice to confirm affected products, dates, importer or retailer details, risks, and consumer instructions.'
  },
  FSANZ_FOOD_RECALLS: {
    id: 'FSANZ_FOOD_RECALLS',
    marketCode: 'AU/NZ',
    marketLabel: 'Australia/New Zealand',
    agencyLabel: 'FSANZ',
    sourceType: 'official-api',
    displayLabel: 'Australia/New Zealand · FSANZ',
    noticeTypeLabel: 'Food recall',
    productScopeLabel: 'Food recalls published by Food Standards Australia New Zealand',
    identifierTypes: [
      'best-before / use-by / expiry date',
      'date marking',
      'batch or lot code',
      'barcode',
      'pack size',
      'product name',
      'brand/company',
      'state or territory distribution'
    ],
    supportsImages: true,
    supportsDistributionDetails: true,
    rawPayloadNotes:
      'FSANZ food recall records are collected from the official food recall listing pages, official recall detail pages, and the official RSS feed for supplemental latest metadata. Detail pages can include product images, recall date, date marking, problem, food safety hazard, consumer action, contact, and PDF recall notice links.',
    officialSourceLabel: 'Source: Australia/New Zealand · FSANZ',
    placeholderLabel: 'FSANZ food recall',
    reasonLabel: 'Reason',
    actionLabel: 'Consumer action',
    quantityLabel: 'Date / batch details',
    distributionLabel: 'Distribution',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your food package, label, batch, barcode, best-before or use-by date, distribution, and official FSANZ notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Date marking, best-before, use-by, expiry, batch, lot, or barcode if listed',
      'Pack size or quantity if listed',
      'State, territory, retailer, or distribution details if listed',
      'Allergen, contamination, or food safety reason',
      'Consumer action in the official notice'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official FSANZ notice, food label, and batch or date code carefully.',
    officialVerificationCopy:
      'Use the official FSANZ notice to confirm affected products, date markings, batch or barcode details, distribution, risks, and consumer instructions.'
  },
  Mock: {
    id: 'Mock',
    marketCode: '',
    marketLabel: '',
    agencyLabel: '',
    sourceType: 'sample',
    displayLabel: 'Sample notice',
    noticeTypeLabel: 'Sample notice',
    productScopeLabel: 'Sample products',
    identifierTypes: [],
    supportsImages: false,
    supportsDistributionDetails: false,
    rawPayloadNotes: 'Fallback sample records are not an official source ingestion path.',
    officialSourceLabel: 'Source: Sample notice',
    placeholderLabel: 'Product recall notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    quantityLabel: 'Units',
    distributionLabel: 'Distribution',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK,
    verificationIntro:
      'Compare the details below with your product label, packaging, receipt, or official notice. A matching search result does not confirm your exact product is included.',
    verificationChecklist: [
      'Product name and brand/company',
      'Model, barcode, lot, batch, or date details if listed',
      'Official notice details',
      'Remedy/action instructions'
    ],
    sparseIdentificationCopy:
      'This recall notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected models, lots, dates, distribution, and remedies.'
  }
};

const currentCoverageSources: CurrentCoverageSourceId[] = [
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS',
  'FSANZ_FOOD_RECALLS'
];

type RecallSourceSearchScope = {
  sourceIds: CurrentCoverageSourceId[];
  aliases: string[];
};

const SOURCE_QUERY_CONTEXT_WORDS = new Set([
  'recall',
  'recalls',
  'notice',
  'notices',
  'alert',
  'alerts',
  'official',
  'officials',
  'source',
  'sources'
]);

const SOURCE_IDENTIFIER_QUERY_PATTERN = /\b(?:cpsc\s+recall\s+number|fda\s+recall\s+number|eu\s+safety\s+gate\s+reference|safety\s+gate\s+reference|fsa\s+reference|food\s+alert\s+reference|recall\s+number|recall\s+no|recall\s+id|record\s+id|alert\s+id|reference\s+number|model\s+number|model\s+no|serial\s+number|lot\s+code|lot\s+number|batch\s+code|batch\s+number|barcode|upc|gtin|ean|sku|serial|lot|batch|reference|ref)\b/;

// These aliases describe the ten official sources already indexed by the site.
// They only shape local search; they do not imply coverage beyond those sources.
const sourceSearchScopes: RecallSourceSearchScope[] = [
  {
    sourceIds: ['CPSC', 'FDA'],
    aliases: [
      'united states',
      'united states of america',
      'usa',
      '\uBBF8\uAD6D',
      '\u7F8E\u56FD',
      '\u30A2\u30E1\u30EA\u30AB'
    ]
  },
  {
    sourceIds: ['CPSC'],
    aliases: [
      'cpsc',
      'consumer product safety commission',
      'us consumer product safety commission',
      '\uBBF8\uAD6D \uC18C\uBE44\uC790 \uC81C\uD488 \uC548\uC804 \uC704\uC6D0\uD68C',
      '\uBBF8\uAD6D\uC18C\uBE44\uC790\uC81C\uD488\uC548\uC804\uC704\uC6D0\uD68C'
    ]
  },
  {
    sourceIds: ['FDA'],
    aliases: [
      'fda',
      'openfda',
      'food and drug administration',
      'us food and drug administration',
      '\uBBF8\uAD6D \uC2DD\uD488 \uC758\uC57D\uAD6D',
      '\uBBF8\uAD6D\uC2DD\uD488\uC758\uC57D\uAD6D'
    ]
  },
  {
    sourceIds: ['CA_RECALLS'],
    aliases: [
      'canada',
      'health canada',
      'canada recalls',
      '\uCE90\uB098\uB2E4',
      '\uCE90\uB098\uB2E4\uBCF4\uAC74\uBD80',
      '\u52A0\u62FF\u5927',
      '\u30AB\u30CA\u30C0'
    ]
  },
  {
    sourceIds: ['EU_SAFETY_GATE'],
    aliases: [
      'european union',
      'eu',
      'safety gate',
      'eu safety gate',
      '\uC720\uB7FD',
      '\uC720\uB7FD\uC5F0\uD569',
      '\uC548\uC804\uAC8C\uC774\uD2B8',
      '\u6B27\u76DF',
      '\u6B27\u6D32\u8054\u76DF',
      '\u30BB\u30FC\u30D5\u30C6\u30A3\u30B2\u30FC\u30C8'
    ]
  },
  {
    sourceIds: ['FR_RAPPELCONSO'],
    aliases: [
      'france',
      'rappelconso',
      'rappel conso',
      '\uD504\uB791\uC2A4',
      '\u6CD5\u56FD',
      '\u30D5\u30E9\u30F3\u30B9'
    ]
  },
  {
    sourceIds: ['UK_FSA'],
    aliases: [
      'united kingdom',
      'uk',
      'great britain',
      'britain',
      'fsa',
      'fsa food alerts',
      'food standards agency',
      '\uC601\uAD6D',
      '\uC601\uAD6D\uC2DD\uD488\uAE30\uC900\uCCAD',
      '\u82F1\u56FD',
      '\u30A4\u30AE\u30EA\u30B9'
    ]
  },
  {
    sourceIds: ['AU_PRODUCT_SAFETY'],
    aliases: [
      'australia',
      'australian',
      'product safety australia',
      'australia product safety',
      '\uD638\uC8FC',
      '\uD638\uC8FC\uC81C\uD488\uC548\uC804',
      '\u6FB3\u5927\u5229\u4E9A',
      '\u30AA\u30FC\u30B9\u30C8\u30E9\u30EA\u30A2'
    ]
  },
  {
    sourceIds: ['NZ_PRODUCT_SAFETY'],
    aliases: [
      'new zealand',
      'nz',
      'product safety new zealand',
      'new zealand product safety',
      '\uB274\uC9C8\uB79C\uB4DC',
      '\uB274\uC9C8\uB79C\uB4DC\uC81C\uD488\uC548\uC804',
      '\u65B0\u897F\u5170',
      '\u30CB\u30E5\u30FC\u30B8\u30FC\u30E9\u30F3\u30C9'
    ]
  },
  {
    sourceIds: ['HK_CFS'],
    aliases: [
      'hong kong',
      'hk',
      'cfs',
      'hong kong cfs',
      'centre for food safety',
      'center for food safety',
      '\uD64D\uCF69',
      '\uD64D\uCF69 \uC2DD\uD488 \uC548\uC804',
      '\uD64D\uCF69\uC2DD\uD488\uC548\uC804\uC13C\uD130',
      '\u9999\u6E2F',
      '\u9999\u6E2F\u98DF\u54C1\u5B89\u5168\u4E2D\u5FC3'
    ]
  },
  {
    sourceIds: ['FSANZ_FOOD_RECALLS'],
    aliases: [
      'fsanz',
      'food standards australia new zealand',
      'food standards australia',
      'australia new zealand food standards',
      '\uD638\uC8FC \uB274\uC9C8\uB79C\uB4DC \uC2DD\uD488\uAE30\uC900\uCCAD',
      '\uD638\uC8FC\uB274\uC9C8\uB79C\uB4DC\uC2DD\uD488\uAE30\uC900\uCCAD'
    ]
  }
];

function normalizeSourceSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceAliasMatchesQuery(normalizedQuery: string, normalizedAlias: string): boolean {
  if (!normalizedQuery || !normalizedAlias) {
    return false;
  }

  const hasNonAscii = /[^\x00-\x7F]/.test(normalizedAlias);
  if (hasNonAscii || normalizedAlias.includes(' ')) {
    return normalizedQuery.includes(normalizedAlias);
  }

  return normalizedQuery.split(' ').includes(normalizedAlias);
}

function removeSourceAliasesFromQuery(normalizedQuery: string, aliases: string[]): string {
  let remaining = normalizedQuery;

  for (const alias of [...new Set(aliases.map(normalizeSourceSearchText))].sort((a, b) => b.length - a.length)) {
    if (!alias) {
      continue;
    }

    if (/[^\x00-\x7F]/.test(alias) || alias.includes(' ')) {
      remaining = remaining.split(alias).join(' ');
      continue;
    }

    remaining = remaining
      .split(' ')
      .filter((token) => token !== alias)
      .join(' ');
  }

  return remaining
    .split(' ')
    .filter((token) => token && !SOURCE_QUERY_CONTEXT_WORDS.has(token))
    .join(' ');
}

export function getRecallSourceSearchIntent(query: string): RecallSourceSearchIntent | null {
  const normalizedQuery = normalizeSourceSearchText(query);
  if (!normalizedQuery || SOURCE_IDENTIFIER_QUERY_PATTERN.test(normalizedQuery)) {
    return null;
  }

  const matchedScopes = sourceSearchScopes
    .map((scope) => ({
      scope,
      matchedAliases: scope.aliases.filter((alias) =>
        sourceAliasMatchesQuery(normalizedQuery, normalizeSourceSearchText(alias))
      )
    }))
    .filter(({ matchedAliases }) => matchedAliases.length > 0);

  if (matchedScopes.length === 0) {
    return null;
  }

  const mostSpecificSourceCount = Math.min(...matchedScopes.map(({ scope }) => scope.sourceIds.length));
  const selectedScopes = matchedScopes.filter(({ scope }) => scope.sourceIds.length === mostSpecificSourceCount);
  const sourceIds = [...new Set(selectedScopes.flatMap(({ scope }) => scope.sourceIds))];
  const remainingQuery = removeSourceAliasesFromQuery(
    normalizedQuery,
    matchedScopes.flatMap(({ matchedAliases }) => matchedAliases)
  );

  return {
    sourceIds,
    remainingQuery,
    isSourceOnly: !remainingQuery
  };
}

function normalizeSourceId(source: string): RecallSourceId {
  return source === 'CPSC' ||
    source === 'FDA' ||
    source === 'FR_RAPPELCONSO' ||
    source === 'CA_RECALLS' ||
    source === 'EU_SAFETY_GATE' ||
    source === 'UK_FSA' ||
    source === 'AU_PRODUCT_SAFETY' ||
    source === 'NZ_PRODUCT_SAFETY' ||
    source === 'HK_CFS' ||
    source === 'FSANZ_FOOD_RECALLS' ||
    source === 'Mock'
    ? source
    : 'Mock';
}

export function getRecallSourceConfig(source: string): RecallSourceConfig {
  return sourceConfigs[normalizeSourceId(source)];
}

export function getRecallSourceLabel(source: string): string {
  return getRecallSourceConfig(source).displayLabel;
}

export function getRecallSourcePlaceholder(source: string): string {
  return getRecallSourceConfig(source).placeholderLabel;
}

export function getRecallReasonLabel(source: string): string {
  return getRecallSourceConfig(source).reasonLabel;
}

export function getRecallActionLabel(source: string): string {
  return getRecallSourceConfig(source).actionLabel;
}

export function getRecallQuantityLabel(source: string): string {
  return getRecallSourceConfig(source).quantityLabel;
}

export function getRecallDistributionLabel(source: string): string {
  return getRecallSourceConfig(source).distributionLabel;
}

export function getRecallDefaultActionFallback(source: string): string {
  return getRecallSourceConfig(source).defaultActionFallback;
}

export function getOfficialSourceLabel(source: string): string {
  return getRecallSourceConfig(source).officialSourceLabel;
}

export function getRecallVerificationIntro(source: string): string {
  return getRecallSourceConfig(source).verificationIntro;
}

export function getRecallVerificationChecklist(source: string): string[] {
  return getRecallSourceConfig(source).verificationChecklist;
}

export function getRecallSparseIdentificationCopy(source: string): string {
  return getRecallSourceConfig(source).sparseIdentificationCopy;
}

export function getOfficialVerificationCopy(source: string): string {
  return getRecallSourceConfig(source).officialVerificationCopy;
}

export function getSourceOptionsForCurrentCoverage(): RecallSourceOption[] {
  return currentCoverageSources.map((source) => ({
    value: source,
    label: getRecallSourceLabel(source)
  }));
}

export function getCurrentRecallSourceConfigs(): RecallSourceConfig[] {
  return currentCoverageSources.map((source) => sourceConfigs[source]);
}
