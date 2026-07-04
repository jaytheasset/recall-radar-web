import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareNewZealandProductSafetyDateDescending,
  defaultNewZealandProductSafetyProcessedPath,
  defaultRawNewZealandProductSafetyPath,
  extractNewZealandProductSafetyRecords,
  isExcludedNewZealandSpecialistRecord,
  normalizeNewZealandText,
  writeNormalizedNewZealandProductSafetyRecalls,
  type NewZealandProductSafetyImage,
  type NewZealandProductSafetyRaw
} from './normalize-new-zealand-product-safety.ts';

type FetchOptions = {
  listPage: string;
  limit: number;
};

const officialListPage = 'https://www.productsafety.govt.nz/recalls';
const defaultLimit = 100;
const maxLimit = 100;
const pageSize = 12;
const maxListPages = 30;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.NZ_PRODUCT_SAFETY_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;

  return {
    listPage: readOption('url') ?? officialListPage,
    limit
  };
}

function absoluteUrl(value: string, base = officialListPage): string {
  if (!value.trim()) {
    return '';
  }

  return new URL(normalizeNewZealandText(value), base).toString();
}

function attrValue(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) ?? tag.match(new RegExp(`\\s${name}='([^']*)'`, 'i'));
  return match ? normalizeNewZealandText(match[1]) : '';
}

