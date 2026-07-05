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
const outputDir = 'outputs/llm-classifier/input-preview/fda-food';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'FDA food recall',
  'Food recall reason not listed',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['undeclared'],
  ['allergen'],
  ['salmonella'],
  ['listeria'],
  ['foreign'],
  ['metal'],
  ['plastic'],
  ['refrigerated'],
  ['label'],
  ['class i'],
  ['class ii'],
  ['class iii'],
  ['terminated'],
  ['upc'],
  ['lot'],
  ['batch'],
  ['best by'],
  ['expiration']
] as const;

type FdaFoodRaw = {
  recall_number?: unknown;
  event_id?: unknown;
  product_description?: unknown;
  product_quantity?: unknown;
  reason_for_recall?: unknown;
  recalling_firm?: unknown;
  classification?: unknown;
  status?: unknown;
  distribution_pattern?: unknown;
  recall_initiation_date?: unknown;
  report_date?: unknown;
  center_classification_date?: unknown;
  termination_date?: unknown;
  code_info?: unknown;
  more_code_info?: unknown;
  voluntary_mandated?: unknown;
  initial_firm_notification?: unknown;
  product_type?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
};

type SourceHints = {
  source: 'FDA';
  market: 'United States';
  officialSource: 'FDA / openFDA food enforcement';
  sourceApi: 'openFDA food enforcement';
  domainHint: 'food';
  classificationOwner: 'llm';
};

