import type { RecallImage } from '../src/data/recall-types.ts';

type RawObject = Record<string, unknown>;

export type CanadaDetailImage = RecallImage & {
  source: 'official-canada-detail';
  extractedFrom: string;
  width?: number;
  height?: number;
};

export type CanadaAffectedProduct = {
  product: string;
  partNumber?: string;
  upc?: string;
  fields: Record<string, string>;
};

export type CanadaDetailPage = {
  sourceUrl: string;
  recallType?: string;
  title?: string;
  lastUpdated?: string;
  brandNames: string[];
  summary: {
    product?: string;
    issue?: string;
    action?: string;
  };
  affectedProductsHeader?: string;
  affectedProductsCaption?: string;
  affectedProducts: CanadaAffectedProduct[];
  images: CanadaDetailImage[];
};

type ImageCandidate = {
  url: string;
  styleName: string;
  kind: string;
  alt: string;
  width?: number;
  height?: number;
};

export type CanadaDetailImageFetchResult = {
  sourceUrl: string;
  status?: number;
  ok: boolean;
  images: CanadaDetailImage[];
  detail?: CanadaDetailPage;
  error?: string;
};

const allowedCanadaImageHosts = new Set(['recalls-rappels.canada.ca', 'www.canada.ca']);
const officialCanadaPageHostPattern = /^https:\/\/recalls-rappels\.canada\.ca\/en\/alert-recall\/[a-z0-9-]+$/i;
const maxConcurrency = 4;

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCharCode(Number.parseInt(decimal, 10)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: string): string {
  return stripHtml(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function cleanAltText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/^image\s+\d+\s*:\s*/i, '')
    .trim();
}

function attributesFor(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const matches = tag.matchAll(/([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g);

  for (const match of matches) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2].replace(/^['"]|['"]$/g, '').trim());
  }

  return attributes;
}

function absoluteUrl(rawUrl: string, pageUrl: string): string {
  if (!rawUrl || /^data:/i.test(rawUrl)) {
    return '';
  }

  try {
    return new URL(decodeHtmlEntities(rawUrl), pageUrl).toString();
  } catch {
    return '';
  }
}

export function isOfficialCanadaDetailUrl(value: string): boolean {
  return officialCanadaPageHostPattern.test(value);
}

export function isSuspectedCanadaChromeImage(value: string): boolean {
  const url = value.trim();
  if (!url || /^data:/i.test(url)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).toLowerCase();
    return (
      path.includes('/libraries/') ||
      path.includes('/themes/') ||
      path.endsWith('.svg') ||
      /(?:logo|wordmark|wmms|sig-blk|generic|icon|favicon|twitter|facebook|linkedin|youtube|rss)/i.test(path)
    );
  } catch {
    return true;
  }
}

export function isOfficialCanadaImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname).toLowerCase();
    return (
      allowedCanadaImageHosts.has(url.hostname.toLowerCase()) &&
      path.includes('/sites/default/files/') &&
      path.includes('/public/alert/recall/') &&
      /\.(?:png|jpe?g|gif|webp)$/i.test(path) &&
      !isSuspectedCanadaChromeImage(value)
    );
  } catch {
    return false;
  }
}

function selectMainContent(html: string): string {
  return html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
}

function selectProductImageContent(mainHtml: string): string {
  return (
    mainHtml.match(
      /<div[^>]*class=(?:"[^"]*\bar-product-images\b[^"]*"|'[^']*\bar-product-images\b[^']*')[\s\S]*?(?=<section\b[^>]*class=(?:"[^"]*\bar-affected-products\b|"[^"]*\bar-what-you-should-do\b|'[^']*\bar-affected-products\b|'[^']*\bar-what-you-should-do\b)|<\/main>)/i
    )?.[0] ?? mainHtml
  );
}

function styleNameFor(url: string): string {
  try {
    return new URL(url).pathname.match(/\/styles\/([^/]+)\//)?.[1] ?? 'original';
  } catch {
    return '';
  }
}

function canonicalImageKey(url: string): string {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/\/styles\/[^/]+\//, '/'));
  } catch {
    return url;
  }
}

