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
const outputDir = 'outputs/llm-classifier/input-preview/uk-fsa';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Review the official FSA notice for current consumer action.',
  'UK FSA food alert',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['allergy alert'],
  ['product recall information notice'],
  ['food alert for action'],
  ['undeclared'],
  ['allergen'],
  ['salmonella'],
  ['listeria'],
  ['foreign'],
  ['metal'],
  ['plastic'],
  ['batch'],
  ['use by'],
  ['best before'],
  ['pack size'],
  ['retail stores'],
  ['point of sale']
] as const;

type UkFsaRaw = {
  '@id'?: unknown;
  notation?: unknown;
  title?: unknown;
  shortTitle?: unknown;
  description?: unknown;
  created?: unknown;
  modified?: unknown;
  type?: unknown;
  reportingBusiness?: unknown;
  otherBusiness?: unknown;
  alertURL?: unknown;
  shortURL?: unknown;
  actionTaken?: unknown;
  consumerAdvice?: unknown;
  relatedMedia?: unknown;
  problem?: unknown;
  productDetails?: unknown;
  status?: unknown;
};

type SourceHints = {
  source: 'UK_FSA';
  market: 'United Kingdom';
  officialSource: 'FSA Food Alerts';
  sourceApi: 'UK FSA Food Alerts linked-data API';
  domainHint: 'food';
  classificationOwner: 'llm';
};

type ProductDetailPreview = {
  productName?: string;
  packSize?: string;
  batchOrDateDetails?: string[];
};

type UkFsaClassifierInputPreview = {
  id: string;
  source: 'UK_FSA';
  sourceUrl: string;
  recallDate: string;
  title: string;
  sourceAlertType?: string;
  sourceStatus?: string;
  alertNotation?: string;
  productNames: string[];
  brandNames: string[];
  shortTitle?: string;
  descriptionText?: string;
  problemText?: string;
  allergenRiskLabels?: string[];
  pathogenRiskLabels?: string[];
  hazardCategoryLabels?: string[];
  actionText?: string;
  productDetails: ProductDetailPreview[];
  relatedMediaTitles?: string[];
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type FoodRiskBucket =
  | 'allergen'
  | 'pathogen'
  | 'foreign-matter'
  | 'batch-or-date'
  | 'other';

type TokenComparison = {
  id: string;
  title: string;
  sourceAlertType: string;
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
  productDetailRows: number;
  identifierCount: number;
  proposedStillNoisy: boolean;
};

type PreviewRecord = {
  id: string;
  title: string;
  sourceAlertType: string;
  foodRiskBucket: FoodRiskBucket;
  genericInput: RecallClassifierInput;
  proposedInput: UkFsaClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'UK_FSA';
  totalUkFsaRecords: number;
  sampleCount: number;
  requestedLimit: number;
  allergyAlertCaseIncluded: boolean;
  productRecallInformationNoticeCaseIncluded: boolean;
  foodAlertForActionCaseIncluded: boolean;
  allergenCaseIncluded: boolean;
  pathogenCaseIncluded: boolean;
  foreignMatterCaseIncluded: boolean;
  batchOrDateCaseIncluded: boolean;
  productDetailCaseIncluded: boolean;
  relatedMediaCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.UK_FSA_CLASSIFIER_INPUT_PREVIEW_LIMIT;
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsed, 100));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
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

function fieldText(value: unknown, limit = 180): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return cleanText(value, limit);
  }
  if (Array.isArray(value)) {
    return uniqueCleanList(value.flatMap((item) => fieldText(item, limit)), 12, limit).join('; ');
  }
  if (isObject(value)) {
    return cleanText(
      value.label ?? value.prefLabel ?? value.commonName ?? value.name ?? value.title ?? value.notation ?? value['@id'],
      limit
    );
  }
  return '';
}

function uniqueCleanList(values: unknown[], limit: number, itemLimit = 180): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = cleanText(typeof value === 'string' || typeof value === 'number' ? value : fieldText(value, itemLimit), itemLimit);
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

function rawPayload(record: NormalizedRecall): UkFsaRaw {
  return isObject(record.raw) ? (record.raw as UkFsaRaw) : {};
}

