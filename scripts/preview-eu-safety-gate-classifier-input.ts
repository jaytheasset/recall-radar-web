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
const outputDir = 'outputs/llm-classifier/input-preview/eu-safety-gate';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Risk not listed.',
  'Safety Gate product',
  'Safety Gate alert',
  'Review the official Safety Gate alert for current measures.',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['toys'],
  ['electrical appliances'],
  ['motor vehicles'],
  ['childcare articles'],
  ['chemical products'],
  ['cosmetics'],
  ['electric shock'],
  ['choking'],
  ['injuries'],
  ['fire'],
  ['chemical'],
  ['barcode'],
  ['model'],
  ['batch'],
  ['sold online'],
  ['country of origin']
] as const;

type EuSafetyGateRaw = {
  id?: unknown;
  notificationType?: unknown;
  reference?: unknown;
  country?: unknown;
  publicationDate?: unknown;
  modificationDate?: unknown;
  product?: unknown;
  risk?: unknown;
  measureTaken?: unknown;
  traceability?: unknown;
  reactingCountries?: unknown;
  webReport?: unknown;
  onlineTraderProductIdentifierReference?: unknown;
};

type SourceHints = {
  source: 'EU_SAFETY_GATE';
  market: 'European Union';
  officialSource: 'Safety Gate';
  sourceApi: 'EU Safety Gate notification API';
  domainHint: 'consumer-product';
  classificationOwner: 'llm';
};

type EuSafetyGateClassifierInputPreview = {
  id: string;
  source: 'EU_SAFETY_GATE';
  sourceUrl: string;
  recallDate: string;
  title: string;
  sourceProductCategory?: string;
  notificationType?: string;
  notifyingCountry?: string;
  countryOfOrigin?: string;
  countriesConcerned?: string[];
  soldOnline?: string;
  productNames: string[];
  brandNames: string[];
  nameSpecific?: string;
  productDescription?: string;
  packageDescription?: string;
  riskTypes: string[];
  riskDescription?: string;
  legalProvision?: string;
  measures: string[];
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type ConsumerRiskBucket =
  | 'toy-child-risk'
  | 'electrical-fire'
  | 'chemical'
  | 'vehicle-injury'
  | 'other';

type TokenComparison = {
  id: string;
  title: string;
  sourceProductCategory: string;
  consumerRiskBucket: ConsumerRiskBucket;
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
};

type NoiseFinding = {
  id: string;
  title: string;
  consumerRiskBucket: ConsumerRiskBucket;
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
  measureCount: number;
  proposedStillNoisy: boolean;
};

type PreviewRecord = {
  id: string;
  title: string;
  sourceProductCategory: string;
  consumerRiskBucket: ConsumerRiskBucket;
  genericInput: RecallClassifierInput;
  proposedInput: EuSafetyGateClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'EU_SAFETY_GATE';
  totalEuSafetyGateRecords: number;
  sampleCount: number;
  requestedLimit: number;
  toyCaseIncluded: boolean;
  electronicsCaseIncluded: boolean;
  vehicleCaseIncluded: boolean;
  childcareCaseIncluded: boolean;
  chemicalOrCosmeticCaseIncluded: boolean;
  barcodeCaseIncluded: boolean;
  modelCaseIncluded: boolean;
  onlineSaleCaseIncluded: boolean;
  imageBackedCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.EU_SAFETY_GATE_CLASSIFIER_INPUT_PREVIEW_LIMIT;
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsed, 100));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
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