function extractTitle(mainHtml: string): string {
  return cleanText(mainHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
}

function extractRecallType(mainHtml: string): string {
  const beforeTitle = mainHtml.split(/<h1\b/i)[0] ?? mainHtml;
  const candidates = [
    ...beforeTitle.matchAll(/<div\b[^>]*id=["']wb-cont-nav["'][^>]*>([\s\S]*?)<\/div>/gi),
    ...beforeTitle.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)
  ].map((match) => cleanText(match[1]));
  return candidates.find((candidate) => /recall|alert|advisory/i.test(candidate)) ?? '';
}

function extractLastUpdated(mainHtml: string): string {
  const block =
    mainHtml.match(/field--name-field-last-updated[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ??
    mainHtml.match(/Last updated[\s\S]{0,500}/i)?.[0] ??
    '';
  return (
    block.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1]?.slice(0, 10) ??
    cleanText(block.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1] ?? '') ??
    ''
  );
}

function extractBrands(mainHtml: string): string[] {
  const brandBlock = mainHtml.match(/<details\b[^>]*class=["'][^"']*\bar-brand-details\b[^"']*["'][\s\S]*?<\/details>/i)?.[0] ?? '';
  return uniqueNonEmpty(
    [...brandBlock.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => cleanText(match[1]))
      .concat([...brandBlock.matchAll(/<div\b[^>]*class=["'][^"']*\bfield--item\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map((match) => cleanText(match[1])))
  );
}

function fieldValue(mainHtml: string, fieldName: string): string {
  const directItem = mainHtml.match(
    new RegExp(`<div\\b(?=[^>]*\\bfield--name-${fieldName}\\b)(?=[^>]*\\bfield--item\\b)[^>]*>([\\s\\S]*?)<\\/div>`, 'i')
  )?.[1];
  if (directItem) {
    return cleanText(directItem);
  }

  const fieldIndex = mainHtml.search(new RegExp(`field--name-${fieldName}\\b`, 'i'));
  if (fieldIndex < 0) {
    return '';
  }

  const block = mainHtml.slice(fieldIndex, fieldIndex + 2500);
  const itemMatches = [...block.matchAll(/<div\b[^>]*class=["'][^"']*\bfield--item\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];
  if (itemMatches.length > 0) {
    return cleanText(itemMatches[0][1]);
  }

  return cleanText(block);
}

function selectSectionByClass(mainHtml: string, className: string): string {
  return (
    mainHtml.match(
      new RegExp(`<section\\b(?=[^>]*\\b${className}\\b)[\\s\\S]*?(?=<section\\b|<footer\\b|<\\/main>)`, 'i')
    )?.[0] ?? ''
  );
}

function headerKey(value: string): string {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalized === 'product') {
    return 'product';
  }

  if (normalized === 'part number' || normalized === 'part no' || normalized === 'item number') {
    return 'partNumber';
  }

  if (normalized === 'upc' || normalized === 'barcode' || normalized === 'gtin') {
    return 'upc';
  }

  return normalized.replace(/\s+([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function extractTableCaption(tableHtml: string): string {
  return cleanText(tableHtml.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] ?? '');
}

function extractAffectedProducts(mainHtml: string): {
  header: string;
  caption: string;
  products: CanadaAffectedProduct[];
} {
  const affectedSection = selectSectionByClass(mainHtml, 'ar-affected-products');
  if (!affectedSection) {
    return { header: '', caption: '', products: [] };
  }

  const header = fieldValue(affectedSection, 'field-affected-products-header');
  const tableHtml = affectedSection.match(/<table\b[\s\S]*?<\/table>/i)?.[0] ?? '';
  if (!tableHtml) {
    return { header, caption: '', products: [] };
  }

  const headers = [...(tableHtml.match(/<thead\b[\s\S]*?<\/thead>/i)?.[0] ?? '').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((match) => headerKey(match[1]))
    .filter(Boolean);
  const caption = extractTableCaption(tableHtml);
  const rows = [...(tableHtml.match(/<tbody\b[\s\S]*?<\/tbody>/i)?.[0] ?? tableHtml).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const products: CanadaAffectedProduct[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => cleanText(match[1]));
    if (cells.length === 0 || cells.every((cell) => !cell)) {
      continue;
    }

    const fields: Record<string, string> = {};
    cells.forEach((cell, index) => {
      const key = headers[index] ?? `column${index + 1}`;
      if (key && cell) {
        fields[key] = cell;
      }
    });

    const product = fields.product ?? cells[0] ?? '';
    if (!product) {
      continue;
    }

    products.push({
      product,
      ...(fields.partNumber ? { partNumber: fields.partNumber } : {}),
      ...(fields.upc ? { upc: fields.upc } : {}),
      fields
    });
  }

  return { header, caption, products };
}

export function extractCanadaDetailPage(html: string, pageUrl: string): CanadaDetailPage {
  const mainHtml = selectMainContent(html);
  const affectedProducts = extractAffectedProducts(mainHtml);

  return {
    sourceUrl: pageUrl,
    ...(extractRecallType(mainHtml) ? { recallType: extractRecallType(mainHtml) } : {}),
    ...(extractTitle(mainHtml) ? { title: extractTitle(mainHtml) } : {}),
    ...(extractLastUpdated(mainHtml) ? { lastUpdated: extractLastUpdated(mainHtml) } : {}),
    brandNames: extractBrands(mainHtml),
    summary: {
      ...(fieldValue(mainHtml, 'field-product') ? { product: fieldValue(mainHtml, 'field-product') } : {}),
      ...(fieldValue(mainHtml, 'field-issue-type') ? { issue: fieldValue(mainHtml, 'field-issue-type') } : {}),
      ...(fieldValue(mainHtml, 'field-action') ? { action: fieldValue(mainHtml, 'field-action') } : {})
    },
    ...(affectedProducts.header ? { affectedProductsHeader: affectedProducts.header } : {}),
    ...(affectedProducts.caption ? { affectedProductsCaption: affectedProducts.caption } : {}),
    affectedProducts: affectedProducts.products,
    images: extractCanadaDetailImages(html, pageUrl)
  };
}

function styleScore(candidate: ImageCandidate): number {
  const styleScores: Record<string, number> = {
    original: 100,
    x_large: 95,
    large: 90,
    medium: 45,
    thumbnail: 25
  };
  const kindScores: Record<string, number> = {
    href: 10,
    'data-box-url': 10,
    'data-src': 8,
    srcset: 7,
    'data-srcset': 7,
    src: 5,
    'data-b-thumb': 1
  };

  return (styleScores[candidate.styleName] ?? 50) + (kindScores[candidate.kind] ?? 0);
}

function addCandidate(
  candidates: ImageCandidate[],
  rawUrl: string | undefined,
  pageUrl: string,
  kind: string,
  alt: string,
  width?: number,
  height?: number
): void {
  const url = absoluteUrl(rawUrl ?? '', pageUrl);
  if (!url || !isOfficialCanadaImageUrl(url)) {
    return;
  }

  candidates.push({
    url,
    styleName: styleNameFor(url),
    kind,
    alt: cleanAltText(alt),
    ...(width ? { width } : {}),
    ...(height ? { height } : {})
  });
}

export function extractCanadaDetailImages(html: string, pageUrl: string): CanadaDetailImage[] {
  const mainHtml = selectMainContent(html);
  const imageHtml = selectProductImageContent(mainHtml);
  const candidates: ImageCandidate[] = [];

  for (const tag of imageHtml.match(/<(?:img|a|div|source)\b[^>]*>/gi) ?? []) {
    const attributes = attributesFor(tag);
    const alt = attributes.alt ?? attributes.title ?? '';
    const width = Number.parseInt(attributes.width ?? '', 10);
    const height = Number.parseInt(attributes.height ?? '', 10);

    for (const attributeName of ['href', 'data-box-url', 'data-src', 'src', 'data-b-thumb']) {
      addCandidate(candidates, attributes[attributeName], pageUrl, attributeName, alt, width, height);
    }

    for (const srcsetAttribute of ['srcset', 'data-srcset']) {
      for (const entry of (attributes[srcsetAttribute] ?? '').split(',')) {
        addCandidate(candidates, entry.trim().split(/\s+/)[0], pageUrl, srcsetAttribute, alt, width, height);
      }
    }
  }

  const groups = new Map<string, ImageCandidate[]>();
  for (const candidate of candidates) {
    const key = canonicalImageKey(candidate.url);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = group.slice().sort((a, b) => styleScore(b) - styleScore(a));
      const primary = sorted[0];
      const thumbnail =
        group.find((candidate) => /^(?:medium|thumbnail)$/i.test(candidate.styleName)) ??
        group.find((candidate) => candidate.kind === 'data-b-thumb');
      const alt = group.map((candidate) => candidate.alt).find(Boolean);

      return {
        url: primary.url,
        ...(thumbnail && thumbnail.url !== primary.url ? { thumbnailUrl: thumbnail.url } : {}),
        ...(alt ? { alt } : {}),
        source: 'official-canada-detail',
        extractedFrom: pageUrl,
        ...(primary.width ? { width: primary.width } : {}),
        ...(primary.height ? { height: primary.height } : {})
      } satisfies CanadaDetailImage;
    })
    .filter((image, index, images) => images.findIndex((candidate) => candidate.url === image.url) === index);
}

export function canadaImagesFromRawRecord(raw: { Images?: unknown }, fallbackAlt: string): RecallImage[] {
  const images = Array.isArray(raw.Images) ? raw.Images : [];
  return images
    .filter(isObject)
    .map((image) => {
      const url = asString(image.url) || asString(image.URL);
      if (!url || !isOfficialCanadaImageUrl(url)) {
        return null;
      }

      const thumbnailUrl = asString(image.thumbnailUrl) || asString(image.thumbnailURL) || asString(image.ThumbnailURL);
      const alt = cleanAltText(asString(image.alt) || asString(image.AltText) || fallbackAlt);
      const caption = cleanAltText(asString(image.caption) || asString(image.Caption));

      return {
        url,
        ...(thumbnailUrl && isOfficialCanadaImageUrl(thumbnailUrl) ? { thumbnailUrl } : {}),
        ...(caption ? { caption } : {}),
        ...(alt ? { alt } : {})
      } satisfies RecallImage;
    })
    .filter((image): image is RecallImage => Boolean(image))
    .filter((image, index, images) => images.findIndex((candidate) => candidate.url === image.url) === index);
}

export async function fetchCanadaDetailImages(sourceUrl: string): Promise<CanadaDetailImageFetchResult> {
  if (!isOfficialCanadaDetailUrl(sourceUrl)) {
    return {
      sourceUrl,
      ok: false,
      images: [],
      error: 'Invalid or unsupported Canada recall detail URL.'
    };
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: 'text/html,*/*',
        'user-agent': 'Recall Radar Canada official detail image fetch'
      }
    });
    const html = await response.text();
    const detail = response.ok ? extractCanadaDetailPage(html, sourceUrl) : undefined;
    return {
      sourceUrl,
      status: response.status,
      ok: response.ok,
      images: detail?.images ?? [],
      ...(detail ? { detail } : {}),
      ...(response.ok ? {} : { error: `HTTP ${response.status} ${response.statusText}` })
    };
  } catch (error) {
    return {
      sourceUrl,
      ok: false,
      images: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function enrichCanadaRecordsWithDetailImages<T extends { URL?: unknown; Images?: unknown }>(
  records: T[]
): Promise<{ records: T[]; results: CanadaDetailImageFetchResult[] }> {
  const enrichedRecords = new Array<T>(records.length);
  const results = new Array<CanadaDetailImageFetchResult>(records.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < records.length) {
      const index = cursor;
      cursor += 1;
      const record = records[index];
      const sourceUrl = asString(record.URL);
      const result = await fetchCanadaDetailImages(sourceUrl);
      results[index] = result;
      enrichedRecords[index] = {
        ...record,
        Images: result.images.length ? result.images : record.Images,
        ...(result.detail ? { Detail: result.detail } : {})
      } as T;
    }
  }

  await Promise.all(Array.from({ length: Math.min(maxConcurrency, Math.max(1, records.length)) }, () => worker()));

  return { records: enrichedRecords, results };
}
