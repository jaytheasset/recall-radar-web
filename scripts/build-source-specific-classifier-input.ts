import type { NormalizedRecall, RecallSource } from '../src/data/recall-types.ts';
import { buildRecallClassifierInput } from './build-recall-classifier-input.ts';

export type SourceSpecificClassifierInput = {
  id: string;
  source: RecallSource;
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategory?: string;
  sourceSubcategory?: string;
  sourceClassification?: string;
  sourceStatus?: string;
  productDescription?: string;
  hazardText?: string;
  riskText?: string;
  reasonText?: string;
  problemText?: string;
  defectText?: string;
  remedyText?: string;
  actionText?: string;
  affectedUnits?: string;
  productQuantity?: string;
  distributionText?: string;
  recallNumber?: string;
  identifiers: string[];
  affectedProducts?: Array<Record<string, string>>;
  productDetails?: Array<Record<string, string>>;
  sourceHints: {
    source: RecallSource;
    market: string;
    officialSource: string;
    domainHint: 'consumer-product' | 'food' | 'medical-health' | 'mixed';
    classificationOwner: 'llm';
  };
};

const sourceHints: Record<RecallSource, SourceSpecificClassifierInput['sourceHints']> = {
  CPSC: {
    source: 'CPSC',
    market: 'United States',
    officialSource: 'Consumer Product Safety Commission',
    domainHint: 'consumer-product',
    classificationOwner: 'llm'
  },
  FDA: {
    source: 'FDA',
    market: 'United States',
    officialSource: 'FDA / openFDA food enforcement',
    domainHint: 'food',
    classificationOwner: 'llm'
  },
  FR_RAPPELCONSO: {
    source: 'FR_RAPPELCONSO',
    market: 'France',
    officialSource: 'RappelConso',
    domainHint: 'mixed',
    classificationOwner: 'llm'
  },
  CA_RECALLS: {
    source: 'CA_RECALLS',
    market: 'Canada',
    officialSource: 'Government of Canada recalls and safety alerts',
    domainHint: 'mixed',
    classificationOwner: 'llm'
  },
  EU_SAFETY_GATE: {
    source: 'EU_SAFETY_GATE',
    market: 'European Union',
    officialSource: 'Safety Gate',
    domainHint: 'consumer-product',
    classificationOwner: 'llm'
  },
  UK_FSA: {
    source: 'UK_FSA',
    market: 'United Kingdom',
    officialSource: 'FSA Food Alerts',
    domainHint: 'food',
    classificationOwner: 'llm'
  },
  AU_PRODUCT_SAFETY: {
    source: 'AU_PRODUCT_SAFETY',
    market: 'Australia',
    officialSource: 'Product Safety Australia',
    domainHint: 'consumer-product',
    classificationOwner: 'llm'
  },
  NZ_PRODUCT_SAFETY: {
    source: 'NZ_PRODUCT_SAFETY',
    market: 'New Zealand',
    officialSource: 'Product Safety New Zealand',
    domainHint: 'consumer-product',
    classificationOwner: 'llm'
  },
  HK_CFS: {
    source: 'HK_CFS',
    market: 'Hong Kong',
    officialSource: 'Centre for Food Safety',
    domainHint: 'food',
    classificationOwner: 'llm'
  },
  FSANZ_FOOD_RECALLS: {
    source: 'FSANZ_FOOD_RECALLS',
    market: 'Australia / New Zealand',
    officialSource: 'Food Standards Australia New Zealand',
    domainHint: 'food',
    classificationOwner: 'llm'
  }
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'");
}

function cleanText(value: unknown, limit = 500): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  const text = normalizeWhitespace(stripHtml(String(value)));
  if (!text || ['n/a', 'unknown', 'not listed'].includes(text.toLowerCase())) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }

  const slice = text.slice(0, limit + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const boundary = lastSpace > limit * 0.65 ? lastSpace : limit;
  return `${slice.slice(0, boundary).trimEnd()}...`;
}

function valueText(value: unknown, limit = 240): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return cleanText(value, limit);
  }
  if (!isObject(value)) {
    return '';
  }

  for (const key of [
    'name',
    'Name',
    'label',
    'prefLabel',
    'title',
    'value',
    'Value',
    'description',
    'text',
    'code',
    'notation',
    'id',
    '@id'
  ]) {
    const text = valueText(value[key], limit);
    if (text) {
      return text;
    }
  }

  return '';
}

function at(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => (isObject(current) ? current[key] : undefined), source);
}

