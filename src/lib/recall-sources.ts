export type RecallSourceId = 'CPSC' | 'FDA' | 'FR_RAPPELCONSO' | 'Mock';
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
    placeholderLabel: 'Recall notice',
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
    placeholderLabel: 'FDA food notice',
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
    placeholderLabel: 'Recall notice',
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

const currentCoverageSources: CurrentCoverageSourceId[] = ['CPSC', 'FDA', 'FR_RAPPELCONSO'];

function normalizeSourceId(source: string): RecallSourceId {
  return source === 'CPSC' || source === 'FDA' || source === 'FR_RAPPELCONSO' || source === 'Mock'
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
