import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareAustraliaProductSafetyDateDescending,
  defaultAustraliaProductSafetyProcessedPath,
  defaultRawAustraliaProductSafetyPath,
  extractAustraliaProductSafetyRecords,
  writeNormalizedAustraliaProductSafetyRecalls,
  type AustraliaProductSafetyImage,
  type AustraliaProductSafetyRaw
} from './normalize-australia-product-safety.ts';

type FetchOptions = {
  listPage: string;
  ajaxEndpoint: string;
  rssEndpoint: string;
  limit: number;
};

type DrupalAjaxViewSettings = {
  view_name: string;
  view_display_id: string;
  view_args: string;
  view_path: string;
  view_base_path: string;
  view_dom_id: string;
  pager_element: string | number;
};

const officialListPage = 'https://www.productsafety.gov.au/recalls';
const officialAjaxEndpoint = 'https://www.productsafety.gov.au/views/ajax?_wrapper_format=drupal_ajax';
const officialRssEndpoint = 'https://www.productsafety.gov.au/rss/feed.xml/psa_recall';
const defaultLimit = 100;
const maxLimit = 100;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.AU_PRODUCT_SAFETY_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;

  return {
    listPage: readOption('url') ?? officialListPage,
    ajaxEndpoint: readOption('ajax-url') ?? officialAjaxEndpoint,
    rssEndpoint: officialRssEndpoint,
    limit
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value: string, base = officialListPage): string {
  if (!value.trim()) {
    return '';
  }

  return new URL(decodeHtml(value.trim()), base).toString();
}

function normalizeAustraliaImageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.hostname === 'www.productsafety.gov.au' &&
      /^\/system\/files\/(?:styles\/[^/]+\/)?(?:public|private)\//i.test(url.pathname)
    ) {
      // Product Safety Australia image gallery links may expose a percent-encoded
      // quote in the derivative href; Drupal's image style endpoint expects that
      // filename percent sign to be encoded again.
      url.pathname = url.pathname.replace(/%22/gi, '%2522');
    }

    return url.toString();
  } catch {
    return value;
  }
}

function absoluteImageUrl(value: string, base = officialListPage): string {
  return normalizeAustraliaImageUrl(absoluteUrl(value, base));
}

function attrValue(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) ?? tag.match(new RegExp(`\\s${name}='([^']*)'`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function textFromFirst(pattern: RegExp, html: string): string {
  const match = html.match(pattern);
  return match ? stripHtml(match[1]) : '';
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/json,*/*',
        'user-agent': 'Recall Radar local Australia Product Safety fetch',
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    throw new Error(
      `Australia Product Safety request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`Australia Product Safety request returned HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Australia Product Safety request returned an empty response: ${url}`);
  }

  return text;
}

function extractDrupalAjaxViewSettings(html: string): DrupalAjaxViewSettings {
  const settingsText =
    html.match(/<script[^>]+data-drupal-selector="drupal-settings-json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] ??
    html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?"ajaxViews"[\s\S]*?)<\/script>/i)?.[1] ??
    '';

  if (settingsText) {
    try {
      const settings = JSON.parse(decodeHtml(settingsText)) as {
        views?: { ajaxViews?: Record<string, Partial<DrupalAjaxViewSettings>> };
      };
      const viewSettings = Object.values(settings.views?.ajaxViews ?? {})[0];

      if (
        viewSettings?.view_name &&
        viewSettings.view_display_id &&
        viewSettings.view_args &&
        viewSettings.view_path &&
        viewSettings.view_base_path &&
        viewSettings.view_dom_id
      ) {
        return {
          view_name: String(viewSettings.view_name),
          view_display_id: String(viewSettings.view_display_id),
          view_args: String(viewSettings.view_args),
          view_path: String(viewSettings.view_path),
          view_base_path: String(viewSettings.view_base_path),
          view_dom_id: String(viewSettings.view_dom_id),
          pager_element: viewSettings.pager_element ?? 0
        };
      }
    } catch {
      // Fall through to conservative default settings below.
    }
  }

  return {
    view_name: 'psa_listing_search',
    view_display_id: 'listing_search_date_range_filter',
    view_args: 'psa_recall',
    view_path: '/node/196',
    view_base_path: 'rss/feed.xml',
    view_dom_id: '',
    pager_element: 0
  };
}

async function fetchListHtml(options: FetchOptions, viewSettings: DrupalAjaxViewSettings, page: number): Promise<string> {
  const ajaxUrl = new URL(options.ajaxEndpoint);
  ajaxUrl.searchParams.set('page', String(page));
  ajaxUrl.searchParams.set('_wrapper_format', 'drupal_ajax');
  const form = new URLSearchParams();
  form.set('view_name', viewSettings.view_name);
  form.set('view_display_id', viewSettings.view_display_id);
  form.set('view_args', viewSettings.view_args);
  form.set('view_path', viewSettings.view_path);
  form.set('view_base_path', viewSettings.view_base_path);
  form.set('view_dom_id', viewSettings.view_dom_id);
  form.set('pager_element', String(viewSettings.pager_element ?? 0));
  form.set('items_per_page', String(options.limit));
  form.set('_wrapper_format', 'drupal_ajax');

  const text = await fetchText(ajaxUrl.toString(), {
    method: 'POST',
    body: form,
    headers: {
      accept: 'application/json,text/javascript,*/*',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: `${options.listPage}?page=${page}`,
      'x-requested-with': 'XMLHttpRequest'
    }
  });

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return text;
  }

  const commands = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Object.values(payload as Record<string, unknown>)
      : [];

  if (!commands.length) {
    return text;
  }

  return commands
    .flatMap((command) => {
      if (!command || typeof command !== 'object') {
        return [];
      }

      const data = (command as { data?: unknown }).data;
      return typeof data === 'string' ? [data] : [];
    })
    .join('\n');
}