function sourceStatus(record: NormalizedRecall): string {
  const raw = rawPayload(record);
  return cleanText(record.status, 80) || fieldText(raw.status, 80);
}

function sourceAlertType(record: NormalizedRecall): string {
  const raw = rawPayload(record);
  const rawTypeText = arrayOf(raw.type).map((item) => fieldText(item, 80)).join(' ');
  if (record.classification) {
    return cleanText(record.classification, 100);
  }
  if (/\bAA\b|Allergy/i.test(rawTypeText)) {
    return 'Allergy Alert';
  }
  if (/\bPRIN\b|Product Recall/i.test(rawTypeText)) {
    return 'Product Recall Information Notice';
  }
  if (/\bFAFA\b|Food Alert/i.test(rawTypeText)) {
    return 'Food Alert For Action';
  }
  return cleanText(record.category, 100);
}

function reportingBusinessNames(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  return uniqueCleanList([
    raw.reportingBusiness,
    ...arrayOf(raw.otherBusiness),
    ...record.brandNames
  ], 8, 180);
}

function problemObjects(record: NormalizedRecall): Record<string, unknown>[] {
  return arrayOf(rawPayload(record).problem).filter(isObject);
}

function labelsFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueCleanList(value.flatMap((item) => labelsFromValue(item)), 24, 180);
  }
  if (!isObject(value)) {
    return uniqueCleanList([value], 1, 180);
  }

  const direct = [
    value.label,
    value.prefLabel,
    value.notation,
    value.riskStatement
  ];
  return uniqueCleanList(direct.flatMap((item) => arrayOf(item)), 16, 220);
}

function allergenRiskLabels(record: NormalizedRecall): string[] {
  return uniqueCleanList(problemObjects(record).flatMap((problem) => labelsFromValue(problem.allergen)), 16, 160);
}

function pathogenRiskLabels(record: NormalizedRecall): string[] {
  return uniqueCleanList(problemObjects(record).flatMap((problem) => [
    ...labelsFromValue(problem.pathogenRisk),
    ...(isObject(problem.pathogenRisk) ? labelsFromValue(problem.pathogenRisk.pathogen) : [])
  ]), 16, 180);
}

function hazardCategoryLabels(record: NormalizedRecall): string[] {
  return uniqueCleanList(problemObjects(record).flatMap((problem) => labelsFromValue(problem.hazardCategory ?? problem.reason)), 16, 180);
}

function riskStatements(record: NormalizedRecall): string[] {
  return uniqueCleanList(problemObjects(record).flatMap((problem) => [
    problem.riskStatement,
    isObject(problem.pathogenRisk) ? problem.pathogenRisk.riskStatement : undefined,
    isObject(problem.allergen) ? problem.allergen.riskStatement : undefined,
    isObject(problem.hazardCategory) ? problem.hazardCategory.riskStatement : undefined
  ]), 8, 420);
}

function productDetails(record: NormalizedRecall): ProductDetailPreview[] {
  const rows = arrayOf(rawPayload(record).productDetails).filter(isObject);

  return rows.slice(0, 20).map((row) => {
    const batches = arrayOf(row.batchDescription).filter(isObject);
    const batchOrDateDetails = uniqueCleanList(batches.flatMap((batch) => [
      batch.batchCode ? `batch ${fieldText(batch.batchCode, 90)}` : '',
      batch.lotNumber ? `lot ${fieldText(batch.lotNumber, 90)}` : '',
      batch.bestBeforeDescription ? `best before ${fieldText(batch.bestBeforeDescription, 90)}` : '',
      batch.useByDescription ? `use by ${fieldText(batch.useByDescription, 90)}` : '',
      batch.dateMarking ? `date mark ${fieldText(batch.dateMarking, 90)}` : ''
    ]), 10, 140);
    const productName = cleanText(row.productName, 180);
    const packSize = cleanText(row.packSizeDescription, 120);

    return {
      ...(productName ? { productName } : {}),
      ...(packSize ? { packSize } : {}),
      ...(batchOrDateDetails.length ? { batchOrDateDetails } : {})
    };
  }).filter((row) => row.productName || row.packSize || row.batchOrDateDetails?.length);
}

