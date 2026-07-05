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
const outputDir = 'outputs/llm-classifier/input-preview/hong-kong-cfs';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Review the official Centre for Food Safety notice for current instructions.',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['allergen'],
  ['undeclared'],
  ['salmonella'],
  ['e coli'],
  ['bacteria'],
  ['histamine'],
  ['patulin'],
  ['pesticide'],
  ['foreign matter'],
  ['plastic'],
  ['glass'],
  ['best-before'],
  ['best before'],
  ['use-by'],
  ['expiry'],
  ['batch'],
  ['lot'],
  ['barcode'],
  ['jan code'],
  ['importer'],
  ['retailer'],
  ['food-allergy']
] as const;

type HongKongCfsDetailRow = {
  label?: unknown;
  value?: unknown;
  lines?: unknown;
};

type HongKongCfsRawDetail = {
  title?: unknown;
  issueDate?: unknown;
  sourceOfInformation?: unknown;
  rows?: unknown;
  text?: unknown;
};

type HongKongCfsRaw = {
  id?: unknown;
  xmlItem?: {
    title?: unknown;
    description?: unknown;
  };
  detail?: HongKongCfsRawDetail;
};

type SourceHints = {
  source: 'HK_CFS';
  market: 'Hong Kong';
  officialSource: 'Centre for Food Safety';
  sourceApi: 'Hong Kong CFS food alerts XML/detail pages';
  domainHint: 'food';
  expectedProductFamilyHint: 'food-grocery';
  classificationOwner: 'llm';
};

