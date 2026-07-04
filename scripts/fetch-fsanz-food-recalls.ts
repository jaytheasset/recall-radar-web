import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareFsanzFoodRecallDateDescending,
  defaultFsanzFoodRecallsProcessedPath,
  defaultRawFsanzFoodRecallsPath,
  extractFsanzFoodRecallRecords,
  normalizeFsanzText,
  writeNormalizedFsanzFoodRecalls,
  type FsanzFoodRecallImage,
  type FsanzFoodRecallLink,
  type FsanzFoodRecallRaw
} from './normalize-fsanz-food-recalls.ts';

type FetchOptions = {
  listPage: string;
  rssFeed: string;
  limit: number;
};

type ExtractedSection = {
  heading: string;
  text: string;
};

const officialListPage = 'https://www.foodstandards.gov.au/food-recalls/recall-alert';
const officialRssFeed = 'https://www.foodstandards.gov.au/food-recalls-rss.xml';
const defaultLimit = 100;
const maxLimit = 100;
const maxPages = 8;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.FSANZ_FOOD_RECALLS_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;

  return {
    listPage: readOption('url') ?? officialListPage,
    rssFeed: readOption('rss') ?? officialRssFeed,
    limit
  };
}

function decodeHtml(value: string): string {
  return normalizeFsanzText(value);
}

function stripHtml(value: string): string {
  return normalizeFsanzText(value);
}

function absoluteUrl(value: string, base = officialListPage): string {
  if (!value.trim()) {
    return '';
  }

  return new URL(decodeHtml(value.trim()), base).toString().replace(/^http:/i, 'https:');
}

