import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, mergeProcessedRecalls, ukFsaProcessedPath } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

type RawObject = Record<string, unknown>;

export type UkFsaAlertRaw = {
  '@id'?: unknown;
  notation?: unknown;
  title?: unknown;
  shortTitle?: unknown;
  description?: unknown;
  created?: unknown;
  modified?: unknown;
  type?: unknown;
  reportingBusiness?: unknown;
  otherBusiness?: unknown;
  alertURL?: unknown;
  shortURL?: unknown;
  actionTaken?: unknown;
  consumerAdvice?: unknown;
  relatedMedia?: unknown;
  problem?: unknown;
  productDetails?: unknown;
  status?: unknown;
};

type RawUkFsaFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  items?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawUkFsaAlertsPath = resolve(projectRoot, 'data/raw/uk-fsa-alerts.json');
export const defaultUkFsaProcessedPath = ukFsaProcessedPath;
const defaultUkFsaAlertsEndpoint = 'https://data.food.gov.uk/food-alerts/id.json';

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/\u00a0/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function asObjects(value: unknown): RawObject[] {
  if (Array.isArray(value)) {
    return value.filter(isObject);
  }

  return isObject(value) ? [value] : [];
}

function rawObjects(raw: UkFsaAlertRaw, key: keyof UkFsaAlertRaw): RawObject[] {
  return asObjects(raw[key]);
}

function objectText(value: unknown, key: string): string {
  return isObject(value) ? asString(value[key]) : '';
}

function valueId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return isObject(value) ? asString(value['@id']) : '';
}

function labelValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.flatMap(labelValues));
  }

  if (isObject(value)) {
    return uniqueNonEmpty([
      asString(value.label),
      asString(value.prefLabel),
      asString(value.notation),
      asString(value.riskStatement)
    ]);
  }

  return uniqueNonEmpty([asString(value)]);
}

function typeCodes(raw: UkFsaAlertRaw): string[] {
  return uniqueNonEmpty(
    (Array.isArray(raw.type) ? raw.type : [raw.type])
      .map((item) => valueId(item) || asString(item))
      .map((value) => value.match(/\/def\/([A-Z]+)/i)?.[1]?.toUpperCase() ?? '')
  ).filter((code) => code !== 'ALERT');
}

function classificationFor(raw: UkFsaAlertRaw): string {
  const labels: Record<string, string> = {
    AA: 'Allergy Alert',
    PRIN: 'Product Recall Information Notice',
    FAFA: 'Food Alert For Action'
  };

  return uniqueNonEmpty(typeCodes(raw).map((code) => labels[code] ?? code)).join('; ');
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const date = new Date(text.includes('T') ? text : `${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function truncateText(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
}

function alertNotation(raw: UkFsaAlertRaw): string {
  const notation = asString(raw.notation);
  if (notation) {
    return notation;
  }

  return valueId(raw['@id']).split('/').pop() ?? '';
}

function makeSourceUrl(raw: UkFsaAlertRaw): string {
  const alertUrl = valueId(raw.alertURL);
  if (alertUrl) {
    return alertUrl;
  }

  const notation = alertNotation(raw);
  return notation ? `https://alerts.food.gov.uk/news-alerts/alert/${notation.toLowerCase()}` : defaultUkFsaAlertsEndpoint;
}

function batchDetails(product: RawObject): string[] {
  return uniqueNonEmpty(
    asObjects(product.batchDescription).flatMap((batch) => [
      asString(batch.batchCode),
      asString(batch.lotCode),
      asString(batch.batchDescription),
      asString(batch.bestBeforeDescription),
      asString(batch.useByDescription)
    ])
  );
}

function productDetailSummaries(raw: UkFsaAlertRaw): string[] {
  return rawObjects(raw, 'productDetails').map((product) =>
    uniqueNonEmpty([
      asString(product.productName),
      asString(product.packSizeDescription),
      ...batchDetails(product)
    ]).join(' / ')
  );
}

function allergenOrRiskLabels(problem: RawObject): string[] {
  return uniqueNonEmpty([
    ...labelValues(problem.allergen),
    ...labelValues(problem.pathogenRisk),
    ...labelValues(problem.hazardCategory),
    ...labelValues(problem.reason)
  ]);
}

function problemLabels(raw: UkFsaAlertRaw): string[] {
  return uniqueNonEmpty(rawObjects(raw, 'problem').flatMap(allergenOrRiskLabels));
}

function riskStatements(raw: UkFsaAlertRaw): string[] {
  return uniqueNonEmpty(rawObjects(raw, 'problem').map((problem) => asString(problem.riskStatement)));
}

function relatedMediaTitles(raw: UkFsaAlertRaw): string[] {
  return uniqueNonEmpty(rawObjects(raw, 'relatedMedia').map((media) => objectText(media, 'title')));
}

function reportingBusinesses(raw: UkFsaAlertRaw): string[] {
  return uniqueNonEmpty([
    objectText(raw.reportingBusiness, 'commonName'),
    objectText(raw.otherBusiness, 'commonName')
  ]);
}

function extractIdentifiers(raw: UkFsaAlertRaw): string[] {
  const text = [
    ...productDetailSummaries(raw),
    asString(raw.title),
    asString(raw.description),
    asString(raw.actionTaken),
    asString(raw.consumerAdvice)
  ].join(' ');
  const patterns = [
    /\b(?:lot|batch)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:best before|best-before|best by|best-by|use by|use-by|expiry|expiration)\s*[:#-]?\s*[A-Z0-9][A-Z0-9 ,./_-]{2,30}\b/gi,
    /\b(?:pack size|pack)\s*[:#-]?\s*[0-9][A-Z0-9 ._-]{1,20}\b/gi,
    /\b\d{8,14}\b/g
  ];

  return uniqueNonEmpty(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])));
}

