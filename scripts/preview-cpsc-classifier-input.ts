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
const outputDir = 'outputs/llm-classifier/input-preview/cpsc';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Hazard not listed',
  'Review the official notice',
  'Review the official CPSC notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const suspiciousSearchGroups = [
  ['yamaha', 'umax', 'bistro'],
  ['yamaha', 'golf'],
  ['utility vehicle'],
  ['golf cart'],
  ['food-allergy'],
  ['battery'],
  ['toy'],
  ['child'],
  ['stroller'],
  ['furniture'],
  ['bicycle'],
  ['scooter'],
  ['atv']
] as const;

type SourceHints = {
  source: 'CPSC';
  domainHint: 'consumer-product';
};

type CpscClassifierInputPreview = {
  id: string;
  source: 'CPSC';
  sourceUrl: string;
  recallDate: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  sourceCategory?: string;
  productDescription?: string;
  hazardText?: string;
  remedyText?: string;
  recallNumber?: string;
  identifiers: string[];
  affectedUnits?: string;
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
  proposedInput: CpscClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'CPSC';
  totalCpscRecords: number;
  sampleCount: number;
  requestedLimit: number;
  yamahaBistroIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.CPSC_CLASSIFIER_INPUT_PREVIEW_LIMIT;
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsed, 301));
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

function valueText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return cleanText(String(value), 240);
  }
  if (!isObject(value)) {
    return '';
  }

  const priorityKeys = [
    'Name',
    'name',
    'Value',
    'value',
    'UPC',
    'upc',
    'Model',
    'model',
    'Number',
    'number',
    'RecallNumber',
    'Code',
    'code',
    'Option',
    'Type'
  ];

  for (const key of priorityKeys) {
    const text = valueText(value[key]);
    if (text) {
      return text;
    }
  }

  return '';
}

function rawArrayText(raw: Record<string, unknown>, keys: string[]): string[] {
  const output: string[] = [];

  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = valueText(item);
        if (text) {
          output.push(text);
        }
      }
      continue;
    }

    const text = valueText(value);
    if (text) {
      output.push(text);
    }
  }

  return output;
}

function identifierMatches(record: NormalizedRecall): string[] {
  const sourceText = [
    record.title,
    record.description,
    record.hazard,
    record.remedy,
    record.affectedUnits,
    record.productQuantity,
    record.distributionPattern
  ].join(' ');
  const patterns = [
    /\b(?:UPC|GTIN|EAN|SKU|model(?: number| no\.?)?|item(?: number| no\.?)?|lot|batch|serial(?: number)?|reference|best before|use by|date marking|date mark|certification)[:#]\s*[-A-Za-z0-9/., ]{2,70}/gi,
    /\b(?:Recall Number|Recall No\.?)\s*[:#]?\s*[A-Za-z0-9-]{3,40}/gi,
    /\b\d{5,14}\b/g
  ];

  return patterns.flatMap((pattern) => sourceText.match(pattern) ?? []);
}

function extractCpscIdentifiers(record: NormalizedRecall): string[] {
  const raw = isObject(record.raw) ? record.raw : {};
  return uniqueCleanList(
    [
      record.recallNumber,
      raw.RecallNumber,
      ...rawArrayText(raw, ['ProductUPCs', 'Models', 'ModelNumbers', 'UPCs']),
      ...identifierMatches(record)
    ],
    12,
    180
  );
}

function buildCpscClassifierInputPreview(record: NormalizedRecall): CpscClassifierInputPreview {
  const raw = isObject(record.raw) ? record.raw : {};
  const sourceCategory = cleanText(record.category, 160);
  const productDescription = cleanText(record.description, 500);
  const hazardText = cleanText(record.hazard || record.reason || '', 500);
  const remedyText = cleanText(record.remedy, 350);
  const affectedUnits = cleanText(record.affectedUnits, 160);
  const recallNumber = cleanText(record.recallNumber || raw.RecallNumber, 80);

  return {
    id: record.id,
    source: 'CPSC',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    productNames: uniqueCleanList(record.productNames, 6),
    brandNames: uniqueCleanList(record.brandNames, 4),
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(productDescription ? { productDescription } : {}),
    ...(hazardText ? { hazardText } : {}),
    ...(remedyText ? { remedyText } : {}),
    ...(recallNumber ? { recallNumber } : {}),
    identifiers: extractCpscIdentifiers(record),
    ...(affectedUnits ? { affectedUnits } : {}),
    sourceHints: {
      source: 'CPSC',
      domainHint: 'consumer-product'
    }
  };
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || record.primaryImageThumbnailUrl || (Array.isArray(record.images) && record.images.length > 0));
}

function recordText(record: NormalizedRecall): string {
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
    ...record.productNames,
    ...record.brandNames
  ].join(' '));
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