function relatedMediaTitles(record: NormalizedRecall): string[] {
  return uniqueCleanList(arrayOf(rawPayload(record).relatedMedia).flatMap((item) => {
    if (isObject(item)) {
      return [item.title];
    }
    return [];
  }), 8, 220);
}

function productNames(record: NormalizedRecall): string[] {
  return uniqueCleanList([
    ...productDetails(record).map((detail) => detail.productName),
    ...record.productNames
  ], 10, 180);
}

function identifierCandidates(record: NormalizedRecall): string[] {
  const detailText = productDetails(record)
    .flatMap((detail) => [detail.productName, detail.packSize, ...(detail.batchOrDateDetails ?? [])])
    .filter(Boolean)
    .join(' ');
  const sourceText = [
    record.recallNumber,
    rawPayload(record).notation,
    record.affectedUnits,
    record.productQuantity,
    detailText,
    record.title,
    record.description
  ].map((value) => cleanText(value, 1200)).join(' ');

  const matches = [
    ...(sourceText.match(/\b(?:UPC|GTIN|EAN|SKU|lot|batch|code|use by|best before|date mark|pack size)[:#\s-]*[-A-Z0-9/., ]{2,80}/gi) ?? []),
    ...(sourceText.match(/\bFSA-(?:AA|PRIN|FAFA)-[A-Z0-9-]+\b/gi) ?? []),
    ...(sourceText.match(/\b\d{8,14}\b/g) ?? [])
  ];

  return uniqueCleanList([rawPayload(record).notation, record.recallNumber, ...matches], 18, 140);
}

function foodRiskBucket(record: NormalizedRecall): FoodRiskBucket {
  const text = normalizeForCompare([
    sourceAlertType(record),
    record.title,
    record.hazard,
    record.description,
    allergenRiskLabels(record).join(' '),
    pathogenRiskLabels(record).join(' '),
    hazardCategoryLabels(record).join(' '),
    identifierCandidates(record).join(' ')
  ].join(' '));

  if (/\b(allergy|allergen|undeclared|milk|soya|peanut|sesame|gluten|mustard|egg|nut)\b/.test(text)) {
    return 'allergen';
  }
  if (/\b(salmonella|listeria|e coli|pathogen|bacteria|botulinum|mould|mold)\b/.test(text)) {
    return 'pathogen';
  }
  if (/\b(foreign|metal|plastic|glass|rubber|wood|stone)\b/.test(text)) {
    return 'foreign-matter';
  }
  if (/\b(batch|lot|use by|best before|date mark|expiry|expiration)\b/.test(text)) {
    return 'batch-or-date';
  }
  return 'other';
}

function buildUkFsaClassifierInputPreview(record: NormalizedRecall): UkFsaClassifierInputPreview {
  const raw = rawPayload(record);
  const details = productDetails(record);
  const allergenLabels = allergenRiskLabels(record);
  const pathogenLabels = pathogenRiskLabels(record);
  const hazardLabels = hazardCategoryLabels(record);
  const mediaTitles = relatedMediaTitles(record);
  const problemText = uniqueCleanList([record.hazard, ...riskStatements(record)], 6, 520).join(' ');
  const actionText = uniqueCleanList([raw.consumerAdvice, raw.actionTaken, record.remedy], 4, 520).join(' ');

  return {
    id: record.id,
    source: 'UK_FSA',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    ...(sourceAlertType(record) ? { sourceAlertType: sourceAlertType(record) } : {}),
    ...(sourceStatus(record) ? { sourceStatus: sourceStatus(record) } : {}),
    ...(cleanText(raw.notation ?? record.recallNumber, 80) ? { alertNotation: cleanText(raw.notation ?? record.recallNumber, 80) } : {}),
    productNames: productNames(record),
    brandNames: reportingBusinessNames(record),
    ...(cleanText(raw.shortTitle, 180) ? { shortTitle: cleanText(raw.shortTitle, 180) } : {}),
    ...(cleanText(raw.description ?? record.description, 420) ? { descriptionText: cleanText(raw.description ?? record.description, 420) } : {}),
    ...(problemText ? { problemText: cleanText(problemText, 780) } : {}),
    ...(allergenLabels.length ? { allergenRiskLabels: allergenLabels } : {}),
    ...(pathogenLabels.length ? { pathogenRiskLabels: pathogenLabels } : {}),
    ...(hazardLabels.length ? { hazardCategoryLabels: hazardLabels } : {}),
    ...(actionText ? { actionText: cleanText(actionText, 760) } : {}),
    productDetails: details,
    ...(mediaTitles.length ? { relatedMediaTitles: mediaTitles } : {}),
    ...(cleanText(raw.notation ?? record.recallNumber, 80) ? { recallNumber: cleanText(raw.notation ?? record.recallNumber, 80) } : {}),
    identifiers: identifierCandidates(record),
    sourceHints: {
      source: 'UK_FSA',
      market: 'United Kingdom',
      officialSource: 'FSA Food Alerts',
      sourceApi: 'UK FSA Food Alerts linked-data API',
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

function selectUkFsaPreviewSample(records: NormalizedRecall[], limit: number): {
  records: NormalizedRecall[];
  reasonsById: Map<string, string[]>;
  notes: string[];
} {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const pushRecord = (record: NormalizedRecall | undefined, reason: string): void => {
    if (!record) {
      notes.push(`No UK FSA sample found for ${reason}.`);
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

  firstMatching('Allergy Alert source type', (record) => sourceAlertType(record) === 'Allergy Alert');
  firstMatching('Product Recall Information Notice source type', (record) => sourceAlertType(record) === 'Product Recall Information Notice');
  firstMatching('Food Alert For Action source type', (record) => sourceAlertType(record) === 'Food Alert For Action');
  firstMatching('allergen or undeclared ingredient case', (record) => foodRiskBucket(record) === 'allergen');
  firstMatching('pathogen contamination case', (record) => foodRiskBucket(record) === 'pathogen');
  firstMatching('foreign matter case', (record) => foodRiskBucket(record) === 'foreign-matter');
  firstMatching('batch/date detail case', (record) => foodRiskBucket(record) === 'batch-or-date' || identifierCandidates(record).some((identifier) => /\b(batch|use by|best before|date mark)\b/i.test(identifier)));
  firstMatching('product details table case', (record) => productDetails(record).length > 0);
  firstMatching('multi-product detail case', (record) => productDetails(record).length >= 5);
  firstMatching('related media notice case', (record) => relatedMediaTitles(record).length > 0);
  firstMatching('sparse identifier case', (record) => identifierCandidates(record).length <= 2);
  firstMatching('long risk or action text case', (record) => [record.hazard, record.remedy, record.description].join(' ').length > 1100);

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
  proposedInput: UkFsaClassifierInputPreview,
  bucket: FoodRiskBucket
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
    sourceAlertType: proposedInput.sourceAlertType || '',
    foodRiskBucket: bucket,
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
      normalized === 'uk fsa' ||
      normalized === 'united kingdom' ||
      normalized === 'fsa food alerts'
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
  const terms = ['bit.ly', 'twitter', 'sms', 'foodalert', 'point of sale notices will be displayed'];
  return collectStrings(value)
    .filter((text) => !/^https?:\/\//i.test(text.trim()))
    .filter((text) => terms.some((term) => normalizeForCompare(text).includes(normalizeForCompare(term))))
    .slice(0, 12);
}

function hasHtmlLeakage(value: unknown): boolean {
  return collectStrings(value).some((text) => /<\/?[a-z][\s\S]*?>/i.test(text) || /&(?:nbsp|amp|quot|#39|#039);/i.test(text));
}

function criticalFieldFindings(input: UkFsaClassifierInputPreview): string[] {
  const findings: string[] = [];
  if (!input.title && input.productNames.length === 0 && input.productDetails.length === 0) {
    findings.push('missing product evidence');
  }
  if (!input.problemText && !input.allergenRiskLabels?.length && !input.pathogenRiskLabels?.length && !input.hazardCategoryLabels?.length) {
    findings.push('missing problem or risk evidence');
  }
  if (!input.actionText) {
    findings.push('missing action evidence');
  }
  if (input.sourceUrl && !input.title && !input.problemText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: UkFsaClassifierInputPreview,
  comparison: TokenComparison,
  bucket: FoodRiskBucket
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
  if (emptyCritical.includes('missing problem or risk evidence')) {
    flags.push('missing problem or risk evidence');
  }
  if (emptyCritical.includes('missing action evidence')) {
    flags.push('missing action evidence');
  }
  if (proposedInput.identifiers.length >= 18) {
    flags.push('identifier over-extraction');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

  return {
    id: record.id,
    title: record.title,
    foodRiskBucket: bucket,
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
    productDetailRows: proposedInput.productDetails.length,
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

  push(records.find((record) => record.sourceAlertType === 'Allergy Alert'));
  push(records.find((record) => record.sourceAlertType === 'Product Recall Information Notice'));
  push(records.find((record) => record.sourceAlertType === 'Food Alert For Action'));
  push(records.find((record) => record.foodRiskBucket === 'pathogen'));
  push(records.find((record) => record.proposedInput.productDetails.length >= 5));

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
  const missingRisk = payload.records.filter((record) => record.noise.flags.includes('missing problem or risk evidence'));
  const missingAction = payload.records.filter((record) => record.noise.flags.includes('missing action evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Source alert type: ${record.proposedInput.sourceAlertType || 'Missing'}`,
    `- Source status: ${record.proposedInput.sourceStatus || 'Missing'}`,
    `- Food risk bucket: ${record.foodRiskBucket}`,
    `- Product evidence: ${[record.proposedInput.title, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Business evidence: ${record.proposedInput.brandNames.length ? record.proposedInput.brandNames.join(' | ') : 'Missing'}`,
    `- Problem evidence: ${record.proposedInput.problemText || [...(record.proposedInput.allergenRiskLabels ?? []), ...(record.proposedInput.pathogenRiskLabels ?? []), ...(record.proposedInput.hazardCategoryLabels ?? [])].join(' | ') || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || 'Missing'}`,
    `- Product detail rows: ${record.proposedInput.productDetails.length}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# UK FSA Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total UK FSA records: ${payload.totalUkFsaRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Allergy Alert case: ${payload.allergyAlertCaseIncluded ? 'included' : 'not found'}`,
    `Product Recall Information Notice case: ${payload.productRecallInformationNoticeCaseIncluded ? 'included' : 'not found'}`,
    `Food Alert For Action case: ${payload.foodAlertForActionCaseIncluded ? 'included' : 'not found'}`,
    `Allergen case: ${payload.allergenCaseIncluded ? 'included' : 'not found'}`,
    `Pathogen case: ${payload.pathogenCaseIncluded ? 'included' : 'not found'}`,
    `Foreign matter case: ${payload.foreignMatterCaseIncluded ? 'included' : 'not found'}`,
    `Batch/date case: ${payload.batchOrDateCaseIncluded ? 'included' : 'not found'}`,
    `Product detail table case: ${payload.productDetailCaseIncluded ? 'included' : 'not found'}`,
    `Related media case: ${payload.relatedMediaCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Problem Or Risk Evidence',
    '',
    missingRisk.length ? missingRisk.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
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
    '## Recommended UK FSA Input Field Map',
    '',
    '- `title`: official FSA title, capped at 240 characters.',
    '- `sourceAlertType`: official FSA alert type such as Allergy Alert, Product Recall Information Notice, or Food Alert For Action. This is source evidence only.',
    '- `sourceStatus`: official FSA status.',
    '- `alertNotation`: official FSA alert notation.',
    '- `productNames`: product names from product detail rows and normalized product names.',
    '- `brandNames`: reporting and other business names.',
    '- `descriptionText`: official short description.',
    '- `problemText`: official risk statement and concise risk wording.',
    '- `allergenRiskLabels`, `pathogenRiskLabels`, `hazardCategoryLabels`: source risk labels only.',
    '- `actionText`: official consumer advice and action taken.',
    '- `productDetails`: official product, pack size, batch, lot, best-before, and use-by evidence.',
    '- `relatedMediaTitles`: titles of official attached notices, not media URLs.',
    '- `recallNumber`: official alert notation.',
    '- `identifiers`: source-derived alert numbers, UPC/barcode-like values, batch, lot, use-by, best-before, and pack-size evidence.',
    '- `sourceHints`: UK/FSA/source-domain provenance only. Product family, product type, hazard type, audience, and final taxonomy are owned by the LLM.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm Allergy Alert, Product Recall Information Notice, and Food Alert For Action examples are represented when present.',
    '- Confirm allergen, pathogen, foreign matter, batch/date, and product detail examples are represented when present.',
    '- Confirm official FSA alert type and risk labels are treated as evidence only.',
    '- Confirm product detail rows preserve pack size, batch, lot, use-by, and best-before evidence without raw JSON.',
    '- Confirm generated preview output excludes raw payloads, image/media URLs, raw HTML, social text, contact boilerplate, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'uk-fsa-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'uk-fsa-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'uk-fsa-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'uk-fsa-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const ukFsaRecords = records.filter((record) => record.source === 'UK_FSA');
  const requestedLimit = envLimit();
  const sample = selectUkFsaPreviewSample(ukFsaRecords, Math.min(requestedLimit, ukFsaRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildUkFsaClassifierInputPreview(record);
    const bucket = foodRiskBucket(record);
    const comparison = tokenComparison(record, genericInput, proposedInput, bucket);
    const noise = detectNoise(record, genericInput, proposedInput, comparison, bucket);

    return {
      id: record.id,
      title: record.title,
      sourceAlertType: proposedInput.sourceAlertType || '',
      foodRiskBucket: bucket,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'UK_FSA',
    totalUkFsaRecords: ukFsaRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    allergyAlertCaseIncluded: previewRecords.some((record) => record.proposedInput.sourceAlertType === 'Allergy Alert'),
    productRecallInformationNoticeCaseIncluded: previewRecords.some((record) => record.proposedInput.sourceAlertType === 'Product Recall Information Notice'),
    foodAlertForActionCaseIncluded: previewRecords.some((record) => record.proposedInput.sourceAlertType === 'Food Alert For Action'),
    allergenCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'allergen'),
    pathogenCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'pathogen'),
    foreignMatterCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'foreign-matter'),
    batchOrDateCaseIncluded: previewRecords.some((record) => record.foodRiskBucket === 'batch-or-date' || record.proposedInput.identifiers.some((identifier) => /\b(batch|use by|best before|date mark)\b/i.test(identifier))),
    productDetailCaseIncluded: previewRecords.some((record) => record.proposedInput.productDetails.length > 0),
    relatedMediaCaseIncluded: previewRecords.some((record) => (record.proposedInput.relatedMediaTitles?.length ?? 0) > 0),
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
    totalUkFsaRecords: payload.totalUkFsaRecords,
    sampleCount: payload.sampleCount,
    allergyAlertCaseIncluded: payload.allergyAlertCaseIncluded,
    productRecallInformationNoticeCaseIncluded: payload.productRecallInformationNoticeCaseIncluded,
    foodAlertForActionCaseIncluded: payload.foodAlertForActionCaseIncluded,
    allergenCaseIncluded: payload.allergenCaseIncluded,
    pathogenCaseIncluded: payload.pathogenCaseIncluded,
    foreignMatterCaseIncluded: payload.foreignMatterCaseIncluded,
    batchOrDateCaseIncluded: payload.batchOrDateCaseIncluded,
    productDetailCaseIncluded: payload.productDetailCaseIncluded,
    relatedMediaCaseIncluded: payload.relatedMediaCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/uk-fsa-input-preview.json`,
      markdownReport: `${outputDir}/uk-fsa-input-preview.md`,
      noiseReport: `${outputDir}/uk-fsa-noise-report.json`,
      tokenComparison: `${outputDir}/uk-fsa-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
