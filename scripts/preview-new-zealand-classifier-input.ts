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
const outputDir = 'outputs/llm-classifier/input-preview/new-zealand';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Hazard not listed in the indexed notice.',
  'Review the official Product Safety New Zealand notice for current instructions.',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['toy'],
  ['baby'],
  ['child'],
  ['battery'],
  ['lithium'],
  ['smoke alarm'],
  ['lamp'],
  ['furniture'],
  ['vacuum'],
  ['appliance'],
  ['scooter'],
  ['bike'],
  ['mobility'],
  ['model'],
  ['sku'],
  ['serial'],
  ['barcode'],
  ['general-consumer-product']
] as const;

type NewZealandRawDetail = {
  title?: unknown;
  metaDescription?: unknown;
  productIdentifiers?: unknown;
  supplierName?: unknown;
  supplierContact?: unknown;
  responsibleAgency?: unknown;
  hazard?: unknown;
  action?: unknown;
};

type SourceHints = {
  source: 'NZ_PRODUCT_SAFETY';
  domainHint: 'consumer-product';
};

type NewZealandClassifierInputPreview = {
  id: string;
  source: 'NZ_PRODUCT_SAFETY';
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategory?: string;
  sourceCategories: string[];
  productIdentifiers?: string;
  supplierName?: string;
  responsibleAgency?: string;
  hazardText?: string;
  actionText?: string;
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
  proposedInput: NewZealandClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'NZ_PRODUCT_SAFETY';
  totalNewZealandRecords: number;
  sampleCount: number;
  requestedLimit: number;
  babyKidsCaseIncluded: boolean;
  electronicsBatteryCaseIncluded: boolean;
  householdCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.NEW_ZEALAND_CLASSIFIER_INPUT_PREVIEW_LIMIT;
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

function rawDetail(record: NormalizedRecall): NewZealandRawDetail {
  if (!isObject(record.raw) || !isObject(record.raw.detail)) {
    return {};
  }
  return record.raw.detail as NewZealandRawDetail;
}

function rawCategories(record: NormalizedRecall): string[] {
  if (!isObject(record.raw) || !Array.isArray(record.raw.categories)) {
    return [];
  }
  return uniqueCleanList(record.raw.categories, 8, 120);
}

function usefulResponsibleAgency(value: unknown): string {
  const text = cleanText(value, 140);
  if (!text) {
    return '';
  }
  if (/mbie\.govt\.nz/i.test(text) || /\bmbie\b/i.test(text)) {
    return 'MBIE';
  }
  return text.replace(/^Responsible Agency\s*/i, '').trim();
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
    detail.productIdentifiers,
    detail.supplierName,
    detail.hazard,
    detail.action,
    ...rawCategories(record),
    ...record.productNames,
    ...record.brandNames
  ].filter((value): value is string => typeof value === 'string').join(' '));
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
    detail.productIdentifiers,
    detail.supplierName,
    detail.hazard,
    detail.action
  ].filter((value): value is string => typeof value === 'string').join(' ');
  const patterns = [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:SKU|serial)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:batch|lot|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b[A-Z]{1,8}-[A-Z0-9]{2,12}\b/g
  ];

  return patterns.flatMap((pattern) => sourceText.match(pattern) ?? []);
}

function extractNewZealandIdentifiers(record: NormalizedRecall): string[] {
  const detail = rawDetail(record);
  return uniqueCleanList(
    [
      record.recallNumber,
      record.affectedUnits,
      record.productQuantity,
      detail.productIdentifiers,
      ...identifierMatches(record)
    ],
    14,
    180
  );
}

