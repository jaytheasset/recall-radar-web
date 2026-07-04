import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, fsanzFoodRecallsProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type FsanzFoodRecallImage = {
  url?: unknown;
  thumbnailUrl?: unknown;
  alt?: unknown;
  caption?: unknown;
};

export type FsanzFoodRecallLink = {
  href?: unknown;
  text?: unknown;
};

export type FsanzFoodRecallRaw = {
  id?: unknown;
  sourceUrl?: unknown;
  path?: unknown;
  title?: unknown;
  listedTitle?: unknown;
  listSummary?: unknown;
  publishedDate?: unknown;
  listImage?: FsanzFoodRecallImage;
  rssItem?: {
    title?: unknown;
    link?: unknown;
    description?: unknown;
    pubDate?: unknown;
  };
  detail?: {
    title?: unknown;
    publishedDate?: unknown;
    metaDescription?: unknown;
    introduction?: unknown;
    dateMarking?: unknown;
    problem?: unknown;
    foodSafetyHazard?: unknown;
    whatToDo?: unknown;
    contact?: unknown;
    relatedLinks?: unknown;
    images?: unknown;
    text?: unknown;
  };
};

type RawFsanzFoodRecallFile = {
  fetchedAt?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawFsanzFoodRecallsPath = resolve(projectRoot, 'data/raw/fsanz-food-recalls.json');
export const defaultFsanzFoodRecallsProcessedPath = fsanzFoodRecallsProcessedPath;

export function normalizeFsanzText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/^\uFEFF/, '')
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
        .replace(/<\/(?:p|div|li|h[1-6]|td|tr)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = normalizeFsanzText(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeFsanzText(value)).filter(Boolean))];
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
}

