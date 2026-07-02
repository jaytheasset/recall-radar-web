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
  source: 'EU_SAFETY_GATE';
  total: number;
  duplicateIds: AuditIssue[];
  missing: Record<string, number>;
  rawCategoryDistribution: Record<string, number>;
  siteIdentifierCoverage: Record<string, number>;
  recordsWithImages: number;
  recordsWithOfficialNoticeUrlShape: number;
  slugCollisions: AuditIssue[];
  warnings: string[];
};

const expectedSourceFilterValues = ['all', 'CPSC', 'FDA', 'FR_RAPPELCONSO', 'CA_RECALLS', 'EU_SAFETY_GATE'];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/eu-safety-gate-recalls.json');
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

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
  return /^https:\/\/ec\.europa\.eu\/safety-gate-alerts\/screen\/webReport\/alertDetail\/[A-Za-z0-9_-]+$/i.test(
    value
  );
}

function hasBarcodeLikeValue(record: NormalizedRecall): boolean {
  return /\b(?:barcode|ean|gtin)\b|\b\d{8,14}\b/i.test(
    [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ')
  );
}

function hasModelOrBatchLikeValue(record: NormalizedRecall): boolean {
  const text = [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ');
  return [
    /\b(?:model|type|item)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:batch|lot)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i
  ].some((pattern) => pattern.test(text));
}

async function readProcessedEuSafetyGateRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records)
    ? payload.records.filter((record) => record.source === 'EU_SAFETY_GATE')
    : [];
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
    EU_SAFETY_GATE: records.filter((record) => record.source === 'EU_SAFETY_GATE').length
  };
}

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const rawCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(rawCategoryDistribution, record.category || '(missing)');
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0).length;
  const barcodeCoverage = records.filter(hasBarcodeLikeValue).length;
  const modelOrBatchCoverage = records.filter(hasModelOrBatchLikeValue).length;
  const warningMessages = [
    records.filter((record) => record.brandNames.length > 0).length === 0
      ? 'EU Safety Gate records may omit brand/company when the alert marks brand as unknown.'
      : '',
    recordsWithImages === 0 ? 'No EU Safety Gate official image URLs were normalized.' : ''
  ].filter(Boolean);

  return {
    source: 'EU_SAFETY_GATE',
    total: records.length,
    duplicateIds,
    missing: {
      sourceUrl: countMissing(records, (record) => !record.sourceUrl),
      title: countMissing(records, (record) => !record.title),
      recallDate: countMissing(records, (record) => !record.recallDate),
      productNames: countMissing(records, (record) => record.productNames.length === 0),
      hazardOrReason: countMissing(records, (record) => !record.hazard && !record.reason),
      remedyOrAction: countMissing(records, (record) => !record.remedy),
      rawPayload: countMissing(records, (record) => !record.raw)
    },
    rawCategoryDistribution,
    siteIdentifierCoverage: {
      barcodeLikeValues: barcodeCoverage,
      modelOrBatchLikeValues: modelOrBatchCoverage
    },
    recordsWithImages,
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    slugCollisions,
    warnings: warningMessages
  };
}

function buildBlockers(summary: AuditSummary, canonicalCounts: SourceCounts, sourceFilters: string[]): string[] {
  const expectedCounts: SourceCounts = {
    total: expectedNumber('EXPECTED_TOTAL_RECALL_COUNT', 701),
    CPSC: expectedNumber('EXPECTED_CPSC_COUNT', 301),
    FDA: expectedNumber('EXPECTED_FDA_COUNT', 100),
    FR_RAPPELCONSO: expectedNumber('EXPECTED_RAPPELCONSO_COUNT', 100),
    CA_RECALLS: expectedNumber('EXPECTED_CANADA_RECALLS_COUNT', 100),
    EU_SAFETY_GATE: expectedNumber('EXPECTED_EU_SAFETY_GATE_COUNT', 100)
  };
  const severeMissingThreshold = Math.max(1, Math.floor(summary.total * 0.05));

  return [
    summary.total === 0 ? 'EU_SAFETY_GATE count is 0.' : '',
    summary.total !== expectedCounts.EU_SAFETY_GATE
      ? `EU_SAFETY_GATE count ${summary.total} does not match expected ${expectedCounts.EU_SAFETY_GATE}.`
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
      ? `Canonical EU_SAFETY_GATE count ${canonicalCounts.EU_SAFETY_GATE} does not match expected ${expectedCounts.EU_SAFETY_GATE}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official EU Safety Gate URL shape mismatch count: ${summary.total - summary.recordsWithOfficialNoticeUrlShape}.`
      : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);
}

async function runAudit(): Promise<void> {
  const records = await readProcessedEuSafetyGateRecords();
  if (records.length === 0) {
    throw new Error(`No EU_SAFETY_GATE records found in ${processedPath}`);
  }

  const summary = audit(records);
  const canonicalCounts = await readCanonicalCounts();
  const sourceFilters = sourceFilterValues();
  const blockers = buildBlockers(summary, canonicalCounts, sourceFilters);
  const passed = blockers.length === 0;

  console.log(
    JSON.stringify(
      {
        passed,
        blockers,
        auditSummary: {
          result: passed ? 'pass' : 'fail',
          source: summary.source,
          euSafetyGateCount: summary.total,
          totalProcessedCount: canonicalCounts.total,
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          sourceFilterValues: sourceFilters
        },
        operationalSummary: {
          source: summary.source,
          totalProcessedCount: canonicalCounts.total,
          countsBySource: {
            CPSC: canonicalCounts.CPSC,
            FDA: canonicalCounts.FDA,
            FR_RAPPELCONSO: canonicalCounts.FR_RAPPELCONSO,
            CA_RECALLS: canonicalCounts.CA_RECALLS,
            EU_SAFETY_GATE: canonicalCounts.EU_SAFETY_GATE
          },
          recordsWithImages: summary.recordsWithImages,
          recordsWithOfficialNoticeUrlShape: summary.recordsWithOfficialNoticeUrlShape,
          sourceFilterValues: sourceFilters,
          warnings: summary.warnings
        },
        detail: {
          ...summary,
          rawCategoryDistribution: Object.fromEntries(
            Object.entries(summary.rawCategoryDistribution).sort((a, b) => b[1] - a[1])
          )
        }
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
