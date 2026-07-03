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

type ImageEndpointValidation = {
  checked: number;
  okImage: number;
  empty2xx: number;
  nonImage2xx: number;
  redirect3xx: number;
  forbidden403: number;
  notFound404: number;
  timeout: number;
  other: number;
  failures: AuditIssue[];
};

type AuditSummary = {
  source: 'EU_SAFETY_GATE';
  total: number;
  duplicateIds: AuditIssue[];
  missing: Record<string, number>;
  rawCategoryDistribution: Record<string, number>;
  siteCategoryDistribution: Record<string, number>;
  siteIdentifierCoverage: Record<string, number>;
  recordsWithImages: number;
  imageSelection: {
    recordsWithRawPhotos: number;
    recordsWithOfficialMainPicture: number;
    recordsWithPrimaryImageUrl: number;
    recordsWithPrimaryImageThumbnailUrl: number;
    primaryImageMatchesOfficialMain: number;
    primaryImageMismatches: AuditIssue[];
    primaryThumbnailMatchesOfficialMain: number;
    primaryThumbnailMismatches: AuditIssue[];
  };
  imageEndpointValidation: ImageEndpointValidation;
  thumbnailEndpointValidation: ImageEndpointValidation;
  recordsWithOfficialNoticeUrlShape: number;
  suspiciousCategoryMappings: AuditIssue[];
  slugCollisions: AuditIssue[];
  warnings: string[];
};

const expectedSourceFilterValues = ['all', 'CPSC', 'FDA', 'FR_RAPPELCONSO', 'CA_RECALLS', 'EU_SAFETY_GATE', 'UK_FSA'];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/eu-safety-gate-recalls.json');
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};
const imageEndpointConcurrency = 8;
const imageEndpointTimeoutMs = 15000;

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function valuesFromObjects(items: Record<string, unknown>[], keys: string[]): string[] {
  return uniqueNonEmpty(items.flatMap((item) => keys.map((key) => asString(item[key]))));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textHasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
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

function rawProduct(record: NormalizedRecall): Record<string, unknown> {
  return asObject(asObject(record.raw).product);
}

function rawRisk(record: NormalizedRecall): Record<string, unknown> {
  return asObject(asObject(record.raw).risk);
}

function rawTraceability(record: NormalizedRecall): Record<string, unknown> {
  return asObject(asObject(record.raw).traceability);
}

function rawIdentifierGroups(record: NormalizedRecall): {
  barcodes: string[];
  models: string[];
  batches: string[];
} {
  const product = rawProduct(record);
  return {
    barcodes: valuesFromObjects(asArray(product.barcodes), ['barcode', 'value']),
    models: valuesFromObjects(asArray(product.modelTypes), ['modelType', 'value']),
    batches: uniqueNonEmpty(asArray(product.batchNumbers).flatMap((item) => Object.values(item).map(asString)))
  };
}

function rawRiskTypes(record: NormalizedRecall): string[] {
  return valuesFromObjects(asArray(rawRisk(record).riskType), ['name', 'key']);
}

function rawCountryValue(record: NormalizedRecall, key: 'country' | 'countryOrigin'): string {
  if (key === 'country') {
    const country = asObject(asObject(record.raw).country);
    return valuesFromObjects([country], ['name', 'key'])[0] ?? '';
  }

  const origin = asObject(rawTraceability(record).countryOrigin);
  return valuesFromObjects([origin], ['name', 'key'])[0] ?? '';
}

function rawCountriesConcerned(record: NormalizedRecall): string[] {
  return uniqueNonEmpty(
    asArray(asObject(record.raw).reactingCountries).map((item) => {
      const country = asObject(item.country);
      return valuesFromObjects([item, country], ['name', 'key'])[0] ?? '';
    })
  );
}

function rawPhotos(record: NormalizedRecall): Record<string, unknown>[] {
  return asArray(rawProduct(record).photos);
}

function officialImageUrl(id: string): string {
  return `https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/${encodeURIComponent(id)}`;
}

function officialThumbnailImageUrl(id: string): string {
  return `https://ec.europa.eu/safety-gate-alerts/public/api/notification/thumbnail/${encodeURIComponent(id)}`;
}

function officialMainPicture(record: NormalizedRecall): Record<string, unknown> | null {
  const photos = rawPhotos(record);
  return photos.find((photo) => photo.mainPicture === true) ?? photos[0] ?? null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchImageEndpointStatus(
  url: string
): Promise<{
  status: 'image' | 'empty-2xx' | 'non-image-2xx' | '3xx' | '403' | '404' | 'timeout' | 'other';
  detail: string;
}> {
  let lastStatus: 'image' | 'empty-2xx' | 'non-image-2xx' | '3xx' | '403' | '404' | 'timeout' | 'other' = 'other';
  let lastDetail = '';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), imageEndpointTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'image/*,*/*',
          language: 'en',
          lang: 'en',
          origin: 'https://ec.europa.eu',
          referer: 'https://ec.europa.eu/safety-gate-alerts/screen/webReport',
          'user-agent': 'Recall Radar EU Safety Gate image audit',
          range: 'bytes=0-1024'
        }
      });
      const body = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') ?? '';
      lastDetail = `HTTP ${response.status} content-type=${contentType || '(missing)'} bytes=${body.length}`;

      if (response.status >= 200 && response.status < 300) {
        if (body.length === 0) {
          lastStatus = 'empty-2xx';
        } else {
          lastStatus = /^image\//i.test(contentType) ? 'image' : 'non-image-2xx';
        }
      } else if (response.status >= 300 && response.status < 400) {
        lastStatus = '3xx';
      } else if (response.status === 403) {
        lastStatus = '403';
      } else if (response.status === 404) {
        lastStatus = '404';
      } else {
        lastStatus = 'other';
      }
    } catch (error) {
      lastStatus = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'other';
      lastDetail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    } finally {
      clearTimeout(timeout);
    }

    if (lastStatus === 'image') {
      return { status: lastStatus, detail: lastDetail };
    }
  }

  return { status: lastStatus, detail: lastDetail };
}