type FdaFoodClassifierInputPreview = {
  id: string;
  source: 'FDA';
  sourceUrl: string;
  recallDate: string;
  title: string;
  sourceProductType?: string;
  sourceClassification?: string;
  sourceStatus?: string;
  voluntaryMandated?: string;
  initialFirmNotification?: string;
  productNames: string[];
  brandNames: string[];
  productDescription?: string;
  reasonText?: string;
  codeInfo?: string;
  productQuantity?: string;
  distributionText?: string;
  recallNumber?: string;
  eventId?: string;
  reportDate?: string;
  centerClassificationDate?: string;
  terminationDate?: string;
  firmLocation?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type FoodHazardBucket =
  | 'allergen'
  | 'pathogen'
  | 'foreign-matter'
  | 'labeling-or-storage'
  | 'other';

type TokenComparison = {
  id: string;
  title: string;
  sourceClassification: string;
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
  sourceClassification: string;
  foodHazardBucket: FoodHazardBucket;
  genericInput: RecallClassifierInput;
  proposedInput: FdaFoodClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'FDA';
  totalFdaFoodRecords: number;
  sampleCount: number;
  requestedLimit: number;
  allergenCaseIncluded: boolean;
  pathogenCaseIncluded: boolean;
  foreignMatterCaseIncluded: boolean;
  labelingOrStorageCaseIncluded: boolean;
  classICaseIncluded: boolean;
  classIICaseIncluded: boolean;
  classIIICaseIncluded: boolean;
  identifierCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.FDA_FOOD_CLASSIFIER_INPUT_PREVIEW_LIMIT;
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

function rawPayload(record: NormalizedRecall): FdaFoodRaw {
  return isObject(record.raw) ? (record.raw as FdaFoodRaw) : {};
}

function formatFdaDate(value: unknown): string {
  const text = cleanText(value, 40);
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : text;
}

function productNames(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  return uniqueCleanList([raw.product_description, ...record.productNames], 4, 160);
}

function brandNames(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  return uniqueCleanList([raw.recalling_firm, ...record.brandNames], 6, 180);
}

function foodHazardBucket(record: NormalizedRecall): FoodHazardBucket {
  const text = normalizeForCompare([record.hazard, record.reason ?? '', rawPayload(record).reason_for_recall].map(String).join(' '));
  if (/\b(undeclared|allergen|contains undeclared|may contain undeclared)\b/.test(text)) {
    return 'allergen';
  }
  if (/\b(salmonella|listeria|e coli|pathogen|bacteria|botulinum|mold|mould)\b/.test(text)) {
    return 'pathogen';
  }
  if (/\b(foreign|metal|plastic|glass|wood|physical contamination|dark spot)\b/.test(text)) {
    return 'foreign-matter';
  }
  if (/\b(label|refrigerated|refrigeration|temperature|misbrand|mislabel|expiration|best by|use by)\b/.test(text)) {
    return 'labeling-or-storage';
  }
  return 'other';
}

function identifierCandidates(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  const sourceText = [
    raw.recall_number,
    raw.event_id,
    raw.product_description,
    raw.code_info,
    raw.more_code_info
  ].map((value) => cleanText(value, 1400)).join(' ');
  const matches = [
    ...(sourceText.match(/\b(?:UPC|GTIN|EAN|ASIN|SKU|FNSKU)[:#\s-]*[-A-Z0-9 ]{3,60}/gi) ?? []),
    ...(sourceText.match(/\b(?:lot|batch|code|unit|best by|use by|expiration date|exp\.?)[:#\s-]*[-A-Z0-9/., ]{2,80}/gi) ?? []),
    ...(sourceText.match(/\bH-\d{3,5}-\d{4}\b/gi) ?? []),
    ...(sourceText.match(/\b\d{8,14}\b/g) ?? [])
  ];

  return uniqueCleanList([raw.recall_number, raw.event_id, ...matches], 16, 140);
}

function firmLocation(record: NormalizedRecall): string {
  const raw = rawPayload(record);
  return uniqueCleanList([raw.city, raw.state, raw.country], 3, 80).join(', ');
}

function buildFdaFoodClassifierInputPreview(record: NormalizedRecall): FdaFoodClassifierInputPreview {
  const raw = rawPayload(record);
  const sourceProductType = cleanText(raw.product_type, 80);
  const sourceClassification = cleanText(raw.classification, 80) || cleanText(record.classification, 80);
  const sourceStatus = cleanText(raw.status, 80) || cleanText(record.status, 80);
  const location = firmLocation(record);

  return {
    id: record.id,
    source: 'FDA',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 220),
    ...(sourceProductType ? { sourceProductType } : {}),
    ...(sourceClassification ? { sourceClassification } : {}),
    ...(sourceStatus ? { sourceStatus } : {}),
    ...(cleanText(raw.voluntary_mandated, 120) ? { voluntaryMandated: cleanText(raw.voluntary_mandated, 120) } : {}),
    ...(cleanText(raw.initial_firm_notification, 140) ? { initialFirmNotification: cleanText(raw.initial_firm_notification, 140) } : {}),
    productNames: productNames(record),
    brandNames: brandNames(record),
    ...(cleanText(raw.product_description, 360) ? { productDescription: cleanText(raw.product_description, 360) } : {}),
    ...(cleanText(raw.reason_for_recall ?? record.reason ?? record.hazard, 420) ? { reasonText: cleanText(raw.reason_for_recall ?? record.reason ?? record.hazard, 420) } : {}),
    ...(cleanText([raw.code_info, raw.more_code_info].map((value) => cleanText(value, 500)).filter(Boolean).join(' '), 520) ? { codeInfo: cleanText([raw.code_info, raw.more_code_info].map((value) => cleanText(value, 500)).filter(Boolean).join(' '), 520) } : {}),
    ...(cleanText(raw.product_quantity ?? record.productQuantity ?? record.affectedUnits, 180) ? { productQuantity: cleanText(raw.product_quantity ?? record.productQuantity ?? record.affectedUnits, 180) } : {}),
    ...(cleanText(raw.distribution_pattern ?? record.distributionPattern, 420) ? { distributionText: cleanText(raw.distribution_pattern ?? record.distributionPattern, 420) } : {}),
    ...(cleanText(raw.recall_number ?? record.recallNumber, 80) ? { recallNumber: cleanText(raw.recall_number ?? record.recallNumber, 80) } : {}),
    ...(cleanText(raw.event_id, 80) ? { eventId: cleanText(raw.event_id, 80) } : {}),
    ...(formatFdaDate(raw.report_date) ? { reportDate: formatFdaDate(raw.report_date) } : {}),
    ...(formatFdaDate(raw.center_classification_date) ? { centerClassificationDate: formatFdaDate(raw.center_classification_date) } : {}),
    ...(formatFdaDate(raw.termination_date) ? { terminationDate: formatFdaDate(raw.termination_date) } : {}),
    ...(location ? { firmLocation: location } : {}),
    identifiers: identifierCandidates(record),
    sourceHints: {
      source: 'FDA',
      market: 'United States',
      officialSource: 'FDA / openFDA food enforcement',
      sourceApi: 'openFDA food enforcement',
      domainHint: 'food',
      classificationOwner: 'llm'
    }
  };
}

function inputText(value: unknown): string {
  return normalizeForCompare(JSON.stringify(value));
}

function sampleText(record: NormalizedRecall): string {
  return inputText({
    title: record.title,
    category: record.category,
    productNames: record.productNames,
    brandNames: record.brandNames,
    description: record.description,
    hazard: record.hazard,
    remedy: record.remedy,
    raw: rawPayload(record)
  });
}

function hasTerm(record: NormalizedRecall, terms: string[]): boolean {
  const text = sampleText(record);
  return terms.some((term) => text.includes(normalizeForCompare(term)));
}

function selectFdaFoodPreviewSample(records: NormalizedRecall[], limit: number): {
  records: NormalizedRecall[];
  reasonsById: Map<string, string[]>;
  notes: string[];
} {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const pushRecord = (record: NormalizedRecall | undefined, reason: string): void => {
    if (!record) {
      notes.push(`No FDA food sample found for ${reason}.`);
      return;
    }
    if (!selected.some((item) => item.id === record.id)) {
      selected.push(record);
    }
    reasonsById.set(record.id, [...(reasonsById.get(record.id) ?? []), reason]);
  };
  const firstMatching = (reason: string, predicate: (record: NormalizedRecall) => boolean): void => {
    pushRecord(records.find(predicate), reason);
  };

  firstMatching('allergen or undeclared ingredient case', (record) => foodHazardBucket(record) === 'allergen');
  firstMatching('pathogen contamination case', (record) => foodHazardBucket(record) === 'pathogen');
  firstMatching('foreign matter case', (record) => foodHazardBucket(record) === 'foreign-matter');
  firstMatching('labeling or storage case', (record) => foodHazardBucket(record) === 'labeling-or-storage');
  firstMatching('Class I case', (record) => hasTerm(record, ['Class I']));
  firstMatching('Class II case', (record) => hasTerm(record, ['Class II']));
  firstMatching('Class III case', (record) => hasTerm(record, ['Class III']));
  firstMatching('terminated status case', (record) => hasTerm(record, ['Terminated']));
  firstMatching('UPC or barcode identifier case', (record) => identifierCandidates(record).some((identifier) => /\b\d{8,14}\b/.test(identifier)));
  firstMatching('lot/batch/date identifier case', (record) => identifierCandidates(record).some((identifier) => /\b(lot|batch|best by|expiration|exp)\b/i.test(identifier)));
  firstMatching('long code_info case', (record) => cleanText(rawPayload(record).code_info, 2000).length > 700);
  firstMatching('sparse identifier case', (record) => identifierCandidates(record).length <= 2);

  for (const group of sampleSearchGroups) {
    if (selected.length >= limit) {
      break;
    }
    firstMatching(`keyword sample: ${group.join(', ')}`, (record) => hasTerm(record, [...group]));
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushRecord(record, 'date-order fill sample');
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
  proposedInput: FdaFoodClassifierInputPreview,
  bucket: FoodHazardBucket
): TokenComparison {
  const genericCharacters = JSON.stringify(genericInput).length;
  const proposedCharacters = JSON.stringify(proposedInput).length;
  const genericEstimatedTokens = estimateTokensFromText(JSON.stringify(genericInput));
  const proposedEstimatedTokens = estimateTokensFromText(JSON.stringify(proposedInput));
  const tokenReductionPercent = genericEstimatedTokens > 0
    ? Number((((genericEstimatedTokens - proposedEstimatedTokens) / genericEstimatedTokens) * 100).toFixed(1))
    : 0;

  return {
    id: record.id,
    title: record.title,
    sourceClassification: proposedInput.sourceClassification || record.classification || '',
    foodHazardBucket: bucket,
    genericCharacters,
    proposedCharacters,
    genericEstimatedTokens,
    proposedEstimatedTokens,
    tokenReductionPercent
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

function repeatedStrings(value: unknown): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const text of collectStrings(value)) {
    const normalized = normalizeForCompare(text);
    if (
      normalized.length < 12 ||
      normalized === 'fda' ||
      normalized === 'food' ||
      normalized === 'united states'
    ) {
      continue;
    }
    const current = counts.get(normalized) ?? { value: text, count: 0 };
    current.count += 1;
    counts.set(normalized, current);
  }

  return [...counts.values()]
    .filter((entry) => entry.count > 1)
    .slice(0, 8)
    .map((entry) => entry.value);
}

function overlyLongFields(value: unknown): string[] {
  const output: string[] = [];
  const visit = (item: unknown, path: string): void => {
    if (typeof item === 'string' && item.length > 950) {
      output.push(path);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (isObject(item)) {
      for (const [key, child] of Object.entries(item)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    }
  };

  visit(value, '');
  return output.slice(0, 12);
}

function fallbackGeneratedStrings(value: unknown): string[] {
  return collectStrings(value).filter((text) => isFallbackString(text)).slice(0, 12);
}

function possibleBoilerplate(value: unknown): string[] {
  const terms = ['address_1', 'address_2', 'postal_code'];
  return collectStrings(value)
    .filter((text) => !/^https?:\/\//i.test(text.trim()))
    .filter((text) => terms.some((term) => normalizeForCompare(text).includes(normalizeForCompare(term))))
    .slice(0, 12);
}

function hasHtmlLeakage(value: unknown): boolean {
  return collectStrings(value).some((text) => /<\/?[a-z][\s\S]*?>/i.test(text) || /&(?:nbsp|amp|quot|#39|#039);/i.test(text));
}

function criticalFieldFindings(input: FdaFoodClassifierInputPreview): string[] {
  const findings: string[] = [];
  if (!input.title && input.productNames.length === 0 && !input.productDescription) {
    findings.push('missing product evidence');
  }
  if (!input.reasonText) {
    findings.push('missing reason evidence');
  }
  if (!input.codeInfo && input.identifiers.length === 0) {
    findings.push('missing code or identifier evidence');
  }
  if (input.sourceUrl && !input.title && !input.reasonText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: FdaFoodClassifierInputPreview,
  comparison: TokenComparison,
  bucket: FoodHazardBucket
): NoiseFinding {
  const repeated = repeatedStrings(proposedInput);
  const overlyLong = overlyLongFields(proposedInput);
  const fallbackGenerated = fallbackGeneratedStrings(proposedInput);
  const boilerplate = possibleBoilerplate(proposedInput);
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
  if (boilerplate.length) {
    flags.push('possible boilerplate');
  }
  if (emptyCritical.includes('missing product evidence')) {
    flags.push('missing product evidence');
  }
  if (emptyCritical.includes('missing reason evidence')) {
    flags.push('missing reason evidence');
  }
  if (emptyCritical.includes('missing code or identifier evidence')) {
    flags.push('missing code or identifier evidence');
  }
  if (proposedInput.identifiers.length >= 24) {
    flags.push('identifier over-extraction');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

  return {
    id: record.id,
    title: record.title,
    foodHazardBucket: bucket,
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
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction'].includes(flag))
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
  push(records.find((record) => record.foodHazardBucket === 'pathogen'));
  push(records.find((record) => record.foodHazardBucket === 'foreign-matter'));
  push(records.find((record) => record.foodHazardBucket === 'labeling-or-storage'));
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
  const missingReason = payload.records.filter((record) => record.noise.flags.includes('missing reason evidence'));
  const missingCodes = payload.records.filter((record) => record.noise.flags.includes('missing code or identifier evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- FDA classification: ${record.proposedInput.sourceClassification || 'Missing'}`,
    `- FDA status: ${record.proposedInput.sourceStatus || 'Missing'}`,
    `- Food hazard bucket: ${record.foodHazardBucket}`,
    `- Product evidence: ${[record.proposedInput.title, record.proposedInput.productDescription, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Firm evidence: ${record.proposedInput.brandNames.length ? record.proposedInput.brandNames.join(' | ') : 'Missing'}`,
    `- Reason evidence: ${record.proposedInput.reasonText || 'Missing'}`,
    `- Code evidence: ${record.proposedInput.codeInfo || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# FDA Food Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total FDA food records: ${payload.totalFdaFoodRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Allergen case: ${payload.allergenCaseIncluded ? 'included' : 'not found'}`,
    `Pathogen case: ${payload.pathogenCaseIncluded ? 'included' : 'not found'}`,
    `Foreign matter case: ${payload.foreignMatterCaseIncluded ? 'included' : 'not found'}`,
    `Labeling/storage case: ${payload.labelingOrStorageCaseIncluded ? 'included' : 'not found'}`,
    `Class I case: ${payload.classICaseIncluded ? 'included' : 'not found'}`,
    `Class II case: ${payload.classIICaseIncluded ? 'included' : 'not found'}`,
    `Class III case: ${payload.classIIICaseIncluded ? 'included' : 'not found'}`,
    `Identifier case: ${payload.identifierCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Reason Evidence',
    '',
    missingReason.length ? missingReason.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Code Or Identifier Evidence',
    '',
    missingCodes.length ? missingCodes.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Noisy Proposed Input',
    '',
    noisyDescription.length ? noisyDescription.map((record) => `- ${record.id}: ${record.noise.flags.join(', ')}`).join('\n') : '- None in sample',
    '',
    '## Records With Likely Over-Extracted Identifiers',
    '',
    overExtracted.length ? overExtracted.map((record) => `- ${record.id}: ${record.proposedInput.identifiers.length} identifiers`).join('\n') : '- None in sample',
    '',
    '## Recommended FDA Food Input Field Map',
    '',
    '- `title`: normalized FDA/openFDA title, capped at 260 characters.',
    '- `sourceProductType`: official openFDA `product_type`, evidence only.',
    '- `sourceClassification`: official FDA Class I, II, or III value, evidence only.',
    '- `sourceStatus`: official enforcement status, evidence only.',
    '- `voluntaryMandated`: official FDA recall initiation type.',
    '- `initialFirmNotification`: official firm notification method.',
    '- `productNames`: product description evidence from the enforcement record.',
    '- `brandNames`: recalling firm evidence.',
    '- `productDescription`: official `product_description`.',
    '- `reasonText`: official `reason_for_recall`.',
    '- `codeInfo`: official `code_info` and `more_code_info` values.',
    '- `productQuantity`: official `product_quantity`.',
    '- `distributionText`: official `distribution_pattern`.',
    '- `recallNumber`: official FDA recall number.',
    '- `eventId`: official FDA event id.',
    '- `firmLocation`: city/state/country only, excluding street address and postal code.',
    '- `identifiers`: source-derived UPC, lot, batch, date marking, recall number, event id, ASIN, SKU, and FNSKU evidence.',
    '- `sourceHints`: FDA/openFDA/source-domain provenance only. Product family, product type, hazard type, audience, and final taxonomy are owned by the LLM.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm allergen, pathogen, foreign matter, labeling/storage, and classification examples are represented when present.',
    '- Confirm source classification and status are treated as source evidence only.',
    '- Confirm UPC, lot, batch, date-marking, ASIN, SKU, and FNSKU values are passed as identifiers without over-extracting distribution prose.',
    '- Confirm generated preview output excludes raw payloads, street addresses, image URLs, raw HTML, and fallback strings.',
    '- Confirm proposed input does not include productFamily, productType, hazardType, audience, or other final taxonomy fields.',
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

  await writeFile(resolve(absoluteOutputDir, 'fda-food-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fda-food-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fda-food-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'fda-food-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const fdaRecords = records.filter((record) => record.source === 'FDA');
  const requestedLimit = envLimit();
  const sample = selectFdaFoodPreviewSample(fdaRecords, Math.min(requestedLimit, fdaRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildFdaFoodClassifierInputPreview(record);
    const bucket = foodHazardBucket(record);
    const comparison = tokenComparison(record, genericInput, proposedInput, bucket);
    const noise = detectNoise(record, genericInput, proposedInput, comparison, bucket);

    return {
      id: record.id,
      title: record.title,
      sourceClassification: proposedInput.sourceClassification || record.classification || '',
      foodHazardBucket: bucket,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'FDA',
    totalFdaFoodRecords: fdaRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    allergenCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'allergen'),
    pathogenCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'pathogen'),
    foreignMatterCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'foreign-matter'),
    labelingOrStorageCaseIncluded: previewRecords.some((record) => record.foodHazardBucket === 'labeling-or-storage'),
    classICaseIncluded: previewRecords.some((record) => record.proposedInput.sourceClassification === 'Class I'),
    classIICaseIncluded: previewRecords.some((record) => record.proposedInput.sourceClassification === 'Class II'),
    classIIICaseIncluded: previewRecords.some((record) => record.proposedInput.sourceClassification === 'Class III'),
    identifierCaseIncluded: previewRecords.some((record) => record.proposedInput.identifiers.length > 0),
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
    totalFdaFoodRecords: payload.totalFdaFoodRecords,
    sampleCount: payload.sampleCount,
    allergenCaseIncluded: payload.allergenCaseIncluded,
    pathogenCaseIncluded: payload.pathogenCaseIncluded,
    foreignMatterCaseIncluded: payload.foreignMatterCaseIncluded,
    labelingOrStorageCaseIncluded: payload.labelingOrStorageCaseIncluded,
    classICaseIncluded: payload.classICaseIncluded,
    classIICaseIncluded: payload.classIICaseIncluded,
    classIIICaseIncluded: payload.classIIICaseIncluded,
    identifierCaseIncluded: payload.identifierCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/fda-food-input-preview.json`,
      markdownReport: `${outputDir}/fda-food-input-preview.md`,
      noiseReport: `${outputDir}/fda-food-noise-report.json`,
      tokenComparison: `${outputDir}/fda-food-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