function firstText(raw: unknown, paths: string[], limit = 500): string {
  for (const path of paths) {
    const text = valueText(at(raw, path), limit);
    if (text) {
      return text;
    }
  }
  return '';
}

function unique(values: unknown[], limit: number, itemLimit = 180): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = valueText(value, itemLimit);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(text);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function arrayText(raw: unknown, paths: string[], limit = 12): string[] {
  const values: unknown[] = [];
  for (const path of paths) {
    const value = at(raw, path);
    if (Array.isArray(value)) {
      values.push(...value);
    } else if (typeof value !== 'undefined') {
      values.push(value);
    }
  }
  return unique(values, limit);
}

function detailRows(rawRows: unknown, limit = 12): Array<Record<string, string>> {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  const output: Array<Record<string, string>> = [];
  for (const row of rawRows) {
    if (!isObject(row)) {
      continue;
    }

    const label = cleanText(row.label ?? row.name ?? row.key, 120);
    const value = cleanText(row.value ?? row.text ?? row.lines, 400);
    const item: Record<string, string> = {};
    if (label) {
      item.label = label;
    }
    if (value) {
      item.value = value;
    }
    if (Object.keys(item).length > 0) {
      output.push(item);
    }
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function compact<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  const requiredArrayKeys = new Set(['productNames', 'brandNames', 'identifiers']);

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    if (Array.isArray(value) && value.length === 0 && !requiredArrayKeys.has(key)) {
      continue;
    }
    if (isObject(value) && Object.keys(value).length === 0) {
      continue;
    }
    output[key] = value;
  }

  return output as T;
}

function common(record: NormalizedRecall): SourceSpecificClassifierInput {
  const generic = buildRecallClassifierInput(record);
  return {
    id: record.id,
    source: record.source,
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: generic.title,
    productNames: generic.productNames,
    brandNames: generic.brandNames,
    sourceCategory: cleanText(record.category, 240),
    sourceClassification: cleanText(record.classification, 160),
    sourceStatus: cleanText(record.status, 160),
    productDescription: generic.description,
    hazardText: generic.hazard,
    remedyText: generic.remedy,
    affectedUnits: cleanText(record.affectedUnits, 180),
    productQuantity: cleanText(record.productQuantity, 180),
    distributionText: cleanText(record.distributionPattern, 360),
    recallNumber: cleanText(record.recallNumber, 120),
    identifiers: generic.identifiers,
    sourceHints: sourceHints[record.source]
  };
}

function withIdentifiers(record: NormalizedRecall, values: unknown[], limit = 18): string[] {
  return unique([...common(record).identifiers, record.recallNumber, record.affectedUnits, record.productQuantity, ...values], limit, 200);
}

function cpsc(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  return compact({
    ...common(record),
    productDescription: firstText(raw, ['Description'], 700) || common(record).productDescription,
    hazardText: arrayText(raw, ['Hazards'], 8).join(' | ') || common(record).hazardText,
    remedyText: arrayText(raw, ['Remedies', 'RemedyOptions'], 10).join(' | ') || common(record).remedyText,
    sourceCategory: common(record).sourceCategory,
    productNames: unique([...record.productNames, ...arrayText(raw, ['Products', 'Inconjunctions'], 10)], 12),
    brandNames: unique([...record.brandNames, ...arrayText(raw, ['Manufacturers', 'Retailers', 'Importers', 'Distributors'], 12)], 12),
    identifiers: withIdentifiers(record, [...arrayText(raw, ['ProductUPCs', 'Products', 'Inconjunctions'], 20)])
  });
}

function fda(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  return compact({
    ...common(record),
    sourceCategory: firstText(raw, ['product_type'], 120) || common(record).sourceCategory,
    sourceClassification: firstText(raw, ['classification'], 120),
    sourceStatus: firstText(raw, ['status'], 120),
    productDescription: firstText(raw, ['product_description'], 700) || common(record).productDescription,
    reasonText: firstText(raw, ['reason_for_recall'], 700) || common(record).hazardText,
    productQuantity: firstText(raw, ['product_quantity'], 240) || common(record).productQuantity,
    distributionText: firstText(raw, ['distribution_pattern'], 500) || common(record).distributionText,
    brandNames: unique([...record.brandNames, firstText(raw, ['recalling_firm'], 180)], 8),
    recallNumber: firstText(raw, ['recall_number'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['event_id'], 120),
      firstText(raw, ['code_info'], 500),
      firstText(raw, ['more_code_info'], 500),
      firstText(raw, ['center_classification_date'], 120),
      firstText(raw, ['termination_date'], 120)
    ])
  });
}

