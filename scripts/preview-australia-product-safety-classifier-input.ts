import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall } from '../src/data/recall-types.ts';
import {
  buildRecallClassifierInput,
  estimateTokensFromText,
  readProcessedRecalls,
  type RecallClassifierInput
} from './build-recall-classifier-input.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = 'outputs/llm-classifier/input-preview/australia-product-safety';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Review the official Product Safety Australia notice for current instructions.',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['baby'],
  ['toddler'],
  ['toy'],
  ['button battery'],
  ['lithium'],
  ['electronics'],
  ['appliance'],
  ['furniture'],
  ['home and garden'],
  ['vehicle'],
  ['ev charger'],
  ['mobility'],
  ['machinery'],
  ['tools'],
  ['chemical'],
  ['poison'],
  ['sports'],
  ['clothing'],
  ['model'],
  ['sku'],
  ['batch'],
  ['barcode'],
  ['amazon'],
  ['ebay'],
  ['big w'],
  ['bunnings']
] as const;

type AustraliaProductSafetyRawImage = {
  url?: unknown;
  thumbnailUrl?: unknown;
  alt?: unknown;
  caption?: unknown;
};

type AustraliaProductSafetyRawDetail = {
  title?: unknown;
  supplierName?: unknown;
  publishedDate?: unknown;
  categories?: unknown;
  productDescription?: unknown;
  brand?: unknown;
  defects?: unknown;
  hazards?: unknown;
  consumerAction?: unknown;
  supplierRunningRecall?: unknown;
  traders?: unknown;
  saleDates?: unknown;
  soldWhere?: unknown;
  manufacturerCountry?: unknown;
  recallNumber?: unknown;
  images?: unknown;
};

type AustraliaProductSafetyRaw = {
  id?: unknown;
  path?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  supplierName?: unknown;
  publishedDate?: unknown;
  categories?: unknown;
  listImage?: AustraliaProductSafetyRawImage;
  detail?: AustraliaProductSafetyRawDetail;
};

type SourceHints = {
  source: 'AU_PRODUCT_SAFETY';
  market: 'Australia';
  officialSource: 'Product Safety Australia';
  sourceApi: 'Product Safety Australia recalls listing/detail pages';
  domainHint: 'consumer-product';
  classificationOwner: 'llm';
};