async function validateImageEndpoints(
  records: NormalizedRecall[],
  getUrl: (record: NormalizedRecall) => string | undefined
): Promise<ImageEndpointValidation> {
  const recordsWithPrimaryImages = records.filter((record) => Boolean(getUrl(record)));
  const validation: ImageEndpointValidation = {
    checked: 0,
    okImage: 0,
    empty2xx: 0,
    nonImage2xx: 0,
    redirect3xx: 0,
    forbidden403: 0,
    notFound404: 0,
    timeout: 0,
    other: 0,
    failures: []
  };

  await mapWithConcurrency(recordsWithPrimaryImages, imageEndpointConcurrency, async (record) => {
    const url = getUrl(record) ?? '';
    const result = await fetchImageEndpointStatus(url);
    const { status } = result;
    validation.checked += 1;

    if (status === 'image') {
      validation.okImage += 1;
    } else if (status === 'empty-2xx') {
      validation.empty2xx += 1;
    } else if (status === 'non-image-2xx') {
      validation.nonImage2xx += 1;
    } else if (status === '3xx') {
      validation.redirect3xx += 1;
    } else if (status === '403') {
      validation.forbidden403 += 1;
    } else if (status === '404') {
      validation.notFound404 += 1;
    } else if (status === 'timeout') {
      validation.timeout += 1;
    } else {
      validation.other += 1;
    }

    if (status !== 'image') {
      validation.failures.push(compactIssue(record, `${status}: ${url} (${result.detail})`));
    }
  });

  return validation;
}

