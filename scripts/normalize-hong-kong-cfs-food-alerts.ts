import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, hongKongCfsProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type HongKongCfsImage = {
  url?: unknown;
  thumbnailUrl?: unknown;
  alt?: unknown;
  caption?: unknown;
};

export type HongKongCfsLink = {
  href?: unknown;
  text?: unknown;
};

export type HongKongCfsDetailRow = {
  label?: unknown;
  value?: unknown;
  lines?: unknown;
};

export type HongKongCfsXmlItem = {
  title?: unknown;
  description?: unknown;
  link?: unknown;
  pubDate?: unknown;
};

export type HongKongCfsRaw = {
  id?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  listedTitle?: unknown;
  publishedDate?: unknown;
  xmlItem?: HongKongCfsXmlItem;
  detail?: {
    title?: unknown;
    issueDate?: unknown;
    sourceOfInformation?: unknown;
    metaDate?: unknown;
    canonicalUrl?: unknown;
    rows?: unknown;
    links?: unknown;
    images?: unknown;
    text?: unknown;
  };
};

type RawHongKongCfsFile = {
  fetchedAt?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawHongKongCfsPath = resolve(projectRoot, 'data/raw/hong-kong-cfs-food-alerts.json');
export const defaultHongKongCfsProcessedPath = hongKongCfsProcessedPath;

export function normalizeHongKongCfsText(value: unknown): string {
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
    const text = normalizeHongKongCfsText(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeHongKongCfsText(value)).filter(Boolean))];
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
}

function normalizeDate(value: unknown): string {
  const text = normalizeHongKongCfsText(value);
  if (!text) {
    return '';
  }

  const hkDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (hkDate) {
    return `${hkDate[3]}-${hkDate[2].padStart(2, '0')}-${hkDate[1].padStart(2, '0')}`;
  }

  const date = new Date(text.includes('T') ? text : `${text} UTC`);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function sourceIdFor(raw: HongKongCfsRaw): string {
  const explicitId = normalizeHongKongCfsText(raw.id);
  if (explicitId) {
    return slugify(explicitId.replace(/_/g, '-'));
  }

  try {
    const url = new URL(normalizeHongKongCfsText(raw.sourceUrl));
    const stem = url.pathname.split('/').pop()?.replace(/\.html$/i, '') ?? '';
    return slugify(stem.replace(/_/g, '-'));
  } catch {
    return slugify(firstNonEmpty([raw.title, raw.listedTitle], 'hong-kong-cfs-alert'));
  }
}

export function isOfficialHongKongCfsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.cfs.gov.hk' &&
      /^\/english\/whatsnew\/whatsnew_fa\/\d{4}_\d+\.html$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isOfficialHongKongCfsImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.cfs.gov.hk' &&
      !/\b(?:logo|icon|sprite|favicon|header|footer|banner|placeholder|default|govt|fehd|cfs)\b/i.test(path)
    );
  } catch {
    return false;
  }
}

function detailRows(raw: HongKongCfsRaw): HongKongCfsDetailRow[] {
  return arrayOfObjects(raw.detail?.rows) as HongKongCfsDetailRow[];
}

function cleanHongKongCfsRows(raw: HongKongCfsRaw): HongKongCfsDetailRow[] {
  return detailRows(raw).flatMap((row) => {
    const label = normalizeHongKongCfsText(row.label);
    const lines = uniqueNonEmpty(
      (Array.isArray(row.lines) ? row.lines : [row.value]).map((value) => normalizeHongKongCfsText(value))
    );
    const value = normalizeHongKongCfsText(row.value) || lines.join(' ');

    if (!label || (!value && lines.length === 0)) {
      return [];
    }

    return [
      {
        label,
        value,
        ...(lines.length ? { lines } : {})
      }
    ];
  });
}

function cleanHongKongCfsLinks(raw: HongKongCfsRaw): HongKongCfsLink[] {
  const seen = new Set<string>();

  return arrayOfObjects(raw.detail?.links).flatMap((link) => {
    const href = normalizeHongKongCfsText(link.href);
    const text = normalizeHongKongCfsText(link.text);

    if (!href || /^back$/i.test(text)) {
      return [];
    }

    try {
      const url = new URL(href);
      if (url.protocol !== 'https:') {
        return [];
      }
    } catch {
      return [];
    }

    const key = `${href} ${text}`.toLowerCase();
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [
      {
        href,
        ...(text ? { text } : {})
      }
    ];
  });
}

