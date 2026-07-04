import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { getSourceOptionsForCurrentCoverage } from '../src/lib/recall-sources.ts';
import {
  isExcludedNewZealandSpecialistRecord,
  isOfficialNewZealandProductSafetyImageUrl,
  isOfficialNewZealandProductSafetyUrl,
  type NewZealandProductSafetyRaw
} from './normalize-new-zealand-product-safety.ts';

type AuditIssue = {
  id: string;
  title: string;
  detail?: string;
};

type SourceCounts = Record<RecallSource, number> & {
  total: number;
};

type AuditSummary = {
  source: 'NZ_PRODUCT_SAFETY';
  total: number;
  wrongSourceIds: AuditIssue[];
  duplicateIds: AuditIssue[];
  slugCollisions: AuditIssue[];
  duplicateSourceUrls: AuditIssue[];
  invalidRecallDates: AuditIssue[];
  nonOfficialSourceUrls: AuditIssue[];
  excludedSpecialistRecords: AuditIssue[];
  missing: Record<string, number>;
  categoryDistribution: Record<string, number>;
  recordsWithImages: number;
  recordsWithPrimaryImageUrl: number;
  recordsWithPrimaryImageThumbnailUrl: number;
  invalidImageUrls: AuditIssue[];
  nonOfficialImageHosts: AuditIssue[];
  suspiciousImageCandidates: AuditIssue[];
  rawHtmlLeakage: AuditIssue[];
  recordsWithProductNames: number;
  recordsWithSupplierOrBrand: number;
  recordsWithHazardOrReason: number;
  recordsWithRemedyOrAction: number;
  recordsWithIdentifiers: number;
  sourceUrlHostDistribution: Record<string, number>;
  imageHostDistribution: Record<string, number>;
  sampleRecords: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    recallDate: string;
    category: string;
    brandNames: string[];
    productNames: string[];
    slug: string;
  }>;
  warnings: string[];
};

const expectedSourceFilterValues = [
  'all',
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS'
];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/new-zealand-product-safety-recalls.json');
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function expectedNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(runtimeEnv[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function sourceFilterValues(): string[] {
  return ['all', ...getSourceOptionsForCurrentCoverage().map((option) => option.value)];
}

async function readProcessedNewZealandRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records.filter((record) => record.source === 'NZ_PRODUCT_SAFETY') : [];
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
    UK_FSA: records.filter((record) => record.source === 'UK_FSA').length,
    AU_PRODUCT_SAFETY: records.filter((record) => record.source === 'AU_PRODUCT_SAFETY').length,
    NZ_PRODUCT_SAFETY: records.filter((record) => record.source === 'NZ_PRODUCT_SAFETY').length,
    HK_CFS: records.filter((record) => record.source === 'HK_CFS').length
  };
}

function countMissing(records: NormalizedRecall[], test: (record: NormalizedRecall) => boolean): number {
  return records.filter(test).length;
}

function isValidRecallDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function textFieldsFor(record: NormalizedRecall): string {
  return [
    record.title,
    record.category,
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.affectedUnits,
    record.description,
    record.productQuantity ?? '',
    record.recallNumber ?? '',
    record.status ?? '',
    record.classification ?? '',
    record.distributionPattern ?? '',
    ...record.productNames,
    ...record.brandNames
  ].join(' ');
}

function imageUrlsFor(record: NormalizedRecall): string[] {
  const urls = [record.primaryImageUrl, record.primaryImageThumbnailUrl].filter((url): url is string => Boolean(url));

  for (const image of record.images ?? []) {
    urls.push(image.url);
    if (image.thumbnailUrl) {
      urls.push(image.thumbnailUrl);
    }
  }

  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
}

function hostFor(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '(invalid)';
  }
}

function duplicateSourceUrlIssues(records: NormalizedRecall[]): AuditIssue[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.sourceUrl, (counts.get(record.sourceUrl) ?? 0) + 1);
  }

  return records
    .filter((record) => (counts.get(record.sourceUrl) ?? 0) > 1)
    .map((record) => compactIssue(record, record.sourceUrl));
}