function classifyEuSafetyGateCategory(record: NormalizedRecall): string {
  const rawCategory = normalizeText(record.category);
  const productText = normalizeText(
    [record.title, record.category, ...record.productNames, ...record.brandNames].join(' ')
  );

  if (
    rawCategory.includes('toys') ||
    rawCategory.includes('childcare') ||
    textHasAny(productText, ['toy', 'toys', 'childcare article', 'baby', 'infant'])
  ) {
    return 'baby-kids';
  }

  if (
    textHasAny(rawCategory, [
      'motor vehicles',
      'machinery',
      'cosmetics',
      'chemical products',
      'jewellery',
      'jewelry',
      'protective equipment',
      'hobby sports equipment',
      'laser pointers',
      'lighters',
      'clothing',
      'construction products'
    ])
  ) {
    return 'general-consumer-product';
  }

  if (
    rawCategory.includes('electrical appliances') ||
    textHasAny(productText, [
      'battery',
      'batteries',
      'charger',
      'charging',
      'lithium',
      'power bank',
      'power supply',
      'adapter',
      'usb',
      'electronics'
    ])
  ) {
    return 'battery-electronics';
  }

  if (
    rawCategory.includes('furniture') ||
    rawCategory.includes('lighting chains') ||
    textHasAny(productText, [
      'appliance',
      'household',
      'kitchen',
      'furniture',
      'lamp',
      'lighting',
      'heater',
      'cooker',
      'iron',
      'hair dryer'
    ])
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function suspiciousCategoryMapping(record: NormalizedRecall): string {
  const rawCategory = normalizeText(record.category);
  const mapped = classifyEuSafetyGateCategory(record);
  const generalCategories = [
    'motor vehicles',
    'machinery',
    'cosmetics',
    'chemical products',
    'jewellery',
    'jewelry',
    'protective equipment',
    'hobby sports equipment',
    'laser pointers',
    'lighters',
    'clothing',
    'construction products'
  ];

  if (mapped === 'food-allergy') {
    return 'EU Safety Gate dangerous non-food product mapped to food-allergy.';
  }

  if (textHasAny(rawCategory, generalCategories) && mapped !== 'general-consumer-product') {
    return `General EU category "${record.category}" mapped to ${mapped}.`;
  }

  if ((rawCategory.includes('toys') || rawCategory.includes('childcare')) && mapped !== 'baby-kids') {
    return `Toy/childcare EU category "${record.category}" mapped to ${mapped}.`;
  }

  if (rawCategory.includes('electrical appliances') && mapped !== 'battery-electronics') {
    return `Electrical appliance EU category "${record.category}" mapped to ${mapped}.`;
  }

  if ((rawCategory.includes('furniture') || rawCategory.includes('lighting chains')) && mapped !== 'household-appliance') {
    return `Household-like EU category "${record.category}" mapped to ${mapped}.`;
  }

  return '';
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
    EU_SAFETY_GATE: records.filter((record) => record.source === 'EU_SAFETY_GATE').length,
    UK_FSA: records.filter((record) => record.source === 'UK_FSA').length
  };
}

async function audit(records: NormalizedRecall[]): Promise<AuditSummary> {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const rawCategoryDistribution: Record<string, number> = {};
  const siteCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(rawCategoryDistribution, record.category || '(missing)');
    increment(siteCategoryDistribution, classifyEuSafetyGateCategory(record));
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const recordsWithImages = records.filter((record) => (record.images?.length ?? 0) > 0).length;
  const recordsWithRawPhotos = records.filter((record) => rawPhotos(record).length > 0).length;
  const recordsWithOfficialMainPicture = records.filter((record) =>
    rawPhotos(record).some((photo) => photo.mainPicture === true)
  ).length;
  const recordsWithPrimaryImageUrl = records.filter((record) => Boolean(record.primaryImageUrl)).length;
  const recordsWithPrimaryImageThumbnailUrl = records.filter((record) =>
    Boolean(record.primaryImageThumbnailUrl)
  ).length;
  const primaryImageMismatches = records
    .map((record) => {
      const mainPicture = officialMainPicture(record);
      const mainPictureId = mainPicture ? asString(mainPicture.id) : '';
      if (!mainPictureId) {
        return null;
      }

      const expectedUrl = officialImageUrl(mainPictureId);
      return record.primaryImageUrl === expectedUrl
        ? null
        : compactIssue(record, `primaryImageUrl=${record.primaryImageUrl || '(missing)'} expected=${expectedUrl}`);
    })
    .filter((issue): issue is AuditIssue => Boolean(issue));
  const primaryThumbnailMismatches = records
    .map((record) => {
      const mainPicture = officialMainPicture(record);
      const mainPictureId = mainPicture ? asString(mainPicture.id) : '';
      if (!mainPictureId) {
        return null;
      }

      const expectedUrl = officialThumbnailImageUrl(mainPictureId);
      return record.primaryImageThumbnailUrl === expectedUrl
        ? null
        : compactIssue(
            record,
            `primaryImageThumbnailUrl=${record.primaryImageThumbnailUrl || '(missing)'} expected=${expectedUrl}`
          );
    })
    .filter((issue): issue is AuditIssue => Boolean(issue));
  const recordsWithBarcodes = records.filter((record) => rawIdentifierGroups(record).barcodes.length > 0 || hasBarcodeLikeValue(record)).length;
  const recordsWithModels = records.filter((record) => rawIdentifierGroups(record).models.length > 0).length;
  const recordsWithBatches = records.filter((record) => rawIdentifierGroups(record).batches.length > 0).length;
  const recordsWithModelOrBatchLikeText = records.filter(hasModelOrBatchLikeValue).length;
  const recordsWithAnyIdentifiers = records.filter((record) => {
    const groups = rawIdentifierGroups(record);
    return (
      groups.barcodes.length > 0 ||
      groups.models.length > 0 ||
      groups.batches.length > 0 ||
      hasBarcodeLikeValue(record) ||
      hasModelOrBatchLikeValue(record)
    );
  }).length;
  const suspiciousCategoryMappings = records
    .map((record) => {
      const detail = suspiciousCategoryMapping(record);
      return detail ? compactIssue(record, detail) : null;
    })
    .filter((issue): issue is AuditIssue => Boolean(issue));
  const warningMessages = [
    records.filter((record) => record.brandNames.length > 0).length === 0
      ? 'EU Safety Gate records may omit brand/company when the alert marks brand as unknown.'
      : '',
    recordsWithImages === 0 ? 'No EU Safety Gate official image URLs were normalized.' : '',
    recordsWithPrimaryImageThumbnailUrl === 0 ? 'No EU Safety Gate official thumbnail image URLs were normalized.' : ''
  ].filter(Boolean);

  return {
    source: 'EU_SAFETY_GATE',
    total: records.length,
    duplicateIds,
    missing: {
      source: countMissing(records, (record) => record.source !== 'EU_SAFETY_GATE'),
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
    siteIdentifierCoverage: {
      barcodeLikeValues: recordsWithBarcodes,
      modelTypeValues: recordsWithModels,
      batchSerialValues: recordsWithBatches,
      modelOrBatchLikeText: recordsWithModelOrBatchLikeText,
      anyIdentifierValues: recordsWithAnyIdentifiers,
      riskTypeValues: records.filter((record) => rawRiskTypes(record).length > 0).length,
      notifyingCountryValues: records.filter((record) => rawCountryValue(record, 'country')).length,
      countryOfOriginValues: records.filter((record) => rawCountryValue(record, 'countryOrigin')).length,
      countriesConcernedValues: records.filter((record) => rawCountriesConcerned(record).length > 0).length,
      countriesConcernedOrMarketValues: records.filter(
        (record) => rawCountriesConcerned(record).length > 0 || Boolean(record.distributionPattern)
      ).length
    },
    recordsWithImages,
    imageSelection: {
      recordsWithRawPhotos,
      recordsWithOfficialMainPicture,
      recordsWithPrimaryImageUrl,
      recordsWithPrimaryImageThumbnailUrl,
      primaryImageMatchesOfficialMain: recordsWithOfficialMainPicture - primaryImageMismatches.length,
      primaryImageMismatches,
      primaryThumbnailMatchesOfficialMain: recordsWithOfficialMainPicture - primaryThumbnailMismatches.length,
      primaryThumbnailMismatches
    },
    imageEndpointValidation: await validateImageEndpoints(records, (record) => record.primaryImageUrl),
    thumbnailEndpointValidation: await validateImageEndpoints(records, (record) => record.primaryImageThumbnailUrl),
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    suspiciousCategoryMappings,
    slugCollisions,
    warnings: warningMessages
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
    canonicalCounts.UK_FSA !== expectedCounts.UK_FSA
      ? `UK_FSA count ${canonicalCounts.UK_FSA} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    (summary.siteCategoryDistribution['food-allergy'] ?? 0) > 0
      ? `EU Safety Gate records mapped to food-allergy: ${summary.siteCategoryDistribution['food-allergy']}.`
      : '',
    summary.suspiciousCategoryMappings.length > 0
      ? `Suspicious EU category mappings found: ${summary.suspiciousCategoryMappings.length}.`
      : '',
    summary.missing.sourceUrl > severeMissingThreshold ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > severeMissingThreshold ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > severeMissingThreshold ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.missing.productNames > severeMissingThreshold ? `Missing product names found: ${summary.missing.productNames}.` : '',
    summary.missing.hazardOrReason > severeMissingThreshold
      ? `Missing risk or reason fields found: ${summary.missing.hazardOrReason}.`
      : '',
    summary.missing.remedyOrAction > severeMissingThreshold
      ? `Missing measure or action fields found: ${summary.missing.remedyOrAction}.`
      : '',
    summary.missing.rawPayload > severeMissingThreshold ? `Missing raw payloads found: ${summary.missing.rawPayload}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official EU Safety Gate URL shape mismatch count: ${summary.total - summary.recordsWithOfficialNoticeUrlShape}.`
      : '',
    summary.imageSelection.recordsWithOfficialMainPicture > 0 &&
    summary.imageSelection.primaryImageMatchesOfficialMain !== summary.imageSelection.recordsWithOfficialMainPicture
      ? `EU primary image does not match official mainPicture for ${summary.imageSelection.primaryImageMismatches.length} records.`
      : '',
    summary.imageSelection.recordsWithOfficialMainPicture > 0 &&
    summary.imageSelection.primaryThumbnailMatchesOfficialMain !== summary.imageSelection.recordsWithOfficialMainPicture
      ? `EU primary thumbnail does not match official mainPicture for ${summary.imageSelection.primaryThumbnailMismatches.length} records.`
      : '',
    summary.imageEndpointValidation.failures.length > 0
      ? `EU primary image endpoint failures found: ${summary.imageEndpointValidation.failures.length}.`
      : '',
    summary.thumbnailEndpointValidation.failures.length > 0
      ? `EU primary thumbnail endpoint failures found: ${summary.thumbnailEndpointValidation.failures.length}.`
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

  const summary = await audit(records);
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
          passed,
          source: summary.source,
          euSafetyGateCount: summary.total,
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
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
          foodAllergyCategoryMappings: summary.siteCategoryDistribution['food-allergy'] ?? 0,
          recordsWithImages: summary.recordsWithImages,
          imageSelection: {
            recordsWithRawPhotos: summary.imageSelection.recordsWithRawPhotos,
            recordsWithOfficialMainPicture: summary.imageSelection.recordsWithOfficialMainPicture,
            recordsWithPrimaryImageUrl: summary.imageSelection.recordsWithPrimaryImageUrl,
            recordsWithPrimaryImageThumbnailUrl: summary.imageSelection.recordsWithPrimaryImageThumbnailUrl,
            primaryImageMatchesOfficialMain: summary.imageSelection.primaryImageMatchesOfficialMain,
            primaryImageMismatches: summary.imageSelection.primaryImageMismatches.length,
            primaryThumbnailMatchesOfficialMain: summary.imageSelection.primaryThumbnailMatchesOfficialMain,
            primaryThumbnailMismatches: summary.imageSelection.primaryThumbnailMismatches.length
          },
          imageEndpointValidation: {
            checked: summary.imageEndpointValidation.checked,
            okImage: summary.imageEndpointValidation.okImage,
            empty2xx: summary.imageEndpointValidation.empty2xx,
            nonImage2xx: summary.imageEndpointValidation.nonImage2xx,
            failures: summary.imageEndpointValidation.failures.length
          },
          thumbnailEndpointValidation: {
            checked: summary.thumbnailEndpointValidation.checked,
            okImage: summary.thumbnailEndpointValidation.okImage,
            empty2xx: summary.thumbnailEndpointValidation.empty2xx,
            nonImage2xx: summary.thumbnailEndpointValidation.nonImage2xx,
            failures: summary.thumbnailEndpointValidation.failures.length
          },
          recordsWithOfficialNoticeUrlShape: summary.recordsWithOfficialNoticeUrlShape,
          identifierCoverage: summary.siteIdentifierCoverage,
          sourceFilterValues: sourceFilters,
          warnings: summary.warnings
        },
        detail: {
          ...summary,
          rawCategoryDistribution: Object.fromEntries(
            Object.entries(summary.rawCategoryDistribution).sort((a, b) => b[1] - a[1])
          ),
          siteCategoryDistribution: Object.fromEntries(
            Object.entries(summary.siteCategoryDistribution).sort((a, b) => b[1] - a[1])
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