function cleanHongKongCfsImages(raw: HongKongCfsRaw): HongKongCfsImage[] {
  const seen = new Set<string>();

  return arrayOfObjects(raw.detail?.images).flatMap((image) => {
    const url = normalizeHongKongCfsText(image.url);
    const thumbnailUrl = normalizeHongKongCfsText(image.thumbnailUrl);
    const alt = normalizeHongKongCfsText(image.alt);
    const caption = normalizeHongKongCfsText(image.caption);

    if (!url || !isOfficialHongKongCfsImageUrl(url) || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [
      {
        url,
        ...(thumbnailUrl && isOfficialHongKongCfsImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
        ...(alt ? { alt } : {}),
        ...(caption && !/\.(?:png|jpe?g|gif|webp)$/i.test(caption) ? { caption } : {})
      }
    ];
  });
}

function cleanHongKongCfsDetailText(raw: HongKongCfsRaw): string {
  return uniqueNonEmpty([
    normalizeHongKongCfsText(raw.detail?.title),
    ...cleanHongKongCfsRows(raw).flatMap((row) => [
      normalizeHongKongCfsText(row.label),
      normalizeHongKongCfsText(row.value)
    ])
  ]).join(' ');
}

function cleanHongKongCfsRawRecord(raw: HongKongCfsRaw): HongKongCfsRaw {
  const detail = raw.detail ?? {};

  return {
    ...(normalizeHongKongCfsText(raw.id) ? { id: normalizeHongKongCfsText(raw.id) } : {}),
    ...(normalizeHongKongCfsText(raw.sourceUrl) ? { sourceUrl: normalizeHongKongCfsText(raw.sourceUrl) } : {}),
    ...(normalizeHongKongCfsText(raw.title) ? { title: normalizeHongKongCfsText(raw.title) } : {}),
    ...(normalizeHongKongCfsText(raw.listedTitle) ? { listedTitle: normalizeHongKongCfsText(raw.listedTitle) } : {}),
    ...(normalizeHongKongCfsText(raw.publishedDate) ? { publishedDate: normalizeHongKongCfsText(raw.publishedDate) } : {}),
    ...(raw.xmlItem
      ? {
          xmlItem: {
            ...(normalizeHongKongCfsText(raw.xmlItem.title) ? { title: normalizeHongKongCfsText(raw.xmlItem.title) } : {}),
            ...(normalizeHongKongCfsText(raw.xmlItem.description)
              ? { description: normalizeHongKongCfsText(raw.xmlItem.description) }
              : {}),
            ...(normalizeHongKongCfsText(raw.xmlItem.link) ? { link: normalizeHongKongCfsText(raw.xmlItem.link) } : {}),
            ...(normalizeHongKongCfsText(raw.xmlItem.pubDate) ? { pubDate: normalizeHongKongCfsText(raw.xmlItem.pubDate) } : {})
          }
        }
      : {}),
    detail: {
      ...(normalizeHongKongCfsText(detail.title) ? { title: normalizeHongKongCfsText(detail.title) } : {}),
      ...(normalizeHongKongCfsText(detail.issueDate) ? { issueDate: normalizeHongKongCfsText(detail.issueDate) } : {}),
      ...(normalizeHongKongCfsText(detail.sourceOfInformation)
        ? { sourceOfInformation: normalizeHongKongCfsText(detail.sourceOfInformation) }
        : {}),
      ...(normalizeHongKongCfsText(detail.metaDate) ? { metaDate: normalizeHongKongCfsText(detail.metaDate) } : {}),
      ...(normalizeHongKongCfsText(detail.canonicalUrl) ? { canonicalUrl: normalizeHongKongCfsText(detail.canonicalUrl) } : {}),
      rows: cleanHongKongCfsRows(raw),
      links: cleanHongKongCfsLinks(raw),
      images: cleanHongKongCfsImages(raw),
      text: cleanHongKongCfsDetailText(raw)
    }
  };
}

function rowValue(raw: HongKongCfsRaw, label: string): string {
  const normalizedLabel = label.toLowerCase();
  return firstNonEmpty(
    detailRows(raw)
      .filter((row) => normalizeHongKongCfsText(row.label).toLowerCase() === normalizedLabel)
      .map((row) => row.value)
  );
}

function rowLines(raw: HongKongCfsRaw, label: string): string[] {
  const normalizedLabel = label.toLowerCase();
  const row = detailRows(raw).find((item) => normalizeHongKongCfsText(item.label).toLowerCase() === normalizedLabel);
  if (!row) {
    return [];
  }

  const value = row.lines;
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.map(normalizeHongKongCfsText));
  }

  return uniqueNonEmpty(normalizeHongKongCfsText(row.value).split(/\s{2,}|;\s*/));
}

