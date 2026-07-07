import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import {
  canonicalProcessedPath,
  mergeProcessedRecalls,
  newZealandProductSafetyProcessedPath
} from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type NewZealandProductSafetyImage = {
  url?: unknown;
  thumbnailUrl?: unknown;
  alt?: unknown;
  caption?: unknown;
};

export type NewZealandProductSafetyRaw = {
  id?: unknown;
  path?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  publishedDate?: unknown;
  categories?: unknown;
  listImage?: NewZealandProductSafetyImage;
  detail?: {
    title?: unknown;
    publishedDate?: unknown;
    metaDescription?: unknown;
    canonicalUrl?: unknown;
    productIdentifiers?: unknown;
    supplierName?: unknown;
    supplierContact?: unknown;
    responsibleAgency?: unknown;
    hazard?: unknown;
    action?: unknown;
    images?: unknown;
  };
};

type RawNewZealandProductSafetyFile = {
  fetchedAt?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawNewZealandProductSafetyPath = resolve(
  projectRoot,
  'data/raw/new-zealand-product-safety-recalls.json'
);
export const defaultNewZealandProductSafetyProcessedPath = newZealandProductSafetyProcessedPath;

export function normalizeNewZealandText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCharCode(Number.parseInt(decimal, 10)))
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/([.!?])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = normalizeNewZealandText(value);
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
  return Array.isArray(value) ? uniqueNonEmpty(value.map(normalizeNewZealandText)) : uniqueNonEmpty([normalizeNewZealandText(value)]);
}

function stripLeadingLabel(value: unknown, labelPattern: RegExp): string {
  return normalizeNewZealandText(value).replace(labelPattern, '').trim();
}

function normalizeResponsibleAgency(value: unknown): string {
  const text = stripLeadingLabel(value, /^Responsible\s+Agency\s*/i);
  if (!text) {
    return '';
  }

  return /mbie\.govt\.nz/i.test(text) || /^mbie$/i.test(text) ? 'MBIE' : text;
}

function normalizeSupplierContact(value: unknown): string {
  return stripLeadingLabel(value, /^Supplier\s+Contact\s*/i);
}