function normalizeDate(value: unknown): string {
  const text = normalizeFsanzText(value);
  if (!text) {
    return '';
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

function truncateText(value: string, maxLength = 320): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength);
  const space = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, space > 80 ? space : maxLength).trim()}...`;
}

function cleanTitle(value: unknown): string {
  return normalizeFsanzText(value).replace(/^UPDATED\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s*\|\s*/i, '');
}

function splitCompanyAndProduct(title: string): { company: string; product: string } {
  const clean = cleanTitle(title);
  const parts = clean.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      company: parts[0],
      product: parts.slice(1).join(' - ')
    };
  }

  return {
    company: '',
    product: clean
  };
}

function sourceSlug(raw: FsanzFoodRecallRaw): string {
  try {
    const url = new URL(normalizeFsanzText(raw.sourceUrl));
    return slugify(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
  } catch {
    return slugify(firstNonEmpty([raw.path, raw.title, raw.listedTitle], 'fsanz-food-recall'));
  }
}

function sourceIdFor(raw: FsanzFoodRecallRaw): string {
  const explicit = normalizeFsanzText(raw.id);
  if (explicit) {
    return slugify(explicit);
  }

  const text = [
    raw.title,
    raw.listedTitle,
    raw.listImage,
    raw.detail?.images,
    raw.detail?.relatedLinks,
    raw.detail?.text,
    raw.sourceUrl
  ]
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value ?? '')))
    .join(' ');
  const codeMatch =
    text.match(/\bFSANZ\s*[-_ ]?([12]\d{3})\s*[-_ ]?(\d{1,4})\b/i) ??
    text.match(/\b([12]\d{3})\s*[-_ ]?(\d{1,4})\s+Recall Notice\b/i);

  if (codeMatch) {
    return `fsanz-${codeMatch[1]}-${codeMatch[2].padStart(2, '0')}`;
  }

  return `fsanz-${sourceSlug(raw)}`;
}

export function isOfficialFsanzUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.foodstandards.gov.au' &&
      /^\/food-recalls\/recall-alert\/[a-z0-9-]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isOfficialFsanzImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.foodstandards.gov.au' &&
      /^\/sites\/default\/files\/(?:styles\/[^/]+\/)?public\//i.test(url.pathname) &&
      !/\b(?:logo|icon|sprite|favicon|header|footer|banner|placeholder|social|inline-images|path%20)\b/i.test(
        url.pathname
      )
    );
  } catch {
    return false;
  }
}

function isMeaningfulCaption(value: string): boolean {
  return Boolean(value) && !/^[^\\/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)(?:\?.*)?$/i.test(value);
}

function normalizeImages(raw: FsanzFoodRecallRaw, fallbackAlt: string): RecallImage[] {
  const detailImages = arrayOfObjects(raw.detail?.images) as FsanzFoodRecallImage[];
  const listImage = raw.listImage && typeof raw.listImage === 'object' ? [raw.listImage as FsanzFoodRecallImage] : [];
  const seen = new Set<string>();

  return [...detailImages, ...listImage].flatMap((image) => {
    const url = normalizeFsanzText(image.url);
    const thumbnailUrl = normalizeFsanzText(image.thumbnailUrl);
    const alt = firstNonEmpty([image.alt, image.caption], fallbackAlt);
    const caption = normalizeFsanzText(image.caption);

    if (!url || !isOfficialFsanzImageUrl(url) || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [
      {
        url,
        ...(thumbnailUrl && isOfficialFsanzImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
        ...(isMeaningfulCaption(caption) ? { caption } : {}),
        ...(alt ? { alt } : {})
      }
    ];
  });
}

function classifyFsanzCategory(raw: FsanzFoodRecallRaw): string {
  const text = normalizeSearchText(
    [
      raw.title,
      raw.listSummary,
      raw.detail?.problem,
      raw.detail?.foodSafetyHazard,
      raw.detail?.whatToDo,
      raw.detail?.dateMarking,
      raw.detail?.introduction
    ].join(' ')
  );

  if (
    /\b(allergen|allergy|undeclared|milk|egg|peanut|tree nut|nut|gluten|wheat|soy|soya|sesame|sulphite|sulfite|fish|crustacean|shellfish)\b/i.test(
      text
    )
  ) {
    return 'food-allergy';
  }

  return 'food-allergy';
}

function extractIdentifierText(raw: FsanzFoodRecallRaw): string[] {
  const explicit = uniqueNonEmpty([normalizeFsanzText(raw.detail?.dateMarking)]);
  const text = [
    raw.title,
    raw.listSummary,
    raw.detail?.introduction,
    raw.detail?.problem,
    raw.detail?.foodSafetyHazard,
    raw.detail?.whatToDo
  ]
    .map(normalizeFsanzText)
    .join(' ');
  const patterns = [
    /\b(?:batch|lot|code)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b(?:\d+(?:\.\d+)?\s*(?:g|kg|ml|l|litre|litres))\b/gi
  ];

  return uniqueNonEmpty([...explicit, ...patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0]))]);
}

function descriptionFor(raw: FsanzFoodRecallRaw, identifiers: string[]): string {
  return truncateText(
    uniqueNonEmpty([
      raw.detail?.introduction ? `Product availability: ${normalizeFsanzText(raw.detail.introduction)}` : '',
      raw.detail?.dateMarking ? `Date marking: ${normalizeFsanzText(raw.detail.dateMarking)}` : '',
      raw.detail?.problem ? `Problem: ${normalizeFsanzText(raw.detail.problem)}` : '',
      raw.detail?.foodSafetyHazard ? `Food safety hazard: ${normalizeFsanzText(raw.detail.foodSafetyHazard)}` : '',
      identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : '',
      raw.detail?.whatToDo ? `Action: ${normalizeFsanzText(raw.detail.whatToDo)}` : ''
    ]).join(' '),
    560
  );
}

export function extractFsanzFoodRecallRecords(payload: unknown): FsanzFoodRecallRaw[] {
  if (Array.isArray(payload)) {
    return payload as FsanzFoodRecallRaw[];
  }

  if (payload && typeof payload === 'object') {
    const file = payload as RawFsanzFoodRecallFile;
    if (Array.isArray(file.records)) {
      return file.records as FsanzFoodRecallRaw[];
    }
  }

  return [];
}

export function compareFsanzFoodRecallDateDescending(a: FsanzFoodRecallRaw, b: FsanzFoodRecallRaw): number {
  const dateDifference = normalizeDate(b.detail?.publishedDate ?? b.publishedDate).localeCompare(
    normalizeDate(a.detail?.publishedDate ?? a.publishedDate)
  );
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return sourceIdFor(b).localeCompare(sourceIdFor(a));
}

export function normalizeFsanzFoodRecallRecords(records: FsanzFoodRecallRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareFsanzFoodRecallDateDescending)
    .map((raw) => {
      const officialTitle = cleanTitle(firstNonEmpty([raw.detail?.title, raw.title, raw.listedTitle], 'FSANZ food recall'));
      const titleParts = splitCompanyAndProduct(officialTitle);
      const productName = firstNonEmpty([titleParts.product, officialTitle], officialTitle);
      const companyName = firstNonEmpty([titleParts.company], '');
      const sourceRecordId = sourceIdFor(raw);
      const id = `fsanz-food-recalls-${sourceRecordId}`;
      const identifiers = extractIdentifierText(raw);
      const hazard = firstNonEmpty(
        [raw.detail?.problem, raw.detail?.foodSafetyHazard, raw.listSummary],
        'Food recall reason not listed.'
      );
      const action = firstNonEmpty([raw.detail?.whatToDo], 'Review the official FSANZ recall notice for current instructions.');
      const images = normalizeImages(raw, `${productName} food recall product image`);
      const primaryImage = images[0];
      const recallDate = normalizeDate(raw.detail?.publishedDate ?? raw.publishedDate);
      const sourceUrl = normalizeFsanzText(raw.sourceUrl);

      return {
        id,
        source: 'FSANZ_FOOD_RECALLS',
        sourceUrl,
        title: truncateText(officialTitle, 180),
        brandNames: uniqueNonEmpty([companyName]),
        productNames: uniqueNonEmpty([productName, officialTitle, ...identifiers]),
        category: classifyFsanzCategory(raw),
        hazard,
        remedy: action,
        recallDate,
        affectedUnits: uniqueNonEmpty([normalizeFsanzText(raw.detail?.dateMarking), ...identifiers]).join('; '),
        description: descriptionFor(raw, identifiers),
        slug: slugify(`${productName}-${id}`),
        classification: 'Food Standards Australia New Zealand food recall',
        reason: hazard,
        distributionPattern: normalizeFsanzText(raw.detail?.introduction || raw.listSummary),
        productQuantity: uniqueNonEmpty([normalizeFsanzText(raw.detail?.dateMarking), ...identifiers]).join('; '),
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
    .filter((record) => record.id && record.title && isOfficialFsanzUrl(record.sourceUrl) && record.recallDate);
}

export async function writeNormalizedFsanzFoodRecalls(
  records: FsanzFoodRecallRaw[],
  processedPath = defaultFsanzFoodRecallsProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeFsanzFoodRecallRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('FSANZ normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'FSANZ_FOOD_RECALLS',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawFsanzFoodRecallsPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractFsanzFoodRecallRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No FSANZ raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedFsanzFoodRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultFsanzFoodRecallsProcessedPath,
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
              affectedUnits: sample.affectedUnits,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              recallNumber: sample.recallNumber,
              primaryImageUrl: sample.primaryImageUrl,
              primaryImageThumbnailUrl: sample.primaryImageThumbnailUrl,
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