type AustraliaProductSafetyClassifierInputPreview = {
  id: string;
  source: 'AU_PRODUCT_SAFETY';
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategories: string[];
  sourcePrimaryCategory?: string;
  productDescription?: string;
  supplierName?: string;
  brandText?: string;
  defectText?: string;
  hazardText?: string;
  actionText?: string;
  traderText?: string;
  saleDateText?: string;
  soldWhereText?: string;
  manufacturerCountry?: string;
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type TokenComparison = {
  id: string;
  title: string;
  legacyCategory: string;
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
};

type NoiseFinding = {
  id: string;
  title: string;
  flags: string[];
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
  repeatedStrings: string[];
  overlyLongFields: string[];
  fallbackGeneratedStrings: string[];
  possibleBoilerplate: string[];
  emptyCriticalFields: string[];
  identifierCount: number;
  proposedStillNoisy: boolean;
};

type PreviewRecord = {
  id: string;
  title: string;
  legacyCategory: string;
  genericInput: RecallClassifierInput;
  proposedInput: AustraliaProductSafetyClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'AU_PRODUCT_SAFETY';
  totalAustraliaProductSafetyRecords: number;
  sampleCount: number;
  requestedLimit: number;
  babyKidsCaseIncluded: boolean;
  electronicsBatteryCaseIncluded: boolean;
  householdCaseIncluded: boolean;
  vehicleCaseIncluded: boolean;
  toolsMachineryCaseIncluded: boolean;
  chemicalsCaseIncluded: boolean;
  identifierCaseIncluded: boolean;
  imageBackedCaseIncluded: boolean;
  marketplaceCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env
    ?.AUSTRALIA_PRODUCT_SAFETY_CLASSIFIER_INPUT_PREVIEW_LIMIT;
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsed, 100));
}

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
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeForCompare(value: string): string {
  return normalizeWhitespace(stripHtml(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFallbackString(value: string): boolean {
  const normalized = normalizeForCompare(value);
  return fallbackStrings.some((fallback) => normalizeForCompare(fallback) === normalized);
}

function trimAtWordBoundary(value: string, limit: number): string {
  const text = normalizeWhitespace(stripHtml(value));
  if (!text || isFallbackString(text)) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }

  const slice = text.slice(0, limit + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = slice.slice(0, lastSpace > limit * 0.65 ? lastSpace : limit).trim();
  return `${trimmed}...`;
}

function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string' || typeof value === 'number' ? trimAtWordBoundary(String(value), limit) : '';
}

function cleanAustraliaField(value: unknown, limit = 420): string {
  const text = cleanText(value, limit)
    .replace(
      /^(?:Product description|Brand|Reason the product is recalled|The hazards to consumers|What consumers should do|Dates available for sale|Manufacturer country ID)\s+/i,
      ''
    )
    .replace(/\s+See a list of details to help identify the product\b.*$/i, '')
    .replace(/\s+Details to help identify the product\b.*$/i, '')
    .replace(/\s*Any products marked with \* along the mentioned batch numbers are safe to use\.?/gi, '')
    .trim();

  return trimAtWordBoundary(text, limit);
}

function conciseActionText(value: unknown): string {
  const text = cleanAustraliaField(value, 640);
  const withoutContactTail = text
    .replace(/\s+(?:For more information|For further information|Contact the supplier|Contact [A-Z][\s\S]*)$/i, '')
    .trim();
  return trimAtWordBoundary(withoutContactTail || text, 420);
}

function uniqueCleanList(values: unknown[], limit: number, itemLimit = 180): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = cleanAustraliaField(value, itemLimit);
    const key = normalizeForCompare(text);
    if (!text || !key || seen.has(key)) {
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

function rawPayload(record: NormalizedRecall): AustraliaProductSafetyRaw {
  return isObject(record.raw) ? (record.raw as AustraliaProductSafetyRaw) : {};
}

function rawDetail(record: NormalizedRecall): AustraliaProductSafetyRawDetail {
  const raw = rawPayload(record);
  return isObject(raw.detail) ? raw.detail : {};
}

function rawCategories(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  const detail = rawDetail(record);
  const values = [
    ...(Array.isArray(raw.categories) ? raw.categories : []),
    ...(Array.isArray(detail.categories) ? detail.categories : [])
  ];
  return uniqueCleanList(values, 10, 120);
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || record.primaryImageThumbnailUrl || (record.images?.length ?? 0) > 0);
}

function recordText(record: NormalizedRecall): string {
  const detail = rawDetail(record);
  return normalizeForCompare([
    record.id,
    record.title,
    record.category,
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.description,
    record.affectedUnits,
    record.productQuantity ?? '',
    record.distributionPattern ?? '',
    detail.productDescription,
    detail.brand,
    detail.defects,
    detail.hazards,
    detail.consumerAction,
    detail.traders,
    detail.saleDates,
    detail.soldWhere,
    detail.manufacturerCountry,
    detail.recallNumber,
    ...rawCategories(record),
    ...record.productNames,
    ...record.brandNames
  ].filter(Boolean).join(' '));
}

function extractIdentifiers(record: NormalizedRecall): string[] {
  const detail = rawDetail(record);
  const sourceText = [
    record.id,
    record.recallNumber ?? '',
    record.affectedUnits,
    record.productQuantity ?? '',
    record.distributionPattern ?? '',
    record.title,
    record.description,
    record.hazard,
    record.remedy,
    detail.productDescription,
    detail.brand,
    detail.defects,
    detail.hazards,
    detail.consumerAction,
    detail.traders,
    detail.saleDates,
    detail.soldWhere,
    detail.recallNumber,
    ...record.productNames
  ].filter(Boolean).join(' ');
  const patterns = [
    /\b(?:model|model number|model no\.?|item|item number|item no\.?|product number|product no\.?|sku|part|part number|serial|serial number)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_ -]{2,80}/gi,
    /\b(?:batch|batch number|lot|lot number|code|marking)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_ -]{2,80}/gi,
    /\b(?:barcode|GTIN|UPC|EAN)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b(?:SKU|PLU)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b[A-Z]{1,8}[0-9][A-Z0-9./_-]{2,}\b/g,
    /\b\d{8,14}\b/g
  ];

  return uniqueCleanList(patterns.flatMap((pattern) => [...sourceText.matchAll(pattern)].map((match) => match[0])), 16, 120);
}