type HongKongCfsClassifierInputPreview = {
  id: string;
  source: 'HK_CFS';
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategory?: string;
  productDescription?: string;
  riskText?: string;
  hazardText?: string;
  actionText?: string;
  foodAlertType?: string;
  origin?: string;
  importer?: string;
  retailer?: string;
  packSize?: string;
  batch?: string;
  expiry?: string;
  bestBefore?: string;
  useBy?: string;
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type FoodRiskBucket =
  | 'allergen'
  | 'contamination-pathogen'
  | 'contamination-chemical'
  | 'foreign-matter'
  | 'labeling-date-marking'
  | 'other-food-risk';

type TokenComparison = {
  id: string;
  title: string;
  legacyCategory: string;
  foodRiskBucket: FoodRiskBucket;
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
};

type NoiseFinding = {
  id: string;
  title: string;
  foodRiskBucket: FoodRiskBucket;
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
  foodRiskBucket: FoodRiskBucket;
  genericInput: RecallClassifierInput;
  proposedInput: HongKongCfsClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'HK_CFS';
  totalHongKongCfsRecords: number;
  sampleCount: number;
  requestedLimit: number;
  allergenCaseIncluded: boolean;
  contaminationCaseIncluded: boolean;
  foreignMatterCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.HONG_KONG_CFS_CLASSIFIER_INPUT_PREVIEW_LIMIT;
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
    .replace(/&#39;/gi, "'");
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

function uniqueCleanList(values: unknown[], limit: number, itemLimit = 180): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = cleanText(value, itemLimit);
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

function rawPayload(record: NormalizedRecall): HongKongCfsRaw {
  return isObject(record.raw) ? (record.raw as HongKongCfsRaw) : {};
}

function rawDetail(record: NormalizedRecall): HongKongCfsRawDetail {
  const raw = rawPayload(record);
  return isObject(raw.detail) ? raw.detail : {};
}

function detailRows(record: NormalizedRecall): HongKongCfsDetailRow[] {
  const detail = rawDetail(record);
  return Array.isArray(detail.rows) ? (detail.rows.filter(isObject) as HongKongCfsDetailRow[]) : [];
}

function rowValue(record: NormalizedRecall, label: string): string {
  const normalizedLabel = label.toLowerCase();
  const row = detailRows(record).find((item) => cleanText(item.label, 120).toLowerCase() === normalizedLabel);
  return row ? cleanText(row.value, 900) : '';
}

function rowLines(record: NormalizedRecall, label: string): string[] {
  const normalizedLabel = label.toLowerCase();
  const row = detailRows(record).find((item) => cleanText(item.label, 120).toLowerCase() === normalizedLabel);
  if (!row) {
    return [];
  }

  if (Array.isArray(row.lines)) {
    return uniqueCleanList(row.lines, 20, 260);
  }

  return uniqueCleanList(cleanText(row.value, 1200).split(/\s{2,}|;\s*/), 20, 260);
}

function productDescriptionPairs(record: NormalizedRecall): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const line of rowLines(record, 'Product Name and Description')) {
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (match) {
      pairs[normalizeForCompare(match[1])] = cleanText(match[2], 260);
    }
  }

  return pairs;
}

function valuesForKeys(pairs: Record<string, string>, keys: string[]): string[] {
  return uniqueCleanList(keys.map((key) => pairs[normalizeForCompare(key)] ?? ''), keys.length, 240);
}

function recordText(record: NormalizedRecall): string {
  const raw = rawPayload(record);
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
    record.recallNumber ?? '',
    raw.xmlItem?.description,
    detail.sourceOfInformation,
    detail.text,
    ...record.productNames,
    ...record.brandNames
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function foodRiskBucket(record: NormalizedRecall): FoodRiskBucket {
  const raw = rawPayload(record);
  const detail = rawDetail(record);
  const text = normalizeForCompare([
    record.id,
    record.title,
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.description,
    record.affectedUnits,
    record.productQuantity ?? '',
    record.distributionPattern ?? '',
    record.recallNumber ?? '',
    raw.xmlItem?.description,
    detail.sourceOfInformation,
    rowValue(record, 'Food Product'),
    rowValue(record, 'Product Name and Description'),
    rowValue(record, 'Reason For Issuing Alert'),
    rowValue(record, 'Advice to Consumers'),
    rowValue(record, 'Advice to the Trade'),
    ...record.productNames,
    ...record.brandNames
  ].filter((value): value is string => typeof value === 'string').join(' '));
  if (/\b(?:salmonella|listeria|e\s?coli|shiga|bacillus|cereus|pathogen|bacteria|microbial|histamine)\b/.test(text)) {
    return 'contamination-pathogen';
  }
  if (/\b(?:chemical|ethylene oxide|patulin|mycotoxin|pesticide|toxin|nitrofuran|chloramphenicol|mercury|heavy metal|preservative|sulphur dioxide)\b/.test(text)) {
    return 'contamination-chemical';
  }
  if (/\b(?:foreign matter|glass|metal|plastic|rubber|fragment|fragments)\b/.test(text)) {
    return 'foreign-matter';
  }
  if (/\b(?:allergen|allergy|undeclared|contains undeclared|may contain undeclared)\b/.test(text)) {
    return 'allergen';
  }
  if (/\b(?:best before|best-before|use by|use-by|expiry|expiration|manufacture date|label|labelling|labeling)\b/.test(text)) {
    return 'labeling-date-marking';
  }
  return 'other-food-risk';
}

function firstValue(pairs: Record<string, string>, keys: string[]): string {
  return valuesForKeys(pairs, keys)[0] ?? '';
}

function identifierMatches(record: NormalizedRecall): string[] {
  const sourceText = [
    record.title,
    record.description,
    record.hazard,
    record.remedy,
    record.affectedUnits,
    record.productQuantity,
    record.distributionPattern,
    rowValue(record, 'Product Name and Description'),
    rowValue(record, 'Further Information')
  ].filter((value): value is string => typeof value === 'string').join(' ');
  const patterns = [
    /\b(?:Best[- ]Before|Use[- ]By|Expiry|Expiration|Manufacture)\s+date\s*[:#-]?\s*[A-Za-z0-9 ,./-]{3,70}/gi,
    /\b(?:Batch(?: Number)?|Batch No\.?|Lot(?: Number)?|Lot No\.?|Code|JAN code|Barcode|GTIN|UPC)\s*[:#-]?\s*[-A-Za-z0-9/., ]{2,90}/gi,
    /\b\d+(?:\.\d+)?\s?(?:g|kg|ml|l|litre|litres|grams|bottle|pack|packs|can|cans|x\s?\d+)\b/gi,
    /\b\d{8,14}\b/g
  ];

  return patterns.flatMap((pattern) => sourceText.match(pattern) ?? []);
}

function extractHongKongCfsIdentifiers(record: NormalizedRecall): string[] {
  const pairs = productDescriptionPairs(record);
  const explicit = valuesForKeys(pairs, [
    'pack size',
    'net weight',
    'volume',
    'size',
    'batch number',
    'batch no.',
    'lot number',
    'lot no.',
    'barcode',
    'jan code',
    'gtin',
    'upc',
    'best-before date',
    'best before date',
    'use-by date',
    'use by date',
    'expiry date',
    'expiration date',
    'manufacture date'
  ]);

  return uniqueCleanList(
    [
      record.recallNumber,
      record.affectedUnits,
      record.productQuantity,
      ...explicit,
      ...identifierMatches(record)
    ],
    14,
    190
  );
}

function isLikelyProductName(value: string, record: NormalizedRecall): boolean {
  const text = normalizeForCompare(value);
  const companyKeys = record.brandNames.map((brand) => normalizeForCompare(brand)).filter(Boolean);
  if (!text || companyKeys.includes(text)) {
    return false;
  }
  return !/\b(?:best before|best by|use by|expiry|expiration|manufacture date|batch|lot|barcode|gtin|upc|jan code|retailer|importer)\b/.test(text);
}

function buildHongKongCfsClassifierInputPreview(record: NormalizedRecall): HongKongCfsClassifierInputPreview {
  const raw = rawPayload(record);
  const detail = rawDetail(record);
  const pairs = productDescriptionPairs(record);
  const sourceCategory = cleanText(record.category, 160);
  const foodProduct = rowValue(record, 'Food Product');
  const productDescription = cleanText(
    rowValue(record, 'Product Name and Description') || raw.xmlItem?.description || record.description,
    360
  );
  const riskText = cleanText(rowValue(record, 'Reason For Issuing Alert') || record.hazard || record.reason || '', 420);
  const actionText = cleanText(
    rowValue(record, 'Advice to Consumers') ||
      rowValue(record, 'Advice to the Trade') ||
      rowValue(record, 'Action Taken by the Centre for Food Safety') ||
      record.remedy,
    260
  );
  const foodAlertType = cleanText(detail.sourceOfInformation || record.classification, 180);
  const origin = firstValue(pairs, ['place of origin', 'origin', 'country of origin']);
  const importer = firstValue(pairs, ['importer', 'distributor', 'manufacturer']);
  const retailer = firstValue(pairs, ['retailer']);
  const packSize = firstValue(pairs, ['pack size', 'net weight', 'volume', 'size']);
  const batch = firstValue(pairs, ['batch number', 'batch no.', 'lot number', 'lot no.', 'code']);
  const expiry = firstValue(pairs, ['expiry date', 'expiration date']);
  const bestBefore = firstValue(pairs, ['best-before date', 'best before date']);
  const useBy = firstValue(pairs, ['use-by date', 'use by date']);
  const recallNumber = cleanText(record.recallNumber || raw.id, 120);
  const productNames = uniqueCleanList(
    [
      firstValue(pairs, ['product name']),
      foodProduct,
      ...record.productNames.filter((name) => isLikelyProductName(name, record))
    ],
    6,
    180
  );
  const brandNames = uniqueCleanList(
    [
      firstValue(pairs, ['brand']),
      ...record.brandNames
    ],
    5,
    180
  );

  return {
    id: record.id,
    source: 'HK_CFS',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    productNames,
    brandNames,
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(productDescription ? { productDescription } : {}),
    ...(riskText ? { riskText } : {}),
    ...(actionText ? { actionText } : {}),
    ...(foodAlertType ? { foodAlertType } : {}),
    ...(origin ? { origin } : {}),
    ...(importer ? { importer } : {}),
    ...(retailer ? { retailer } : {}),
    ...(packSize ? { packSize } : {}),
    ...(batch ? { batch } : {}),
    ...(expiry ? { expiry } : {}),
    ...(bestBefore ? { bestBefore } : {}),
    ...(useBy ? { useBy } : {}),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers: extractHongKongCfsIdentifiers(record),
    sourceHints: {
      source: 'HK_CFS',
      market: 'Hong Kong',
      officialSource: 'Centre for Food Safety',
      sourceApi: 'Hong Kong CFS food alerts XML/detail pages',
      domainHint: 'food',
      expectedProductFamilyHint: 'food-grocery',
      classificationOwner: 'llm'
    }
  };
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || record.primaryImageThumbnailUrl || (Array.isArray(record.images) && record.images.length > 0));
}

function pushSample(
  selected: NormalizedRecall[],
  reasonsById: Map<string, string[]>,
  record: NormalizedRecall | undefined,
  reason: string
): void {
  if (!record) {
    return;
  }

  if (!selected.some((item) => item.id === record.id)) {
    selected.push(record);
  }
  const reasons = reasonsById.get(record.id) ?? [];
  reasons.push(reason);
  reasonsById.set(record.id, reasons);
}

function findByText(records: NormalizedRecall[], terms: readonly string[]): NormalizedRecall | undefined {
  return records.find((record) => {
    const text = recordText(record);
    return terms.every((term) => text.includes(normalizeForCompare(term)));
  });
}

function selectHongKongCfsPreviewSample(records: NormalizedRecall[], limit: number): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const byIdentifierCount = [...records].sort((a, b) => extractHongKongCfsIdentifiers(b).length - extractHongKongCfsIdentifiers(a).length);
  const sparseIdentifiers = [...records].sort((a, b) => extractHongKongCfsIdentifiers(a).length - extractHongKongCfsIdentifiers(b).length);
  const byLongText = [...records].sort((a, b) => ([b.hazard, b.remedy].join(' ').length - [a.hazard, a.remedy].join(' ').length));
  const nonAllergenFood = records.find((record) => foodRiskBucket(record) !== 'allergen');

  pushSample(selected, reasonsById, records.find((record) => foodRiskBucket(record) === 'allergen'), 'allergen or undeclared allergen case');
  pushSample(selected, reasonsById, records.find((record) => ['contamination-pathogen', 'contamination-chemical'].includes(foodRiskBucket(record))), 'contamination case');
  pushSample(selected, reasonsById, records.find((record) => foodRiskBucket(record) === 'foreign-matter'), 'foreign matter case');
  pushSample(selected, reasonsById, findByText(records, ['best before']) ?? findByText(records, ['best-before']) ?? findByText(records, ['use by']) ?? findByText(records, ['expiry']) ?? findByText(records, ['batch']), 'expiry batch or date case');
  pushSample(selected, reasonsById, findByText(records, ['importer']) ?? findByText(records, ['retailer']), 'importer or retailer case');
  pushSample(selected, reasonsById, sparseIdentifiers[0], 'sparse identifier case');
  pushSample(selected, reasonsById, records.find((record) => hasImage(record)), 'image-backed review case');
  pushSample(selected, reasonsById, records.find((record) => !hasImage(record)), 'image-less review case');
  pushSample(selected, reasonsById, byLongText[0], 'long risk/action text case');
  pushSample(selected, reasonsById, nonAllergenFood, 'non-allergen food recall case');
  pushSample(selected, reasonsById, byIdentifierCount[0], 'record with many extracted identifiers');

  for (const terms of sampleSearchGroups) {
    pushSample(selected, reasonsById, findByText(records, terms), `Hong Kong CFS search terms: ${terms.join(', ')}`);
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushSample(selected, reasonsById, record, 'fill sample to requested limit');
  }

  if (!selected.some((record) => foodRiskBucket(record) === 'allergen')) {
    notes.push('No allergen or undeclared allergen Hong Kong CFS record found in the current sample.');
  }
  if (!selected.some((record) => ['contamination-pathogen', 'contamination-chemical'].includes(foodRiskBucket(record)))) {
    notes.push('No contamination Hong Kong CFS record found in the current sample.');
  }
  if (!selected.some((record) => foodRiskBucket(record) === 'foreign-matter')) {
    notes.push('No foreign matter Hong Kong CFS record found in the current sample.');
  }
  if (!selected.some((record) => hasImage(record))) {
    notes.push('No image-backed Hong Kong CFS record selected; current source records may rely on text-only official notices.');
  }
  if (!selected.some((record) => !hasImage(record))) {
    notes.push('No image-less Hong Kong CFS record found in the current sample.');
  }

  return {
    records: selected.slice(0, limit),
    reasonsById,
    notes
  };
}

function inputText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function tokenComparison(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: HongKongCfsClassifierInputPreview): TokenComparison {
  const genericText = inputText(genericInput);
  const proposedText = inputText(proposedInput);
  const genericTokens = estimateTokensFromText(genericText);
  const proposedTokens = estimateTokensFromText(proposedText);
  const reduction = genericTokens > 0 ? Number((((genericTokens - proposedTokens) / genericTokens) * 100).toFixed(1)) : 0;

  return {
    id: record.id,
    title: record.title,
    legacyCategory: record.category,
    foodRiskBucket: foodRiskBucket(record),
    genericCharacters: genericText.length,
    proposedCharacters: proposedText.length,
    genericEstimatedTokens: genericTokens,
    proposedEstimatedTokens: proposedTokens,
    tokenReductionPercent: reduction
  };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }
  if (isObject(value)) {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }
  return [];
}

function repeatedStrings(input: unknown): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const text of collectStrings(input)) {
    const clean = cleanText(text, 500);
    const key = normalizeForCompare(clean);
    if (key.length < 24) {
      continue;
    }
    const current = counts.get(key) ?? { text: clean, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.values()]
    .filter((item) => item.count > 1)
    .map((item) => item.text)
    .slice(0, 8);
}

