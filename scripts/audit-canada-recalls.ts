import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { getSourceOptionsForCurrentCoverage } from '../src/lib/recall-sources.ts';
import { isOfficialCanadaImageUrl, isSuspectedCanadaChromeImage } from './canada-detail-images.ts';

type AuditIssue = {
  id: string;
  title: string;
  detail?: string;
};

type AuditSummary = {
  source: 'CA_RECALLS';
  total: number;
  duplicateIds: AuditIssue[];
  missing: Record<string, number>;
  rawCategoryDistribution: Record<string, number>;
  siteCategoryDistribution: Record<string, number>;
  recordsWithImages: number;
  recordsWithPrimaryImageUrl: number;
  recordsWithPrimaryImageThumbnailUrl: number;
  recordsWithOfficialDetailUrl: number;
  invalidImageUrls: AuditIssue[];
  nonOfficialImageHosts: AuditIssue[];
  suspectedChromeImageFalsePositives: AuditIssue[];
  duplicateImageUrls: AuditIssue[];
  sampleRecoveredRecords: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    primaryImageUrl: string;
    primaryImageThumbnailUrl?: string;
    images: number;
    slug: string;
  }>;
  recordsWithUpcOrBarcodeLikeValues: number;
  recordsWithModelOrItemNumberLikeValues: number;
  recordsWithLotBatchCodeOrDateLikeValues: number;
  recordsWithDistributionDetails: number;
  recordsWithOfficialNoticeUrlShape: number;
  slugCollisions: AuditIssue[];
  suspiciousCategoryMappings: AuditIssue[];
  warnings: string[];
};

