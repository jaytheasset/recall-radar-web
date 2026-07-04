import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import {
  australiaProductSafetyProcessedPath,
  canonicalProcessedPath,
  mergeProcessedRecalls
} from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type AustraliaProductSafetyImage = {
  url?: unknown;
  thumbnailUrl?: unknown;
  alt?: unknown;
  caption?: unknown;
};

export type AustraliaProductSafetyRaw = {
  id?: unknown;
  path?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  supplierName?: unknown;
  publishedDate?: unknown;
  categories?: unknown;
  listImage?: AustraliaProductSafetyImage;
  detail?: {
    title?: unknown;
    supplierName?: unknown;
    publishedDate?: unknown;
    categories?: unknown;
    productDescription?: unknown;
    brand?: unknown;
    defects?: unknown;
    hazards?: unknown;
    consumerAction?: unknown;
    supplierRunningRecall?: unknown;
    traders?: unknown;
    saleDates?: unknown;
    soldWhere?: unknown;
    manufacturerCountry?: unknown;
    recallNumber?: unknown;
    images?: unknown;
  };
};

type RawAustraliaProductSafetyFile = {
  fetchedAt?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawAustraliaProductSafetyPath = resolve(
  projectRoot,
  'data/raw/australia-product-safety-recalls.json'
);
export const defaultAustraliaProductSafetyProcessedPath = australiaProductSafetyProcessedPath;

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
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

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? uniqueNonEmpty(value.map(asString)) : uniqueNonEmpty([asString(value)]);
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const date = new Date(text.includes('T') ? text : `${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function truncateText(value: string, maxLength = 260): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 80 ? wordBoundary : maxLength).trim()}...`;
}

function cleanAustraliaField(value: unknown): string {
  return asString(value)
    .replace(
      /^(?:Product description|Brand|Reason the product is recalled|The hazards to consumers|What consumers should do|Dates available for sale|Manufacturer country ID)\s+/i,
      ''
    )
    .replace(/\s+See a list of details to help identify the product\b.*$/i, '')
    .replace(/\s+Details to help identify the product\b.*$/i, '')
    .replace(/\s*Any products marked with \* along the mentioned batch numbers are safe to use\.?/gi, '')
    .trim();
}

function isOfficialAustraliaProductSafetyImageUrl(value: string): boolean {
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

function normalizeAustraliaImageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.hostname === 'www.productsafety.gov.au' &&
      /^\/system\/files\/(?:styles\/[^/]+\/)?(?:public|private)\//i.test(url.pathname)
    ) {
      // Some official gallery hrefs expose filenames such as 12%22 LCD...
      // The Drupal image style endpoint serves those derivatives as 12%2522...
      url.pathname = url.pathname.replace(/%22/gi, '%2522');
    }

    return url.toString();
  } catch {
    return value;
  }
}

function isMeaningfulCaption(value: string): boolean {
  return Boolean(value) && !/^[^\\/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)(?:\?.*)?$/i.test(value);
}

function normalizeImages(raw: AustraliaProductSafetyRaw, fallbackAlt: string): RecallImage[] {
  const detailImages = Array.isArray(raw.detail?.images) ? raw.detail.images : [];
  const rawImages = [...detailImages, raw.listImage].filter(Boolean) as AustraliaProductSafetyImage[];
  const seen = new Set<string>();

  return rawImages.flatMap((image) => {
    const url = normalizeAustraliaImageUrl(asString(image.url));
    const thumbnailUrl = normalizeAustraliaImageUrl(asString(image.thumbnailUrl));
    const alt = firstNonEmpty([image.alt, image.caption], fallbackAlt);
    const caption = asString(image.caption);

    if (!url || !isOfficialAustraliaProductSafetyImageUrl(url) || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [
      {
        url,
        ...(thumbnailUrl && isOfficialAustraliaProductSafetyImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
        ...(isMeaningfulCaption(caption) ? { caption } : {}),
        ...(alt ? { alt } : {})
      }
    ];
  });
}

function extractIdentifierText(raw: AustraliaProductSafetyRaw): string[] {
  const text = [
    raw.title,
    raw.supplierName,
    raw.detail?.productDescription,
    raw.detail?.brand,
    raw.detail?.defects,
    raw.detail?.hazards,
    raw.detail?.consumerAction,
    raw.detail?.traders,
    raw.detail?.saleDates,
    raw.detail?.soldWhere,
    raw.detail?.recallNumber
  ]
    .map(asString)
    .join(' ');
  const patterns = [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:batch|lot|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b[A-Z]{1,6}-\d{2,8}\b/g
  ];

  return uniqueNonEmpty(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])));
}

function sourceIdFor(raw: AustraliaProductSafetyRaw): string {
  const explicitId = firstNonEmpty([raw.id, raw.detail?.recallNumber]);
  const pathSlug = asString(raw.path).split('/').filter(Boolean).at(-1) ?? '';
  return slugify(explicitId || pathSlug || firstNonEmpty([raw.title], 'australia-product-safety-recall'));
}

