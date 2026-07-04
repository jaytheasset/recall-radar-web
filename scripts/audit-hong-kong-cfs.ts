import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { getSourceOptionsForCurrentCoverage } from '../src/lib/recall-sources.ts';
import { isOfficialHongKongCfsImageUrl, isOfficialHongKongCfsUrl } from './normalize-hong-kong-cfs-food-alerts.ts';

type AuditIssue = {
  id: string;
  title: string;
  detail?: string;
};

type SourceCounts = Record<RecallSource, number> & {
  total: number;
};

type AuditSummary = {
  source: 'HK_CFS';
  total: number;
  wrongSourceIds: AuditIssue[];
  duplicateIds: AuditIssue[];
  slugCollisions: AuditIssue[];
  duplicateSourceUrls: AuditIssue[];
  invalidRecallDates: AuditIssue[];
  nonOfficialSourceUrls: AuditIssue[];
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
  recordsWithCompanyOrBrand: number;
  recordsWithHazardOrRisk: number;
  recordsWithRemedyOrAction: number;
  recordsWithIdentifiers: number;
  recordsWithAllergenLikeTerms: number;
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
const processedPath = resolve(projectRoot, 'data/processed/hong-kong-cfs-food-alerts.json');
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

async function readProcessedHongKongRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records.filter((record) => record.source === 'HK_CFS') : [];
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
      .filter((url) => !isOfficialHongKongCfsImageUrl(url))
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
    /\b(?:batch|lot|code)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/i,
    /\b\d{8,14}\b/,
    /\b(?:best-before|best before|use-by|use by|expiry|expiration|manufacture)\s+date\b/i,
    /\b(?:pack size|net weight)\b/i
  ].some((pattern) => pattern.test(text));
}

function hasAllergenLikeTerm(record: NormalizedRecall): boolean {
  return /\b(allergen|allergy|undeclared|milk|egg|peanut|tree nut|nut|gluten|wheat|soy|soya|sesame|sulphite|sulfite|fish|crustacean|shellfish)\b/i.test(
    textFieldsFor(record)
  );
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

  const wrongSourceIds = records.filter((record) => record.source !== 'HK_CFS').map((record) => compactIssue(record, String(record.source)));
  const duplicateIds = records.filter((record) => (idCounts.get(record.id) ?? 0) > 1).map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0);
  const rawHtmlLeakage = rawHtmlLeakageIssues(records);
  const suspiciousImageCandidates = suspiciousImageCandidateIssues(records);
  const warnings = [
    recordsWithImages.length === 0
      ? 'CFS food alert detail pages in the bounded sample did not expose official product image URLs; existing fallback image behavior is expected.'
      : '',
    countMissing(records, (record) => record.affectedUnits.length === 0) > 0
      ? 'Some Hong Kong CFS notices do not expose batch, pack, or date identifiers in a consistent structured field.'
      : '',
    suspiciousImageCandidates.length > 0
      ? `Suspicious Hong Kong image candidate strings found: ${suspiciousImageCandidates.length}; review before accepting future refreshes.`
      : ''
  ].filter(Boolean);

  return {
    source: 'HK_CFS',
    total: records.length,
    wrongSourceIds,
    duplicateIds,
    slugCollisions,
    duplicateSourceUrls: duplicateSourceUrlIssues(records),
    invalidRecallDates: records.filter((record) => !isValidRecallDate(record.recallDate)).map((record) => compactIssue(record, record.recallDate)),
    nonOfficialSourceUrls: records.filter((record) => !isOfficialHongKongCfsUrl(record.sourceUrl)).map((record) => compactIssue(record, record.sourceUrl)),
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
    recordsWithCompanyOrBrand: records.filter((record) => record.brandNames.length > 0).length,
    recordsWithHazardOrRisk: records.filter((record) => Boolean(record.hazard || record.reason)).length,
    recordsWithRemedyOrAction: records.filter((record) => Boolean(record.remedy)).length,
    recordsWithIdentifiers: records.filter(hasIdentifierLikeValue).length,
    recordsWithAllergenLikeTerms: records.filter(hasAllergenLikeTerm).length,
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
  const severeMissingThreshold = Math.max(1, Math.floor(summary.total * 0.1));

  return [
    summary.total === 0 ? 'HK_CFS count is 0.' : '',
    summary.total !== expectedCounts.HK_CFS
      ? `HK_CFS count ${summary.total} does not match expected ${expectedCounts.HK_CFS}.`
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
      ? `NZ_PRODUCT_SAFETY count ${canonicalCounts.NZ_PRODUCT_SAFETY} does not match expected ${expectedCounts.NZ_PRODUCT_SAFETY}.`
      : '',
    canonicalCounts.HK_CFS !== expectedCounts.HK_CFS
      ? `Canonical HK_CFS count ${canonicalCounts.HK_CFS} does not match expected ${expectedCounts.HK_CFS}.`
      : '',
    summary.wrongSourceIds.length > 0 ? `Wrong source ids found in Hong Kong CFS file: ${summary.wrongSourceIds.length}.` : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.duplicateSourceUrls.length > 0 ? `Duplicate source URLs found: ${summary.duplicateSourceUrls.length}.` : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.missing.productNames > severeMissingThreshold ? `Missing product names found: ${summary.missing.productNames}.` : '',
    summary.missing.hazardOrReason > severeMissingThreshold
      ? `Missing hazard/reason fields found: ${summary.missing.hazardOrReason}.`
      : '',
    summary.missing.remedyOrAction > severeMissingThreshold
      ? `Missing remedy/action fields found: ${summary.missing.remedyOrAction}.`
      : '',
    summary.invalidRecallDates.length > 0 ? `Invalid Hong Kong CFS recall dates found: ${summary.invalidRecallDates.length}.` : '',
    summary.nonOfficialSourceUrls.length > 0
      ? `Non-official Hong Kong CFS source URLs found: ${summary.nonOfficialSourceUrls.length}.`
      : '',
    summary.invalidImageUrls.length > 0 ? `Invalid Hong Kong CFS image URLs found: ${summary.invalidImageUrls.length}.` : '',
    summary.nonOfficialImageHosts.length > 0
      ? `Non-official Hong Kong CFS image URLs found: ${summary.nonOfficialImageHosts.length}.`
      : '',
    summary.rawHtmlLeakage.length > 0 ? `Raw HTML/script/style leakage found in visible fields: ${summary.rawHtmlLeakage.length}.` : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);
}

async function runAudit(): Promise<void> {
  const records = await readProcessedHongKongRecords();
  if (records.length === 0) {
    throw new Error(`No HK_CFS records found in ${processedPath}`);
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
          hongKongCfsCount: summary.total,
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
          recordsWithProductNames: summary.recordsWithProductNames,
          recordsWithCompanyOrBrand: summary.recordsWithCompanyOrBrand,
          recordsWithHazardOrRisk: summary.recordsWithHazardOrRisk,
          recordsWithRemedyOrAction: summary.recordsWithRemedyOrAction,
          recordsWithIdentifiers: summary.recordsWithIdentifiers,
          recordsWithAllergenLikeTerms: summary.recordsWithAllergenLikeTerms,
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