function attrValue(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) ?? tag.match(new RegExp(`\\s${name}='([^']*)'`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function textFromFirst(pattern: RegExp, html: string): string {
  const match = html.match(pattern);
  return match ? stripHtml(match[1]) : '';
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml,application/rss+xml,application/xml,*/*'): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept,
        'user-agent': 'Recall Radar local FSANZ food recall fetch'
      }
    });
  } catch (error) {
    throw new Error(`FSANZ request failed before a response was received: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`FSANZ request returned HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`FSANZ request returned an empty response: ${url}`);
  }

  return text;
}

function imageFromTag(imageTag: string, base: string, overrideUrl = ''): FsanzFoodRecallImage | undefined {
  const imageUrl = attrValue(imageTag, 'src') || attrValue(imageTag, 'data-src');
  const absoluteImageUrl = imageUrl ? absoluteUrl(imageUrl, base) : '';
  const url = overrideUrl ? absoluteUrl(overrideUrl, base) : absoluteImageUrl;

  if (!url || /\b(?:logo|icon|sprite|favicon|header|footer|banner|placeholder|social|inline-images|path%20)\b/i.test(url)) {
    return undefined;
  }

  return {
    url,
    ...(absoluteImageUrl && absoluteImageUrl !== url ? { thumbnailUrl: absoluteImageUrl } : {}),
    alt: attrValue(imageTag, 'alt')
  };
}

function firstImageIn(html: string, base: string): FsanzFoodRecallImage | undefined {
  const photoswipe = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*photoswipe[^"']*["'][^>]*>\s*(<img\b[^>]*>)/i);
  if (photoswipe) {
    return imageFromTag(photoswipe[2], base, photoswipe[1]);
  }

  const image = html.match(/<img\b[^>]*>/i);
  return image ? imageFromTag(image[0], base) : undefined;
}

function extractListingRecords(html: string, base: string): FsanzFoodRecallRaw[] {
  const rows = [...html.matchAll(/<div class="food-recall-wrapper">([\s\S]*?)<\/div>\s*<\/span>\s*<\/div>\s*<\/div>/gi)];

  return rows
    .map((match) => {
      const rowHtml = match[1];
      const link = rowHtml.match(/<h2>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
      const sourceUrl = link ? absoluteUrl(link[1], base) : '';
      const listedTitle = link ? stripHtml(link[2]) : '';
      const listImage = firstImageIn(rowHtml, base);
      const publishedDate = textFromFirst(/<p\b[^>]*class=["']published-date["'][^>]*>\s*Published\s+([\s\S]*?)<\/p>/i, rowHtml);
      const listSummary = textFromFirst(/<div class="food-recall-desc">[\s\S]*?<p>\s*<p>([\s\S]*?)<\/p>\s*<\/p>/i, rowHtml);
      const path = sourceUrl ? new URL(sourceUrl).pathname : '';

      return {
        path,
        sourceUrl,
        listedTitle,
        title: listedTitle,
        listSummary,
        publishedDate,
        ...(listImage ? { listImage } : {})
      } satisfies FsanzFoodRecallRaw;
    })
    .filter((record) => record.sourceUrl && record.listedTitle);
}

function cdataText(value: string): string {
  return normalizeFsanzText(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function xmlField(item: string, field: string): string {
  const match = item.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`, 'i'));
  return match ? cdataText(match[1]) : '';
}

function extractRssItems(xml: string): NonNullable<FsanzFoodRecallRaw['rssItem']>[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => ({
    title: xmlField(match[1], 'title'),
    link: absoluteUrl(xmlField(match[1], 'link'), officialRssFeed),
    description: xmlField(match[1], 'description'),
    pubDate: xmlField(match[1], 'pubDate')
  }));
}

function htmlLines(value: string): string[] {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .split(/\n+/)
    .map(normalizeFsanzText)
    .filter(Boolean);
}

function paragraphs(value: string): string[] {
  return [...value.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripHtml(match[1])).filter(Boolean);
}

function extractSections(fieldHtml: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const matches = [...fieldHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];

  for (const [index, match] of matches.entries()) {
    const heading = stripHtml(match[1]).replace(/:$/, '').trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? fieldHtml.length : fieldHtml.length;
    const block = fieldHtml.slice(start, end);
    const text = paragraphs(block).join(' ');

    if (heading && text) {
      sections.push({ heading, text });
    }
  }

  return sections;
}

function sectionValue(sections: ExtractedSection[], label: string): string {
  const target = label.toLowerCase();
  return sections.find((section) => section.heading.toLowerCase() === target)?.text ?? '';
}

function extractRelatedLinks(html: string, base: string): FsanzFoodRecallLink[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absoluteUrl(match[1], base),
      text: stripHtml(match[2])
    }))
    .filter((link) => link.href && link.text);
}

function extractAllImages(html: string, base: string): FsanzFoodRecallImage[] {
  const images: FsanzFoodRecallImage[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*photoswipe[^"']*["'][^>]*>\s*(<img\b[^>]*>)/gi)) {
    const image = imageFromTag(match[2], base, match[1]);
    const url = typeof image?.url === 'string' ? image.url : '';
    if (image && url && !seen.has(url)) {
      seen.add(url);
      images.push(image);
    }
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const image = imageFromTag(match[0], base);
    const url = typeof image?.url === 'string' ? image.url : '';
    if (image && url && !seen.has(url)) {
      seen.add(url);
      images.push(image);
    }
  }

  return images;
}

function extractDetail(html: string, sourceUrl: string): NonNullable<FsanzFoodRecallRaw['detail']> {
  const articleHtml = html.match(/<article\b[^>]*class=["'][^"']*food-recall[^"']*full[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
  const fieldHtml = articleHtml.match(/<div class="field-bare">([\s\S]*?)<\/div>\s*<div class="container container-page-updated">/i)?.[1] ?? articleHtml;
  const firstHeading = fieldHtml.search(/<h2\b/i);
  const introductionHtml = firstHeading >= 0 ? fieldHtml.slice(0, firstHeading) : fieldHtml;
  const introLines = htmlLines(introductionHtml);
  const dateMarking = introLines.find((line) => /^Date Marking:/i.test(line))?.replace(/^Date Marking:\s*/i, '') ?? '';
  const introduction = introLines.filter((line) => !/^Date Marking:/i.test(line)).join(' ');
  const sections = extractSections(fieldHtml);

  return {
    title: textFromFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html).replace(/^Food Recalls\s*/i, ''),
    publishedDate:
      html.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] ??
      textFromFirst(/Published\s*<time[^>]*>([\s\S]*?)<\/time>/i, html),
    metaDescription: html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1] ?? '',
    introduction,
    dateMarking,
    problem: sectionValue(sections, 'Problem'),
    foodSafetyHazard: sectionValue(sections, 'Food safety hazard'),
    whatToDo: sectionValue(sections, 'What to do'),
    contact: sectionValue(sections, 'For further information please contact'),
    relatedLinks: extractRelatedLinks(fieldHtml, sourceUrl),
    images: extractAllImages(articleHtml, sourceUrl),
    text: stripHtml(fieldHtml)
  };
}

