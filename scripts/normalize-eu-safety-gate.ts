import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, euSafetyGateProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type EuSafetyGateRaw = Record<string, unknown>;

type RawEuSafetyGateFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  records?: unknown;
  content?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawEuSafetyGatePath = resolve(projectRoot, 'data/raw/eu-safety-gate-recalls.json');
export const defaultEuSafetyGateProcessedPath = euSafetyGateProcessedPath;

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
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
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

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function labelize(value: unknown): string {
  const text = asString(value);
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

function versionText(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const versions = asArray(container.versions);
  return (
    versions.find((version) => {
      const language = asObject(version.language);
      return asString(language.key).toUpperCase() === key.toUpperCase();
    }) ??
    versions[0] ??
    {}
  );
}

function valuesFromObjects(items: Record<string, unknown>[], keys: string[]): string[] {
  return uniqueNonEmpty(
    items.flatMap((item) => keys.map((key) => asString(item[key]))).filter(Boolean)
  );
}

function namesFromCountryObjects(items: Record<string, unknown>[]): string[] {
  return uniqueNonEmpty(
    items.map((item) => {
      const country = asObject(item.country);
      return firstNonEmpty([item.name, item.key, country.name, country.key]);
    })
  );
}

function officialDetailUrl(id: string): string {
  return `https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/${encodeURIComponent(id)}`;
}

function officialImageUrl(id: string): string {
  return `https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/${encodeURIComponent(id)}`;
}

function officialThumbnailImageUrl(id: string): string {
  return `https://ec.europa.eu/safety-gate-alerts/public/api/notification/thumbnail/${encodeURIComponent(id)}`;
}

function officialImages(raw: EuSafetyGateRaw, title: string): RecallImage[] {
  const product = asObject(raw.product);
  const photos = asArray(product.photos);
  const images: RecallImage[] = [];
  const orderedPhotos = photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const aMain = a.photo.mainPicture === true ? 0 : 1;
      const bMain = b.photo.mainPicture === true ? 0 : 1;
      return aMain - bMain || a.index - b.index;
    })
    .map((item) => item.photo);

  for (const photo of orderedPhotos) {
    const id = asString(photo.id);
    if (!id) {
      continue;
    }

    const caption = firstNonEmpty([photo.fileName], 'Safety Gate product image');
    images.push({
      url: officialImageUrl(id),
      thumbnailUrl: officialThumbnailImageUrl(id),
      caption,
      alt: `${title} product image`
    });
  }

  return images;
}

function measureSummary(measureTaken: Record<string, unknown>): string {
  const measures = asArray(measureTaken.measures).map((measure) => {
    const category = asObject(measure.measureCategory);
    const type = asObject(measure.measureType);
    const version = versionText(measure, 'EN');
    const label = firstNonEmpty([version.measureCategoryOther, category.name, category.key]);
    const typeLabel = firstNonEmpty([type.name, type.key]);

    return uniqueNonEmpty([typeLabel ? labelize(typeLabel) : '', label ? labelize(label) : '']).join(': ');
  });

  return uniqueNonEmpty(measures).join('; ');
}

type ProductIdentifierGroups = {
  barcodes: string[];
  models: string[];
  batches: string[];
};

function productIdentifierGroups(product: Record<string, unknown>): ProductIdentifierGroups {
  const barcodes = valuesFromObjects(asArray(product.barcodes), ['barcode', 'value']);
  const batches = uniqueNonEmpty(
    asArray(product.batchNumbers).flatMap((item) => Object.values(item).map(asString))
  );
  const models = valuesFromObjects(asArray(product.modelTypes), ['modelType', 'value']);

  return { barcodes, models, batches };
}

function productIdentifiers(product: Record<string, unknown>): string[] {
  const groups = productIdentifierGroups(product);
  return uniqueNonEmpty([...groups.barcodes, ...groups.models, ...groups.batches]);
}

function identifierSummary(groups: ProductIdentifierGroups): string[] {
  return uniqueNonEmpty([
    groups.barcodes.length ? `Barcodes: ${groups.barcodes.join(', ')}` : '',
    groups.models.length ? `Model/type: ${groups.models.join(', ')}` : '',
    groups.batches.length ? `Batch/serial: ${groups.batches.join(', ')}` : ''
  ]);
}

function sourceReference(raw: EuSafetyGateRaw): string {
  return firstNonEmpty([raw.reference, raw.id], 'unknown');
}

function descriptionFor(input: {
  productVersion: Record<string, unknown>;
  riskVersion: Record<string, unknown>;
  measureTaken: Record<string, unknown>;
  traceability: Record<string, unknown>;
  identifiers: string[];
  identifierSummaries: string[];
  riskTypes: string[];
  notifyingCountry: string;
  countriesConcerned: string[];
}): string {
  const origin = asObject(input.traceability.countryOrigin);
  const soldOnline = asObject(input.traceability.isSoldOnline);
  const countryOfOrigin = firstNonEmpty([origin.name, origin.key]);
  const soldOnlineValue = firstNonEmpty([soldOnline.name, soldOnline.key]);

  return uniqueNonEmpty([
    asString(input.productVersion.description),
    asString(input.productVersion.packageDescription),
    input.identifiers.length ? `Identifiers: ${input.identifiers.join(', ')}` : '',
    ...input.identifierSummaries,
    input.riskTypes.length ? `Risk type: ${input.riskTypes.join(', ')}` : '',
    asString(input.riskVersion.riskDescription),
    asString(input.riskVersion.legalProvision),
    measureSummary(input.measureTaken),
    input.notifyingCountry ? `Notifying country: ${input.notifyingCountry}` : '',
    countryOfOrigin ? `Country of origin: ${countryOfOrigin}` : '',
    input.countriesConcerned.length ? `Countries concerned: ${input.countriesConcerned.join(', ')}` : '',
    soldOnlineValue ? `Sold online: ${labelize(soldOnlineValue)}` : ''
  ]).join(' ');
}

