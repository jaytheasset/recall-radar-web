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
const outputDir = 'outputs/llm-classifier/input-preview/canada';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Review the official Government of Canada notice for current instructions.',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['ipex'],
  ['upc'],
  ['part number'],
  ['baby'],
  ['child'],
  ['toy'],
  ['battery'],
  ['lithium'],
  ['appliance'],
  ['furniture'],
  ['health product recall'],
  ['medical'],
  ['food'],
  ['allergen'],
  ['vehicle'],
  ['chemical'],
  ['labelling'],
  ['packaging']
] as const;

type CanadaAffectedProduct = {
  product?: unknown;
  partNumber?: unknown;
  upc?: unknown;
  fields?: unknown;
};

type CanadaDetail = {
  sourceUrl?: unknown;
  recallType?: unknown;
  title?: unknown;
  lastUpdated?: unknown;
  brandNames?: unknown;
  summary?: {
    product?: unknown;
    issue?: unknown;
    action?: unknown;
  };
  affectedProductsHeader?: unknown;
  affectedProductsCaption?: unknown;
  affectedProducts?: unknown;
  images?: unknown;
};

type CanadaRaw = {
  NID?: unknown;
  Title?: unknown;
  URL?: unknown;
  Organization?: unknown;
  Product?: unknown;
  Issue?: unknown;
  'What you should do'?: unknown;
  Category?: unknown;
  'Recall class'?: unknown;
  'Last updated'?: unknown;
  Detail?: CanadaDetail;
};

type SourceHints = {
  source: 'CA_RECALLS';
  market: 'Canada';
  officialSource: 'Government of Canada recalls and safety alerts';
  classificationOwner: 'llm';
};

type CanadaClassifierInputPreview = {
  id: string;
  source: 'CA_RECALLS';
  sourceUrl: string;
  recallDate: string;
  title: string;
  sourceRecallType?: string;
  sourceCategory?: string;
  sourceRecallClass?: string;
  productNames: string[];
  brandNames: string[];
  summaryProduct?: string;
  issueText?: string;
  actionText?: string;
  affectedProductsHeader?: string;
  affectedProducts: Array<{
    product?: string;
    partNumber?: string;
    upc?: string;
  }>;
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type TokenComparison = {
  id: string;
  title: string;
  sourceCategory: string;
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
  affectedProductRows: number;
  identifierCount: number;
  proposedStillNoisy: boolean;
};

type PreviewRecord = {
  id: string;
  title: string;
  sourceCategory: string;
  genericInput: RecallClassifierInput;
  proposedInput: CanadaClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'CA_RECALLS';
  totalCanadaRecords: number;
  sampleCount: number;
  requestedLimit: number;
  ipexCaseIncluded: boolean;
  affectedProductTableCaseIncluded: boolean;
  healthProductCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.CANADA_CLASSIFIER_INPUT_PREVIEW_LIMIT;
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

function rawPayload(record: NormalizedRecall): CanadaRaw {
  return isObject(record.raw) ? (record.raw as CanadaRaw) : {};
}

function rawDetail(record: NormalizedRecall): CanadaDetail {
  const raw = rawPayload(record);
  return isObject(raw.Detail) ? raw.Detail : {};
}

function rawBrandNames(detail: CanadaDetail): string[] {
  return Array.isArray(detail.brandNames) ? uniqueCleanList(detail.brandNames, 6, 160) : [];
}

function affectedProducts(record: NormalizedRecall): CanadaAffectedProduct[] {
  const detail = rawDetail(record);
  if (!Array.isArray(detail.affectedProducts)) {
    return [];
  }

  return detail.affectedProducts.filter(isObject) as CanadaAffectedProduct[];
}

function affectedProductRows(record: NormalizedRecall, limit: number): CanadaClassifierInputPreview['affectedProducts'] {
  return affectedProducts(record).slice(0, limit).map((item) => ({
    ...(cleanText(item.product, 220) ? { product: cleanText(item.product, 220) } : {}),
    ...(cleanText(item.partNumber, 120) ? { partNumber: cleanText(item.partNumber, 120) } : {}),
    ...(cleanText(item.upc, 120) ? { upc: cleanText(item.upc, 120) } : {})
  })).filter((item) => item.product || item.partNumber || item.upc);
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
    raw.Organization,
    raw.Product,
    raw.Issue,
    raw['What you should do'],
    raw.Category,
    raw['Recall class'],
    detail.recallType,
    detail.summary?.product,
    detail.summary?.issue,
    detail.summary?.action,
    detail.affectedProductsHeader,
    ...affectedProducts(record).flatMap((item) => [item.product, item.partNumber, item.upc]),
    ...record.productNames,
    ...record.brandNames
  ].filter((value): value is string | number => typeof value === 'string' || typeof value === 'number').map(String).join(' '));
}