function blockForLink(html: string, linkIndex: number): string {
  const start = Math.max(html.lastIndexOf('<div class="card-wrapper', linkIndex), html.lastIndexOf('<div  class="card-wrapper', linkIndex));
  const nextSingle = html.indexOf('<div class="card-wrapper', linkIndex + 1);
  const nextDouble = html.indexOf('<div  class="card-wrapper', linkIndex + 1);
  const nextCandidates = [nextSingle, nextDouble].filter((index) => index > linkIndex);
  const end = nextCandidates.length ? Math.min(...nextCandidates) : html.length;

  return html.slice(start >= 0 ? start : linkIndex, end);
}

function extractCategories(html: string): string[] {
  const categoryBlock =
    html.match(/field--name-field-psa-product-category[\s\S]*?(?=<div[^>]+field--name-|<div[^>]+card-|<\/article|$)/i)?.[0] ??
    html;
  const terms = [...categoryBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);

  return [...new Set(terms)];
}

function extractImageFromBlock(html: string): AustraliaProductSafetyImage | undefined {
  const imageTag = html.match(/<img\b[^>]*>/i)?.[0] ?? '';
  const src = attrValue(imageTag, 'src');
  if (!src) {
    return undefined;
  }

  return {
    url: absoluteImageUrl(src),
    thumbnailUrl: absoluteImageUrl(src),
    alt: attrValue(imageTag, 'alt')
  };
}

function extractListingRecords(html: string, options: FetchOptions): AustraliaProductSafetyRaw[] {
  const seen = new Set<string>();
  const records: AustraliaProductSafetyRaw[] = [];
  const linkPattern = /<a\b[^>]+href="(\/search-consumer-product-recalls\/[^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const path = decodeHtml(match[1]);
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);

    const block = blockForLink(html, match.index ?? 0);
    const sourceUrl = absoluteUrl(path, options.listPage);
    const publishedDate =
      block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ??
      textFromFirst(/field--name-field-psa-recall-published-date[\s\S]*?<time[^>]*>([\s\S]*?)<\/time>/i, block);

    records.push({
      id: path.split('/').filter(Boolean).at(-1) ?? path,
      path,
      sourceUrl,
      title: textFromFirst(/field--name-node-title[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i, block),
      supplierName: textFromFirst(/field--name-field-psa-recall-supplier-name[\s\S]*?field__item[^>]*>([\s\S]*?)<\/[^>]+>/i, block),
      publishedDate,
      categories: extractCategories(block),
      listImage: extractImageFromBlock(block)
    });
  }

  return records.filter((record) => record.sourceUrl && record.title).slice(0, options.limit);
}

function fieldBlock(html: string, fieldName: string): string {
  const pattern = new RegExp(
    `<div[^>]+field--name-${fieldName}[^>]*>[\\s\\S]*?(?=<div[^>]+field--name-|<section|<footer|</main>|$)`,
    'i'
  );
  return html.match(pattern)?.[0] ?? '';
}

function fieldText(html: string, fieldName: string): string {
  return stripHtml(fieldBlock(html, fieldName));
}

function firstTimeDate(html: string): string {
  return html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ?? '';
}

function extractDetailCategories(html: string): string[] {
  return extractCategories(fieldBlock(html, 'field-psa-product-category'));
}