function selectCpscPreviewSample(records: NormalizedRecall[], limit: number): { records: NormalizedRecall[]; reasonsById: Map<string, string[]>; notes: string[] } {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const byIdentifierCount = [...records].sort((a, b) => extractCpscIdentifiers(b).length - extractCpscIdentifiers(a).length);
  const sparseIdentifiers = [...records].sort((a, b) => extractCpscIdentifiers(a).length - extractCpscIdentifiers(b).length);

  pushSample(selected, reasonsById, findByText(records, ['yamaha']) ?? findByText(records, ['umax']) ?? findByText(records, ['bistro']), 'required Yamaha/UMAX/Bistro vehicle review case');
  pushSample(selected, reasonsById, records.find((record) => normalizeForCompare(record.category).includes('food allergy')), 'legacy food-allergy CPSC category if present');
  pushSample(selected, reasonsById, findByText(records, ['toy']) ?? findByText(records, ['child']) ?? findByText(records, ['stroller']), 'baby or kids review case');
  pushSample(selected, reasonsById, findByText(records, ['battery']) ?? findByText(records, ['power bank']), 'electronics or battery review case');
  pushSample(selected, reasonsById, findByText(records, ['furniture']) ?? findByText(records, ['dresser']) ?? findByText(records, ['appliance']), 'household or furniture review case');
  pushSample(selected, reasonsById, findByText(records, ['bicycle']) ?? findByText(records, ['scooter']) ?? findByText(records, ['atv']), 'sports or outdoor review case');
  pushSample(selected, reasonsById, findByText(records, ['utility vehicle']) ?? findByText(records, ['golf car']) ?? findByText(records, ['golf cart']), 'vehicle or mobility review case');
  pushSample(selected, reasonsById, byIdentifierCount[0], 'record with many extracted identifiers');
  pushSample(selected, reasonsById, sparseIdentifiers[0], 'record with sparse extracted identifiers');
  pushSample(selected, reasonsById, records.find((record) => hasImage(record)), 'image-backed review case');
  pushSample(selected, reasonsById, records.find((record) => !hasImage(record)), 'image-less review case');

  for (const terms of suspiciousSearchGroups) {
    pushSample(selected, reasonsById, findByText(records, terms), `suspicious search terms: ${terms.join(', ')}`);
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushSample(selected, reasonsById, record, 'fill sample to requested limit');
  }

  if (!selected.some((record) => /yamaha|umax|bistro/i.test([record.title, ...record.productNames, record.description].join(' ')))) {
    notes.push('No Yamaha/UMAX/Bistro record found in current CPSC records.');
  } else {
    notes.push('Yamaha/UMAX/Bistro record included for vehicle classification evidence review.');
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

function tokenComparison(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: CpscClassifierInputPreview): TokenComparison {
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

function fieldLengths(record: NormalizedRecall, genericInput: RecallClassifierInput, proposedInput: CpscClassifierInputPreview): string[] {
  const fields: Array<[string, string | undefined, number]> = [
    ['record.description', record.description, 1200],
    ['record.hazard', record.hazard, 900],
    ['record.remedy', record.remedy, 900],
    ['generic.description', genericInput.description, 780],
    ['generic.remedy', genericInput.remedy, 480],
    ['proposed.productDescription', proposedInput.productDescription, 520],
    ['proposed.hazardText', proposedInput.hazardText, 520],
    ['proposed.remedyText', proposedInput.remedyText, 370]
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
    [/\bconsumer contact\b/i, 'consumer contact block'],
    [/\bmedia contact\b/i, 'media contact block'],
    [/\bfor more information\b/i, 'for more information text'],
    [/\bwww\.[^\s]+/i, 'web/contact URL text'],
    [/\b(?:\d{3}[-.]\d{3}[-.]\d{4}|\(\d{3}\)\s*\d{3}[-.]\d{4})\b/i, 'phone number text'],
    [/\brecall alert\b/i, 'generic recall alert text']
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(text)) {
      findings.push(label);
    }
  }

  return findings;
}

function hasHtmlLeakage(input: unknown): boolean {
  return /<[^>]+>|&nbsp;|<script|<style/i.test(collectStrings(input).join('\n'));
}

function criticalFieldFindings(record: NormalizedRecall, proposedInput: CpscClassifierInputPreview): string[] {
  const findings: string[] = [];
  if (!proposedInput.title && proposedInput.productNames.length === 0) {
    findings.push('missing product identity');
  }
  if (!proposedInput.hazardText) {
    findings.push('missing hazard text');
  }
  if (!proposedInput.remedyText) {
    findings.push('missing remedy text');
  }
  if (proposedInput.identifiers.length === 0 && !record.recallNumber) {
    findings.push('missing identifiers');
  }
  if (proposedInput.sourceUrl && !proposedInput.title && !proposedInput.productDescription && !proposedInput.hazardText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: CpscClassifierInputPreview,
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
  if (emptyCritical.includes('missing product identity')) {
    flags.push('missing product identity');
  }
  if (emptyCritical.includes('missing hazard text')) {
    flags.push('missing hazard text');
  }
  if (emptyCritical.includes('missing remedy text')) {
    flags.push('missing remedy text');
  }
  if (proposedInput.identifiers.length >= 12) {
    flags.push('identifier over-extraction');
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

  push(records.find((record) => /yamaha|umax|bistro/i.test([record.title, ...record.proposedInput.productNames].join(' '))));
  push(records.find((record) => record.noise.flags.includes('identifier over-extraction')));
  push(records.find((record) => record.noise.flags.includes('missing hazard text')));
  push(records.find((record) => /toy|child|stroller/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /battery|power bank/i.test(inputText(record.proposedInput))));

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
  const missingHazard = payload.records.filter((record) => record.noise.flags.includes('missing hazard text'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Current legacy category: ${record.legacyCategory}`,
    `- Proposed product evidence: ${[record.proposedInput.title, ...record.proposedInput.productNames, ...record.proposedInput.brandNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Proposed hazard evidence: ${record.proposedInput.hazardText || 'Missing'}`,
    `- Proposed identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# CPSC Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total CPSC records: ${payload.totalCpscRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Yamaha/Bistro inclusion result: ${payload.yamahaBistroIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Identity',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Hazard Text',
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
    '## Recommended CPSC Input Field Map',
    '',
    '- `title`: official CPSC title, capped at 240 characters.',
    '- `productNames`: up to 6 normalized product names from CPSC product records.',
    '- `brandNames`: up to 4 manufacturers, importers, or distributors.',
    '- `sourceCategory`: CPSC product type/category text when present.',
    '- `productDescription`: CPSC description capped at 500 characters.',
    '- `hazardText`: CPSC hazard text capped at 500 characters.',
    '- `remedyText`: concise remedy/action text capped at 350 characters.',
    '- `recallNumber`: official CPSC recall number.',
    '- `identifiers`: up to 12 explicit model, UPC, serial, lot, recall number, or similar source-derived values.',
    '- `affectedUnits`: short affected unit count when useful.',
    '- `sourceHints`: fixed CPSC consumer-product hints.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm Yamaha/Bistro product evidence points to vehicles and mobility, not food.',
    '- Confirm CPSC input excludes raw payloads, image URLs, contact blocks, and fallback strings.',
    '- Confirm proposed token reduction is meaningful without losing product identity.',
    '- Confirm records with missing hazard or product evidence are reviewed before live classification.',
    '- Confirm identifier extraction does not flood the prompt with duplicate product names.',
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

  await writeFile(resolve(absoluteOutputDir, 'cpsc-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'cpsc-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'cpsc-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'cpsc-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const cpscRecords = records.filter((record) => record.source === 'CPSC');
  const requestedLimit = envLimit();
  const sample = selectCpscPreviewSample(cpscRecords, Math.min(requestedLimit, cpscRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildCpscClassifierInputPreview(record);
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
    source: 'CPSC',
    totalCpscRecords: cpscRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    yamahaBistroIncluded: previewRecords.some((record) => /yamaha|umax|bistro/i.test([record.title, ...record.proposedInput.productNames].join(' '))),
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
    totalCpscRecords: payload.totalCpscRecords,
    sampleCount: payload.sampleCount,
    yamahaBistroIncluded: payload.yamahaBistroIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/cpsc-input-preview.json`,
      markdownReport: `${outputDir}/cpsc-input-preview.md`,
      noiseReport: `${outputDir}/cpsc-noise-report.json`,
      tokenComparison: `${outputDir}/cpsc-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