function rawHtmlLeakageIssues(records: NormalizedRecall[]): AuditIssue[] {
  const leakagePattern = /<script\b|<style\b|<\/?[a-z][^>]*>|&(?:lt|gt|nbsp|quot|#039|apos);/i;
  return records.filter((record) => leakagePattern.test(textFieldsFor(record))).map((record) => compactIssue(record));
}

function invalidImageIssues(records: NormalizedRecall[]): AuditIssue[] {
  return records.flatMap((record) =>
    imageUrlsFor(record)
      .filter((url) => {
        try {
          new URL(url);
          return false;
        } catch {
          return true;
        }
      })
      .map((url) => compactIssue(record, url))
  );
}

function nonOfficialImageHostIssues(records: NormalizedRecall[]): AuditIssue[] {
  return records.flatMap((record) =>
    imageUrlsFor(record)
      .filter((url) => !isOfficialNewZealandProductSafetyImageUrl(url))
      .map((url) => compactIssue(record, url))
  );
}

function suspiciousImageCandidateIssues(records: NormalizedRecall[]): AuditIssue[] {
  const suspiciousPattern =
    /\b(?:logo|favicon|sprite|icon|social|share|tracking|analytics|header|footer|placeholder|default|avatar|banner|og-image)\b/i;

  return records.flatMap((record) =>
    (record.images ?? [])
      .filter((image) =>
        suspiciousPattern.test([image.url, image.thumbnailUrl ?? '', image.alt ?? '', image.caption ?? ''].join(' '))
      )
      .map((image) => compactIssue(record, image.url))
  );
}

function hasIdentifierLikeValue(record: NormalizedRecall): boolean {
  const text = [record.title, record.description, record.affectedUnits, record.productQuantity ?? '', ...record.productNames].join(' ');
  return [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:SKU|serial)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/i,
    /\b\d{8,14}\b/,
    /\b(?:batch|lot|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i
  ].some((pattern) => pattern.test(text));
}

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const categoryDistribution: Record<string, number> = {};
  const sourceUrlHostDistribution: Record<string, number> = {};
  const imageHostDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(categoryDistribution, record.category || '(missing)');
    increment(sourceUrlHostDistribution, hostFor(record.sourceUrl));

    for (const url of imageUrlsFor(record)) {
      increment(imageHostDistribution, hostFor(url));
    }
  }

  const wrongSourceIds = records
    .filter((record) => record.source !== 'NZ_PRODUCT_SAFETY')
    .map((record) => compactIssue(record, String(record.source)));
  const duplicateIds = records.filter((record) => (idCounts.get(record.id) ?? 0) > 1).map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0);
  const rawHtmlLeakage = rawHtmlLeakageIssues(records);
  const suspiciousImageCandidates = suspiciousImageCandidateIssues(records);
  const warnings = [
    countMissing(records, (record) => record.affectedUnits.length === 0) > 0
      ? 'Product Safety New Zealand detail pages do not expose affected unit counts in a consistent structured field.'
      : '',
    recordsWithImages.length < Math.floor(records.length * 0.4)
      ? 'Fewer than 40% of New Zealand records include official product image URLs; review extraction if this changes unexpectedly.'
      : '',
    suspiciousImageCandidates.length > 0
      ? `Suspicious New Zealand image candidate strings found: ${suspiciousImageCandidates.length}; review before accepting future refreshes.`
      : ''
  ].filter(Boolean);

  return {
    source: 'NZ_PRODUCT_SAFETY',
    total: records.length,
    wrongSourceIds,
    duplicateIds,
    slugCollisions,
    duplicateSourceUrls: duplicateSourceUrlIssues(records),
    invalidRecallDates: records.filter((record) => !isValidRecallDate(record.recallDate)).map((record) => compactIssue(record, record.recallDate)),
    nonOfficialSourceUrls: records
      .filter((record) => !isOfficialNewZealandProductSafetyUrl(record.sourceUrl))
      .map((record) => compactIssue(record, record.sourceUrl)),
    excludedSpecialistRecords: records
      .filter((record) => isExcludedNewZealandSpecialistRecord(record.raw as NewZealandProductSafetyRaw))
      .map((record) => compactIssue(record)),
    missing: {
      sourceUrl: countMissing(records, (record) => !record.sourceUrl),
      title: countMissing(records, (record) => !record.title),
      recallDate: countMissing(records, (record) => !record.recallDate),
      category: countMissing(records, (record) => !record.category),
      productNames: countMissing(records, (record) => record.productNames.length === 0),
      brandNames: countMissing(records, (record) => record.brandNames.length === 0),
      hazardOrReason: countMissing(records, (record) => !record.hazard && !record.reason),
      remedyOrAction: countMissing(records, (record) => !record.remedy),
      rawPayload: countMissing(records, (record) => !record.raw)
    },
    categoryDistribution,
    recordsWithImages: recordsWithImages.length,
    recordsWithPrimaryImageUrl: records.filter((record) => Boolean(record.primaryImageUrl)).length,
    recordsWithPrimaryImageThumbnailUrl: records.filter((record) => Boolean(record.primaryImageThumbnailUrl)).length,
    invalidImageUrls: invalidImageIssues(records),
    nonOfficialImageHosts: nonOfficialImageHostIssues(records),
    suspiciousImageCandidates,
    rawHtmlLeakage,
    recordsWithProductNames: records.filter((record) => record.productNames.length > 0).length,
    recordsWithSupplierOrBrand: records.filter((record) => record.brandNames.length > 0).length,
    recordsWithHazardOrReason: records.filter((record) => Boolean(record.hazard || record.reason)).length,
    recordsWithRemedyOrAction: records.filter((record) => Boolean(record.remedy)).length,
    recordsWithIdentifiers: records.filter(hasIdentifierLikeValue).length,
    sourceUrlHostDistribution,
    imageHostDistribution,
    sampleRecords: records.slice(0, 5).map((record) => ({
      id: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      recallDate: record.recallDate,
      category: record.category,
      brandNames: record.brandNames.slice(0, 3),
      productNames: record.productNames.slice(0, 3),
      slug: record.slug
    })),
    warnings
  };
}