function productDescriptionPairs(raw: HongKongCfsRaw): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const line of rowLines(raw, 'Product Name and Description')) {
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (match) {
      pairs[normalizeHongKongCfsText(match[1]).toLowerCase()] = normalizeHongKongCfsText(match[2]);
    }
  }

  return pairs;
}

function valuesForKeys(pairs: Record<string, string>, keys: string[]): string[] {
  return uniqueNonEmpty(keys.flatMap((key) => [pairs[key.toLowerCase()] ?? '']));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanIdentifierCandidate(value: string): string {
  let text = normalizeHongKongCfsText(value);
  for (const nextLabel of [
    'Product name',
    'Brand',
    'Place of origin',
    'Net Weight',
    'Pack size',
    'Volume',
    'Size',
    'Retailer',
    'Importer',
    'Manufacturer',
    'Distributor',
    'Batch Number',
    'JAN code',
    'Barcode',
    'The CFS press release',
    'CFS press release',
    'Members of the public',
    'Reason For Issuing Alert',
    'Action Taken by the Centre for Food Safety',
    'Advice to the Trade',
    'Advice to Consumers',
    'Further Information'
  ]) {
    text = text.replace(new RegExp(`\\s+${escapeRegExp(nextLabel)}\\b.*$`, 'i'), '').trim();
  }

  return text;
}

function classifyHongKongCfsCategory(raw: HongKongCfsRaw): string {
  const pairs = productDescriptionPairs(raw);
  const text = normalizeSearchText(
    [
      raw.title,
      raw.listedTitle,
      rowValue(raw, 'Food Product'),
      rowValue(raw, 'Reason For Issuing Alert'),
      rowValue(raw, 'Advice to Consumers'),
      ...Object.values(pairs)
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

function extractIdentifierText(raw: HongKongCfsRaw): string[] {
  const pairs = productDescriptionPairs(raw);
  const explicit = valuesForKeys(pairs, [
    'batch number',
    'batch no.',
    'lot number',
    'lot no.',
    'barcode',
    'best-before date',
    'best before date',
    'use-by date',
    'expiry date',
    'expiration date',
    'manufacture date',
    'pack size',
    'net weight',
    'size'
  ]);
  const text = [
    raw.title,
    rowValue(raw, 'Food Product'),
    rowValue(raw, 'Product Name and Description'),
    rowValue(raw, 'Further Information')
  ]
    .map(normalizeHongKongCfsText)
    .join(' ');
  const patterns = [
    /\b(?:batch|lot|code)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:barcode|GTIN|UPC)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b(?:best-before|best before|use-by|use by|expiry|expiration|manufacture)\s+date\s*[:#-]?\s*[A-Za-z0-9 ,./-]{3,40}/gi
  ];

  return uniqueNonEmpty(
    [...explicit, ...patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0]))]
      .map(cleanIdentifierCandidate)
      .filter((candidate) => candidate.length >= 3)
  );
}

function normalizeImages(raw: HongKongCfsRaw, fallbackAlt: string): RecallImage[] {
  const images = arrayOfObjects(raw.detail?.images) as HongKongCfsImage[];
  const seen = new Set<string>();

  return images.flatMap((image) => {
    const url = normalizeHongKongCfsText(image.url);
    const thumbnailUrl = normalizeHongKongCfsText(image.thumbnailUrl);
    const alt = firstNonEmpty([image.alt, image.caption], fallbackAlt);
    const caption = normalizeHongKongCfsText(image.caption);

    if (!url || !isOfficialHongKongCfsImageUrl(url) || seen.has(url)) {
      return [];
    }

    seen.add(url);
    return [
      {
        url,
        ...(thumbnailUrl && isOfficialHongKongCfsImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
        ...(alt ? { alt } : {}),
        ...(caption && !/\.(?:png|jpe?g|gif|webp)$/i.test(caption) ? { caption } : {})
      }
    ];
  });
}

function truncateText(value: string, maxLength = 280): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength);
  const space = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, space > 80 ? space : maxLength).trim()}...`;
}

function descriptionFor(raw: HongKongCfsRaw, identifiers: string[]): string {
  return truncateText(
    uniqueNonEmpty([
      rowValue(raw, 'Product Name and Description'),
      rowValue(raw, 'Reason For Issuing Alert'),
      identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : ''
    ]).join(' '),
    520
  );
}

export function extractHongKongCfsRecords(payload: unknown): HongKongCfsRaw[] {
  if (Array.isArray(payload)) {
    return payload as HongKongCfsRaw[];
  }

  if (payload && typeof payload === 'object') {
    const file = payload as RawHongKongCfsFile;
    if (Array.isArray(file.records)) {
      return file.records as HongKongCfsRaw[];
    }
  }

  return [];
}

export function compareHongKongCfsDateDescending(a: HongKongCfsRaw, b: HongKongCfsRaw): number {
  const dateDifference = normalizeDate(b.detail?.issueDate ?? b.publishedDate).localeCompare(
    normalizeDate(a.detail?.issueDate ?? a.publishedDate)
  );
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return sourceIdFor(b).localeCompare(sourceIdFor(a));
}

export function normalizeHongKongCfsRecords(records: HongKongCfsRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareHongKongCfsDateDescending)
    .map((raw) => {
      const cleanedRaw = cleanHongKongCfsRawRecord(raw);
      const pairs = productDescriptionPairs(cleanedRaw);
      const sourceRecordId = sourceIdFor(cleanedRaw);
      const id = `hk-cfs-${sourceRecordId}`;
      const officialTitle = firstNonEmpty([cleanedRaw.detail?.title, cleanedRaw.title, cleanedRaw.listedTitle], 'Hong Kong food alert');
      const foodProduct = rowValue(cleanedRaw, 'Food Product');
      const productName = firstNonEmpty([pairs['product name'], foodProduct, officialTitle], officialTitle);
      const brandNames = uniqueNonEmpty(
        valuesForKeys(pairs, ['brand', 'importer', 'retailer', 'manufacturer', 'distributor']).slice(0, 5)
      );
      const identifiers = extractIdentifierText(cleanedRaw);
      const hazard = firstNonEmpty([rowValue(cleanedRaw, 'Reason For Issuing Alert'), cleanedRaw.xmlItem?.description], officialTitle);
      const action = firstNonEmpty(
        [
          rowValue(cleanedRaw, 'Advice to Consumers'),
          rowValue(cleanedRaw, 'Action Taken by the Centre for Food Safety'),
          rowValue(cleanedRaw, 'Advice to the Trade')
        ],
        'Review the official Centre for Food Safety notice for current instructions.'
      );
      const recallDate = normalizeDate(cleanedRaw.detail?.issueDate ?? cleanedRaw.publishedDate);
      const images = normalizeImages(cleanedRaw, `${productName} food alert product image`);
      const primaryImage = images[0];
      const productQuantity = valuesForKeys(pairs, [
        'net weight',
        'pack size',
        'size',
        'batch number',
        'best-before date',
        'best before date',
        'use-by date',
        'expiry date',
        'expiration date'
      ]).join('; ');
      const sourceUrl = normalizeHongKongCfsText(cleanedRaw.detail?.canonicalUrl) || normalizeHongKongCfsText(cleanedRaw.sourceUrl);

      return {
        id,
        source: 'HK_CFS',
        sourceUrl,
        title: truncateText(officialTitle, 170),
        brandNames,
        productNames: uniqueNonEmpty([productName, foodProduct, officialTitle, ...identifiers]),
        category: classifyHongKongCfsCategory(cleanedRaw),
        hazard,
        remedy: action,
        recallDate,
        affectedUnits: productQuantity,
        description: descriptionFor(cleanedRaw, identifiers),
        slug: slugify(`${productName}-${id}`),
        classification: 'Hong Kong Centre for Food Safety food alert',
        reason: hazard,
        distributionPattern: valuesForKeys(pairs, ['retailer', 'importer', 'place of origin']).join('; '),
        productQuantity,
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
    .filter((record) => record.id && record.title && isOfficialHongKongCfsUrl(record.sourceUrl) && record.recallDate);
}

export async function writeNormalizedHongKongCfsRecalls(
  records: HongKongCfsRaw[],
  processedPath = defaultHongKongCfsProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeHongKongCfsRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('Hong Kong CFS normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'HK_CFS',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawHongKongCfsPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractHongKongCfsRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No Hong Kong CFS raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedHongKongCfsRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultHongKongCfsProcessedPath,
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