function rappelConso(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  return compact({
    ...common(record),
    sourceCategory: firstText(raw, ['categorie_produit'], 220) || common(record).sourceCategory,
    sourceSubcategory: firstText(raw, ['sous_categorie_produit'], 220),
    productDescription: firstText(raw, ['modeles_ou_references', 'informations_complementaires_publiques'], 700) || common(record).productDescription,
    riskText: firstText(raw, ['risques_encourus', 'description_complementaire_risque'], 700) || common(record).hazardText,
    reasonText: firstText(raw, ['motif_rappel'], 500),
    actionText: firstText(raw, ['conduites_a_tenir_par_le_consommateur', 'preconisations_sanitaires'], 500) || common(record).remedyText,
    distributionText: firstText(raw, ['zone_geographique_de_vente', 'distributeurs'], 500) || common(record).distributionText,
    brandNames: unique([...record.brandNames, firstText(raw, ['marque_produit'], 180)], 10),
    recallNumber: firstText(raw, ['numero_fiche', 'rappel_guid', 'id'], 160) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['modeles_ou_references'], 500),
      firstText(raw, ['conditionnements'], 300),
      ...arrayText(raw, ['identification_produits'], 18)
    ], 24)
  });
}

function canada(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  const detail = at(raw, 'Detail');
  return compact({
    ...common(record),
    sourceCategory: firstText(raw, ['Category'], 220) || common(record).sourceCategory,
    sourceClassification: firstText(raw, ['Recall class'], 160),
    productDescription: firstText(raw, ['Product', 'Detail.summary.product'], 500) || common(record).productDescription,
    issueText: firstText(raw, ['Issue', 'Detail.summary.issue'], 500) || common(record).hazardText,
    actionText: firstText(raw, ['What you should do', 'Detail.summary.action'], 500) || common(record).remedyText,
    brandNames: unique([...record.brandNames, firstText(raw, ['Organization'], 220)], 10),
    affectedProducts: detailRows(at(detail, 'affectedProducts'), 12),
    recallNumber: firstText(raw, ['NID'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['NID'], 120),
      firstText(detail, ['affectedProductsHeader', 'affectedProductsCaption'], 400),
      JSON.stringify(at(detail, 'affectedProducts') ?? '')
    ], 24)
  });
}

function euSafetyGate(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  return compact({
    ...common(record),
    sourceCategory: firstText(raw, ['product.productCategory.name', 'product.productCategory.code'], 220) || common(record).sourceCategory,
    productDescription: firstText(raw, ['product.description.name', 'product.name.name', 'product.nameSpecific'], 700) || common(record).productDescription,
    riskText: [
      ...arrayText(raw, ['risk.riskType'], 8),
      firstText(raw, ['risk.versions'], 700)
    ].filter(Boolean).join(' | ') || common(record).hazardText,
    actionText: arrayText(raw, ['measureTaken.measures'], 12).join(' | ') || common(record).remedyText,
    productNames: unique([...record.productNames, firstText(raw, ['product.nameSpecific', 'product.name.name'], 220)], 10),
    brandNames: unique([...record.brandNames, ...arrayText(raw, ['product.brands'], 10)], 10),
    recallNumber: firstText(raw, ['reference', 'id'], 160) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['reference'], 120),
      firstText(raw, ['country.name'], 120),
      firstText(raw, ['traceability.countryOrigin.name'], 120),
      ...arrayText(raw, ['product.barcodes', 'product.batchNumbers', 'product.modelTypes'], 24)
    ], 28)
  });
}

function ukFsa(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  return compact({
    ...common(record),
    sourceCategory: arrayText(raw, ['type'], 4).join(' | ') || common(record).sourceCategory,
    sourceStatus: firstText(raw, ['status.prefLabel', 'status.label'], 120),
    productDescription: firstText(raw, ['description', 'SMStext'], 700) || common(record).productDescription,
    problemText: arrayText(raw, ['problem'], 8).join(' | ') || common(record).hazardText,
    actionText: firstText(raw, ['consumerAdvice', 'actionTaken'], 700) || common(record).remedyText,
    brandNames: unique([...record.brandNames, firstText(raw, ['reportingBusiness.commonName'], 220)], 10),
    productDetails: detailRows(at(raw, 'productDetails'), 12),
    recallNumber: firstText(raw, ['notation'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['notation'], 120),
      JSON.stringify(at(raw, 'productDetails') ?? '')
    ], 24)
  });
}