function truncateText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 70 ? wordBoundary : maxLength).trim()}...`;
}

export function extractEuSafetyGateRecords(payload: unknown): EuSafetyGateRaw[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawEuSafetyGateFile;
    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records.filter(isObject);
    }

    if (Array.isArray(maybeFile.content)) {
      return maybeFile.content.filter(isObject);
    }
  }

  return [];
}

export function compareEuSafetyGateDateDescending(a: EuSafetyGateRaw, b: EuSafetyGateRaw): number {
  const dateDifference = normalizeDate(b.publicationDate).localeCompare(normalizeDate(a.publicationDate));
  return dateDifference === 0 ? sourceReference(b).localeCompare(sourceReference(a)) : dateDifference;
}

export function normalizeEuSafetyGateRecords(records: EuSafetyGateRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareEuSafetyGateDateDescending)
    .map((raw) => {
      const product = asObject(raw.product);
      const risk = asObject(raw.risk);
      const measureTaken = asObject(raw.measureTaken);
      const traceability = asObject(raw.traceability);
      const notificationType = asObject(raw.notificationType);
      const country = asObject(raw.country);
      const productCategory = asObject(product.productCategory);
      const productVersion = versionText(product, 'EN');
      const riskVersion = versionText(risk, 'EN');
      const identifierGroups = productIdentifierGroups(product);
      const identifiers = productIdentifiers(product);
      const identifierSummaries = identifierSummary(identifierGroups);
      const brands = valuesFromObjects(asArray(product.brands), ['brand', 'name']);
      const productName = firstNonEmpty(
        [
          productVersion.name,
          product.name,
          product.nameSpecific,
          productVersion.description,
          productCategory.name
        ],
        'Safety Gate product'
      );
      const category = firstNonEmpty([productCategory.name, productCategory.key, productVersion.productCategoryOther], 'Safety Gate alert');
      const riskTypes = valuesFromObjects(asArray(risk.riskType), ['name', 'key']).map(labelize);
      const notifyingCountry = firstNonEmpty([country.name, country.key]);
      const countryOfOrigin = firstNonEmpty([
        asObject(traceability.countryOrigin).name,
        asObject(traceability.countryOrigin).key
      ]);
      const countriesConcerned = namesFromCountryObjects(asArray(raw.reactingCountries)).map(labelize);
      const hazard = firstNonEmpty(
        [riskVersion.riskDescription, riskTypes.join(', '), riskVersion.riskTypeOther],
        'Risk not listed.'
      );
      const remedy = firstNonEmpty([measureSummary(measureTaken)], 'Review the official Safety Gate alert for current measures.');
      const sourceId = asString(raw.id);
      const reference = sourceReference(raw);
      const id = `eu-safety-gate-${sourceId || slugify(reference)}`;
      const title = truncateText(uniqueNonEmpty([brands[0] ?? '', productName, 'Safety Gate alert']).join(' - '), 150);
      const images = officialImages(raw, title);
      const description = descriptionFor({
        productVersion,
        riskVersion,
        measureTaken,
        traceability,
        identifiers,
        identifierSummaries,
        riskTypes,
        notifyingCountry,
        countriesConcerned
      });

      return {
        id,
        source: 'EU_SAFETY_GATE',
        sourceUrl: officialDetailUrl(sourceId || reference),
        title,
        brandNames: brands,
        productNames: uniqueNonEmpty([productName, asString(product.nameSpecific), ...identifiers]),
        category: labelize(category) || 'Safety Gate alert',
        hazard,
        remedy,
        recallDate: normalizeDate(raw.publicationDate),
        affectedUnits: '',
        description,
        slug: slugify(`${title}-${id}`),
        classification: uniqueNonEmpty([asString(notificationType.code), labelize(notificationType.name)]).join(' / '),
        reason: hazard,
        distributionPattern: uniqueNonEmpty([
          notifyingCountry,
          countryOfOrigin,
          countriesConcerned.length ? `Countries concerned: ${countriesConcerned.join(', ')}` : ''
        ]).join(' / '),
        productQuantity: '',
        recallNumber: reference,
        status: raw.hasBeenUpdated === true ? 'Updated' : '',
        ...(images.length
          ? {
              images,
              primaryImageUrl: images[0].url,
              primaryImageThumbnailUrl: images[0].thumbnailUrl,
              primaryImageAlt: images[0].alt
            }
          : {}),
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.id && record.title && record.sourceUrl && record.recallDate);
}

export async function writeNormalizedEuSafetyGateRecalls(
  records: EuSafetyGateRaw[],
  processedPath = defaultEuSafetyGateProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeEuSafetyGateRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('EU Safety Gate normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'EU_SAFETY_GATE',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawEuSafetyGatePath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractEuSafetyGateRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No EU Safety Gate raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedEuSafetyGateRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultEuSafetyGateProcessedPath,
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
              productNames: sample.productNames,
              category: sample.category,
              hazard: sample.hazard,
              remedy: sample.remedy,
              recallDate: sample.recallDate,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              recallNumber: sample.recallNumber,
              distributionPattern: sample.distributionPattern,
              images: sample.images?.length ?? 0
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