async function enrichRecord(record: FsanzFoodRecallRaw): Promise<FsanzFoodRecallRaw> {
  const sourceUrl = normalizeFsanzText(record.sourceUrl);
  const html = await fetchText(sourceUrl);
  const detail = extractDetail(html, sourceUrl);

  return {
    ...record,
    title: normalizeFsanzText(detail.title) || normalizeFsanzText(record.title),
    publishedDate: normalizeFsanzText(detail.publishedDate) || normalizeFsanzText(record.publishedDate),
    detail
  };
}

async function enrichRecords(records: FsanzFoodRecallRaw[]): Promise<FsanzFoodRecallRaw[]> {
  const enriched: FsanzFoodRecallRaw[] = [];

  for (const [index, record] of records.entries()) {
    try {
      enriched.push(await enrichRecord(record));
    } catch (error) {
      console.warn(
        `FSANZ detail fetch failed for ${record.sourceUrl} (${index + 1}/${records.length}): ${
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
}): typeof record {
  return record;
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const rssXml = await fetchText(options.rssFeed, 'application/rss+xml,application/xml,text/xml,*/*');
  const rssItems = extractRssItems(rssXml);
  const rssItemsByUrl = new Map(rssItems.map((item) => [normalizeFsanzText(item.link), item]));
  const candidateMap = new Map<string, FsanzFoodRecallRaw>();
  let pagesScanned = 0;

  for (let page = 0; page < maxPages && candidateMap.size < options.limit; page += 1) {
    const listUrl = page === 0 ? options.listPage : `${options.listPage}?page=${page}`;
    const html = await fetchText(listUrl);
    pagesScanned += 1;

    for (const record of extractListingRecords(html, listUrl)) {
      const sourceUrl = normalizeFsanzText(record.sourceUrl);
      const rssItem = rssItemsByUrl.get(sourceUrl);
      candidateMap.set(sourceUrl, {
        ...record,
        ...(rssItem ? { rssItem, publishedDate: rssItem.pubDate || record.publishedDate } : {})
      });

      if (candidateMap.size >= options.limit) {
        break;
      }
    }
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length < options.limit) {
    throw new Error(
      `FSANZ source returned ${candidates.length} candidate records, below requested limit ${options.limit}; existing data was not overwritten.`
    );
  }

  const enrichedCandidates = await enrichRecords(candidates);
  const records = enrichedCandidates.slice().sort(compareFsanzFoodRecallDateDescending).slice(0, options.limit);

  if (records.length < options.limit) {
    throw new Error(
      `FSANZ source returned ${records.length} eligible records, below requested limit ${options.limit}; existing data was not overwritten.`
    );
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawFsanzFoodRecallsPath, {
    fetchedAt,
    source: 'FSANZ_FOOD_RECALLS',
    endpoint: options.listPage,
    rssFeed: options.rssFeed,
    accessMode: 'official FSANZ food recall listing pagination plus official detail pages; RSS feed used as supplemental latest metadata',
    limit: options.limit,
    rssItemCount: rssItems.length,
    pagesScanned,
    candidateRecordsScanned: candidates.length,
    count: records.length,
    records
  });

  const rawPayload = {
    records
  };
  const processed = await writeNormalizedFsanzFoodRecalls(
    extractFsanzFoodRecallRecords(rawPayload),
    defaultFsanzFoodRecallsProcessedPath
  );
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: options.listPage,
        rssFeed: options.rssFeed,
        rawPath: defaultRawFsanzFoodRecallsPath,
        processedPath: defaultFsanzFoodRecallsProcessedPath,
        canonicalPath: canonicalProcessedPath,
        accessMode: 'official FSANZ food recall listing pagination plus official detail pages',
        rssItemCount: rssItems.length,
        pagesScanned,
        candidateRecordsScanned: candidates.length,
        rawRecordsSaved: records.length,
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