function buildAustraliaProductSafetyClassifierInputPreview(
  record: NormalizedRecall
): AustraliaProductSafetyClassifierInputPreview {
  const raw = rawPayload(record);
  const detail = rawDetail(record);
  const sourceCategories = rawCategories(record);
  const productDescription = cleanAustraliaField(detail.productDescription, 420);
  const supplierName = cleanText(detail.supplierName ?? raw.supplierName, 180);
  const brandText = cleanAustraliaField(detail.brand, 180);
  const defectText = cleanAustraliaField(detail.defects, 420);
  const hazardText = cleanAustraliaField(detail.hazards, 420);
  const actionText = conciseActionText(detail.consumerAction);
  const traderText = cleanAustraliaField(detail.traders, 260);
  const saleDateText = cleanAustraliaField(detail.saleDates, 180);
  const soldWhereText = cleanAustraliaField(detail.soldWhere, 180);
  const manufacturerCountry = cleanAustraliaField(detail.manufacturerCountry, 120);
  const recallNumber = cleanText(detail.recallNumber ?? record.recallNumber ?? raw.id, 140);
  const identifiers = extractIdentifiers(record);

  return {
    id: record.id,
    source: 'AU_PRODUCT_SAFETY',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 260),
    productNames: uniqueCleanList([productDescription, ...record.productNames, detail.title, raw.title], 8, 180),
    brandNames: uniqueCleanList([brandText, supplierName, ...record.brandNames], 8, 160),
    sourceCategories,
    ...(sourceCategories[0] ? { sourcePrimaryCategory: sourceCategories[0] } : {}),
    ...(productDescription ? { productDescription } : {}),
    ...(supplierName ? { supplierName } : {}),
    ...(brandText ? { brandText } : {}),
    ...(defectText ? { defectText } : {}),
    ...(hazardText ? { hazardText } : {}),
    ...(actionText ? { actionText } : {}),
    ...(traderText ? { traderText } : {}),
    ...(saleDateText ? { saleDateText } : {}),
    ...(soldWhereText ? { soldWhereText } : {}),
    ...(manufacturerCountry ? { manufacturerCountry } : {}),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers,
    sourceHints: {
      source: 'AU_PRODUCT_SAFETY',
      market: 'Australia',
      officialSource: 'Product Safety Australia',
      sourceApi: 'Product Safety Australia recalls listing/detail pages',
      domainHint: 'consumer-product',
      classificationOwner: 'llm'
    }
  };
}

function inputText(value: unknown): string {
  return normalizeForCompare(JSON.stringify(value));
}