function buildBlockers(summary: AuditSummary, canonicalCounts: SourceCounts, sourceFilters: string[]): string[] {
  const expectedCounts: SourceCounts = {
    total: expectedNumber('EXPECTED_TOTAL_RECALL_COUNT', 1101),
    CPSC: expectedNumber('EXPECTED_CPSC_COUNT', 301),
    FDA: expectedNumber('EXPECTED_FDA_COUNT', 100),
    FR_RAPPELCONSO: expectedNumber('EXPECTED_RAPPELCONSO_COUNT', 100),
    CA_RECALLS: expectedNumber('EXPECTED_CANADA_RECALLS_COUNT', 100),
    EU_SAFETY_GATE: expectedNumber('EXPECTED_EU_SAFETY_GATE_COUNT', 100),
    UK_FSA: expectedNumber('EXPECTED_UK_FSA_COUNT', 100),
    AU_PRODUCT_SAFETY: expectedNumber('EXPECTED_AU_PRODUCT_SAFETY_COUNT', 100),
    NZ_PRODUCT_SAFETY: expectedNumber('EXPECTED_NZ_PRODUCT_SAFETY_COUNT', 100),
    HK_CFS: expectedNumber('EXPECTED_HK_CFS_COUNT', 100)
  };
  const severeMissingThreshold = Math.max(1, Math.floor(summary.total * 0.05));

  return [
    summary.total === 0 ? 'NZ_PRODUCT_SAFETY count is 0.' : '',
    summary.total !== expectedCounts.NZ_PRODUCT_SAFETY
      ? `NZ_PRODUCT_SAFETY count ${summary.total} does not match expected ${expectedCounts.NZ_PRODUCT_SAFETY}.`
      : '',
    canonicalCounts.total !== expectedCounts.total
      ? `Total processed count ${canonicalCounts.total} does not match expected ${expectedCounts.total}.`
      : '',
    canonicalCounts.CPSC !== expectedCounts.CPSC ? `CPSC count ${canonicalCounts.CPSC} does not match expected ${expectedCounts.CPSC}.` : '',
    canonicalCounts.FDA !== expectedCounts.FDA ? `FDA count ${canonicalCounts.FDA} does not match expected ${expectedCounts.FDA}.` : '',
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
      ? `UK_FSA count ${canonicalCounts.UK_FSA} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    canonicalCounts.AU_PRODUCT_SAFETY !== expectedCounts.AU_PRODUCT_SAFETY
      ? `AU_PRODUCT_SAFETY count ${canonicalCounts.AU_PRODUCT_SAFETY} does not match expected ${expectedCounts.AU_PRODUCT_SAFETY}.`
      : '',
    canonicalCounts.NZ_PRODUCT_SAFETY !== expectedCounts.NZ_PRODUCT_SAFETY
      ? `Canonical NZ_PRODUCT_SAFETY count ${canonicalCounts.NZ_PRODUCT_SAFETY} does not match expected ${expectedCounts.NZ_PRODUCT_SAFETY}.`
      : '',
    canonicalCounts.HK_CFS !== expectedCounts.HK_CFS
      ? `HK_CFS count ${canonicalCounts.HK_CFS} does not match expected ${expectedCounts.HK_CFS}.`
      : '',
    summary.wrongSourceIds.length > 0 ? `Wrong source ids found in New Zealand file: ${summary.wrongSourceIds.length}.` : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.duplicateSourceUrls.length > 0 ? `Duplicate source URLs found: ${summary.duplicateSourceUrls.length}.` : '',
    summary.excludedSpecialistRecords.length > 0
      ? `Specialist vehicle/medical records were normalized into NZ_PRODUCT_SAFETY: ${summary.excludedSpecialistRecords.length}.`
      : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.invalidRecallDates.length > 0 ? `Invalid New Zealand recall dates found: ${summary.invalidRecallDates.length}.` : '',
    summary.nonOfficialSourceUrls.length > 0
      ? `Non-official New Zealand source URLs found: ${summary.nonOfficialSourceUrls.length}.`
      : '',
    summary.invalidImageUrls.length > 0 ? `Invalid New Zealand image URLs found: ${summary.invalidImageUrls.length}.` : '',
    summary.nonOfficialImageHosts.length > 0
      ? `Non-official New Zealand image URLs found: ${summary.nonOfficialImageHosts.length}.`
      : '',
    summary.rawHtmlLeakage.length > 0 ? `Raw HTML/script/style leakage found in visible fields: ${summary.rawHtmlLeakage.length}.` : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);
}

async function runAudit(): Promise<void> {
  const records = await readProcessedNewZealandRecords();
  if (records.length === 0) {
    throw new Error(`No NZ_PRODUCT_SAFETY records found in ${processedPath}`);
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
          nzProductSafetyCount: summary.total,
          totalProcessedCount: canonicalCounts.total,
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          duplicateSourceUrls: summary.duplicateSourceUrls.length,
          invalidRecallDates: summary.invalidRecallDates.length,
          nonOfficialSourceUrls: summary.nonOfficialSourceUrls.length,
          recordsWithImages: summary.recordsWithImages,
          sourceFilterValues: sourceFilters
        },
        operationalSummary: {
          source: summary.source,
          totalProcessedCount: canonicalCounts.total,
          countsBySource: canonicalCounts,
          recordsWithImages: summary.recordsWithImages,
          recordsWithPrimaryImageUrl: summary.recordsWithPrimaryImageUrl,
          recordsWithPrimaryImageThumbnailUrl: summary.recordsWithPrimaryImageThumbnailUrl,
          recordsWithSupplierOrBrand: summary.recordsWithSupplierOrBrand,
          recordsWithProductNames: summary.recordsWithProductNames,
          recordsWithHazardOrReason: summary.recordsWithHazardOrReason,
          recordsWithRemedyOrAction: summary.recordsWithRemedyOrAction,
          recordsWithIdentifiers: summary.recordsWithIdentifiers,
          invalidImageUrls: summary.invalidImageUrls.length,
          nonOfficialImageHosts: summary.nonOfficialImageHosts.length,
          suspiciousImageCandidates: summary.suspiciousImageCandidates.length,
          rawHtmlLeakage: summary.rawHtmlLeakage.length,
          sourceUrlHostDistribution: summary.sourceUrlHostDistribution,
          imageHostDistribution: summary.imageHostDistribution,
          sampleRecords: summary.sampleRecords,
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