function fieldLengths(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: HongKongCfsClassifierInputPreview): string[] {
  const fields: Array<[string, string | undefined, number]> = [
    ['record.description', record.description, 1200],
    ['record.hazard', record.hazard, 850],
    ['record.remedy', record.remedy, 700],
    ['generic.description', genericInput.description, 780],
    ['generic.remedy', genericInput.remedy, 480],
    ['proposed.productDescription', proposedInput.productDescription, 500],
    ['proposed.riskText', proposedInput.riskText, 550],
    ['proposed.actionText', proposedInput.actionText, 380],
    ['proposed.importer', proposedInput.importer, 180],
    ['proposed.retailer', proposedInput.retailer, 180]
  ];

  return fields
    .filter(([, value, limit]) => typeof value === 'string' && value.length > limit)
    .map(([field]) => field);
}

function fallbackFindings(input: unknown): string[] {
  const strings = collectStrings(input);
  return [...new Set(strings.filter((text) => isFallbackString(text)).map((text) => cleanText(text, 140)))];
}

function boilerplateFindings(input: unknown): string[] {
  const text = collectStrings(input).join('\n');
  const findings: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/\bCentre for Food Safety Food and Environmental Hygiene Department\b/i, 'government footer text'],
    [/\bThe CFS press release\b/i, 'press release link text'],
    [/\bMembers of the public may call\b/i, 'public hotline text'],
    [/\bhotline\b/i, 'hotline contact text'],
    [/\bduring office hours\b/i, 'office-hours contact text'],
    [/\bBack\b/i, 'navigation text'],
    [/\bFood Surveillance Programme\b/i, 'surveillance-programme boilerplate'],
    [/\bThe CFS will alert the trade\b/i, 'standard CFS follow-up text'],
    [/\binvestigation is ongoing\b/i, 'standard investigation text'],
    [/\bvendor concerned\b/i, 'generic vendor wording'],
    [/\bimporter concerned\b/i, 'generic importer wording'],
    [/\bwww\.[^\s]+/i, 'web/contact URL text'],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, 'email contact text'],
    [/\b(?:\+?\d[\d\s().-]{7,})\b/i, 'phone number text']
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(text)) {
      findings.push(label);
    }
  }

  return [...new Set(findings)];
}