function selectAustraliaProductSafetyPreviewSample(
  records: NormalizedRecall[],
  limit: number
): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];

  const addRecord = (record: NormalizedRecall | undefined, reason: string): void => {
    if (!record) {
      notes.push(`No record found for sample reason: ${reason}`);
      return;
    }
    if (!selected.some((item) => item.id === record.id)) {
      selected.push(record);
    }
    reasonsById.set(record.id, [...(reasonsById.get(record.id) ?? []), reason]);
  };

  for (const group of sampleSearchGroups) {
    const match = records.find((record) => group.some((term) => recordText(record).includes(normalizeForCompare(term))));
    addRecord(match, `matched source evidence: ${group.join(' / ')}`);
    if (selected.length >= limit) {
      break;
    }
  }

  addRecord(records.find((record) => hasImage(record)), 'image-backed record');
  addRecord(records.find((record) => !hasImage(record)), 'image-less record if present');
  addRecord(records.find((record) => extractIdentifiers(record).length >= 2), 'identifier-rich record');
  addRecord(records.find((record) => extractIdentifiers(record).length === 0), 'sparse identifier record');
  addRecord(records.find((record) => (rawDetail(record).consumerAction?.toString().length ?? 0) > 500), 'long action text record');
  addRecord(records.find((record) => (rawDetail(record).hazards?.toString().length ?? 0) > 300), 'long hazard text record');

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    addRecord(record, 'fill default sample');
  }

  return {
    records: selected.slice(0, limit),
    reasonsById,
    notes
  };
}

function tokenComparison(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: AustraliaProductSafetyClassifierInputPreview
): TokenComparison {
  const genericSerialized = JSON.stringify(genericInput);
  const proposedSerialized = JSON.stringify(proposedInput);
  const genericEstimatedTokens = estimateTokensFromText(genericSerialized);
  const proposedEstimatedTokens = estimateTokensFromText(proposedSerialized);
  const tokenReductionPercent = genericEstimatedTokens === 0
    ? 0
    : Number((((genericEstimatedTokens - proposedEstimatedTokens) / genericEstimatedTokens) * 100).toFixed(1));

  return {
    id: record.id,
    title: record.title,
    legacyCategory: record.category,
    genericCharacters: genericSerialized.length,
    proposedCharacters: proposedSerialized.length,
    genericEstimatedTokens,
    proposedEstimatedTokens,
    tokenReductionPercent
  };
}

function repeatedStrings(values: string[]): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const value of values) {
    const normalized = normalizeForCompare(value);
    if (!normalized || normalized.length < 10) {
      continue;
    }
    const existing = counts.get(normalized);
    counts.set(normalized, { text: value, count: (existing?.count ?? 0) + 1 });
  }

  return [...counts.values()].filter((item) => item.count > 1).map((item) => item.text).slice(0, 8);
}

function objectStringValues(value: unknown): string[] {
  if (!isObject(value)) {
    return [];
  }

  return Object.values(value).flatMap((item) => {
    if (typeof item === 'string') {
      return [item];
    }
    if (Array.isArray(item)) {
      return item.filter((arrayItem): arrayItem is string => typeof arrayItem === 'string');
    }
    return [];
  });
}

function hasHtmlLeakage(value: unknown): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(JSON.stringify(value));
}

function possibleBoilerplate(values: string[]): string[] {
  return values.filter((value) =>
    /\b(?:subscribe|privacy|terms of use|social media|share this page|print this page|accessibility|feedback|report an unsafe product)\b/i.test(value)
  ).slice(0, 8);
}

function fallbackGeneratedStrings(values: string[]): string[] {
  return values.filter((value) => {
    const normalized = normalizeForCompare(value);
    return fallbackStrings.some((fallback) => normalized === normalizeForCompare(fallback));
  }).slice(0, 8);
}