function descriptionFor(raw: AustraliaProductSafetyRaw, identifiers: string[]): string {
  return uniqueNonEmpty([
    `Product: ${cleanAustraliaField(raw.detail?.productDescription)}`,
    `Brand/company: ${cleanAustraliaField(raw.detail?.brand)}`,
    `Supplier: ${firstNonEmpty([raw.detail?.supplierName, raw.supplierName])}`,
    `Reason: ${cleanAustraliaField(raw.detail?.defects)}`,
    `Hazards: ${cleanAustraliaField(raw.detail?.hazards)}`,
    `Sold by: ${cleanAustraliaField(raw.detail?.traders)}`,
    `Sale dates: ${cleanAustraliaField(raw.detail?.saleDates)}`,
    `Sold in: ${cleanAustraliaField(raw.detail?.soldWhere)}`,
    `Country of manufacture: ${cleanAustraliaField(raw.detail?.manufacturerCountry)}`,
    identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : '',
    cleanAustraliaField(raw.detail?.consumerAction)
  ]).join(' ');
}

export function extractAustraliaProductSafetyRecords(payload: unknown): AustraliaProductSafetyRaw[] {
  if (Array.isArray(payload)) {
    return payload as AustraliaProductSafetyRaw[];
  }

  if (payload && typeof payload === 'object') {
    const file = payload as RawAustraliaProductSafetyFile;
    if (Array.isArray(file.records)) {
      return file.records as AustraliaProductSafetyRaw[];
    }
  }

  return [];
}

export function compareAustraliaProductSafetyDateDescending(
  a: AustraliaProductSafetyRaw,
  b: AustraliaProductSafetyRaw
): number {
  const dateDifference = normalizeDate(b.detail?.publishedDate ?? b.publishedDate).localeCompare(
    normalizeDate(a.detail?.publishedDate ?? a.publishedDate)
  );
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return sourceIdFor(a).localeCompare(sourceIdFor(b));
}

export function normalizeAustraliaProductSafetyRecords(records: AustraliaProductSafetyRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareAustraliaProductSafetyDateDescending)
    .map((raw) => {
      const sourceRecordId = sourceIdFor(raw);
      const id = `au-product-safety-${sourceRecordId}`;
      const title = truncateText(firstNonEmpty([raw.detail?.title, raw.title], 'Australia product safety recall'), 170);
      const category = firstNonEmpty([arrayOfStrings(raw.detail?.categories)[0], arrayOfStrings(raw.categories)[0]], 'Product safety recall');
      const supplier = firstNonEmpty([raw.detail?.supplierName, raw.supplierName]);
      const brand = firstNonEmpty([cleanAustraliaField(raw.detail?.brand)]);
      const productDescription = firstNonEmpty([cleanAustraliaField(raw.detail?.productDescription), raw.title], title);
      const identifiers = extractIdentifierText(raw);
      const images = normalizeImages(raw, `${title} recall product image`);
      const primaryImage = images[0];
      const defects = firstNonEmpty([cleanAustraliaField(raw.detail?.defects)], 'Reason not listed in the indexed notice.');
      const hazards = firstNonEmpty(
        [cleanAustraliaField(raw.detail?.hazards), cleanAustraliaField(raw.detail?.defects)],
        'Hazard not listed in the indexed notice.'
      );
      const remedy = firstNonEmpty(
        [cleanAustraliaField(raw.detail?.consumerAction)],
        'Review the official Product Safety Australia notice for current instructions.'
      );
      const recallDate = normalizeDate(raw.detail?.publishedDate ?? raw.publishedDate);

      return {
        id,
        source: 'AU_PRODUCT_SAFETY',
        sourceUrl: asString(raw.sourceUrl),
        title,
        brandNames: uniqueNonEmpty([brand, supplier]),
        productNames: uniqueNonEmpty([productDescription, title, ...identifiers]),
        category,
        hazard: hazards,
        remedy,
        recallDate,
        affectedUnits: '',
        description: descriptionFor(raw, identifiers),
        slug: slugify(`${title}-${id}`),
        classification: 'Product Safety Australia recall',
        reason: defects,
        distributionPattern: uniqueNonEmpty([
          cleanAustraliaField(raw.detail?.traders),
          cleanAustraliaField(raw.detail?.soldWhere),
          cleanAustraliaField(raw.detail?.saleDates)
        ]).join(' '),
        productQuantity: '',
        recallNumber: sourceRecordId,
        status: '',
        ...(images.length
          ? {
              images,
              primaryImageUrl: primaryImage.url,
              primaryImageThumbnailUrl: primaryImage.thumbnailUrl,
              primaryImageAlt: primaryImage.alt ?? primaryImage.caption
            }
          : {}),
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.id && record.title && record.sourceUrl && record.recallDate);
}

export async function writeNormalizedAustraliaProductSafetyRecalls(
  records: AustraliaProductSafetyRaw[],
  processedPath = defaultAustraliaProductSafetyProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeAustraliaProductSafetyRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('Australia Product Safety normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'AU_PRODUCT_SAFETY',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawAustraliaProductSafetyPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractAustraliaProductSafetyRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No Australia Product Safety raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedAustraliaProductSafetyRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultAustraliaProductSafetyProcessedPath,
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
              primaryImageUrl: sample.primaryImageUrl,
              primaryImageThumbnailUrl: sample.primaryImageThumbnailUrl,
              primaryImageAlt: sample.primaryImageAlt,
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