export function extractUkFsaAlertRecords(payload: unknown): UkFsaAlertRaw[] {
  if (Array.isArray(payload)) {
    return payload as UkFsaAlertRaw[];
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawUkFsaFile;
    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records as UkFsaAlertRaw[];
    }

    if (Array.isArray(maybeFile.items)) {
      return maybeFile.items as UkFsaAlertRaw[];
    }
  }

  return [];
}

export function compareUkFsaAlertDateDescending(a: UkFsaAlertRaw, b: UkFsaAlertRaw): number {
  const dateDifference = normalizeDate(b.created).localeCompare(normalizeDate(a.created));
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return alertNotation(b).localeCompare(alertNotation(a));
}

export function normalizeUkFsaAlertRecords(records: UkFsaAlertRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareUkFsaAlertDateDescending)
    .map((raw) => {
      const notation = alertNotation(raw);
      const id = `uk-fsa-${slugify(notation || firstNonEmpty([raw.title], 'food-alert'))}`;
      const title = truncateText(firstNonEmpty([raw.title, raw.shortTitle], 'UK FSA food alert'), 170);
      const productNames = uniqueNonEmpty([
        ...rawObjects(raw, 'productDetails').map((product) => asString(product.productName)),
        ...productDetailSummaries(raw),
        ...extractIdentifiers(raw)
      ]);
      const brands = reportingBusinesses(raw);
      const riskLabels = problemLabels(raw);
      const riskText = firstNonEmpty(
        [riskStatements(raw).join(' '), riskLabels.join(', '), raw.description],
        'Reason not listed.'
      );
      const action = uniqueNonEmpty([asString(raw.consumerAdvice), asString(raw.actionTaken)]).join(' ');
      const classification = classificationFor(raw);
      const status = firstNonEmpty([objectText(raw.status, 'label'), objectText(raw.status, 'notation')]);
      const productDetails = productDetailSummaries(raw);
      const description = uniqueNonEmpty([
        asString(raw.description),
        productDetails.length ? `Product details: ${productDetails.join('; ')}` : '',
        riskLabels.length ? `Risk labels: ${riskLabels.join(', ')}` : '',
        relatedMediaTitles(raw).length ? `Related notices: ${relatedMediaTitles(raw).join('; ')}` : ''
      ]).join(' ');

      return {
        id,
        source: 'UK_FSA',
        sourceUrl: makeSourceUrl(raw),
        title,
        brandNames: brands,
        productNames: productNames.length ? productNames : uniqueNonEmpty([title]),
        category: classification || 'UK FSA food alert',
        hazard: riskText,
        remedy: action || 'Review the official FSA notice for current consumer action.',
        recallDate: normalizeDate(firstNonEmpty([raw.created, raw.modified])),
        affectedUnits: productDetails.join('; '),
        description: description || title,
        slug: slugify(`${title}-${id}`),
        classification,
        reason: riskText,
        distributionPattern: 'United Kingdom',
        productQuantity: uniqueNonEmpty(rawObjects(raw, 'productDetails').map((product) => asString(product.packSizeDescription))).join('; '),
        recallNumber: notation,
        status,
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.id && record.title && record.sourceUrl && record.recallDate);
}

export async function writeNormalizedUkFsaAlerts(
  records: UkFsaAlertRaw[],
  processedPath = defaultUkFsaProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeUkFsaAlertRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('UK FSA Food Alerts normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'UK_FSA',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawUkFsaAlertsPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractUkFsaAlertRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No UK FSA raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedUkFsaAlerts(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultUkFsaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        mergedRecordsSaved: mergedOutput.count,
        countsBySource: mergedOutput.countsBySource,
        sample: sample
          ? {
              id: sample.id,
              source: sample.source,
              sourceUrl: sample.sourceUrl,
              title: sample.title,
              brandNames: sample.brandNames,
              productNames: sample.productNames.slice(0, 5),
              category: sample.category,
              hazard: sample.hazard,
              remedy: sample.remedy,
              recallDate: sample.recallDate,
              affectedUnits: sample.affectedUnits,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              recallNumber: sample.recallNumber,
              status: sample.status
            }
          : null
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  runNormalize().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