function labelize(value: unknown): string {
  const text = cleanText(value, 160);
  if (!text) {
    return '';
  }

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
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
    return cleanText(value.name ?? value.label ?? value.prefLabel ?? value.key ?? value.code ?? value.value ?? value['@id'], limit);
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

function rawPayload(record: NormalizedRecall): EuSafetyGateRaw {
  return isObject(record.raw) ? (record.raw as EuSafetyGateRaw) : {};
}

function versionText(container: Record<string, unknown>, languageKey: string): Record<string, unknown> {
  const versions = arrayOf(container.versions).filter(isObject);
  return (
    versions.find((version) => normalizeForCompare(fieldText(asObject(version.language).key, 20)) === normalizeForCompare(languageKey)) ??
    versions[0] ??
    {}
  );
}

function rawProduct(record: NormalizedRecall): Record<string, unknown> {
  return asObject(rawPayload(record).product);
}

function rawRisk(record: NormalizedRecall): Record<string, unknown> {
  return asObject(rawPayload(record).risk);
}

function rawTraceability(record: NormalizedRecall): Record<string, unknown> {
  return asObject(rawPayload(record).traceability);
}

function rawProductVersion(record: NormalizedRecall): Record<string, unknown> {
  return versionText(rawProduct(record), 'EN');
}

function rawRiskVersion(record: NormalizedRecall): Record<string, unknown> {
  return versionText(rawRisk(record), 'EN');
}

function rawProductCategory(record: NormalizedRecall): string {
  const product = rawProduct(record);
  const productCategory = asObject(product.productCategory);
  const productVersion = rawProductVersion(record);
  return labelize(productCategory.name ?? productCategory.key ?? productVersion.productCategoryOther ?? record.category);
}

function sourceNotificationType(record: NormalizedRecall): string {
  const notificationType = asObject(rawPayload(record).notificationType);
  return uniqueCleanList([notificationType.code, labelize(notificationType.name), notificationType.key, record.classification], 4, 120).join(' / ');
}

function countryValue(value: unknown): string {
  const object = asObject(value);
  return labelize(object.name ?? object.key ?? value);
}

function notifyingCountry(record: NormalizedRecall): string {
  return countryValue(rawPayload(record).country);
}

function countryOfOrigin(record: NormalizedRecall): string {
  return countryValue(rawTraceability(record).countryOrigin);
}

function countriesConcerned(record: NormalizedRecall): string[] {
  return uniqueCleanList(arrayOf(rawPayload(record).reactingCountries).map((item) => countryValue(asObject(item).country ?? item)), 20, 120);
}

function soldOnline(record: NormalizedRecall): string {
  return labelize(asObject(rawTraceability(record).isSoldOnline).name ?? asObject(rawTraceability(record).isSoldOnline).key);
}

function brandNames(record: NormalizedRecall): string[] {
  return uniqueCleanList([
    ...arrayOf(rawProduct(record).brands).map((brand) => asObject(brand).brand ?? asObject(brand).name),
    ...record.brandNames
  ], 8, 160);
}

function productNames(record: NormalizedRecall): string[] {
  const product = rawProduct(record);
  const version = rawProductVersion(record);
  return uniqueCleanList([
    version.name,
    product.name,
    product.nameSpecific,
    ...record.productNames.filter((name) => !/^\d{8,14}$/.test(name))
  ], 8, 180);
}

function riskTypes(record: NormalizedRecall): string[] {
  return uniqueCleanList(arrayOf(rawRisk(record).riskType).map((riskType) => labelize(asObject(riskType).name ?? asObject(riskType).key)), 16, 140);
}

function measures(record: NormalizedRecall): string[] {
  const measureTaken = asObject(rawPayload(record).measureTaken);
  return uniqueCleanList(arrayOf(measureTaken.measures).filter(isObject).map((measure) => {
    const category = asObject(measure.measureCategory);
    const type = asObject(measure.measureType);
    const operator = asObject(measure.measureVoluntaryEconomicOperator ?? measure.measureCompulsoryEconomicOperator);
    return uniqueCleanList([
      labelize(type.name ?? type.key),
      labelize(category.name ?? category.key),
      labelize(operator.name ?? operator.key)
    ], 3, 120).join(': ');
  }), 12, 180);
}

function onlineTraderIdentifiers(record: NormalizedRecall): string[] {
  return uniqueCleanList(arrayOf(rawPayload(record).onlineTraderProductIdentifierReference).filter(isObject).flatMap((item) => [
    item.uniqueProductIdentifier ? `${fieldText(item.onlineTrader, 80)} ${fieldText(item.uniqueProductIdentifier, 120)}` : '',
    item.onlineTrader
  ]), 10, 160);
}

function identifierCandidates(record: NormalizedRecall): string[] {
  const product = rawProduct(record);
  const sourceText = [
    rawPayload(record).reference,
    record.recallNumber,
    ...arrayOf(product.barcodes).filter(isObject).flatMap((item) => [item.barcode, item.value]),
    ...arrayOf(product.modelTypes).filter(isObject).flatMap((item) => [item.modelType, item.value]),
    ...arrayOf(product.batchNumbers).filter(isObject).flatMap((item) => Object.values(item)),
    ...onlineTraderIdentifiers(record),
    record.description,
    record.affectedUnits
  ].map((value) => cleanText(value, 1200)).join(' ');

  const matches = [
    ...(sourceText.match(/\b(?:barcode|gtin|ean|model|type|batch|lot|serial|asin|unique product identifier)[:#\s-]*[-A-Z0-9/*., ]{2,90}/gi) ?? []),
    ...(sourceText.match(/\bSR\/\d{4,6}\/\d{2,4}\b/gi) ?? []),
    ...(sourceText.match(/\b\d{8,14}\b/g) ?? [])
  ];

  return uniqueCleanList([rawPayload(record).reference, record.recallNumber, ...matches], 24, 160);
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || (record.images?.length ?? 0) > 0);
}

function consumerRiskBucket(record: NormalizedRecall): ConsumerRiskBucket {
  const text = normalizeForCompare([
    rawProductCategory(record),
    record.title,
    record.hazard,
    record.description,
    riskTypes(record).join(' ')
  ].join(' '));

  if (/\b(toy|childcare|children|choking|suffocation|strangulation|entrapment)\b/.test(text)) {
    return 'toy-child-risk';
  }
  if (/\b(electrical|electric shock|fire|burns|battery|lighting|appliance)\b/.test(text)) {
    return 'electrical-fire';
  }
  if (/\b(chemical|cosmetic|health risk|asbestos|lead|cadmium|phthalate|environment)\b/.test(text)) {
    return 'chemical';
  }
  if (/\b(motor vehicle|vehicle|machinery|injuries|cuts)\b/.test(text)) {
    return 'vehicle-injury';
  }
  return 'other';
}

function buildEuSafetyGateClassifierInputPreview(record: NormalizedRecall): EuSafetyGateClassifierInputPreview {
  const product = rawProduct(record);
  const productVersion = rawProductVersion(record);
  const riskVersion = rawRiskVersion(record);
  const origin = countryOfOrigin(record);
  const concerned = countriesConcerned(record);
  const onlineValue = soldOnline(record);

  return {
    id: record.id,
    source: 'EU_SAFETY_GATE',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 240),
    ...(rawProductCategory(record) ? { sourceProductCategory: rawProductCategory(record) } : {}),
    ...(sourceNotificationType(record) ? { notificationType: sourceNotificationType(record) } : {}),
    ...(notifyingCountry(record) ? { notifyingCountry: notifyingCountry(record) } : {}),
    ...(origin ? { countryOfOrigin: origin } : {}),
    ...(concerned.length ? { countriesConcerned: concerned } : {}),
    ...(onlineValue ? { soldOnline: onlineValue } : {}),
    productNames: productNames(record),
    brandNames: brandNames(record),
    ...(cleanText(product.nameSpecific, 180) ? { nameSpecific: cleanText(product.nameSpecific, 180) } : {}),
    ...(cleanText(productVersion.description, 420) ? { productDescription: cleanText(productVersion.description, 420) } : {}),
    ...(cleanText(productVersion.packageDescription, 220) ? { packageDescription: cleanText(productVersion.packageDescription, 220) } : {}),
    riskTypes: riskTypes(record),
    ...(cleanText(riskVersion.riskDescription ?? record.hazard, 650) ? { riskDescription: cleanText(riskVersion.riskDescription ?? record.hazard, 650) } : {}),
    ...(cleanText(riskVersion.legalProvision, 420) ? { legalProvision: cleanText(riskVersion.legalProvision, 420) } : {}),
    measures: measures(record),
    ...(cleanText(rawPayload(record).reference ?? record.recallNumber, 80) ? { recallNumber: cleanText(rawPayload(record).reference ?? record.recallNumber, 80) } : {}),
    identifiers: identifierCandidates(record),
    sourceHints: {
      source: 'EU_SAFETY_GATE',
      market: 'European Union',
      officialSource: 'Safety Gate',
      sourceApi: 'EU Safety Gate notification API',
      domainHint: 'consumer-product',
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

function selectEuSafetyGatePreviewSample(records: NormalizedRecall[], limit: number): {
  records: NormalizedRecall[];
  reasonsById: Map<string, string[]>;
  notes: string[];
} {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const pushRecord = (record: NormalizedRecall | undefined, reason: string): void => {
    if (!record) {
      notes.push(`No EU Safety Gate sample found for ${reason}.`);
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

  firstMatching('toy or child-risk source category', (record) => consumerRiskBucket(record) === 'toy-child-risk');
  firstMatching('electrical, fire, or battery risk case', (record) => consumerRiskBucket(record) === 'electrical-fire');
  firstMatching('chemical or cosmetic risk case', (record) => consumerRiskBucket(record) === 'chemical');
  firstMatching('vehicle, machinery, or injury case', (record) => consumerRiskBucket(record) === 'vehicle-injury');
  firstMatching('barcode identifier case', (record) => identifierCandidates(record).some((identifier) => /\b\d{8,14}\b/.test(identifier)));
  firstMatching('model/type identifier case', (record) => identifierCandidates(record).some((identifier) => /\b(model|type)\b/i.test(identifier)));
  firstMatching('batch/serial identifier case', (record) => identifierCandidates(record).some((identifier) => /\b(batch|lot|serial)\b/i.test(identifier)));
  firstMatching('online marketplace or trader case', (record) => hasTerm(record, ['sold online', 'amazon', 'etsy', 'asin']));
  firstMatching('country of origin case', (record) => Boolean(countryOfOrigin(record)));
  firstMatching('image-backed source record', (record) => hasImage(record));
  firstMatching('sparse brand case', (record) => brandNames(record).length === 0);
  firstMatching('long identifier case', (record) => identifierCandidates(record).length >= 10);

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
  proposedInput: EuSafetyGateClassifierInputPreview,
  bucket: ConsumerRiskBucket
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
    sourceProductCategory: proposedInput.sourceProductCategory || record.category,
    consumerRiskBucket: bucket,
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
      normalized === 'eu safety gate' ||
      normalized === 'european union' ||
      normalized === 'safety gate'
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
    if (typeof item === 'string' && item.length > 900) {
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
  const terms = ['pds status', 'internal comments', 'notifications', 'webreport', 'screen webreport'];
  return collectStrings(value)
    .filter((text) => !/^https?:\/\//i.test(text.trim()))
    .filter((text) => terms.some((term) => normalizeForCompare(text).includes(normalizeForCompare(term))))
    .slice(0, 12);
}

function hasHtmlLeakage(value: unknown): boolean {
  return collectStrings(value).some((text) => /<\/?[a-z][\s\S]*?>/i.test(text) || /&(?:nbsp|amp|quot|#39|#039);/i.test(text));
}

function criticalFieldFindings(input: EuSafetyGateClassifierInputPreview): string[] {
  const findings: string[] = [];
  if (!input.title && input.productNames.length === 0 && !input.productDescription) {
    findings.push('missing product evidence');
  }
  if (!input.riskDescription && input.riskTypes.length === 0) {
    findings.push('missing risk evidence');
  }
  if (input.measures.length === 0) {
    findings.push('missing measure evidence');
  }
  if (input.sourceUrl && !input.title && !input.riskDescription) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: EuSafetyGateClassifierInputPreview,
  comparison: TokenComparison,
  bucket: ConsumerRiskBucket
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
  if (emptyCritical.includes('missing risk evidence')) {
    flags.push('missing risk evidence');
  }
  if (emptyCritical.includes('missing measure evidence')) {
    flags.push('missing measure evidence');
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
    consumerRiskBucket: bucket,
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
    measureCount: proposedInput.measures.length,
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

  push(records.find((record) => record.consumerRiskBucket === 'toy-child-risk'));
  push(records.find((record) => record.consumerRiskBucket === 'electrical-fire'));
  push(records.find((record) => record.consumerRiskBucket === 'chemical'));
  push(records.find((record) => record.consumerRiskBucket === 'vehicle-injury'));
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
  const missingRisk = payload.records.filter((record) => record.noise.flags.includes('missing risk evidence'));
  const missingMeasures = payload.records.filter((record) => record.noise.flags.includes('missing measure evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Source category: ${record.proposedInput.sourceProductCategory || 'Missing'}`,
    `- Risk bucket: ${record.consumerRiskBucket}`,
    `- Notifying country: ${record.proposedInput.notifyingCountry || 'Missing'}`,
    `- Country of origin: ${record.proposedInput.countryOfOrigin || 'Missing'}`,
    `- Product evidence: ${[record.proposedInput.title, record.proposedInput.nameSpecific, record.proposedInput.productDescription, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Brand evidence: ${record.proposedInput.brandNames.length ? record.proposedInput.brandNames.join(' | ') : 'Missing'}`,
    `- Risk evidence: ${[record.proposedInput.riskTypes.join(', '), record.proposedInput.riskDescription].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Measure evidence: ${record.proposedInput.measures.length ? record.proposedInput.measures.join(' | ') : 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# EU Safety Gate Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total EU Safety Gate records: ${payload.totalEuSafetyGateRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Toy case: ${payload.toyCaseIncluded ? 'included' : 'not found'}`,
    `Electronics case: ${payload.electronicsCaseIncluded ? 'included' : 'not found'}`,
    `Vehicle case: ${payload.vehicleCaseIncluded ? 'included' : 'not found'}`,
    `Childcare case: ${payload.childcareCaseIncluded ? 'included' : 'not found'}`,
    `Chemical/cosmetic case: ${payload.chemicalOrCosmeticCaseIncluded ? 'included' : 'not found'}`,
    `Barcode case: ${payload.barcodeCaseIncluded ? 'included' : 'not found'}`,
    `Model case: ${payload.modelCaseIncluded ? 'included' : 'not found'}`,
    `Online sale case: ${payload.onlineSaleCaseIncluded ? 'included' : 'not found'}`,
    `Image-backed case: ${payload.imageBackedCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Risk Evidence',
    '',
    missingRisk.length ? missingRisk.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Measure Evidence',
    '',
    missingMeasures.length ? missingMeasures.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Noisy Proposed Input',
    '',
    noisyDescription.length ? noisyDescription.map((record) => `- ${record.id}: ${record.noise.flags.join(', ')}`).join('\n') : '- None in sample',
    '',
    '## Records With Likely Over-Extracted Identifiers',
    '',
    overExtracted.length ? overExtracted.map((record) => `- ${record.id}: ${record.proposedInput.identifiers.length} identifiers`).join('\n') : '- None in sample',
    '',
    '## Recommended EU Safety Gate Input Field Map',
    '',
    '- `title`: normalized Recall Radar title derived from official Safety Gate product wording.',
    '- `sourceProductCategory`: official Safety Gate product category, evidence only.',
    '- `notificationType`: official Safety Gate notification type or code, evidence only.',
    '- `notifyingCountry`: official notifying country.',
    '- `countryOfOrigin`: official country of origin when present.',
    '- `countriesConcerned`: official reacting/countries-concerned list when present.',
    '- `soldOnline`: official sold-online flag when present.',
    '- `productNames`: official English product name, nameSpecific, and normalized source product names.',
    '- `brandNames`: official brand values.',
    '- `productDescription`: official English product description.',
    '- `packageDescription`: official English package description.',
    '- `riskTypes`: official Safety Gate risk types.',
    '- `riskDescription`: official English risk description.',
    '- `legalProvision`: official legal provision text.',
    '- `measures`: official measure category/type/operator evidence.',
    '- `recallNumber`: official Safety Gate reference.',
    '- `identifiers`: source-derived barcodes, model/type values, batch/serial values, online trader identifiers, and reference numbers.',
    '- `sourceHints`: EU/Safety Gate/source-domain provenance only. Product family, product type, hazard type, audience, and final taxonomy are owned by the LLM.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm toys, electronics, vehicles, childcare, chemical/cosmetic, and image-backed examples are represented when present.',
    '- Confirm official Safety Gate categories are evidence only, not public category assignments.',
    '- Confirm barcode, model/type, batch/serial, online marketplace, and country evidence is retained without raw JSON.',
    '- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, web report boilerplate, and fallback strings.',
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

  await writeFile(resolve(absoluteOutputDir, 'eu-safety-gate-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'eu-safety-gate-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'eu-safety-gate-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'eu-safety-gate-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const euRecords = records.filter((record) => record.source === 'EU_SAFETY_GATE');
  const requestedLimit = envLimit();
  const sample = selectEuSafetyGatePreviewSample(euRecords, Math.min(requestedLimit, euRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildEuSafetyGateClassifierInputPreview(record);
    const bucket = consumerRiskBucket(record);
    const comparison = tokenComparison(record, genericInput, proposedInput, bucket);
    const noise = detectNoise(record, genericInput, proposedInput, comparison, bucket);

    return {
      id: record.id,
      title: record.title,
      sourceProductCategory: proposedInput.sourceProductCategory || record.category,
      consumerRiskBucket: bucket,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'EU_SAFETY_GATE',
    totalEuSafetyGateRecords: euRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    toyCaseIncluded: previewRecords.some((record) => /toy/i.test(inputText(record.proposedInput))),
    electronicsCaseIncluded: previewRecords.some((record) => /electrical|appliance|electric shock|battery|lighting/i.test(inputText(record.proposedInput))),
    vehicleCaseIncluded: previewRecords.some((record) => /vehicle|motor vehicles|machinery/i.test(inputText(record.proposedInput))),
    childcareCaseIncluded: previewRecords.some((record) => /childcare|children|choking|suffocation/i.test(inputText(record.proposedInput))),
    chemicalOrCosmeticCaseIncluded: previewRecords.some((record) => /chemical|cosmetic|asbestos|lead|cadmium|phthalate/i.test(inputText(record.proposedInput))),
    barcodeCaseIncluded: previewRecords.some((record) => record.proposedInput.identifiers.some((identifier) => /\b\d{8,14}\b/.test(identifier))),
    modelCaseIncluded: previewRecords.some((record) => record.proposedInput.identifiers.some((identifier) => /\b(model|type)\b/i.test(identifier))),
    onlineSaleCaseIncluded: previewRecords.some((record) => /sold online|amazon|etsy|asin/i.test(inputText(record.proposedInput))),
    imageBackedCaseIncluded: previewRecords.some((record) => hasImage(euRecords.find((item) => item.id === record.id) as NormalizedRecall)),
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
    totalEuSafetyGateRecords: payload.totalEuSafetyGateRecords,
    sampleCount: payload.sampleCount,
    toyCaseIncluded: payload.toyCaseIncluded,
    electronicsCaseIncluded: payload.electronicsCaseIncluded,
    vehicleCaseIncluded: payload.vehicleCaseIncluded,
    childcareCaseIncluded: payload.childcareCaseIncluded,
    chemicalOrCosmeticCaseIncluded: payload.chemicalOrCosmeticCaseIncluded,
    barcodeCaseIncluded: payload.barcodeCaseIncluded,
    modelCaseIncluded: payload.modelCaseIncluded,
    onlineSaleCaseIncluded: payload.onlineSaleCaseIncluded,
    imageBackedCaseIncluded: payload.imageBackedCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/eu-safety-gate-input-preview.json`,
      markdownReport: `${outputDir}/eu-safety-gate-input-preview.md`,
      noiseReport: `${outputDir}/eu-safety-gate-noise-report.json`,
      tokenComparison: `${outputDir}/eu-safety-gate-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