function hasHtmlLeakage(input: unknown): boolean {
  return /<[^>]+>|&nbsp;|<script|<style/i.test(collectStrings(input).join('\n'));
}

function criticalFieldFindings(proposedInput: HongKongCfsClassifierInputPreview): string[] {
  const findings: string[] = [];
  const productEvidence = [proposedInput.title, ...proposedInput.productNames, proposedInput.productDescription].filter(Boolean).join(' ');
  if (!productEvidence) {
    findings.push('missing product identity');
  }
  if (!proposedInput.riskText && !proposedInput.hazardText) {
    findings.push('missing hazard/risk evidence');
  }
  if (!proposedInput.actionText) {
    findings.push('missing action evidence');
  }
  if (proposedInput.sourceUrl && !proposedInput.title && !proposedInput.productDescription && !proposedInput.riskText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function importerContactDominates(proposedInput: HongKongCfsClassifierInputPreview): boolean {
  const importerRetailerText = [proposedInput.importer, proposedInput.retailer].filter(Boolean).join(' ');
  const riskActionText = [proposedInput.riskText, proposedInput.actionText].filter(Boolean).join(' ');
  return importerRetailerText.length > 260 && importerRetailerText.length > riskActionText.length;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: HongKongCfsClassifierInputPreview,
  comparison: TokenComparison
): NoiseFinding {
  const repeated = repeatedStrings(proposedInput);
  const overlyLong = fieldLengths(record, genericInput, proposedInput);
  const fallbackGenerated = [...new Set([...fallbackFindings(genericInput), ...fallbackFindings(proposedInput)])];
  const possibleBoilerplate = boilerplateFindings({
    ...proposedInput,
    sourceUrl: ''
  });
  const emptyCritical = criticalFieldFindings(proposedInput);
  const flags: string[] = [];

  if (hasHtmlLeakage(proposedInput) || hasHtmlLeakage(genericInput)) {
    flags.push('raw HTML leakage');
  }
  if (repeated.length) {
    flags.push('repeated strings');
  }
  if (overlyLong.length) {
    flags.push('overly long fields');
  }
  if (fallbackGenerated.length) {
    flags.push('fallback/generated strings');
  }
  if (possibleBoilerplate.length) {
    flags.push('possible boilerplate');
  }
  if (emptyCritical.includes('missing product identity')) {
    flags.push('missing product identity');
  }
  if (emptyCritical.includes('missing hazard/risk evidence')) {
    flags.push('missing hazard/risk evidence');
  }
  if (emptyCritical.includes('missing action evidence')) {
    flags.push('missing action evidence');
  }
  if (proposedInput.identifiers.length >= 14) {
    flags.push('identifier over-extraction');
  }
  if ((proposedInput.actionText?.length ?? 0) > ((proposedInput.riskText?.length ?? 0) + 240)) {
    flags.push('action text dominates input');
  }
  if (importerContactDominates(proposedInput)) {
    flags.push('importer/contact text dominates input');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

  return {
    id: comparison.id,
    title: comparison.title,
    foodRiskBucket: comparison.foodRiskBucket,
    flags,
    genericCharacters: comparison.genericCharacters,
    proposedCharacters: comparison.proposedCharacters,
    genericEstimatedTokens: comparison.genericEstimatedTokens,
    proposedEstimatedTokens: comparison.proposedEstimatedTokens,
    tokenReductionPercent: comparison.tokenReductionPercent,
    repeatedStrings: repeated,
    overlyLongFields: overlyLong,
    fallbackGeneratedStrings: fallbackGenerated,
    possibleBoilerplate,
    emptyCriticalFields: emptyCritical,
    identifierCount: proposedInput.identifiers.length,
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction', 'importer/contact text dominates input'].includes(flag))
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

  push(records.find((record) => record.foodRiskBucket === 'allergen'));
  push(records.find((record) => ['contamination-pathogen', 'contamination-chemical'].includes(record.foodRiskBucket)));
  push(records.find((record) => record.foodRiskBucket === 'foreign-matter'));
  push(records.find((record) => record.proposedInput.importer || record.proposedInput.retailer));
  push(records.find((record) => record.noise.flags.includes('identifier over-extraction')));

  for (const record of records) {
    if (selected.length >= 5) {
      break;
    }
    push(record);
  }

  return selected.slice(0, 5);
}

function riskBucketSummary(records: PreviewRecord[]): string {
  const counts = new Map<FoodRiskBucket, number>();
  for (const record of records) {
    counts.set(record.foodRiskBucket, (counts.get(record.foodRiskBucket) ?? 0) + 1);
  }
  return [...counts.entries()].map(([bucket, count]) => `- ${bucket}: ${count}`).join('\n') || '- None';
}

function markdownReport(payload: PreviewPayload): string {
  const comparisons = payload.records.map((record) => record.tokenComparison);
  const genericAvg = average(comparisons.map((item) => item.genericEstimatedTokens));
  const proposedAvg = average(comparisons.map((item) => item.proposedEstimatedTokens));
  const reductionAvg = average(comparisons.map((item) => item.tokenReductionPercent));
  const missingProduct = payload.records.filter((record) => record.noise.flags.includes('missing product identity'));
  const missingHazard = payload.records.filter((record) => record.noise.flags.includes('missing hazard/risk evidence'));
  const missingAction = payload.records.filter((record) => record.noise.flags.includes('missing action evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Current legacy category: ${record.legacyCategory}`,
    `- Food risk bucket: ${record.foodRiskBucket}`,
    `- Product evidence: ${[record.proposedInput.title, ...record.proposedInput.productNames, record.proposedInput.productDescription].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Brand/company evidence: ${[...record.proposedInput.brandNames, record.proposedInput.importer, record.proposedInput.retailer].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Risk evidence: ${record.proposedInput.riskText || record.proposedInput.hazardText || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# Hong Kong CFS Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total Hong Kong CFS records: ${payload.totalHongKongCfsRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Allergen case: ${payload.allergenCaseIncluded ? 'included' : 'not found'}`,
    `Contamination case: ${payload.contaminationCaseIncluded ? 'included' : 'not found'}`,
    `Foreign matter case: ${payload.foreignMatterCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Food Risk Buckets In Sample',
    '',
    riskBucketSummary(payload.records),
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Hazard Or Risk Evidence',
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
    '## Recommended Hong Kong CFS Input Field Map',
    '',
    '- `title`: official Hong Kong CFS alert title, capped at 240 characters.',
    '- `productNames`: product and food product names only, excluding date marks and importer-only strings.',
    '- `brandNames`: brand names from product description rows.',
    '- `productDescription`: structured product description row or XML summary, capped at 470 characters.',
    '- `riskText` / `hazardText`: official reason for issuing alert, capped at 520 characters.',
    '- `actionText`: consumer or trade advice, capped at 360 characters.',
    '- `foodAlertType`: CFS source information or current classification label.',
    '- `origin`, `importer`, `retailer`: source row values when concise and useful.',
    '- `packSize`, `batch`, `expiry`, `bestBefore`, `useBy`: explicit source identifiers when available.',
    '- `recallNumber`: stable source record id.',
    '- `identifiers`: up to 14 source-derived pack, batch, date, barcode, JAN, GTIN, UPC, or recall id values.',
    '- `sourceHints`: fixed Hong Kong food-domain hints.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm allergen and undeclared allergen records keep allergen evidence.',
    '- Confirm pathogen, chemical, toxin, and foreign matter cases retain risk evidence.',
    '- Confirm batch, date, pack, barcode, JAN, importer, and retailer fields are useful without flooding the prompt.',
    '- Confirm government boilerplate, footer, hotline, and navigation text do not dominate the proposed input.',
    '- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'hong-kong-cfs-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'hong-kong-cfs-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'hong-kong-cfs-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'hong-kong-cfs-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const hongKongCfsRecords = records.filter((record) => record.source === 'HK_CFS');
  const requestedLimit = envLimit();
  const sample = selectHongKongCfsPreviewSample(hongKongCfsRecords, Math.min(requestedLimit, hongKongCfsRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildHongKongCfsClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, genericInput, proposedInput, comparison);

    return {
      id: record.id,
      title: record.title,
      legacyCategory: record.category,
      foodRiskBucket: comparison.foodRiskBucket,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'HK_CFS',
    totalHongKongCfsRecords: hongKongCfsRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    allergenCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'allergen'),
    contaminationCaseIncluded: previewRecords.some((record) => ['contamination-pathogen', 'contamination-chemical'].includes(record.foodRiskBucket)),
    foreignMatterCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'foreign-matter'),
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
    totalHongKongCfsRecords: payload.totalHongKongCfsRecords,
    sampleCount: payload.sampleCount,
    allergenCaseIncluded: payload.allergenCaseIncluded,
    contaminationCaseIncluded: payload.contaminationCaseIncluded,
    foreignMatterCaseIncluded: payload.foreignMatterCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/hong-kong-cfs-input-preview.json`,
      markdownReport: `${outputDir}/hong-kong-cfs-input-preview.md`,
      noiseReport: `${outputDir}/hong-kong-cfs-noise-report.json`,
      tokenComparison: `${outputDir}/hong-kong-cfs-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