function identifierMatches(record: NormalizedRecall): string[] {
  const tableRows = affectedProducts(record);
  const hasAffectedProductTable = tableRows.length > 0;
  const sourceText = [
    record.title,
    hasAffectedProductTable ? '' : record.description,
    record.hazard,
    record.remedy,
    hasAffectedProductTable ? '' : record.affectedUnits,
    record.productQuantity,
    record.distributionPattern,
    ...(hasAffectedProductTable ? [] : tableRows.flatMap((item) => [item.product, item.partNumber, item.upc]))
  ].filter((value): value is string => typeof value === 'string').join(' ');
  const patterns = [
    /\b(?:UPC|GTIN|EAN|SKU|model(?: number| no\.?)?|item(?: number| no\.?)?|part(?: number| no\.?)?|lot|batch|serial(?: number)?|reference|DIN|NPN)[:#]?\s*[-A-Za-z0-9/., ]{2,80}/gi,
    /\b\d{8,14}\b/g,
    /\b[A-Z]{1,8}-[A-Z0-9]{2,12}\b/g
  ];

  return patterns.flatMap((pattern) => sourceText.match(pattern) ?? []);
}

function extractCanadaIdentifiers(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  const tableRows = affectedProducts(record);
  return uniqueCleanList(
    [
      record.recallNumber,
      raw.NID,
      ...(tableRows.length > 0 ? [] : tableRows.flatMap((item) => [item.partNumber, item.upc])),
      ...identifierMatches(record)
    ],
    24,
    180
  );
}

function buildCanadaClassifierInputPreview(record: NormalizedRecall): CanadaClassifierInputPreview {
  const raw = rawPayload(record);
  const detail = rawDetail(record);
  const sourceRecallType = cleanText(detail.recallType, 180);
  const sourceCategory = cleanText(raw.Category || record.category, 180);
  const sourceRecallClass = cleanText(raw['Recall class'], 160);
  const summaryProduct = cleanText(detail.summary?.product || raw.Product, 260);
  const issueText = cleanText(detail.summary?.issue || raw.Issue || record.hazard || record.reason || '', 420);
  const actionText = cleanText(detail.summary?.action || raw['What you should do'] || record.remedy, 420);
  const affectedProductsHeader = cleanText(detail.affectedProductsHeader, 420);
  const recallNumber = cleanText(record.recallNumber || raw.NID, 120);
  const tableRows = affectedProducts(record);
  const productNames = uniqueCleanList(
    [
      summaryProduct,
      raw.Product,
      ...(tableRows.length > 0 ? [] : record.productNames)
    ],
    8,
    220
  );
  const brandNames = uniqueCleanList(
    [
      ...rawBrandNames(detail),
      ...record.brandNames
    ],
    6,
    180
  );

  return {
    id: record.id,
    source: 'CA_RECALLS',
    sourceUrl: cleanText(detail.sourceUrl || record.sourceUrl, 500),
    recallDate: cleanText(detail.lastUpdated || raw['Last updated'] || record.recallDate, 80),
    title: cleanText(detail.title || record.title || raw.Title, 260),
    ...(sourceRecallType ? { sourceRecallType } : {}),
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(sourceRecallClass ? { sourceRecallClass } : {}),
    productNames,
    brandNames,
    ...(summaryProduct ? { summaryProduct } : {}),
    ...(issueText ? { issueText } : {}),
    ...(actionText ? { actionText } : {}),
    ...(affectedProductsHeader ? { affectedProductsHeader } : {}),
    affectedProducts: affectedProductRows(record, 20),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers: extractCanadaIdentifiers(record),
    sourceHints: {
      source: 'CA_RECALLS',
      market: 'Canada',
      officialSource: 'Government of Canada recalls and safety alerts',
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

function selectCanadaPreviewSample(records: NormalizedRecall[], limit: number): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const byIdentifierCount = [...records].sort((a, b) => extractCanadaIdentifiers(b).length - extractCanadaIdentifiers(a).length);
  const sparseIdentifiers = [...records].sort((a, b) => extractCanadaIdentifiers(a).length - extractCanadaIdentifiers(b).length);
  const byAffectedTableRows = [...records].sort((a, b) => affectedProducts(b).length - affectedProducts(a).length);
  const byLongText = [...records].sort((a, b) => ([b.hazard, b.remedy, b.description].join(' ').length - [a.hazard, a.remedy, a.description].join(' ').length));

  pushSample(selected, reasonsById, findByText(records, ['ipex']) ?? byAffectedTableRows[0], 'IPEX or affected-products table case');
  pushSample(selected, reasonsById, byAffectedTableRows.find((record) => affectedProducts(record).length > 0), 'record with official affected-products table');
  pushSample(selected, reasonsById, records.find((record) => affectedProducts(record).length === 0), 'record without official affected-products table');
  pushSample(selected, reasonsById, byIdentifierCount.find((record) => extractCanadaIdentifiers(record).length > 0), 'record with source identifiers');
  pushSample(selected, reasonsById, sparseIdentifiers[0], 'record with sparse source identifiers');
  pushSample(selected, reasonsById, records.find((record) => hasImage(record)), 'image-backed review case');
  pushSample(selected, reasonsById, records.find((record) => !hasImage(record)), 'image-less review case if present');
  pushSample(selected, reasonsById, byLongText[0], 'long issue/action/source text case');
  pushSample(selected, reasonsById, findByText(records, ['health product recall']) ?? findByText(records, ['medical']) ?? findByText(records, ['hospital']), 'health or medical source recall type case');
  pushSample(selected, reasonsById, findByText(records, ['food']) ?? findByText(records, ['allergen']), 'food or allergen source wording case if present');
  pushSample(selected, reasonsById, findByText(records, ['vehicle']) ?? findByText(records, ['car seat']) ?? findByText(records, ['transport']), 'vehicle or mobility-like wording case if present');

  for (const terms of sampleSearchGroups) {
    pushSample(selected, reasonsById, findByText(records, terms), `Canada source search terms: ${terms.join(', ')}`);
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushSample(selected, reasonsById, record, 'fill sample to requested limit');
  }

  if (!selected.some((record) => /ipex/i.test(recordText(record)))) {
    notes.push('No IPEX Canada record found in the current processed file.');
  }
  if (!selected.some((record) => affectedProducts(record).length > 0)) {
    notes.push('No Canada record with an affected-products table was found in the current sample.');
  }
  if (!selected.some((record) => /health product recall|medical|hospital/i.test(recordText(record)))) {
    notes.push('No health or medical Canada record was found in the current sample.');
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

function tokenComparison(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: CanadaClassifierInputPreview): TokenComparison {
  const genericText = inputText(genericInput);
  const proposedText = inputText(proposedInput);
  const genericTokens = estimateTokensFromText(genericText);
  const proposedTokens = estimateTokensFromText(proposedText);
  const reduction = genericTokens > 0 ? Number((((genericTokens - proposedTokens) / genericTokens) * 100).toFixed(1)) : 0;

  return {
    id: record.id,
    title: record.title,
    sourceCategory: proposedInput.sourceCategory || record.category,
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

function fieldLengths(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: CanadaClassifierInputPreview): string[] {
  const fields: Array<[string, string | undefined, number]> = [
    ['record.description', record.description, 1400],
    ['record.hazard', record.hazard, 900],
    ['record.remedy', record.remedy, 900],
    ['generic.description', genericInput.description, 820],
    ['generic.remedy', genericInput.remedy, 520],
    ['proposed.issueText', proposedInput.issueText, 460],
    ['proposed.actionText', proposedInput.actionText, 460],
    ['proposed.affectedProductsHeader', proposedInput.affectedProductsHeader, 460]
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
    [/\bGovernment of Canada\b/i, 'government label text'],
    [/\bRecalls and safety alerts\b/i, 'page header text'],
    [/\bSearch website\b/i, 'navigation/search text'],
    [/\bCanada\.ca\b/i, 'navigation text'],
    [/\bFor more information\b/i, 'contact boilerplate'],
    [/\bHealth Canada\b/i, 'agency text'],
    [/\bMedia enquiries\b/i, 'media contact text'],
    [/\bwww\.[^\s]+/i, 'web/contact URL text'],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, 'email contact text']
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

function criticalFieldFindings(proposedInput: CanadaClassifierInputPreview): string[] {
  const findings: string[] = [];
  const productEvidence = [proposedInput.title, proposedInput.summaryProduct, ...proposedInput.productNames, ...proposedInput.affectedProducts.map((row) => row.product)].filter(Boolean).join(' ');
  if (!productEvidence) {
    findings.push('missing product evidence');
  }
  if (!proposedInput.issueText) {
    findings.push('missing issue evidence');
  }
  if (!proposedInput.actionText) {
    findings.push('missing action evidence');
  }
  if (proposedInput.sourceUrl && !proposedInput.title && !proposedInput.summaryProduct && !proposedInput.issueText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: CanadaClassifierInputPreview,
  comparison: TokenComparison
): NoiseFinding {
  const repeated = repeatedStrings(proposedInput);
  const overlyLong = fieldLengths(record, genericInput, proposedInput);
  const fallbackGenerated = [...new Set([...fallbackFindings(genericInput), ...fallbackFindings(proposedInput)])];
  const possibleBoilerplate = boilerplateFindings({
    ...proposedInput,
    sourceUrl: '',
    sourceHints: {}
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
  if (emptyCritical.includes('missing product evidence')) {
    flags.push('missing product evidence');
  }
  if (emptyCritical.includes('missing issue evidence')) {
    flags.push('missing issue evidence');
  }
  if (emptyCritical.includes('missing action evidence')) {
    flags.push('missing action evidence');
  }
  if (proposedInput.identifiers.length >= 24) {
    flags.push('identifier over-extraction');
  }
  if (proposedInput.affectedProducts.length >= 20 && affectedProducts(record).length > 20) {
    flags.push('affected product table truncated');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

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
    possibleBoilerplate,
    emptyCriticalFields: emptyCritical,
    affectedProductRows: proposedInput.affectedProducts.length,
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

  push(records.find((record) => /ipex/i.test(inputText(record.proposedInput))));
  push(records.find((record) => record.proposedInput.affectedProducts.length > 0));
  push(records.find((record) => /health product recall|medical|hospital/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /food|allergen/i.test(inputText(record.proposedInput))));
  push(records.find((record) => record.noise.flags.includes('identifier over-extraction')));

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
  const missingIssue = payload.records.filter((record) => record.noise.flags.includes('missing issue evidence'));
  const missingAction = payload.records.filter((record) => record.noise.flags.includes('missing action evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Source category: ${record.sourceCategory || 'Missing'}`,
    `- Source recall type: ${record.proposedInput.sourceRecallType || 'Missing'}`,
    `- Product evidence: ${[record.proposedInput.title, record.proposedInput.summaryProduct, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Issue evidence: ${record.proposedInput.issueText || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || 'Missing'}`,
    `- Affected product rows: ${record.proposedInput.affectedProducts.length}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# Canada Recalls Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total Canada records: ${payload.totalCanadaRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `IPEX case: ${payload.ipexCaseIncluded ? 'included' : 'not found'}`,
    `Affected-products table case: ${payload.affectedProductTableCaseIncluded ? 'included' : 'not found'}`,
    `Health product case: ${payload.healthProductCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Issue Evidence',
    '',
    missingIssue.length ? missingIssue.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
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
    '## Recommended Canada Input Field Map',
    '',
    '- `title`: official Canada notice title, capped at 260 characters.',
    '- `sourceRecallType`: official page type such as consumer product recall or health product recall.',
    '- `sourceCategory`: official Canada category text, not a Recall Radar taxonomy decision.',
    '- `sourceRecallClass`: official Canada recall class when present.',
    '- `productNames`: summary product plus official affected-product table product names.',
    '- `brandNames`: detail-page brand names and source organization names.',
    '- `summaryProduct`: official summary product field.',
    '- `issueText`: official summary issue or feed issue field.',
    '- `actionText`: official summary action or feed action field.',
    '- `affectedProductsHeader`: short official affected-products intro text.',
    '- `affectedProducts`: up to 20 official table rows with product, part number, and UPC.',
    '- `recallNumber`: stable Canada NID/source id.',
    '- `identifiers`: source-derived NID, part numbers, UPCs, model, SKU, lot, batch, DIN, or NPN values.',
    '- `sourceHints`: Canada/source provenance only. Product family, hazard type, audience, and final taxonomy are owned by the LLM.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm IPEX table rows pass product, part number, and UPC evidence without relying on UI categories.',
    '- Confirm health/medical records keep official source wording but are not pre-classified by the parser.',
    '- Confirm source category and recall type are treated as evidence only.',
    '- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, navigation text, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'canada-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'canada-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'canada-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'canada-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const canadaRecords = records.filter((record) => record.source === 'CA_RECALLS');
  const requestedLimit = envLimit();
  const sample = selectCanadaPreviewSample(canadaRecords, Math.min(requestedLimit, canadaRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildCanadaClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, genericInput, proposedInput, comparison);

    return {
      id: record.id,
      title: record.title,
      sourceCategory: proposedInput.sourceCategory || record.category,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'CA_RECALLS',
    totalCanadaRecords: canadaRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    ipexCaseIncluded: previewRecords.some((record) => /ipex/i.test(inputText(record.proposedInput))),
    affectedProductTableCaseIncluded: previewRecords.some((record) => record.proposedInput.affectedProducts.length > 0),
    healthProductCaseIncluded: previewRecords.some((record) => /health product recall|medical|hospital/i.test(inputText(record.proposedInput))),
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
    totalCanadaRecords: payload.totalCanadaRecords,
    sampleCount: payload.sampleCount,
    ipexCaseIncluded: payload.ipexCaseIncluded,
    affectedProductTableCaseIncluded: payload.affectedProductTableCaseIncluded,
    healthProductCaseIncluded: payload.healthProductCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/canada-input-preview.json`,
      markdownReport: `${outputDir}/canada-input-preview.md`,
      noiseReport: `${outputDir}/canada-noise-report.json`,
      tokenComparison: `${outputDir}/canada-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