function extractDetailImages(html: string): AustraliaProductSafetyImage[] {
  const block = fieldBlock(html, 'field-psa-recall-product-photo');
  const images: AustraliaProductSafetyImage[] = [];

  for (const imageMatch of block.matchAll(/<a\b[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img\b[^>]*>/gi)) {
    const linkTag = imageMatch[0].match(/<a\b[^>]*>/i)?.[0] ?? '';
    const imageTag = imageMatch[0].match(/<img\b[^>]*>/i)?.[0] ?? '';
    const fullUrl = attrValue(linkTag, 'href');
    const thumbnailUrl = attrValue(imageTag, 'src');
    const alt = attrValue(imageTag, 'alt');

    if (fullUrl) {
      images.push({
        url: absoluteImageUrl(fullUrl),
        ...(thumbnailUrl ? { thumbnailUrl: absoluteImageUrl(thumbnailUrl) } : {}),
        ...(alt ? { alt, caption: alt } : {})
      });
    }
  }

  if (images.length) {
    return images;
  }

  for (const imageTag of block.matchAll(/<img\b[^>]*>/gi)) {
    const src = attrValue(imageTag[0], 'src');
    if (src) {
      images.push({
        url: absoluteImageUrl(src),
        thumbnailUrl: absoluteImageUrl(src),
        alt: attrValue(imageTag[0], 'alt')
      });
    }
  }

  return images;
}

function extractDetail(html: string): NonNullable<AustraliaProductSafetyRaw['detail']> {
  return {
    title: textFromFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html),
    supplierName: fieldText(html, 'field-psa-recall-supplier-name'),
    publishedDate: firstTimeDate(html),
    categories: extractDetailCategories(html),
    productDescription: fieldText(html, 'field-psa-recall-product-desc'),
    brand: fieldText(html, 'field-psa-recall-brand'),
    defects: fieldText(html, 'field-psa-recall-product-defects'),
    hazards: fieldText(html, 'field-psa-recall-hazards'),
    consumerAction: fieldText(html, 'field-psa-recall-consumer-action'),
    supplierRunningRecall: fieldText(html, 'field-psa-recall-supplier-running'),
    traders: fieldText(html, 'field-psa-recall-traders'),
    saleDates: fieldText(html, 'field-psa-recall-sale-dates'),
    soldWhere: fieldText(html, 'field-psa-recall-where-sold'),
    manufacturerCountry: fieldText(html, 'field-psa-recall-country'),
    images: extractDetailImages(html)
  };
}

async function enrichRecord(record: AustraliaProductSafetyRaw): Promise<AustraliaProductSafetyRaw> {
  const html = await fetchText(String(record.sourceUrl));
  return {
    ...record,
    detail: extractDetail(html)
  };
}

async function enrichRecords(records: AustraliaProductSafetyRaw[]): Promise<AustraliaProductSafetyRaw[]> {
  const enriched: AustraliaProductSafetyRaw[] = [];

  for (const [index, record] of records.entries()) {
    try {
      enriched.push(await enrichRecord(record));
    } catch (error) {
      console.warn(
        `Australia Product Safety detail fetch failed for ${record.sourceUrl} (${index + 1}/${records.length}): ${
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
  classification?: string;
  recallNumber?: string;
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  primaryImageAlt?: string;
}): typeof record {
  return record;
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const listHtmlPage = await fetchText(`${options.listPage}?items_per_page=${options.limit}`);
  const viewSettings = extractDrupalAjaxViewSettings(listHtmlPage);
  const allRecordsByUrl = new Map<string, AustraliaProductSafetyRaw>();

  for (let page = 0; page < 10 && allRecordsByUrl.size < options.limit; page += 1) {
    const listHtml = await fetchListHtml(options, viewSettings, page);
    const pageRecords = extractListingRecords(listHtml, options);

    if (pageRecords.length === 0) {
      break;
    }

    for (const record of pageRecords) {
      allRecordsByUrl.set(String(record.sourceUrl), record);
    }
  }

  const allRecords = [...allRecordsByUrl.values()];
  const records = allRecords.slice().sort(compareAustraliaProductSafetyDateDescending).slice(0, options.limit);

  if (records.length === 0) {
    throw new Error('Australia Product Safety source returned zero listing records; existing data was not overwritten.');
  }

  const enrichedRecords = await enrichRecords(records);
  const fetchedAt = new Date().toISOString();

  await writeJsonAtomic(defaultRawAustraliaProductSafetyPath, {
    fetchedAt,
    source: 'AU_PRODUCT_SAFETY',
    endpoint: options.ajaxEndpoint,
    officialListPage: options.listPage,
    officialRssEndpoint: options.rssEndpoint,
    fetchMode: 'official Drupal AJAX listing view plus official detail pages',
    limit: options.limit,
    totalAvailableInFetchedWindow: allRecords.length,
    count: enrichedRecords.length,
    records: enrichedRecords
  });

  const rawPayload = {
    records: enrichedRecords
  };
  const processed = await writeNormalizedAustraliaProductSafetyRecalls(
    extractAustraliaProductSafetyRecords(rawPayload),
    defaultAustraliaProductSafetyProcessedPath
  );
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: options.ajaxEndpoint,
        officialListPage: options.listPage,
        officialRssEndpoint: options.rssEndpoint,
        rawPath: defaultRawAustraliaProductSafetyPath,
        processedPath: defaultAustraliaProductSafetyProcessedPath,
        canonicalPath: canonicalProcessedPath,
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