function normalizeDate(value: unknown): string {
  const text = normalizeNewZealandText(value);
  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text.includes('T') ? text : `${text} UTC`);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeSearchText(value: string): string {
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

function truncateText(value: string, maxLength = 260): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 80 ? wordBoundary : maxLength).trim()}...`;
}

export function isExcludedNewZealandSpecialistRecord(raw: NewZealandProductSafetyRaw): boolean {
  const text = normalizeSearchText(
    [
      raw.title,
      raw.detail?.title,
      raw.detail?.responsibleAgency,
      ...arrayOfStrings(raw.categories)
    ].join(' ')
  );

  return textHasAny(text, [
    'vehicle',
    'vehicles',
    'road vehicle',
    'airbag',
    'airbags',
    'nzta',
    'waka kotahi',
    'medical',
    'medsafe',
    'pharmaceutical'
  ]);
}

export function classifyNewZealandProductSafetyCategory(raw: NewZealandProductSafetyRaw): string {
  const text = normalizeSearchText(
    [
      raw.title,
      raw.detail?.title,
      raw.detail?.productIdentifiers,
      raw.detail?.hazard,
      raw.detail?.action,
      ...arrayOfStrings(raw.categories)
    ].join(' ')
  );

  if (textHasAny(text, ['baby', 'child', 'children', 'toy', 'toys', 'nursery', 'cot', 'stroller', 'pram', 'teether'])) {
    return 'baby-kids';
  }

  if (
    textHasAny(text, [
      'battery',
      'batteries',
      'button battery',
      'charger',
      'charging',
      'power bank',
      'lithium',
      'electrical',
      'electronics',
      'smoke alarm',
      'phone'
    ])
  ) {
    return 'battery-electronics';
  }

  if (textHasAny(text, ['food', 'allergen', 'allergy', 'undeclared', 'milk', 'egg', 'wheat', 'peanut', 'sesame'])) {
    return 'food-allergy';
  }

  if (
    textHasAny(text, [
      'appliance',
      'furniture',
      'household',
      'kitchen',
      'home',
      'night light',
      'heater',
      'washing machine',
      'lamp',
      'towel'
    ])
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

export function isOfficialNewZealandProductSafetyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.productsafety.govt.nz' && /^\/recalls\/[^/][^?#]*$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function isOfficialNewZealandProductSafetyImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.productsafety.govt.nz' &&
      /^\/assets\/uploads\//i.test(url.pathname) &&
      !/\b(?:logo|icon|sprite|favicon|header|footer|banner|placeholder|default|govt)\b/i.test(path)
    );
  } catch {
    return false;
  }
}

function isMeaningfulCaption(value: string): boolean {
  return Boolean(value) && !/^[^\\/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)(?:\?.*)?$/i.test(value) && !/^\d+$/i.test(value);
}

function normalizeImages(raw: NewZealandProductSafetyRaw, fallbackAlt: string): RecallImage[] {
  const detailImages = Array.isArray(raw.detail?.images) ? raw.detail.images : [];
  const rawImages = [...detailImages, raw.listImage].filter(Boolean) as NewZealandProductSafetyImage[];
  const seen = new Set<string>();
  const fallbackThumbnailUrl = normalizeNewZealandText(raw.listImage?.thumbnailUrl);

  return rawImages.flatMap((image) => {
    const url = normalizeNewZealandText(image.url);
    const thumbnailUrl = normalizeNewZealandText(image.thumbnailUrl);
    const alt = firstNonEmpty([image.alt, image.caption], fallbackAlt);
    const caption = normalizeNewZealandText(image.caption);

    if (!url || !isOfficialNewZealandProductSafetyImageUrl(url) || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [
      {
        url,
        ...((thumbnailUrl && isOfficialNewZealandProductSafetyImageUrl(thumbnailUrl)) ||
        (fallbackThumbnailUrl && isOfficialNewZealandProductSafetyImageUrl(fallbackThumbnailUrl))
          ? { thumbnailUrl: thumbnailUrl || fallbackThumbnailUrl }
          : {}),
        ...(isMeaningfulCaption(caption) ? { caption } : {}),
        ...(alt ? { alt } : {})
      }
    ];
  });
}

function normalizeRawImageForProcessed(image: NewZealandProductSafetyImage): NewZealandProductSafetyImage | null {
  const url = normalizeNewZealandText(image.url);
  const thumbnailUrl = normalizeNewZealandText(image.thumbnailUrl);

  if (!url || !isOfficialNewZealandProductSafetyImageUrl(url)) {
    return null;
  }

  return {
    url,
    ...(thumbnailUrl && isOfficialNewZealandProductSafetyImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
    ...(() => {
      const alt = normalizeNewZealandText(image.alt);
      return alt ? { alt } : {};
    })(),
    ...(() => {
      const caption = normalizeNewZealandText(image.caption);
      return isMeaningfulCaption(caption) ? { caption } : {};
    })()
  };
}

function sanitizeRawNewZealandRecord(raw: NewZealandProductSafetyRaw): NewZealandProductSafetyRaw {
  const detail = raw.detail ?? {};
  const images = Array.isArray(detail.images)
    ? (detail.images as NewZealandProductSafetyImage[]).map(normalizeRawImageForProcessed).filter((image): image is NewZealandProductSafetyImage => Boolean(image))
    : [];
  const listImage = raw.listImage ? normalizeRawImageForProcessed(raw.listImage) : null;

  return {
    id: normalizeNewZealandText(raw.id),
    path: normalizeNewZealandText(raw.path),
    sourceUrl: normalizeNewZealandText(raw.sourceUrl),
    title: normalizeNewZealandText(raw.title),
    publishedDate: normalizeNewZealandText(raw.publishedDate),
    categories: arrayOfStrings(raw.categories),
    ...(listImage ? { listImage } : {}),
    detail: {
      title: normalizeNewZealandText(detail.title),
      publishedDate: normalizeNewZealandText(detail.publishedDate),
      metaDescription: normalizeNewZealandText(detail.metaDescription),
      canonicalUrl: normalizeNewZealandText(detail.canonicalUrl),
      productIdentifiers: normalizeNewZealandText(detail.productIdentifiers),
      supplierName: normalizeNewZealandText(detail.supplierName),
      supplierContact: normalizeSupplierContact(detail.supplierContact),
      responsibleAgency: normalizeResponsibleAgency(detail.responsibleAgency),
      hazard: normalizeNewZealandText(detail.hazard),
      action: normalizeNewZealandText(detail.action),
      images
    }
  };
}

function sourceIdFor(raw: NewZealandProductSafetyRaw): string {
  const explicitId = firstNonEmpty([raw.id]);
  const pathSlug = normalizeNewZealandText(raw.path).split('/').filter(Boolean).at(-1) ?? '';
  return slugify(explicitId || pathSlug || firstNonEmpty([raw.title, raw.detail?.title], 'new-zealand-product-safety-recall'));
}

function extractIdentifierText(raw: NewZealandProductSafetyRaw): string[] {
  const text = [
    raw.title,
    raw.detail?.title,
    raw.detail?.productIdentifiers,
    raw.detail?.supplierName,
    raw.detail?.hazard,
    raw.detail?.action
  ]
    .map(normalizeNewZealandText)
    .join(' ');
  const patterns = [
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:SKU|serial)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:batch|lot|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b[A-Z]{1,8}-[A-Z0-9]{2,12}\b/g
  ];

  return uniqueNonEmpty(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])));
}

function descriptionFor(raw: NewZealandProductSafetyRaw, identifiers: string[]): string {
  return uniqueNonEmpty([
    `Product identifiers: ${normalizeNewZealandText(raw.detail?.productIdentifiers)}`,
    `Supplier: ${normalizeNewZealandText(raw.detail?.supplierName)}`,
    normalizeResponsibleAgency(raw.detail?.responsibleAgency) && normalizeResponsibleAgency(raw.detail?.responsibleAgency) !== 'MBIE'
      ? `Responsible agency: ${normalizeResponsibleAgency(raw.detail?.responsibleAgency)}`
      : '',
    `Category: ${arrayOfStrings(raw.categories).join(', ')}`,
    `Hazard: ${normalizeNewZealandText(raw.detail?.hazard)}`,
    identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : '',
    normalizeNewZealandText(raw.detail?.action)
  ]).join(' ');
}

export function extractNewZealandProductSafetyRecords(payload: unknown): NewZealandProductSafetyRaw[] {
  if (Array.isArray(payload)) {
    return payload as NewZealandProductSafetyRaw[];
  }

  if (payload && typeof payload === 'object') {
    const file = payload as RawNewZealandProductSafetyFile;
    if (Array.isArray(file.records)) {
      return file.records as NewZealandProductSafetyRaw[];
    }
  }

  return [];
}

export function compareNewZealandProductSafetyDateDescending(
  a: NewZealandProductSafetyRaw,
  b: NewZealandProductSafetyRaw
): number {
  const dateDifference = normalizeDate(b.detail?.publishedDate ?? b.publishedDate).localeCompare(
    normalizeDate(a.detail?.publishedDate ?? a.publishedDate)
  );
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return sourceIdFor(a).localeCompare(sourceIdFor(b));
}

export function normalizeNewZealandProductSafetyRecords(records: NewZealandProductSafetyRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .filter((raw) => !isExcludedNewZealandSpecialistRecord(raw))
    .sort(compareNewZealandProductSafetyDateDescending)
    .map((raw) => {
      const cleanedRaw = sanitizeRawNewZealandRecord(raw);
      const sourceRecordId = sourceIdFor(cleanedRaw);
      const id = `nz-product-safety-${sourceRecordId}`;
      const title = truncateText(firstNonEmpty([cleanedRaw.detail?.title, cleanedRaw.title], 'New Zealand product recall'), 170);
      const supplier = firstNonEmpty([cleanedRaw.detail?.supplierName]);
      const identifiers = extractIdentifierText(cleanedRaw);
      const productIdentifiers = normalizeNewZealandText(cleanedRaw.detail?.productIdentifiers);
      const productName = firstNonEmpty([productIdentifiers, title], title);
      const hazard = firstNonEmpty([cleanedRaw.detail?.hazard], 'Hazard not listed in the indexed notice.');
      const remedy = firstNonEmpty(
        [cleanedRaw.detail?.action],
        'Review the official Product Safety New Zealand notice for current instructions.'
      );
      const recallDate = normalizeDate(cleanedRaw.detail?.publishedDate ?? cleanedRaw.publishedDate);
      const category = classifyNewZealandProductSafetyCategory(cleanedRaw);
      const images = normalizeImages(cleanedRaw, `${title} recall product image`);
      const primaryImage = images[0];

      return {
        id,
        source: 'NZ_PRODUCT_SAFETY',
        sourceUrl: normalizeNewZealandText(raw.detail?.canonicalUrl) || normalizeNewZealandText(raw.sourceUrl),
        title,
        brandNames: uniqueNonEmpty([supplier]),
        productNames: uniqueNonEmpty([productName, title, ...identifiers]),
        category,
        hazard,
        remedy,
        recallDate,
        affectedUnits: '',
        description: descriptionFor(cleanedRaw, identifiers),
        slug: slugify(`${title}-${id}`),
        classification: 'Product Safety New Zealand recall',
        reason: hazard,
        distributionPattern: productIdentifiers,
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
        raw: cleanedRaw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.id && record.title && isOfficialNewZealandProductSafetyUrl(record.sourceUrl) && record.recallDate);
}

export async function writeNormalizedNewZealandProductSafetyRecalls(
  records: NewZealandProductSafetyRaw[],
  processedPath = defaultNewZealandProductSafetyProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeNewZealandProductSafetyRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('New Zealand Product Safety normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'NZ_PRODUCT_SAFETY',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawNewZealandProductSafetyPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractNewZealandProductSafetyRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No New Zealand Product Safety raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedNewZealandProductSafetyRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultNewZealandProductSafetyProcessedPath,
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