function textFromFirst(pattern: RegExp, html: string): string {
  const match = html.match(pattern);
  return match ? normalizeNewZealandText(match[1]) : '';
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml,*/*'): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept,
        'user-agent': 'Recall Radar local New Zealand Product Safety fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `New Zealand Product Safety request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`New Zealand Product Safety request returned HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`New Zealand Product Safety request returned an empty response: ${url}`);
  }

  return text;
}

function imageFromTag(imageTag: string, base: string): NewZealandProductSafetyImage | undefined {
  const url = attrValue(imageTag, 'src') || attrValue(imageTag, 'data-src');
  if (!url) {
    return undefined;
  }

  return {
    url: absoluteUrl(url, base),
    thumbnailUrl: absoluteUrl(url, base),
    alt: attrValue(imageTag, 'alt')
  };
}

function extractCategories(block: string): string[] {
  const categoryBlock = block.match(/<ul[^>]+class="recall__categories"[\s\S]*?<\/ul>/i)?.[0] ?? '';
  return [...categoryBlock.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normalizeNewZealandText(match[1]))
    .filter(Boolean);
}

function extractListingRecords(html: string, options: FetchOptions): NewZealandProductSafetyRaw[] {
  const records: NewZealandProductSafetyRaw[] = [];

  for (const articleMatch of html.matchAll(/<article\b[^>]+class="recall"[\s\S]*?<\/article>/gi)) {
    const block = articleMatch[0];
    const href = attrValue(block.match(/<a\b[^>]+class="recall__image-link"[^>]*>/i)?.[0] ?? '', 'href');
    const imageTag = block.match(/<img\b[^>]*>/i)?.[0] ?? '';
    const path = href || '';
    const sourceUrl = absoluteUrl(path, options.listPage);
    const publishedDate =
      block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ??
      textFromFirst(/<time[^>]*>([\s\S]*?)<\/time>/i, block);
    const title = textFromFirst(/<h1[^>]+class="recall__title"[^>]*>([\s\S]*?)<\/h1>/i, block);

    if (!path || !title || !sourceUrl) {
      continue;
    }

    records.push({
      id: path.split('/').filter(Boolean).at(-1) ?? path,
      path,
      sourceUrl,
      title,
      publishedDate,
      categories: extractCategories(block),
      listImage: imageFromTag(imageTag, options.listPage)
    });
  }

  return records;
}

function blockAfterHeading(html: string, heading: string): string {
  const pattern = new RegExp(`<h4[^>]*class="recall__content-heading"[^>]*>\\s*${heading}\\s*<\\/h4>([\\s\\S]*?)<\\/div>`, 'i');
  return html.match(pattern)?.[1] ?? '';
}

function infoBlock(html: string, modifier: string): string {
  const pattern = new RegExp(`<div[^>]+recall__info--${modifier}[^>]*>[\\s\\S]*?<div class="recall__info-content">([\\s\\S]*?)<\\/div>`, 'i');
  return html.match(pattern)?.[1] ?? '';
}

function extractSupplierName(html: string): string {
  const supplierBlock = html.match(/<div[^>]+col--supplier[^>]*>[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? '';
  return textFromFirst(/<strong>([\s\S]*?)<\/strong>/i, supplierBlock);
}

function extractSupplierContact(html: string): string {
  const supplierBlock = html.match(/<div[^>]+col--supplier[^>]*>[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? '';
  return normalizeNewZealandText(supplierBlock);
}

function extractResponsibleAgency(html: string): string {
  const agencyBlock = html.match(/<div[^>]+col--agency[^>]*>[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? '';
  return normalizeNewZealandText(agencyBlock);
}

function extractDetailImages(html: string, base: string): NewZealandProductSafetyImage[] {
  const images: NewZealandProductSafetyImage[] = [];
  const ogImage = html.match(/<meta[^>]+(?:property|name)="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? '';
  const twitterImage = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i)?.[1] ?? '';
  const twitterAlt = html.match(/<meta[^>]+name="twitter:image:alt"[^>]+content="([^"]+)"/i)?.[1] ?? '';

  for (const value of [ogImage, twitterImage]) {
    if (value) {
      images.push({
        url: absoluteUrl(value, base),
        alt: normalizeNewZealandText(twitterAlt)
      });
    }
  }

  for (const imageMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    const image = imageFromTag(imageMatch[0], base);
    if (!image?.url) {
      continue;
    }

    images.push(image);
  }

  const seen = new Set<string>();
  return images.filter((image) => {
    const url = normalizeNewZealandText(image.url);
    if (!url || seen.has(url) || /\/logos-|nz-govt-logo|favicon|_resources\//i.test(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
}

function extractDetail(html: string, sourceUrl: string): NonNullable<NewZealandProductSafetyRaw['detail']> {
  return {
    title: textFromFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html),
    metaDescription: normalizeNewZealandText(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? ''),
    canonicalUrl: html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? sourceUrl,
    productIdentifiers: normalizeNewZealandText(blockAfterHeading(html, 'Product Identifiers')),
    supplierName: extractSupplierName(html),
    supplierContact: extractSupplierContact(html),
    responsibleAgency: extractResponsibleAgency(html),
    hazard: normalizeNewZealandText(infoBlock(html, 'hazard')),
    action: normalizeNewZealandText(infoBlock(html, 'whattodo')),
    images: extractDetailImages(html, sourceUrl)
  };
}

async function enrichRecord(record: NewZealandProductSafetyRaw): Promise<NewZealandProductSafetyRaw> {
  const sourceUrl = String(record.sourceUrl);
  const html = await fetchText(sourceUrl);
  return {
    ...record,
    detail: {
      ...extractDetail(html, sourceUrl),
      publishedDate: record.publishedDate
    }
  };
}

async function enrichRecords(records: NewZealandProductSafetyRaw[]): Promise<NewZealandProductSafetyRaw[]> {
  const enriched: NewZealandProductSafetyRaw[] = [];

  for (const [index, record] of records.entries()) {
    try {
      enriched.push(await enrichRecord(record));
    } catch (error) {
      console.warn(
        `New Zealand Product Safety detail fetch failed for ${record.sourceUrl} (${index + 1}/${records.length}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      enriched.push(record);
    }
  }

  return enriched;
}

function publicSample(record: {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  brandNames: string[];
  productNames: string[];
  category: string;
  hazard: string;
  remedy: string;
  recallDate: string;
  description: string;
  slug: string;
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  primaryImageAlt?: string;
}): typeof record {
  return record;
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const allRecordsByUrl = new Map<string, NewZealandProductSafetyRaw>();
  let listingRecordsScanned = 0;
  let excludedSpecialistRecords = 0;

  for (let start = 0; start < pageSize * maxListPages && allRecordsByUrl.size < options.limit; start += pageSize) {
    const listUrl = start === 0 ? options.listPage : `${options.listPage}?start=${start}`;
    const listHtml = await fetchText(listUrl);
    const pageRecords = extractListingRecords(listHtml, options);

    if (pageRecords.length === 0) {
      break;
    }

    listingRecordsScanned += pageRecords.length;

    for (const record of pageRecords) {
      if (isExcludedNewZealandSpecialistRecord(record)) {
        excludedSpecialistRecords += 1;
        continue;
      }

      allRecordsByUrl.set(String(record.sourceUrl), record);
      if (allRecordsByUrl.size >= options.limit) {
        break;
      }
    }
  }

  const allRecords = [...allRecordsByUrl.values()];
  const records = allRecords.slice().sort(compareNewZealandProductSafetyDateDescending).slice(0, options.limit);

  if (records.length === 0) {
    throw new Error('New Zealand Product Safety source returned zero eligible listing records; existing data was not overwritten.');
  }

  if (records.length < options.limit) {
    throw new Error(
      `New Zealand Product Safety source returned ${records.length} eligible records, below requested limit ${options.limit}; existing data was not overwritten.`
    );
  }

  const enrichedRecords = await enrichRecords(records);
  const fetchedAt = new Date().toISOString();

  await writeJsonAtomic(defaultRawNewZealandProductSafetyPath, {
    fetchedAt,
    source: 'NZ_PRODUCT_SAFETY',
    endpoint: options.listPage,
    officialListPage: options.listPage,
    accessMode: 'official HTML listing with start pagination plus official detail pages',
    limit: options.limit,
    listingRecordsScanned,
    excludedSpecialistRecords,
    count: enrichedRecords.length,
    records: enrichedRecords
  });

  const rawPayload = {
    records: enrichedRecords
  };
  const processed = await writeNormalizedNewZealandProductSafetyRecalls(
    extractNewZealandProductSafetyRecords(rawPayload),
    defaultNewZealandProductSafetyProcessedPath
  );
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: options.listPage,
        rawPath: defaultRawNewZealandProductSafetyPath,
        processedPath: defaultNewZealandProductSafetyProcessedPath,
        canonicalPath: canonicalProcessedPath,
        accessMode: 'official HTML listing with start pagination plus official detail pages',
        listingRecordsScanned,
        excludedSpecialistRecords,
        rawRecordsSaved: enrichedRecords.length,
        rawRecordsWithDetailImages: enrichedRecords.filter(
          (record) => Array.isArray(record.detail?.images) && record.detail.images.length > 0
        ).length,
        normalizedRecordsSaved: processed.count,
        normalizedRecordsWithImages: processed.records.filter((record) => record.primaryImageUrl).length,
        mergedRecordsSaved: merged.count,
        countsBySource: merged.countsBySource,
        sample: sample ? publicSample(sample) : null
      },
      null,
      2
    )
  );
}

runFetch().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