function detectNoise(
  record: NormalizedRecall,
  proposedInput: AustraliaProductSafetyClassifierInputPreview,
  comparison: TokenComparison
): NoiseFinding {
  const values = objectStringValues(proposedInput);
  const repeated = repeatedStrings(values);
  const overlyLong = values.filter((value) => value.length > 650).map((value) => value.slice(0, 90));
  const fallbackGenerated = fallbackGeneratedStrings(values);
  const boilerplate = possibleBoilerplate(values);
  const emptyCritical = [
    proposedInput.title || proposedInput.productNames.length ? '' : 'missing product evidence',
    proposedInput.hazardText || proposedInput.defectText ? '' : 'missing hazard/defect evidence',
    proposedInput.actionText ? '' : 'missing action/remedy evidence',
    record.sourceUrl && values.length <= 2 ? 'sourceUrl-only record' : ''
  ].filter(Boolean);
  const flags = [
    hasHtmlLeakage(proposedInput) ? 'raw HTML leakage' : '',
    repeated.length ? 'repeated strings' : '',
    overlyLong.length ? 'overly long fields' : '',
    fallbackGenerated.length ? 'fallback/generated strings' : '',
    boilerplate.length ? 'possible boilerplate' : '',
    comparison.proposedEstimatedTokens > comparison.genericEstimatedTokens + 80 ? 'proposed input larger than generic' : '',
    proposedInput.identifiers.length >= 14 ? 'identifier over-extraction' : '',
    (proposedInput.actionText?.length ?? 0) > ((proposedInput.hazardText?.length ?? 0) + 260) ? 'action text dominates input' : '',
    ...emptyCritical
  ].filter(Boolean);

  return {
    id: record.id,
    title: record.title,
    flags,
    genericCharacters: comparison.genericCharacters,
    proposedCharacters: comparison.proposedCharacters,
    genericEstimatedTokens: comparison.genericEstimatedTokens,
    proposedEstimatedTokens: comparison.proposedEstimatedTokens,
    tokenReductionPercent: comparison.tokenReductionPercent,
    repeatedStrings: repeated,
    overlyLongFields: overlyLong,
    fallbackGeneratedStrings: fallbackGenerated,
    possibleBoilerplate: boilerplate,
    emptyCriticalFields: emptyCritical,
    identifierCount: proposedInput.identifiers.length,
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction', 'action text dominates input'].includes(flag))
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1));
}

function representativeRecords(records: PreviewRecord[]): PreviewRecord[] {
  const selected: PreviewRecord[] = [];
  const push = (record: PreviewRecord | undefined): void => {
    if (record && !selected.some((item) => item.id === record.id)) {
      selected.push(record);
    }
  };

  push(records.find((record) => /baby|toy|toddler/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /button battery|lithium|electronics|electric/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /home and garden|furniture|appliance/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /vehicle|ev charger|mobility/i.test(inputText(record.proposedInput))));
  push(records.find((record) => record.proposedInput.identifiers.length > 0));

  for (const record of records) {
    if (selected.length >= 5) {
      break;
    }
    push(record);
  }

  return selected.slice(0, 5);
}

