export type RecallSourceId =
  | 'CPSC'
  | 'FDA'
  | 'FR_RAPPELCONSO'
  | 'CA_RECALLS'
  | 'EU_SAFETY_GATE'
  | 'UK_FSA'
  | 'AU_PRODUCT_SAFETY'
  | 'Mock';
export type CurrentCoverageSourceId = Exclude<RecallSourceId, 'Mock'>;
export type RecallSourceType = 'official-api' | 'sample';

export type RecallSourceOption = {
  value: CurrentCoverageSourceId;
  label: string;
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
      'This indexed notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official notice, package label, and lot or date code carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official RappelConso notice, product label, and lot or date code carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official FSA notice, food label, and batch or date code carefully.',
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
      'This indexed notice may not list every identifier in a structured field. Review the official Product Safety Australia notice and product label carefully.',
    officialVerificationCopy:
      'Use the official notice to confirm affected products, identifiers, sale dates, traders, locations sold, hazards, and consumer action.'
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
      'This indexed notice may not list every identifier in a structured field. Review the official notice and product label carefully.',
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
  'AU_PRODUCT_SAFETY'
];

function normalizeSourceId(source: string): RecallSourceId {
  return source === 'CPSC' ||
    source === 'FDA' ||
    source === 'FR_RAPPELCONSO' ||
    source === 'CA_RECALLS' ||
    source === 'EU_SAFETY_GATE' ||
    source === 'UK_FSA' ||
    source === 'AU_PRODUCT_SAFETY' ||
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
