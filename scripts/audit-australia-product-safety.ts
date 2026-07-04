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
  source: 'AU_PRODUCT_SAFETY';
  total: number;
  duplicateIds: AuditIssue[];
  slugCollisions: AuditIssue[];
  missing: Record<string, number>;
  rawCategoryDistribution: Record<string, number>;
  siteCategoryDistribution: Record<string, number>;
  recordsWithImages: number;
  recordsWithPrimaryImageUrl: number;
  recordsWithPrimaryImageThumbnailUrl: number;
  recordsWithOfficialNoticeUrlShape: number;
  invalidImageUrls: AuditIssue[];
  nonOfficialImageHosts: AuditIssue[];
  duplicateImageUrls: AuditIssue[];
  recordsWithModelBarcodeBatchOrLotLikeValues: number;
  recordsWithDistributionDetails: number;
  sampleImageRecords: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    primaryImageUrl: string;
    primaryImageThumbnailUrl?: string;
    images: number;
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
  'AU_PRODUCT_SAFETY'
];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/australia-product-safety-recalls.json');
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

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function compactIssue(record: NormalizedRecall, detail?: string): AuditIssue {
  return {
    id: record.id,
    title: record.title,
    ...(detail ? { detail } : {})
  };
}

function expectedNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(runtimeEnv[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sourceFilterValues(): string[] {
  return ['all', ...getSourceOptionsForCurrentCoverage().map((option) => option.value)];
}

async function readProcessedAustraliaRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records.filter((record) => record.source === 'AU_PRODUCT_SAFETY') : [];
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
    AU_PRODUCT_SAFETY: records.filter((record) => record.source === 'AU_PRODUCT_SAFETY').length
  };
}

function countMissing(records: NormalizedRecall[], test: (record: NormalizedRecall) => boolean): number {
  return records.filter(test).length;
}

function looksLikeOfficialNoticeUrl(value: string): boolean {
  return /^https:\/\/www\.productsafety\.gov\.au\/search-consumer-product-recalls\/[^?#]+$/i.test(value);
}

function isOfficialAustraliaImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === 'www.productsafety.gov.au' &&
      /^\/system\/files\/(?:styles\/[^/]+\/)?(?:public|private)\//i.test(url.pathname)
    );
  } catch {
    return false;
  }
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
      .filter((url) => !isOfficialAustraliaImageUrl(url))
      .map((url) => compactIssue(record, url))
  );
}

function duplicateImageUrlIssues(records: NormalizedRecall[]): AuditIssue[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const url of imageUrlsFor(record)) {
      counts.set(url, (counts.get(url) ?? 0) + 1);
    }
  }

  return records.flatMap((record) =>
    imageUrlsFor(record)
      .filter((url) => (counts.get(url) ?? 0) > 1)
      .map((url) => compactIssue(record, url))
  );
}

function hasIdentifierLikeValue(record: NormalizedRecall): boolean {
  const text = [record.title, record.description, record.affectedUnits, record.productQuantity ?? '', ...record.productNames].join(' ');
  return [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/i,
    /\b\d{8,14}\b/,
    /\b(?:batch|lot|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i
  ].some((pattern) => pattern.test(text));
}

function classifyAustraliaRecord(record: NormalizedRecall): string {
  const text = normalize(
    [
      record.title,
      record.category,
      record.hazard,
      record.reason ?? '',
      record.remedy,
      record.description,
      ...record.productNames,
      ...record.brandNames
    ].join(' ')
  );

  if (hasAny(text, ['baby', 'toddler', 'child', 'children', 'kids', 'toy', 'dummy', 'pram'])) {
    return 'baby-kids';
  }

  if (hasAny(text, ['battery', 'batteries', 'button battery', 'charger', 'charging', 'lithium', 'electronics', 'electrical'])) {
    return 'battery-electronics';
  }

  if (hasAny(text, ['food', 'grocery', 'allergen', 'allergy', 'undeclared', 'milk', 'egg', 'wheat', 'peanut', 'sesame'])) {
    return 'food-allergy';
  }

  if (hasAny(text, ['home', 'garden', 'appliance', 'household', 'furniture', 'gas', 'heater', 'chemical', 'poison'])) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const rawCategoryDistribution: Record<string, number> = {};
  const siteCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(rawCategoryDistribution, record.category || '(missing)');
    increment(siteCategoryDistribution, classifyAustraliaRecord(record));
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0);
  const invalidImageUrls = invalidImageIssues(records);
  const nonOfficialImageHosts = nonOfficialImageHostIssues(records);
  const duplicateImageUrls = duplicateImageUrlIssues(records);
  const warnings = [
    countMissing(records, (record) => record.affectedUnits.length === 0) > 0
      ? 'Product Safety Australia detail pages do not expose affected unit counts in a consistent structured field.'
      : '',
    recordsWithImages.length < Math.floor(records.length * 0.4)
      ? 'Fewer than 40% of Australia records include official product image URLs; review extraction if this changes unexpectedly.'
      : ''
  ].filter(Boolean);

  return {
    source: 'AU_PRODUCT_SAFETY',
    total: records.length,
    duplicateIds,
    slugCollisions,
    missing: {
      sourceUrl: countMissing(records, (record) => !record.sourceUrl),
      title: countMissing(records, (record) => !record.title),
      recallDate: countMissing(records, (record) => !record.recallDate),
      productNames: countMissing(records, (record) => record.productNames.length === 0),
      brandNames: countMissing(records, (record) => record.brandNames.length === 0),
      hazardOrReason: countMissing(records, (record) => !record.hazard && !record.reason),
      remedyOrAction: countMissing(records, (record) => !record.remedy),
      rawPayload: countMissing(records, (record) => !record.raw)
    },
    rawCategoryDistribution,
    siteCategoryDistribution,
    recordsWithImages: recordsWithImages.length,
    recordsWithPrimaryImageUrl: records.filter((record) => Boolean(record.primaryImageUrl)).length,
    recordsWithPrimaryImageThumbnailUrl: records.filter((record) => Boolean(record.primaryImageThumbnailUrl)).length,
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    invalidImageUrls,
    nonOfficialImageHosts,
    duplicateImageUrls,
    recordsWithModelBarcodeBatchOrLotLikeValues: records.filter(hasIdentifierLikeValue).length,
    recordsWithDistributionDetails: records.filter((record) => Boolean(record.distributionPattern)).length,
    sampleImageRecords: recordsWithImages.slice(0, 5).map((record) => ({
      id: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      primaryImageUrl: record.primaryImageUrl ?? '',
      ...(record.primaryImageThumbnailUrl ? { primaryImageThumbnailUrl: record.primaryImageThumbnailUrl } : {}),
      images: record.images?.length ?? 0,
      slug: record.slug
    })),
    warnings
  };
}

