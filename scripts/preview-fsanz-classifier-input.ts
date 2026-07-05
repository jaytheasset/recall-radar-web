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
const outputDir = 'outputs/llm-classifier/input-preview/fsanz';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Food recall reason not listed',
  'Review the official FSANZ recall notice',
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
  ['listeria'],
  ['e coli'],
  ['chemical'],
  ['foreign matter'],
  ['plastic'],
  ['glass'],
  ['best before'],
  ['use by'],
  ['batch'],
  ['lot'],
  ['barcode'],
  ['pack'],
  ['food-allergy']
] as const;

type FsanzRawDetail = {
  title?: unknown;
  metaDescription?: unknown;
  introduction?: unknown;
  dateMarking?: unknown;
  problem?: unknown;
  foodSafetyHazard?: unknown;
  whatToDo?: unknown;
  contact?: unknown;
  text?: unknown;
};

type SourceHints = {
  source: 'FSANZ_FOOD_RECALLS';
  market: 'Australia / New Zealand';
  officialSource: 'Food Standards Australia New Zealand';
  sourceApi: 'FSANZ food recall listing/detail pages';
  domainHint: 'food';
  expectedProductFamilyHint: 'food-grocery';
  classificationOwner: 'llm';
};

type FsanzClassifierInputPreview = {
  id: string;
  source: 'FSANZ_FOOD_RECALLS';
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategory?: string;
  productDescription?: string;
  problemText?: string;
  foodSafetyHazardText?: string;
  actionText?: string;
  dateMarking?: string;
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type FoodHazardBucket =
  | 'allergen'
  | 'contamination-pathogen'
  | 'contamination-chemical'
  | 'foreign-matter'
  | 'labeling-date-marking'
  | 'unknown';

type TokenComparison = {
  id: string;
  title: string;
  legacyCategory: string;
  foodHazardBucket: FoodHazardBucket;
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
};

type NoiseFinding = {
  id: string;
  title: string;
  foodHazardBucket: FoodHazardBucket;
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
  foodHazardBucket: FoodHazardBucket;
  genericInput: RecallClassifierInput;
  proposedInput: FsanzClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'FSANZ_FOOD_RECALLS';
  totalFsanzRecords: number;
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
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.FSANZ_CLASSIFIER_INPUT_PREVIEW_LIMIT;
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
  return typeof value === 'string' ? trimAtWordBoundary(value, limit) : '';
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

function rawDetail(record: NormalizedRecall): FsanzRawDetail {
  if (!isObject(record.raw) || !isObject(record.raw.detail)) {
    return {};
  }
  return record.raw.detail as FsanzRawDetail;
}

function rawText(record: NormalizedRecall, key: string): string {
  if (!isObject(record.raw)) {
    return '';
  }
  return cleanText(record.raw[key], 500);
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
    detail.introduction,
    detail.problem,
    detail.foodSafetyHazard,
    detail.whatToDo,
    detail.dateMarking,
    ...record.productNames,
    ...record.brandNames
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function foodHazardBucket(record: NormalizedRecall): FoodHazardBucket {
  const detail = rawDetail(record);
  const text = normalizeForCompare([
    record.hazard,
    record.reason ?? '',
    record.description,
    detail.metaDescription,
    detail.problem,
    detail.foodSafetyHazard,
    detail.whatToDo
  ].filter((value): value is string => typeof value === 'string').join(' '));
  if (/\b(?:allergen|allergy|undeclared|milk|egg|peanut|gluten|soy|sesame|sulphite|sulfite|crustacean|shellfish)\b/.test(text)) {
    return 'allergen';
  }
  if (/\b(?:salmonella|listeria|e\s?coli|microbial|pathogen|bacteria)\b/.test(text)) {
    return 'contamination-pathogen';
  }
  if (/\b(?:chemical|ethylene oxide|aflatoxin|pesticide|toxin|nitrofurazone|prohibited substance)\b/.test(text)) {
    return 'contamination-chemical';
  }
  if (/\b(?:foreign matter|glass|metal|plastic|rubber|fragment|fragments)\b/.test(text)) {
    return 'foreign-matter';
  }
  if (/\b(?:date marking|best before|use by|expiry|label|labelling|labeling)\b/.test(text)) {
    return 'labeling-date-marking';
  }
  return 'unknown';
}

function identifierMatches(record: NormalizedRecall): string[] {
  const detail = rawDetail(record);
  const sourceText = [
    record.title,
    record.description,
    record.hazard,
    record.remedy,
    record.affectedUnits,
    record.productQuantity,
    record.distributionPattern,
    detail.dateMarking,
    detail.introduction,
    detail.problem,
    detail.foodSafetyHazard,
    detail.whatToDo
  ].filter((value): value is string => typeof value === 'string').join(' ');
  const patterns = [
    /\b(?:Best Before|Use By|Expiry|Date Marking)[:#]?\s*[-A-Za-z0-9/., ]{2,80}/gi,
    /\b(?:Batch(?: Numbers?)?|Batch No\.?|Lot(?: Number)?|Code|Barcode|GTIN|UPC)[:#]?\s*[-A-Za-z0-9/., ]{2,90}/gi,
    /\b\d+(?:\.\d+)?\s?(?:g|kg|ml|l|litre|litres|pack|packs|x\s?\d+)\b/gi,
    /\b\d{8,14}\b/g
  ];

  return patterns.flatMap((pattern) => sourceText.match(pattern) ?? []);
}

function isLikelyProductName(value: string, record: NormalizedRecall): boolean {
  const text = normalizeForCompare(value);
  const companyKeys = record.brandNames.map((brand) => normalizeForCompare(brand)).filter(Boolean);
  if (!text || companyKeys.includes(text)) {
    return false;
  }
  return !/\b(?:best before|use by|batch|lot|barcode|gtin|upc|date marking)\b/.test(text);
}

function extractFsanzIdentifiers(record: NormalizedRecall): string[] {
  const detail = rawDetail(record);
  return uniqueCleanList(
    [
      record.recallNumber,
      cleanText(detail.dateMarking, 160),
      record.affectedUnits,
      record.productQuantity,
      ...identifierMatches(record)
    ],
    14,
    180
  );
}

function buildFsanzClassifierInputPreview(record: NormalizedRecall): FsanzClassifierInputPreview {
  const detail = rawDetail(record);
  const sourceCategory = cleanText(record.category, 160);
  const productDescription = cleanText(detail.introduction || rawText(record, 'listSummary') || record.description, 450);
  const problemText = cleanText(detail.problem || record.hazard || record.reason || '', 420);
  const foodSafetyHazardText = cleanText(detail.foodSafetyHazard, 420);
  const actionText = cleanText(detail.whatToDo || record.remedy, 320);
  const dateMarking = cleanText(detail.dateMarking, 180);
  const recallNumber = cleanText(record.recallNumber, 100);
  const productNames = uniqueCleanList(
    record.productNames.filter((name) => isLikelyProductName(name, record)),
    6,
    180
  );

  return {
    id: record.id,
    source: 'FSANZ_FOOD_RECALLS',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    productNames,
    brandNames: uniqueCleanList(record.brandNames, 4),
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(productDescription ? { productDescription } : {}),
    ...(problemText ? { problemText } : {}),
    ...(foodSafetyHazardText ? { foodSafetyHazardText } : {}),
    ...(actionText ? { actionText } : {}),
    ...(dateMarking ? { dateMarking } : {}),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers: extractFsanzIdentifiers(record),
    sourceHints: {
      source: 'FSANZ_FOOD_RECALLS',
      market: 'Australia / New Zealand',
      officialSource: 'Food Standards Australia New Zealand',
      sourceApi: 'FSANZ food recall listing/detail pages',
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

function selectFsanzPreviewSample(records: NormalizedRecall[], limit: number): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const byIdentifierCount = [...records].sort((a, b) => extractFsanzIdentifiers(b).length - extractFsanzIdentifiers(a).length);
  const sparseIdentifiers = [...records].sort((a, b) => extractFsanzIdentifiers(a).length - extractFsanzIdentifiers(b).length);
  const withLongAvailability = records.find((record) => /available for sale|retail|stores|online|nationally/i.test(cleanText(rawDetail(record).introduction, 700)));
  const nonAllergenLegacyFoodAllergy = records.find((record) => record.category === 'food-allergy' && foodHazardBucket(record) !== 'allergen');

  pushSample(selected, reasonsById, records.find((record) => foodHazardBucket(record) === 'allergen'), 'allergen or undeclared allergen case');
  pushSample(selected, reasonsById, records.find((record) => foodHazardBucket(record) === 'contamination-pathogen'), 'pathogen contamination case');
  pushSample(selected, reasonsById, records.find((record) => foodHazardBucket(record) === 'contamination-chemical'), 'chemical contamination case');
  pushSample(selected, reasonsById, records.find((record) => foodHazardBucket(record) === 'foreign-matter'), 'foreign matter case');
  pushSample(selected, reasonsById, records.find((record) => foodHazardBucket(record) === 'labeling-date-marking'), 'date marking or labeling case');
  pushSample(selected, reasonsById, findByText(records, ['best before']) ?? findByText(records, ['use by']) ?? findByText(records, ['expiry']), 'date marking evidence case');
  pushSample(selected, reasonsById, findByText(records, ['batch']) ?? findByText(records, ['lot']) ?? findByText(records, ['barcode']), 'batch lot or barcode evidence case');
  pushSample(selected, reasonsById, findByText(records, ['kg']) ?? findByText(records, ['g']) ?? findByText(records, ['ml']), 'pack size evidence case');
  pushSample(selected, reasonsById, records.find((record) => hasImage(record)), 'image-backed review case');
  pushSample(selected, reasonsById, records.find((record) => !hasImage(record)), 'image-less review case if present');
  pushSample(selected, reasonsById, sparseIdentifiers[0], 'record with sparse extracted identifiers');
  pushSample(selected, reasonsById, byIdentifierCount[0], 'record with many extracted identifiers');
  pushSample(selected, reasonsById, withLongAvailability, 'long availability or distribution prose case');
  pushSample(selected, reasonsById, nonAllergenLegacyFoodAllergy, 'legacy food-allergy category but non-allergen hazard case');
  pushSample(selected, reasonsById, records.find((record) => record.brandNames.length > 0 && record.productNames.length > 0), 'company and product split case');

  for (const terms of sampleSearchGroups) {
    pushSample(selected, reasonsById, findByText(records, terms), `food source search terms: ${terms.join(', ')}`);
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushSample(selected, reasonsById, record, 'fill sample to requested limit');
  }

  if (!selected.some((record) => foodHazardBucket(record) === 'allergen')) {
    notes.push('No allergen record found in the current FSANZ records.');
  } else {
    notes.push('Allergen or undeclared allergen record included.');
  }
  if (!selected.some((record) => ['contamination-pathogen', 'contamination-chemical'].includes(foodHazardBucket(record)))) {
    notes.push('No pathogen or chemical contamination record found in the current FSANZ records.');
  } else {
    notes.push('Contamination record included.');
  }
  if (!selected.some((record) => foodHazardBucket(record) === 'foreign-matter')) {
    notes.push('No foreign matter record found in the current FSANZ records.');
  } else {
    notes.push('Foreign matter record included.');
  }
  if (nonAllergenLegacyFoodAllergy) {
    notes.push('Legacy food-allergy category includes at least one non-allergen FSANZ hazard.');
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

function tokenComparison(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: FsanzClassifierInputPreview): TokenComparison {
  const genericText = inputText(genericInput);
  const proposedText = inputText(proposedInput);
  const genericTokens = estimateTokensFromText(genericText);
  const proposedTokens = estimateTokensFromText(proposedText);
  const reduction = genericTokens > 0 ? Number((((genericTokens - proposedTokens) / genericTokens) * 100).toFixed(1)) : 0;

  return {
    id: record.id,
    title: record.title,
    legacyCategory: record.category,
    foodHazardBucket: foodHazardBucket(record),
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

function fieldLengths(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: FsanzClassifierInputPreview): string[] {
  const fields: Array<[string, string | undefined, number]> = [
    ['record.description', record.description, 1200],
    ['record.hazard', record.hazard, 750],
    ['record.remedy', record.remedy, 750],
    ['generic.description', genericInput.description, 780],
    ['generic.remedy', genericInput.remedy, 480],
    ['proposed.productDescription', proposedInput.productDescription, 470],
    ['proposed.problemText', proposedInput.problemText, 450],
    ['proposed.foodSafetyHazardText', proposedInput.foodSafetyHazardText, 450],
    ['proposed.actionText', proposedInput.actionText, 340]
  ];

  return fields
    .filter(([, value, limit]) => typeof value === 'string' && value.length > limit)
    .map(([field]) => field);
}

function fallbackFindings(input: unknown): string[] {
  const strings = collectStrings(input);
  return [...new Set(strings.filter((text) => isFallbackString(text)).map((text) => cleanText(text, 120)))];
}

function boilerplateFindings(input: unknown): string[] {
  const text = collectStrings(input).join('\n');
  const findings: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/\bconsumer(?:s)? concerned about their health should seek medical advice\b/i, 'standard FSANZ health advice'],
    [/\breturn the product\(s\) to the place of purchase for a full refund\b/i, 'standard refund instruction'],
    [/\bavailable for sale\b/i, 'availability/distribution prose'],
    [/\bonline nationally\b/i, 'availability/distribution prose'],
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

function criticalFieldFindings(record: NormalizedRecall, proposedInput: FsanzClassifierInputPreview): string[] {
  const findings: string[] = [];
  const productEvidence = [proposedInput.title, ...proposedInput.productNames].filter(Boolean).join(' ');
  if (!productEvidence) {
    findings.push('missing product identity');
  }
  if (!proposedInput.problemText && !proposedInput.foodSafetyHazardText) {
    findings.push('missing problem/hazard text');
  }
  if (!proposedInput.dateMarking && /best before|use by|expiry|date marking/i.test(recordText(record))) {
    findings.push('missing date marking');
  }
  if (proposedInput.sourceUrl && !proposedInput.title && !proposedInput.productDescription && !proposedInput.problemText) {
    findings.push('sourceUrl-only record');
  }
  if (proposedInput.productNames.length > 0 && proposedInput.productNames.every((name) => record.brandNames.some((brand) => normalizeForCompare(brand) === normalizeForCompare(name)))) {
    findings.push('product name only company name');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: FsanzClassifierInputPreview,
  comparison: TokenComparison
): NoiseFinding {
  const repeated = repeatedStrings(proposedInput);
  const overlyLong = fieldLengths(record, genericInput, proposedInput);
  const fallbackGenerated = [...new Set([...fallbackFindings(genericInput), ...fallbackFindings(proposedInput)])];
  const possibleBoilerplate = boilerplateFindings({
    ...proposedInput,
    sourceUrl: ''
  });
  const emptyCritical = criticalFieldFindings(record, proposedInput);
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
  if (possibleBoilerplate.includes('availability/distribution prose') && (proposedInput.productDescription?.length ?? 0) > 260) {
    flags.push('long availability/distribution prose');
  }
  if (emptyCritical.includes('missing product identity')) {
    flags.push('missing product identity');
  }
  if (emptyCritical.includes('missing problem/hazard text')) {
    flags.push('missing problem/hazard text');
  }
  if (emptyCritical.includes('missing date marking')) {
    flags.push('missing date marking');
  }
  if (emptyCritical.includes('product name only company name')) {
    flags.push('product name only company name');
  }
  if (proposedInput.identifiers.length >= 14) {
    flags.push('identifier over-extraction');
  }
  if ((proposedInput.actionText?.length ?? 0) > ((proposedInput.problemText?.length ?? 0) + (proposedInput.foodSafetyHazardText?.length ?? 0) + 180)) {
    flags.push('action text dominates input');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

  return {
    id: record.id,
    title: record.title,
    foodHazardBucket: comparison.foodHazardBucket,
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
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction', 'long availability/distribution prose'].includes(flag))
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

  push(records.find((record) => record.foodHazardBucket === 'allergen'));
  push(records.find((record) => record.foodHazardBucket === 'contamination-pathogen'));
  push(records.find((record) => record.foodHazardBucket === 'contamination-chemical'));
  push(records.find((record) => record.foodHazardBucket === 'foreign-matter'));
  push(records.find((record) => record.noise.flags.includes('identifier over-extraction')));
  push(records.find((record) => record.noise.flags.includes('missing problem/hazard text')));

  for (const record of records) {
    if (selected.length >= 5) {
      break;
    }
    push(record);
  }

  return selected.slice(0, 5);
}

function hazardBucketSummary(records: PreviewRecord[]): string {
  const counts = new Map<FoodHazardBucket, number>();
  for (const record of records) {
    counts.set(record.foodHazardBucket, (counts.get(record.foodHazardBucket) ?? 0) + 1);
  }
  return [...counts.entries()].map(([bucket, count]) => `- ${bucket}: ${count}`).join('\n') || '- None';
}

function markdownReport(payload: PreviewPayload): string {
  const comparisons = payload.records.map((record) => record.tokenComparison);
  const genericAvg = average(comparisons.map((item) => item.genericEstimatedTokens));
  const proposedAvg = average(comparisons.map((item) => item.proposedEstimatedTokens));
  const reductionAvg = average(comparisons.map((item) => item.tokenReductionPercent));
  const missingProduct = payload.records.filter((record) => record.noise.flags.includes('missing product identity'));
  const missingHazard = payload.records.filter((record) => record.noise.flags.includes('missing problem/hazard text'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Current legacy category: ${record.legacyCategory}`,
    `- Food hazard bucket: ${record.foodHazardBucket}`,
    `- Product evidence: ${[record.proposedInput.title, ...record.proposedInput.productNames, ...record.proposedInput.brandNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Problem evidence: ${record.proposedInput.problemText || 'Missing'}`,
    `- Food safety hazard evidence: ${record.proposedInput.foodSafetyHazardText || 'Missing'}`,
    `- Date marking: ${record.proposedInput.dateMarking || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# FSANZ Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total FSANZ records: ${payload.totalFsanzRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Allergen case: ${payload.allergenCaseIncluded ? 'included' : 'not found'}`,
    `Contamination case: ${payload.contaminationCaseIncluded ? 'included' : 'not found'}`,
    `Foreign matter case: ${payload.foreignMatterCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Hazard Buckets In Sample',
    '',
    hazardBucketSummary(payload.records),
    '',
    '## Records With Missing Product Identity',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Problem Or Hazard Text',
    '',
    missingHazard.length ? missingHazard.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Noisy Description Or Proposed Input',
    '',
    noisyDescription.length ? noisyDescription.map((record) => `- ${record.id}: ${record.noise.flags.join(', ')}`).join('\n') : '- None in sample',
    '',
    '## Records With Likely Over-Extracted Identifiers',
    '',
    overExtracted.length ? overExtracted.map((record) => `- ${record.id}: ${record.proposedInput.identifiers.length} identifiers`).join('\n') : '- None in sample',
    '',
    '## Recommended FSANZ Input Field Map',
    '',
    '- `title`: official FSANZ recall title, capped at 240 characters.',
    '- `productNames`: product names only, excluding date marks and pack-size-only values.',
    '- `brandNames`: recalling business or company name.',
    '- `sourceCategory`: current legacy category for comparison only.',
    '- `productDescription`: short FSANZ introduction or list summary, capped at 450 characters.',
    '- `problemText`: official FSANZ problem field.',
    '- `foodSafetyHazardText`: official FSANZ food safety hazard field.',
    '- `actionText`: concise consumer action text.',
    '- `dateMarking`: official date marking field when available.',
    '- `recallNumber`: stable source record id.',
    '- `identifiers`: date marks, batch or lot codes, barcodes, pack sizes, and recall number when explicit.',
    '- `sourceHints`: fixed FSANZ food-domain hints.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm allergen records remain food and grocery, not general household products.',
    '- Confirm non-allergen FSANZ records are not forced into the legacy food-allergy meaning.',
    '- Confirm pathogen, chemical contamination, and foreign matter cases retain problem evidence.',
    '- Confirm date marks and pack sizes are useful identifiers without flooding the prompt.',
    '- Confirm generated preview output excludes raw payloads, contact blocks, image URLs, raw HTML, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'fsanz-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fsanz-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fsanz-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fsanz-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const fsanzRecords = records.filter((record) => record.source === 'FSANZ_FOOD_RECALLS');
  const requestedLimit = envLimit();
  const sample = selectFsanzPreviewSample(fsanzRecords, Math.min(requestedLimit, fsanzRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildFsanzClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, genericInput, proposedInput, comparison);

    return {
      id: record.id,
      title: record.title,
      legacyCategory: record.category,
      foodHazardBucket: comparison.foodHazardBucket,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'FSANZ_FOOD_RECALLS',
    totalFsanzRecords: fsanzRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    allergenCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'allergen'),
    contaminationCaseIncluded: previewRecords.some((record) => ['contamination-pathogen', 'contamination-chemical'].includes(record.foodHazardBucket)),
    foreignMatterCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'foreign-matter'),
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
    totalFsanzRecords: payload.totalFsanzRecords,
    sampleCount: payload.sampleCount,
    allergenCaseIncluded: payload.allergenCaseIncluded,
    contaminationCaseIncluded: payload.contaminationCaseIncluded,
    foreignMatterCaseIncluded: payload.foreignMatterCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/fsanz-input-preview.json`,
      markdownReport: `${outputDir}/fsanz-input-preview.md`,
      noiseReport: `${outputDir}/fsanz-noise-report.json`,
      tokenComparison: `${outputDir}/fsanz-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