function isLikelyProductName(value: string, record: NormalizedRecall): boolean {
  const text = normalizeForCompare(value);
  const companyKeys = record.brandNames.map((brand) => normalizeForCompare(brand)).filter(Boolean);
  if (!text || companyKeys.includes(text)) {
    return false;
  }
  if (/^(?:sku|serial numbers?|barcode|model|batch|lot|code)[:# -]/i.test(value)) {
    return false;
  }
  if (/^\d{8,14}$/.test(text)) {
    return false;
  }
  return true;
}

function buildNewZealandClassifierInputPreview(record: NormalizedRecall): NewZealandClassifierInputPreview {
  const detail = rawDetail(record);
  const sourceCategory = cleanText(record.category, 160);
  const sourceCategories = rawCategories(record);
  const productIdentifiers = cleanText(detail.productIdentifiers || record.distributionPattern || record.description, 420);
  const supplierName = cleanText(detail.supplierName || record.brandNames[0], 180);
  const responsibleAgency = usefulResponsibleAgency(detail.responsibleAgency);
  const hazardText = cleanText(detail.hazard || record.hazard || record.reason || '', 470);
  const actionText = cleanText(detail.action || record.remedy, 340);
  const recallNumber = cleanText(record.recallNumber, 120);
  const productNames = uniqueCleanList(
    record.productNames.filter((name) => isLikelyProductName(name, record)),
    6,
    180
  );

  return {
    id: record.id,
    source: 'NZ_PRODUCT_SAFETY',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    productNames,
    brandNames: uniqueCleanList(record.brandNames, 4),
    ...(sourceCategory ? { sourceCategory } : {}),
    sourceCategories,
    ...(productIdentifiers ? { productIdentifiers } : {}),
    ...(supplierName ? { supplierName } : {}),
    ...(responsibleAgency ? { responsibleAgency } : {}),
    ...(hazardText ? { hazardText } : {}),
    ...(actionText ? { actionText } : {}),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers: extractNewZealandIdentifiers(record),
    sourceHints: {
      source: 'NZ_PRODUCT_SAFETY',
      domainHint: 'consumer-product'
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

function selectNewZealandPreviewSample(records: NormalizedRecall[], limit: number): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const byIdentifierCount = [...records].sort((a, b) => extractNewZealandIdentifiers(b).length - extractNewZealandIdentifiers(a).length);
  const sparseIdentifiers = [...records].sort((a, b) => extractNewZealandIdentifiers(a).length - extractNewZealandIdentifiers(b).length);
  const byLongText = [...records].sort((a, b) => ([b.hazard, b.remedy].join(' ').length - [a.hazard, a.remedy].join(' ').length));

  pushSample(selected, reasonsById, records.find((record) => record.category === 'baby-kids') ?? findByText(records, ['toy']), 'baby/kids or toy case');
  pushSample(selected, reasonsById, records.find((record) => record.category === 'battery-electronics') ?? findByText(records, ['battery']), 'electronics or battery case');
  pushSample(selected, reasonsById, records.find((record) => record.category === 'household-appliance') ?? findByText(records, ['furniture']) ?? findByText(records, ['appliance']), 'household furniture or appliance case');
  pushSample(selected, reasonsById, findByText(records, ['scooter']) ?? findByText(records, ['bike']) ?? findByText(records, ['mobility']) ?? findByText(records, ['regulator']), 'vehicle or mobility-like case if present');
  pushSample(selected, reasonsById, byIdentifierCount.find((record) => extractNewZealandIdentifiers(record).length > 0), 'record with product identifiers');
  pushSample(selected, reasonsById, sparseIdentifiers[0], 'record with sparse identifiers');
  pushSample(selected, reasonsById, records.find((record) => hasImage(record)), 'image-backed review case');
  pushSample(selected, reasonsById, records.find((record) => !hasImage(record)), 'image-less review case if present');
  pushSample(selected, reasonsById, byLongText[0], 'long hazard/action text case');
  pushSample(selected, reasonsById, records.find((record) => record.category === 'general-consumer-product'), 'ambiguous or general category case');

  for (const terms of sampleSearchGroups) {
    pushSample(selected, reasonsById, findByText(records, terms), `New Zealand source search terms: ${terms.join(', ')}`);
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushSample(selected, reasonsById, record, 'fill sample to requested limit');
  }

  if (!selected.some((record) => record.category === 'baby-kids')) {
    notes.push('No baby/kids record found in the current New Zealand sample.');
  }
  if (!selected.some((record) => record.category === 'battery-electronics')) {
    notes.push('No electronics/battery record found in the current New Zealand sample.');
  }
  if (!selected.some((record) => !hasImage(record))) {
    notes.push('No image-less New Zealand Product Safety record found; current 100 records all expose image URLs.');
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

function tokenComparison(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: NewZealandClassifierInputPreview): TokenComparison {
  const genericText = inputText(genericInput);
  const proposedText = inputText(proposedInput);
  const genericTokens = estimateTokensFromText(genericText);
  const proposedTokens = estimateTokensFromText(proposedText);
  const reduction = genericTokens > 0 ? Number((((genericTokens - proposedTokens) / genericTokens) * 100).toFixed(1)) : 0;

  return {
    id: record.id,
    title: record.title,
    legacyCategory: record.category,
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

function fieldLengths(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: NewZealandClassifierInputPreview): string[] {
  const fields: Array<[string, string | undefined, number]> = [
    ['record.description', record.description, 1200],
    ['record.hazard', record.hazard, 900],
    ['record.remedy', record.remedy, 900],
    ['generic.description', genericInput.description, 780],
    ['generic.remedy', genericInput.remedy, 480],
    ['proposed.productIdentifiers', proposedInput.productIdentifiers, 440],
    ['proposed.hazardText', proposedInput.hazardText, 500],
    ['proposed.actionText', proposedInput.actionText, 360]
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
    [/\bResponsible Agency\b/i, 'responsible agency label'],
    [/\bwww\.mbie\.govt\.nz\b/i, 'agency URL text'],
    [/\breturn shipping address\b/i, 'supplier/contact return text'],
    [/\bphone number\b/i, 'supplier/contact text'],
    [/\bstore\/point of purchase\b/i, 'supplier/contact purchase text'],
    [/\bavailable for sale\b/i, 'sale-window prose'],
    [/\bsold at\b/i, 'retailer/sale prose'],
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

function criticalFieldFindings(proposedInput: NewZealandClassifierInputPreview): string[] {
  const findings: string[] = [];
  const productEvidence = [proposedInput.title, ...proposedInput.productNames, proposedInput.productIdentifiers].filter(Boolean).join(' ');
  if (!productEvidence) {
    findings.push('missing product identity');
  }
  if (!proposedInput.hazardText) {
    findings.push('missing hazard evidence');
  }
  if (!proposedInput.actionText) {
    findings.push('missing action/remedy evidence');
  }
  if (proposedInput.sourceUrl && !proposedInput.title && !proposedInput.productIdentifiers && !proposedInput.hazardText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function supplierContactDominates(record: NormalizedRecall, proposedInput: NewZealandClassifierInputPreview): boolean {
  const detail = rawDetail(record);
  const contact = cleanText(detail.supplierContact, 900);
  if (!contact) {
    return false;
  }
  const proposedText = collectStrings(proposedInput).join(' ');
  return contact.length > 280 && normalizeForCompare(proposedText).includes(normalizeForCompare(contact).slice(0, 80));
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: NewZealandClassifierInputPreview,
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
  if (emptyCritical.includes('missing hazard evidence')) {
    flags.push('missing hazard evidence');
  }
  if (emptyCritical.includes('missing action/remedy evidence')) {
    flags.push('missing action/remedy evidence');
  }
  if (proposedInput.identifiers.length >= 14) {
    flags.push('identifier over-extraction');
  }
  if ((proposedInput.actionText?.length ?? 0) > ((proposedInput.hazardText?.length ?? 0) + 240)) {
    flags.push('action text dominates input');
  }
  if (supplierContactDominates(record, proposedInput)) {
    flags.push('supplier/contact text dominates input');
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
    identifierCount: proposedInput.identifiers.length,
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction', 'supplier/contact text dominates input'].includes(flag))
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

  push(records.find((record) => record.legacyCategory === 'baby-kids'));
  push(records.find((record) => record.legacyCategory === 'battery-electronics'));
  push(records.find((record) => record.legacyCategory === 'household-appliance'));
  push(records.find((record) => record.legacyCategory === 'general-consumer-product'));
  push(records.find((record) => record.noise.flags.includes('identifier over-extraction')));
  push(records.find((record) => record.noise.flags.includes('supplier/contact text dominates input')));

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
  const missingProduct = payload.records.filter((record) => record.noise.flags.includes('missing product identity'));
  const missingHazard = payload.records.filter((record) => record.noise.flags.includes('missing hazard evidence'));
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
    `- Product evidence: ${[record.proposedInput.title, ...record.proposedInput.productNames, record.proposedInput.productIdentifiers].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Supplier: ${record.proposedInput.supplierName || 'Missing'}`,
    `- Hazard evidence: ${record.proposedInput.hazardText || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# New Zealand Product Safety Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total New Zealand Product Safety records: ${payload.totalNewZealandRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Baby/kids case: ${payload.babyKidsCaseIncluded ? 'included' : 'not found'}`,
    `Electronics/battery case: ${payload.electronicsBatteryCaseIncluded ? 'included' : 'not found'}`,
    `Household case: ${payload.householdCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Hazard Evidence',
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
    '## Recommended New Zealand Input Field Map',
    '',
    '- `title`: official recall title, capped at 240 characters.',
    '- `productNames`: product names only, excluding identifier-only strings.',
    '- `brandNames`: normalized supplier or brand names.',
    '- `sourceCategory`: current legacy category for comparison only.',
    '- `sourceCategories`: official Product Safety New Zealand listing categories.',
    '- `productIdentifiers`: official product identifier block, capped at 420 characters.',
    '- `supplierName`: supplier/recalling business name.',
    '- `responsibleAgency`: short agency label when useful.',
    '- `hazardText`: official hazard text, capped at 470 characters.',
    '- `actionText`: concise official consumer action text, capped at 340 characters.',
    '- `recallNumber`: stable source record id.',
    '- `identifiers`: up to 14 explicit model, SKU, serial, batch, lot, barcode, GTIN, UPC, or similar source-derived values.',
    '- `sourceHints`: fixed New Zealand consumer-product hints.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm toy and baby/kids records retain product identity and choking-risk evidence.',
    '- Confirm electronics and lithium battery records retain model/SKU/battery evidence when present.',
    '- Confirm household and general consumer product records are not misread as food records.',
    '- Confirm supplier/contact blocks and agency URLs do not dominate the prompt.',
    '- Confirm generated preview output excludes raw payloads, image URLs, contact blocks, raw HTML, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'new-zealand-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'new-zealand-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'new-zealand-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'new-zealand-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const newZealandRecords = records.filter((record) => record.source === 'NZ_PRODUCT_SAFETY');
  const requestedLimit = envLimit();
  const sample = selectNewZealandPreviewSample(newZealandRecords, Math.min(requestedLimit, newZealandRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildNewZealandClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, genericInput, proposedInput, comparison);

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

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'NZ_PRODUCT_SAFETY',
    totalNewZealandRecords: newZealandRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    babyKidsCaseIncluded: previewRecords.some((record) => record.legacyCategory === 'baby-kids'),
    electronicsBatteryCaseIncluded: previewRecords.some((record) => record.legacyCategory === 'battery-electronics'),
    householdCaseIncluded: previewRecords.some((record) => record.legacyCategory === 'household-appliance'),
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
    totalNewZealandRecords: payload.totalNewZealandRecords,
    sampleCount: payload.sampleCount,
    babyKidsCaseIncluded: payload.babyKidsCaseIncluded,
    electronicsBatteryCaseIncluded: payload.electronicsBatteryCaseIncluded,
    householdCaseIncluded: payload.householdCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/new-zealand-input-preview.json`,
      markdownReport: `${outputDir}/new-zealand-input-preview.md`,
      noiseReport: `${outputDir}/new-zealand-noise-report.json`,
      tokenComparison: `${outputDir}/new-zealand-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
