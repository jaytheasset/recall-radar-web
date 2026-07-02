import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { getSourceOptionsForCurrentCoverage } from '../src/lib/recall-sources.ts';

type AuditIssue = {
  id: string;
  title: string;
  detail?: string;
};

type SourceCounts = Record<RecallSource, number> & {
  total: number;
};

type AuditSummary = {
  source: 'UK_FSA';
  total: number;
  duplicateIds: AuditIssue[];
  missing: Record<string, number>;
  classificationDistribution: Record<string, number>;
  siteCategoryDistribution: Record<string, number>;
  recordsWithBatchOrDateDetails: number;
  recordsWithPackSizeValues: number;
  recordsWithAllergenOrRiskLabels: number;
  recordsWithRetailerOrDistributionDetails: number;
  recordsWithImages: number;
  recordsWithRelatedMedia: number;
  recordsWithOfficialNoticeUrlShape: number;
  suspiciousCategoryMappings: AuditIssue[];
  slugCollisions: AuditIssue[];
  warnings: string[];
};

const expectedSourceFilterValues = [
  'all',
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA'
];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/uk-fsa-alerts.json');
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function compactIssue(record: NormalizedRecall, detail?: string): AuditIssue {
  return {
    id: record.id,
    title: record.title,
    ...(detail ? { detail } : {})
  };
}

function countMissing(records: NormalizedRecall[], test: (record: NormalizedRecall) => boolean): number {
  return records.filter(test).length;
}

function expectedNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(runtimeEnv[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sourceFilterValues(): string[] {
  return ['all', ...getSourceOptionsForCurrentCoverage().map((option) => option.value)];
}

function looksLikeOfficialNoticeUrl(value: string): boolean {
  return /^https:\/\/(?:alerts\.|www\.)food\.gov\.uk\/news-alerts\/alert\/fsa-[a-z]+-\d+-\d{4}(?:-update-\d+)?$/i.test(
    value
  );
}

function hasBatchOrDateLikeValue(record: NormalizedRecall): boolean {
  return /\b(?:lot|batch|best before|best-by|best by|use by|use-by|expiry|expiration|all dates)\b/i.test(
    [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ')
  );
}

function hasPackSizeValue(record: NormalizedRecall): boolean {
  return /\b(?:pack size|pack|all pack sizes|\d+(?:\.\d+)?\s?(?:g|kg|ml|l|litre|litres|oz|lb|per pack|packs?|pieces?|bars?|bottles?|jars?))\b/i.test(
    [record.productQuantity ?? '', record.affectedUnits, record.description, ...record.productNames].join(' ')
  );
}

function hasAllergenOrRiskLabel(record: NormalizedRecall): boolean {
  return /\b(?:allergen|allergy|ingredient|ingredients|undeclared|milk|egg|peanut|tree nut|almond|cashew|walnut|nut|soya|soy|wheat|gluten|mustard|sesame|celery|sulphite|sulphites|fish|shellfish|listeria|salmonella|contamination|foreign body|plastic|metal)\b/i.test(
    [record.title, record.description, record.hazard, record.reason ?? '', ...record.productNames].join(' ')
  );
}

function hasRetailerOrDistributionDetail(record: NormalizedRecall): boolean {
  return /\b(?:retail|retailer|stores?|supermarket|sold|stocked|pharmac(?:y|ies)|food businesses|distribution|distributed|purchased|where you bought|where it was bought|return (?:it|the product) to)\b/i.test(
    [record.title, record.description, record.remedy, record.distributionPattern ?? '', ...record.brandNames].join(' ')
  );
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || (Array.isArray(record.images) && record.images.length > 0));
}

function hasRelatedMedia(record: NormalizedRecall): boolean {
  const raw = record.raw as { relatedMedia?: unknown } | undefined;
  return Array.isArray(raw?.relatedMedia) ? raw.relatedMedia.length > 0 : Boolean(raw?.relatedMedia);
}

function classifyUkFsa(record: NormalizedRecall): string {
  const text = normalize([record.title, record.category, record.description, record.hazard, record.reason ?? ''].join(' '));

  if (
    text.includes('food alert') ||
    text.includes('allergy alert') ||
    text.includes('food alert for action') ||
    text.includes('product recall information') ||
    text.includes('allergen') ||
    text.includes('undeclared') ||
    text.includes('listeria') ||
    text.includes('salmonella')
  ) {
    return 'food-allergy';
  }

  return 'general-consumer-product';
}

async function readProcessedUkFsaRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records.filter((record) => record.source === 'UK_FSA') : [];
}

async function readCanonicalCounts(): Promise<SourceCounts> {
  const text = await readFile(canonicalProcessedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  const records = Array.isArray(payload.records) ? payload.records : [];

  return {
    total: records.length,
    CPSC: records.filter((record) => record.source === 'CPSC').length,
    FDA: records.filter((record) => record.source === 'FDA').length,
    FR_RAPPELCONSO: records.filter((record) => record.source === 'FR_RAPPELCONSO').length,
    CA_RECALLS: records.filter((record) => record.source === 'CA_RECALLS').length,
    EU_SAFETY_GATE: records.filter((record) => record.source === 'EU_SAFETY_GATE').length,
    UK_FSA: records.filter((record) => record.source === 'UK_FSA').length
  };
}

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const classificationDistribution: Record<string, number> = {};
  const siteCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(classificationDistribution, record.classification || record.category || '(missing)');
    increment(siteCategoryDistribution, classifyUkFsa(record));
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithBatchOrDateDetails = records.filter(hasBatchOrDateLikeValue).length;
  const recordsWithPackSizeValues = records.filter(hasPackSizeValue).length;
  const recordsWithAllergenOrRiskLabels = records.filter(hasAllergenOrRiskLabel).length;
  const recordsWithRetailerOrDistributionDetails = records.filter(hasRetailerOrDistributionDetail).length;
  const recordsWithImages = records.filter(hasImage).length;
  const recordsWithRelatedMedia = records.filter(hasRelatedMedia).length;
  const suspiciousCategoryMappings = records
    .filter((record) => classifyUkFsa(record) !== 'food-allergy')
    .map((record) => compactIssue(record, record.category));

  return {
    source: 'UK_FSA',
    total: records.length,
    duplicateIds,
    missing: {
      source: countMissing(records, (record) => record.source !== 'UK_FSA'),
      sourceUrl: countMissing(records, (record) => !record.sourceUrl),
      title: countMissing(records, (record) => !record.title),
      recallDate: countMissing(records, (record) => !record.recallDate),
      productNames: countMissing(records, (record) => record.productNames.length === 0),
      brandNames: countMissing(records, (record) => record.brandNames.length === 0),
      hazardOrReason: countMissing(records, (record) => !record.hazard && !record.reason),
      remedyOrAction: countMissing(records, (record) => !record.remedy),
      rawPayload: countMissing(records, (record) => !record.raw)
    },
    classificationDistribution,
    siteCategoryDistribution,
    recordsWithBatchOrDateDetails,
    recordsWithPackSizeValues,
    recordsWithAllergenOrRiskLabels,
    recordsWithRetailerOrDistributionDetails,
    recordsWithImages,
    recordsWithRelatedMedia,
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    suspiciousCategoryMappings,
    slugCollisions,
    warnings: [
      recordsWithBatchOrDateDetails === 0
        ? 'No UK FSA records exposed batch, lot, best-before, or use-by details in the selected spike.'
        : '',
      recordsWithPackSizeValues === 0 ? 'No UK FSA records exposed pack size values in the selected spike.' : '',
      recordsWithAllergenOrRiskLabels === 0
        ? 'No UK FSA records exposed allergen, pathogen, or risk labels in the selected spike.'
        : '',
      recordsWithRetailerOrDistributionDetails === 0
        ? 'No UK FSA records exposed retailer, store, distribution, or food-business details in the selected spike.'
        : ''
    ].filter(Boolean)
  };
}

function buildBlockers(summary: AuditSummary, canonicalCounts: SourceCounts, sourceFilters: string[]): string[] {
  const expectedCounts: SourceCounts = {
    total: expectedNumber('EXPECTED_TOTAL_RECALL_COUNT', 801),
    CPSC: expectedNumber('EXPECTED_CPSC_COUNT', 301),
    FDA: expectedNumber('EXPECTED_FDA_COUNT', 100),
    FR_RAPPELCONSO: expectedNumber('EXPECTED_RAPPELCONSO_COUNT', 100),
    CA_RECALLS: expectedNumber('EXPECTED_CANADA_RECALLS_COUNT', 100),
    EU_SAFETY_GATE: expectedNumber('EXPECTED_EU_SAFETY_GATE_COUNT', 100),
    UK_FSA: expectedNumber('EXPECTED_UK_FSA_COUNT', 100)
  };
  const severeMissingThreshold = Math.max(1, Math.floor(summary.total * 0.05));

  return [
    summary.total === 0 ? 'UK_FSA count is 0.' : '',
    summary.total !== expectedCounts.UK_FSA
      ? `UK_FSA count ${summary.total} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    canonicalCounts.total !== expectedCounts.total
      ? `Total processed count ${canonicalCounts.total} does not match expected ${expectedCounts.total}.`
      : '',
    canonicalCounts.CPSC !== expectedCounts.CPSC
      ? `CPSC count ${canonicalCounts.CPSC} does not match expected ${expectedCounts.CPSC}.`
      : '',
    canonicalCounts.FDA !== expectedCounts.FDA
      ? `FDA count ${canonicalCounts.FDA} does not match expected ${expectedCounts.FDA}.`
      : '',
    canonicalCounts.FR_RAPPELCONSO !== expectedCounts.FR_RAPPELCONSO
      ? `FR_RAPPELCONSO count ${canonicalCounts.FR_RAPPELCONSO} does not match expected ${expectedCounts.FR_RAPPELCONSO}.`
      : '',
    canonicalCounts.CA_RECALLS !== expectedCounts.CA_RECALLS
      ? `CA_RECALLS count ${canonicalCounts.CA_RECALLS} does not match expected ${expectedCounts.CA_RECALLS}.`
      : '',
    canonicalCounts.EU_SAFETY_GATE !== expectedCounts.EU_SAFETY_GATE
      ? `EU_SAFETY_GATE count ${canonicalCounts.EU_SAFETY_GATE} does not match expected ${expectedCounts.EU_SAFETY_GATE}.`
      : '',
    canonicalCounts.UK_FSA !== expectedCounts.UK_FSA
      ? `Canonical UK_FSA count ${canonicalCounts.UK_FSA} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    (summary.siteCategoryDistribution['general-consumer-product'] ?? 0) > 0
      ? `UK FSA records mapped outside food/allergy: ${summary.siteCategoryDistribution['general-consumer-product']}.`
      : '',
    summary.suspiciousCategoryMappings.length > 0
      ? `Suspicious UK FSA category mappings found: ${summary.suspiciousCategoryMappings.length}.`
      : '',
    summary.missing.source > 0 ? `Non-UK_FSA source records found in UK processed file: ${summary.missing.source}.` : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.missing.productNames > severeMissingThreshold ? `Missing product names found: ${summary.missing.productNames}.` : '',
    summary.missing.hazardOrReason > severeMissingThreshold
      ? `Missing reason fields found: ${summary.missing.hazardOrReason}.`
      : '',
    summary.missing.remedyOrAction > severeMissingThreshold
      ? `Missing consumer action fields found: ${summary.missing.remedyOrAction}.`
      : '',
    summary.missing.rawPayload > severeMissingThreshold ? `Missing raw payloads found: ${summary.missing.rawPayload}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official UK FSA URL shape mismatch count: ${summary.total - summary.recordsWithOfficialNoticeUrlShape}.`
      : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);
}

async function runAudit(): Promise<void> {
  const records = await readProcessedUkFsaRecords();
  if (records.length === 0) {
    throw new Error(`No UK_FSA records found in ${processedPath}`);
  }

  const summary = audit(records);
  const canonicalCounts = await readCanonicalCounts();
  const sourceFilters = sourceFilterValues();
  const blockers = buildBlockers(summary, canonicalCounts, sourceFilters);
  const passed = blockers.length === 0;
  const foodAllergyMappingCount = summary.siteCategoryDistribution['food-allergy'] ?? 0;
  const summaryLine = `${passed ? 'PASS' : 'FAIL'} UK_FSA=${summary.total} total=${canonicalCounts.total} food-allergy=${foodAllergyMappingCount} duplicateIds=${summary.duplicateIds.length} slugCollisions=${summary.slugCollisions.length} suspiciousCategoryMappings=${summary.suspiciousCategoryMappings.length}`;

  console.log(
    JSON.stringify(
      {
        passed,
        summaryLine,
        blockers,
        auditSummary: {
          result: passed ? 'pass' : 'fail',
          source: summary.source,
          ukFsaCount: summary.total,
          totalProcessedCount: canonicalCounts.total,
          blockerCount: blockers.length,
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
          foodAllergyMappingCount,
          categoryDistribution: summary.siteCategoryDistribution,
          sourceFilterValues: sourceFilters
        },
        operationalSummary: {
          auditPassed: passed,
          source: summary.source,
          totalProcessedCount: canonicalCounts.total,
          countsBySource: {
            CPSC: canonicalCounts.CPSC,
            FDA: canonicalCounts.FDA,
            FR_RAPPELCONSO: canonicalCounts.FR_RAPPELCONSO,
            CA_RECALLS: canonicalCounts.CA_RECALLS,
            EU_SAFETY_GATE: canonicalCounts.EU_SAFETY_GATE,
            UK_FSA: canonicalCounts.UK_FSA
          },
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          foodAllergyMappingCount,
          recordsWithBatchOrDateDetails: summary.recordsWithBatchOrDateDetails,
          recordsWithPackSizeValues: summary.recordsWithPackSizeValues,
          recordsWithAllergenOrRiskLabels: summary.recordsWithAllergenOrRiskLabels,
          recordsWithRetailerOrDistributionDetails: summary.recordsWithRetailerOrDistributionDetails,
          recordsWithImages: summary.recordsWithImages,
          recordsWithRelatedMedia: summary.recordsWithRelatedMedia,
          alertTypeDistribution: summary.classificationDistribution,
          categoryDistribution: summary.siteCategoryDistribution,
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
          recordsWithOfficialNoticeUrlShape: summary.recordsWithOfficialNoticeUrlShape,
          sourceFilterValues: sourceFilters,
          warnings: summary.warnings
        },
        detail: summary
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