function buildBlockers(summary: AuditSummary, canonicalCounts: SourceCounts, sourceFilters: string[]): string[] {
  const expectedCounts: SourceCounts = {
    total: expectedNumber('EXPECTED_TOTAL_RECALL_COUNT', 901),
    CPSC: expectedNumber('EXPECTED_CPSC_COUNT', 301),
    FDA: expectedNumber('EXPECTED_FDA_COUNT', 100),
    FR_RAPPELCONSO: expectedNumber('EXPECTED_RAPPELCONSO_COUNT', 100),
    CA_RECALLS: expectedNumber('EXPECTED_CANADA_RECALLS_COUNT', 100),
    EU_SAFETY_GATE: expectedNumber('EXPECTED_EU_SAFETY_GATE_COUNT', 100),
    UK_FSA: expectedNumber('EXPECTED_UK_FSA_COUNT', 100),
    AU_PRODUCT_SAFETY: expectedNumber('EXPECTED_AU_PRODUCT_SAFETY_COUNT', 100)
  };
  const severeMissingThreshold = Math.max(1, Math.floor(summary.total * 0.05));

  return [
    summary.total === 0 ? 'AU_PRODUCT_SAFETY count is 0.' : '',
    summary.total !== expectedCounts.AU_PRODUCT_SAFETY
      ? `AU_PRODUCT_SAFETY count ${summary.total} does not match expected ${expectedCounts.AU_PRODUCT_SAFETY}.`
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
      ? `UK_FSA count ${canonicalCounts.UK_FSA} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    canonicalCounts.AU_PRODUCT_SAFETY !== expectedCounts.AU_PRODUCT_SAFETY
      ? `Canonical AU_PRODUCT_SAFETY count ${canonicalCounts.AU_PRODUCT_SAFETY} does not match expected ${expectedCounts.AU_PRODUCT_SAFETY}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official Australia URL shape mismatch count: ${summary.total - summary.recordsWithOfficialNoticeUrlShape}.`
      : '',
    summary.recordsWithPrimaryImageUrl === 0 ? 'No Australia official product image URLs were normalized.' : '',
    summary.invalidImageUrls.length > 0 ? `Invalid Australia image URLs found: ${summary.invalidImageUrls.length}.` : '',
    summary.nonOfficialImageHosts.length > 0
      ? `Non-official Australia image URLs found: ${summary.nonOfficialImageHosts.length}.`
      : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);
}

async function runAudit(): Promise<void> {
  const records = await readProcessedAustraliaRecords();
  if (records.length === 0) {
    throw new Error(`No AU_PRODUCT_SAFETY records found in ${processedPath}`);
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
          auProductSafetyCount: summary.total,
          totalProcessedCount: canonicalCounts.total,
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          recordsWithImages: summary.recordsWithImages,
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
            EU_SAFETY_GATE: canonicalCounts.EU_SAFETY_GATE,
            UK_FSA: canonicalCounts.UK_FSA,
            AU_PRODUCT_SAFETY: canonicalCounts.AU_PRODUCT_SAFETY
          },
          recordsWithImages: summary.recordsWithImages,
          recordsWithPrimaryImageUrl: summary.recordsWithPrimaryImageUrl,
          recordsWithPrimaryImageThumbnailUrl: summary.recordsWithPrimaryImageThumbnailUrl,
          recordsWithOfficialNoticeUrlShape: summary.recordsWithOfficialNoticeUrlShape,
          recordsWithDistributionDetails: summary.recordsWithDistributionDetails,
          recordsWithModelBarcodeBatchOrLotLikeValues: summary.recordsWithModelBarcodeBatchOrLotLikeValues,
          invalidImageUrls: summary.invalidImageUrls.length,
          nonOfficialImageHosts: summary.nonOfficialImageHosts.length,
          duplicateImageUrls: summary.duplicateImageUrls.length,
          sampleImageRecords: summary.sampleImageRecords,
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