type SourceCounts = Record<RecallSource, number> & {
  total: number;
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
const processedPath = resolve(projectRoot, 'data/processed/canada-recalls.json');
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

function classifyCanadaRecall(record: NormalizedRecall): string {
  const rawCategory = normalize(record.category);
  const raw = record.raw && typeof record.raw === 'object' ? (record.raw as Record<string, unknown>) : {};
  const organization = normalize(String(raw.Organization ?? ''));
  const text = normalize(
    [
      record.title,
      record.category,
      organization,
      record.description,
      record.hazard,
      record.remedy,
      ...record.productNames,
      ...record.brandNames
    ].join(' ')
  );

  if (organization === 'cfia' || hasAny(text, ['food', 'allergen', 'allergy', 'undeclared', 'salmonella', 'listeria', 'milk', 'egg', 'wheat', 'sesame', 'pistachio'])) {
    return 'food-allergy';
  }

  if (hasAny(text, ['baby', 'child', 'children', 'infant', 'toy', 'nursery', 'kids'])) {
    return 'baby-kids';
  }

  if (hasAny(text, ['battery', 'batteries', 'charger', 'charging', 'electronics', 'power bank', 'lithium'])) {
    return 'battery-electronics';
  }

  if (
    hasAny(text, ['appliance', 'household', 'kitchenware', 'tableware', 'air conditioner', 'heat pump', 'furniture', 'furnishings']) ||
    rawCategory.includes('household') ||
    rawCategory.includes('furniture')
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function hasUpcOrBarcodeLikeValue(record: NormalizedRecall): boolean {
  return /\b(?:upc|barcode)\b|\b\d{8,14}\b/i.test(
    [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ')
  );
}

function hasModelOrItemNumberLikeValue(record: NormalizedRecall): boolean {
  const text = [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ');
  return [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:model|item|product)\s+#[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:model|item|product)\s+(?=[A-Z0-9./_-]*\d)[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:DIN|NPN)\s*[:#-]?\s*[0-9]{5,}\b/i
  ].some((pattern) => pattern.test(text));
}

function hasLotBatchCodeOrDateLikeValue(record: NormalizedRecall): boolean {
  const text = [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ');
  return [
    /\b(?:lot|batch)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:date code|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/i,
    /\b(?:best before|best-by|use by|expiry date|expiration date|expiry|expiration)\s*[:#-]?\s*[A-Z0-9][A-Z0-9 ,./_-]{2,30}\b/i
  ].some((pattern) => pattern.test(text));
}

function looksLikeOfficialNoticeUrl(value: string): boolean {
  return /^https:\/\/recalls-rappels\.canada\.ca\/en\/alert-recall\/[a-z0-9-]+$/i.test(value);
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
      .filter((url) => {
        try {
          new URL(url);
          return !isOfficialCanadaImageUrl(url);
        } catch {
          return false;
        }
      })
      .map((url) => compactIssue(record, url))
  );
}

function suspectedChromeImageIssues(records: NormalizedRecall[]): AuditIssue[] {
  return records.flatMap((record) =>
    imageUrlsFor(record)
      .filter(isSuspectedCanadaChromeImage)
      .map((url) => compactIssue(record, url))
  );
}

function duplicateImageUrlIssues(records: NormalizedRecall[]): AuditIssue[] {
  const imageUrlCounts = new Map<string, number>();
  for (const record of records) {
    for (const url of imageUrlsFor(record)) {
      imageUrlCounts.set(url, (imageUrlCounts.get(url) ?? 0) + 1);
    }
  }

  return records.flatMap((record) =>
    imageUrlsFor(record)
      .filter((url) => (imageUrlCounts.get(url) ?? 0) > 1)
      .map((url) => compactIssue(record, url))
  );
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

async function readProcessedCanadaRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records.filter((record) => record.source === 'CA_RECALLS') : [];
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

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const rawCategoryDistribution: Record<string, number> = {};
  const siteCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(rawCategoryDistribution, record.category || '(missing)');
    increment(siteCategoryDistribution, classifyCanadaRecall(record));
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const suspiciousCategoryMappings = records
    .map((record) => ({ record, siteCategory: classifyCanadaRecall(record) }))
    .filter(({ record, siteCategory }) => {
      const text = normalize([record.title, record.category, record.description, record.hazard, record.reason ?? ''].join(' '));

      if (siteCategory === 'food-allergy') {
        return !hasAny(text, ['cfia', 'food', 'allergen', 'allergy', 'salmonella', 'listeria', 'milk', 'egg', 'wheat', 'sesame']);
      }

      if (siteCategory === 'baby-kids') {
        return !hasAny(text, ['baby', 'child', 'children', 'infant', 'toy', 'nursery', 'kids']);
      }

      if (siteCategory === 'battery-electronics') {
        return !hasAny(text, ['battery', 'charger', 'electronics', 'power bank', 'lithium']);
      }

      return false;
    })
    .map(({ record, siteCategory }) => compactIssue(record, `${record.category} -> ${siteCategory}`));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0);
  const invalidImageUrls = invalidImageIssues(records);
  const nonOfficialImageHosts = nonOfficialImageHostIssues(records);
  const suspectedChromeImageFalsePositives = suspectedChromeImageIssues(records);
  const duplicateImageUrls = duplicateImageUrlIssues(records);

  const warnings = [
    countMissing(records, (record) => record.brandNames.length === 0) > 0
      ? 'Some Canada open-data records do not expose brand/company in a structured field.'
      : '',
    countMissing(records, (record) => !record.remedy) > 0
      ? 'Some Canada open-data records do not expose action text in the JSON feed.'
      : '',
    records.filter((record) => Boolean(record.distributionPattern)).length === 0
      ? 'The selected Canada open-data JSON feed does not include structured distribution details.'
      : '',
    recordsWithImages.length === 0
      ? 'No official Canada detail-page product images were normalized.'
      : ''
  ].filter(Boolean);

  return {
    source: 'CA_RECALLS',
    total: records.length,
    duplicateIds,
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
    recordsWithOfficialDetailUrl: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    invalidImageUrls,
    nonOfficialImageHosts,
    suspectedChromeImageFalsePositives,
    duplicateImageUrls,
    sampleRecoveredRecords: recordsWithImages.slice(0, 5).map((record) => ({
      id: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      primaryImageUrl: record.primaryImageUrl ?? '',
      ...(record.primaryImageThumbnailUrl ? { primaryImageThumbnailUrl: record.primaryImageThumbnailUrl } : {}),
      images: record.images?.length ?? 0,
      slug: record.slug
    })),
    recordsWithUpcOrBarcodeLikeValues: records.filter(hasUpcOrBarcodeLikeValue).length,
    recordsWithModelOrItemNumberLikeValues: records.filter(hasModelOrItemNumberLikeValue).length,
    recordsWithLotBatchCodeOrDateLikeValues: records.filter(hasLotBatchCodeOrDateLikeValue).length,
    recordsWithDistributionDetails: records.filter((record) => Boolean(record.distributionPattern)).length,
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    slugCollisions,
    suspiciousCategoryMappings,
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
  const blockers = [
    summary.total === 0 ? 'CA_RECALLS count is 0.' : '',
    summary.total !== expectedCounts.CA_RECALLS
      ? `CA_RECALLS count ${summary.total} does not match expected ${expectedCounts.CA_RECALLS}.`
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
      ? `Canonical CA_RECALLS count ${canonicalCounts.CA_RECALLS} does not match expected ${expectedCounts.CA_RECALLS}.`
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
      ? `HK_CFS count ${canonicalCounts.HK_CFS} does not match expected ${expectedCounts.HK_CFS}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.suspiciousCategoryMappings.length > 0
      ? `Suspicious category mappings found: ${summary.suspiciousCategoryMappings.length}.`
      : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official Canada URL shape mismatch count: ${summary.total - summary.recordsWithOfficialNoticeUrlShape}.`
      : '',
    summary.recordsWithPrimaryImageUrl === 0 ? 'No Canada official detail-page image URLs were normalized.' : '',
    summary.invalidImageUrls.length > 0 ? `Invalid Canada image URLs found: ${summary.invalidImageUrls.length}.` : '',
    summary.nonOfficialImageHosts.length > 0
      ? `Non-official Canada image URLs found: ${summary.nonOfficialImageHosts.length}.`
      : '',
    summary.suspectedChromeImageFalsePositives.length > 0
      ? `Suspected Canada chrome/logo image false positives found: ${summary.suspectedChromeImageFalsePositives.length}.`
      : '',
    sourceFilters.join('|') !== expectedSourceFilterValues.join('|')
      ? `Source filter values changed unexpectedly: ${sourceFilters.join(', ')}.`
      : ''
  ].filter(Boolean);

  return blockers;
}

async function runAudit(): Promise<void> {
  const records = await readProcessedCanadaRecords();
  if (records.length === 0) {
    throw new Error(`No CA_RECALLS records found in ${processedPath}`);
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
          caRecallsCount: summary.total,
          totalProcessedCount: canonicalCounts.total,
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
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
            AU_PRODUCT_SAFETY: canonicalCounts.AU_PRODUCT_SAFETY,
            NZ_PRODUCT_SAFETY: canonicalCounts.NZ_PRODUCT_SAFETY,
            HK_CFS: canonicalCounts.HK_CFS
          },
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
          recordsWithImages: summary.recordsWithImages,
          recordsWithPrimaryImageUrl: summary.recordsWithPrimaryImageUrl,
          recordsWithPrimaryImageThumbnailUrl: summary.recordsWithPrimaryImageThumbnailUrl,
          recordsWithOfficialDetailUrl: summary.recordsWithOfficialDetailUrl,
          invalidImageUrls: summary.invalidImageUrls.length,
          nonOfficialImageHosts: summary.nonOfficialImageHosts.length,
          suspectedChromeImageFalsePositives: summary.suspectedChromeImageFalsePositives.length,
          duplicateImageUrls: summary.duplicateImageUrls.length,
          sampleRecoveredRecords: summary.sampleRecoveredRecords,
          recordsWithUpcOrBarcodeLikeValues: summary.recordsWithUpcOrBarcodeLikeValues,
          recordsWithModelOrItemNumberLikeValues: summary.recordsWithModelOrItemNumberLikeValues,
          recordsWithLotBatchCodeOrDateLikeValues: summary.recordsWithLotBatchCodeOrDateLikeValues,
          recordsWithDistributionDetails: summary.recordsWithDistributionDetails,
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