function markdownReport(payload: PreviewPayload): string {
  const comparisons = payload.records.map((record) => record.tokenComparison);
  const genericAvg = average(comparisons.map((item) => item.genericEstimatedTokens));
  const proposedAvg = average(comparisons.map((item) => item.proposedEstimatedTokens));
  const reductionAvg = average(comparisons.map((item) => item.tokenReductionPercent));
  const missingProduct = payload.records.filter((record) => record.noise.flags.includes('missing product evidence'));
  const missingHazard = payload.records.filter((record) => record.noise.flags.includes('missing hazard/defect evidence'));
  const missingAction = payload.records.filter((record) => record.noise.flags.includes('missing action/remedy evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Current legacy category: ${record.legacyCategory}`,
    `- Source categories: ${record.proposedInput.sourceCategories.join(', ') || 'Missing'}`,
    `- Product evidence: ${[record.proposedInput.title, record.proposedInput.productDescription, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Brand/supplier evidence: ${[record.proposedInput.brandText, record.proposedInput.supplierName, ...record.proposedInput.brandNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Defect evidence: ${record.proposedInput.defectText || 'Missing'}`,
    `- Hazard evidence: ${record.proposedInput.hazardText || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || 'Missing'}`,
    `- Sale/distribution evidence: ${[record.proposedInput.traderText, record.proposedInput.saleDateText, record.proposedInput.soldWhereText].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# Australia Product Safety Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total Australia Product Safety records: ${payload.totalAustraliaProductSafetyRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Baby/kids case: ${payload.babyKidsCaseIncluded ? 'included' : 'not found'}`,
    `Electronics/battery case: ${payload.electronicsBatteryCaseIncluded ? 'included' : 'not found'}`,
    `Household case: ${payload.householdCaseIncluded ? 'included' : 'not found'}`,
    `Vehicle case: ${payload.vehicleCaseIncluded ? 'included' : 'not found'}`,
    `Tools/machinery case: ${payload.toolsMachineryCaseIncluded ? 'included' : 'not found'}`,
    `Chemicals case: ${payload.chemicalsCaseIncluded ? 'included' : 'not found'}`,
    `Identifier case: ${payload.identifierCaseIncluded ? 'included' : 'not found'}`,
    `Image-backed case: ${payload.imageBackedCaseIncluded ? 'included' : 'not found'}`,
    `Marketplace case: ${payload.marketplaceCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Hazard Or Defect Evidence',
    '',
    missingHazard.length ? missingHazard.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Action Evidence',
    '',
    missingAction.length ? missingAction.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Noisy Proposed Input',
    '',
    noisyDescription.length ? noisyDescription.map((record) => `- ${record.id}: ${record.noise.flags.join(', ')}`).join('\n') : '- None in sample',
    '',
    '## Records With Likely Over-Extracted Identifiers',
    '',
    overExtracted.length ? overExtracted.map((record) => `- ${record.id}: ${record.proposedInput.identifiers.length} identifiers`).join('\n') : '- None in sample',
    '',
    '## Recommended Australia Input Field Map',
    '',
    '- `title`: official Product Safety Australia recall title, capped at 260 characters.',
    '- `productNames`: official product description, title, and normalized source product names.',
    '- `brandNames`: official brand, supplier, and normalized source company names.',
    '- `sourceCategories` and `sourcePrimaryCategory`: official Product Safety Australia categories, evidence only.',
    '- `productDescription`: official product-description block.',
    '- `supplierName`: supplier or recalling business name.',
    '- `brandText`: official brand field when present.',
    '- `defectText`: official reason the product is recalled.',
    '- `hazardText`: official hazards-to-consumers field.',
    '- `actionText`: concise official consumer action text with long contact tail reduced.',
    '- `traderText`, `saleDateText`, and `soldWhereText`: official sale/distribution evidence.',
    '- `manufacturerCountry`: official manufacture-country evidence when present.',
    '- `recallNumber`: source record id or official recall number.',
    '- `identifiers`: explicit model, SKU, item, part, serial, batch, lot, barcode, GTIN, UPC, or similar source-derived values.',
    '- `sourceHints`: fixed Australia/Product Safety/source-domain provenance only. Final public taxonomy values remain LLM-owned.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm baby, toy, and button-battery records retain product identity and child-risk evidence.',
    '- Confirm household, electronics, vehicle/accessory, tools, chemical, sports, and clothing records are represented when present.',
    '- Confirm Product Safety Australia categories are evidence only and not final public taxonomy assignments.',
    '- Confirm supplier/contact blocks and website boilerplate do not dominate the prompt.',
    '- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, generic fallback strings, and final taxonomy fields.',
    '',
    '## Representative Records',
    '',
    ...repSections
  ].join('\n');
}

async function writeOutputs(payload: PreviewPayload): Promise<void> {
  await mkdir(absoluteOutputDir, { recursive: true });

  const tokenComparisonPayload = {
    generatedAt: payload.generatedAt,
    source: payload.source,
    sampleCount: payload.sampleCount,
    averageGenericTokens: average(payload.records.map((record) => record.tokenComparison.genericEstimatedTokens)),
    averageProposedTokens: average(payload.records.map((record) => record.tokenComparison.proposedEstimatedTokens)),
    averageReductionPercent: average(payload.records.map((record) => record.tokenComparison.tokenReductionPercent)),
    records: payload.records.map((record) => record.tokenComparison)
  };
  const noisePayload = {
    generatedAt: payload.generatedAt,
    source: payload.source,
    sampleCount: payload.sampleCount,
    noisyRecords: payload.records.filter((record) => record.noise.flags.length > 0).length,
    records: payload.records.map((record) => record.noise)
  };

  await writeFile(resolve(absoluteOutputDir, 'australia-product-safety-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'australia-product-safety-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'australia-product-safety-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'australia-product-safety-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const australiaRecords = records.filter((record) => record.source === 'AU_PRODUCT_SAFETY');
  const requestedLimit = envLimit();
  const sample = selectAustraliaProductSafetyPreviewSample(australiaRecords, Math.min(requestedLimit, australiaRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildAustraliaProductSafetyClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, proposedInput, comparison);

    return {
      id: record.id,
      title: record.title,
      legacyCategory: record.category,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });
  const joinedInputs = previewRecords.map((record) => inputText(record.proposedInput));

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'AU_PRODUCT_SAFETY',
    totalAustraliaProductSafetyRecords: australiaRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    babyKidsCaseIncluded: joinedInputs.some((text) => /baby|toddler|toy|child/.test(text)),
    electronicsBatteryCaseIncluded: joinedInputs.some((text) => /button battery|lithium|electronics|electric/.test(text)),
    householdCaseIncluded: joinedInputs.some((text) => /home and garden|furniture|appliance|household/.test(text)),
    vehicleCaseIncluded: joinedInputs.some((text) => /vehicle|ev charger|mobility/.test(text)),
    toolsMachineryCaseIncluded: joinedInputs.some((text) => /machinery|tools|hydraulic|jack/.test(text)),
    chemicalsCaseIncluded: joinedInputs.some((text) => /chemical|poison|cement|primer/.test(text)),
    identifierCaseIncluded: previewRecords.some((record) => record.proposedInput.identifiers.length > 0),
    imageBackedCaseIncluded: previewRecords.some((record) => hasImage(australiaRecords.find((item) => item.id === record.id) as NormalizedRecall)),
    marketplaceCaseIncluded: joinedInputs.some((text) => /amazon|ebay|big w|bunnings|trader|sold by/.test(text)),
    outputDir,
    notes: sample.notes,
    records: previewRecords
  };

  await writeOutputs(payload);

  const genericAvg = average(previewRecords.map((record) => record.tokenComparison.genericEstimatedTokens));
  const proposedAvg = average(previewRecords.map((record) => record.tokenComparison.proposedEstimatedTokens));
  const reductionAvg = average(previewRecords.map((record) => record.tokenComparison.tokenReductionPercent));
  const noiseCount = previewRecords.filter((record) => record.noise.flags.length > 0).length;

  console.log(JSON.stringify({
    totalAustraliaProductSafetyRecords: payload.totalAustraliaProductSafetyRecords,
    sampleCount: payload.sampleCount,
    babyKidsCaseIncluded: payload.babyKidsCaseIncluded,
    electronicsBatteryCaseIncluded: payload.electronicsBatteryCaseIncluded,
    householdCaseIncluded: payload.householdCaseIncluded,
    vehicleCaseIncluded: payload.vehicleCaseIncluded,
    toolsMachineryCaseIncluded: payload.toolsMachineryCaseIncluded,
    chemicalsCaseIncluded: payload.chemicalsCaseIncluded,
    identifierCaseIncluded: payload.identifierCaseIncluded,
    imageBackedCaseIncluded: payload.imageBackedCaseIncluded,
    marketplaceCaseIncluded: payload.marketplaceCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/australia-product-safety-input-preview.json`,
      markdownReport: `${outputDir}/australia-product-safety-input-preview.md`,
      noiseReport: `${outputDir}/australia-product-safety-noise-report.json`,
      tokenComparison: `${outputDir}/australia-product-safety-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