function australia(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  const detail = at(raw, 'detail');
  return compact({
    ...common(record),
    sourceCategory: arrayText(raw, ['categories', 'detail.categories'], 8).join(' | ') || common(record).sourceCategory,
    productDescription: firstText(detail, ['productDescription'], 700) || common(record).productDescription,
    defectText: firstText(detail, ['defects'], 500),
    hazardText: firstText(detail, ['hazards'], 500) || common(record).hazardText,
    actionText: firstText(detail, ['consumerAction'], 500) || common(record).remedyText,
    distributionText: [firstText(detail, ['traders'], 300), firstText(detail, ['saleDates'], 160), firstText(detail, ['soldWhere'], 240)].filter(Boolean).join(' | '),
    brandNames: unique([...record.brandNames, firstText(detail, ['brand'], 180), firstText(raw, ['supplierName'], 180), firstText(detail, ['supplierName'], 180)], 12),
    recallNumber: firstText(raw, ['id'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['id', 'path'], 180),
      firstText(detail, ['manufacturerCountry'], 180)
    ])
  });
}

function newZealand(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  const detail = at(raw, 'detail');
  return compact({
    ...common(record),
    sourceCategory: arrayText(raw, ['categories'], 8).join(' | ') || common(record).sourceCategory,
    productDescription: firstText(detail, ['metaDescription', 'productIdentifiers'], 700) || common(record).productDescription,
    hazardText: firstText(detail, ['hazard'], 500) || common(record).hazardText,
    actionText: firstText(detail, ['action'], 500) || common(record).remedyText,
    brandNames: unique([...record.brandNames, firstText(detail, ['supplierName'], 180)], 10),
    recallNumber: firstText(raw, ['id'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['id', 'path'], 180),
      firstText(detail, ['productIdentifiers'], 700),
      firstText(detail, ['responsibleAgency'], 180)
    ], 24)
  });
}

function hongKongCfs(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  const detail = at(raw, 'detail');
  return compact({
    ...common(record),
    sourceCategory: 'Food alert',
    productDescription: firstText(detail, ['text'], 700) || firstText(raw, ['xmlItem.description'], 500) || common(record).productDescription,
    riskText: firstText(detail, ['text'], 700) || common(record).hazardText,
    actionText: common(record).remedyText,
    productDetails: detailRows(at(detail, 'rows'), 12),
    recallNumber: firstText(raw, ['id'], 120) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['id'], 120),
      JSON.stringify(at(detail, 'rows') ?? '')
    ], 24)
  });
}

function fsanz(record: NormalizedRecall, raw: unknown): SourceSpecificClassifierInput {
  const detail = at(raw, 'detail');
  return compact({
    ...common(record),
    sourceCategory: 'Food recall',
    productDescription: firstText(detail, ['introduction', 'metaDescription', 'text'], 700) || common(record).productDescription,
    problemText: firstText(detail, ['problem'], 500) || common(record).hazardText,
    hazardText: firstText(detail, ['foodSafetyHazard'], 500) || common(record).hazardText,
    actionText: firstText(detail, ['whatToDo'], 500) || common(record).remedyText,
    productQuantity: firstText(detail, ['dateMarking'], 240) || common(record).productQuantity,
    brandNames: common(record).brandNames,
    recallNumber: firstText(raw, ['path'], 180) || common(record).recallNumber,
    identifiers: withIdentifiers(record, [
      firstText(raw, ['path'], 180),
      firstText(detail, ['dateMarking'], 500),
      firstText(detail, ['contact'], 300)
    ], 24)
  });
}

export function buildSourceSpecificClassifierInput(record: NormalizedRecall): SourceSpecificClassifierInput {
  const raw = isObject(record.raw) ? record.raw : {};

  switch (record.source) {
    case 'CPSC':
      return cpsc(record, raw);
    case 'FDA':
      return fda(record, raw);
    case 'FR_RAPPELCONSO':
      return rappelConso(record, raw);
    case 'CA_RECALLS':
      return canada(record, raw);
    case 'EU_SAFETY_GATE':
      return euSafetyGate(record, raw);
    case 'UK_FSA':
      return ukFsa(record, raw);
    case 'AU_PRODUCT_SAFETY':
      return australia(record, raw);
    case 'NZ_PRODUCT_SAFETY':
      return newZealand(record, raw);
    case 'HK_CFS':
      return hongKongCfs(record, raw);
    case 'FSANZ_FOOD_RECALLS':
      return fsanz(record, raw);
  }
}
