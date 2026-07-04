import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareHongKongCfsDateDescending,
  defaultHongKongCfsProcessedPath,
  defaultRawHongKongCfsPath,
  extractHongKongCfsRecords,
  normalizeHongKongCfsText,
  writeNormalizedHongKongCfsRecalls,
  type HongKongCfsImage,
  type HongKongCfsLink,
  type HongKongCfsRaw,
  type HongKongCfsXmlItem
} from './normalize-hong-kong-cfs-food-alerts.ts';

type FetchOptions = {
  listPage: string;
  xmlFeed: string;
  limit: number;
};

type ExtractedHongKongCfsRow = {
  label: string;
  value: string;
  lines: string[];
};

const officialListPage = 'https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/whatsnew_fa.html';
const officialXmlFeed = 'https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml';
const defaultLimit = 100;
const maxLimit = 100;
const maxCandidateRecords = 140;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.HK_CFS_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;

  return {
    listPage: readOption('url') ?? officialListPage,
    xmlFeed: readOption('xml') ?? officialXmlFeed,
    limit
  };
}

function absoluteUrl(value: string, base: string): string {
  if (!value.trim()) {
    return '';
  }

  return new URL(normalizeHongKongCfsText(value), base).toString().replace(/^http:/i, 'https:');
}

function attrValue(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) ?? tag.match(new RegExp(`\\s${name}='([^']*)'`, 'i'));
  return match ? normalizeHongKongCfsText(match[1]) : '';
}

async function fetchText(url: string, accept = 'text/html,application/xml,*/*'): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept,
        'user-agent': 'Recall Radar local Hong Kong CFS fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `Hong Kong CFS request failed before a response was received: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new Error(`Hong Kong CFS request returned HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Hong Kong CFS request returned an empty response: ${url}`);
  }

  return text;
}

function cdataText(value: string): string {
  return normalizeHongKongCfsText(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function xmlField(item: string, field: string): string {
  const match = item.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`, 'i'));
  return match ? cdataText(match[1]) : '';
}

function extractXmlItems(xml: string): HongKongCfsXmlItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => ({
    title: xmlField(match[1], 'title'),
    description: xmlField(match[1], 'description'),
    link: absoluteUrl(xmlField(match[1], 'link'), officialXmlFeed),
    pubDate: xmlField(match[1], 'pubDate')
  }));
}

function extractArchivePages(html: string, base: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/href=["']([^"']*whatsnew_fa_\d{4}\.html)["']/gi)]
        .map((match) => absoluteUrl(match[1], base))
        .filter(Boolean)
    )
  ].sort((a, b) => b.localeCompare(a));
}

function extractListingRecords(html: string, base: string): HongKongCfsRaw[] {
  const records: HongKongCfsRaw[] = [];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*(?:\/english\/whatsnew\/whatsnew_fa\/)?\d{4}_\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = absoluteUrl(match[1], base);
    const title = normalizeHongKongCfsText(match[2]);
    const id = sourceUrl.split('/').pop()?.replace(/\.html$/i, '').replace(/_/g, '-') ?? '';

    if (!sourceUrl || !title || !id) {
      continue;
    }

    records.push({
      id,
      sourceUrl,
      listedTitle: title,
      title
    });
  }

  return records;
}

function htmlLines(value: string): string[] {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .split(/\n+/)
    .map(normalizeHongKongCfsText)
    .filter(Boolean);
}

function extractRows(html: string): ExtractedHongKongCfsRow[] {
  return [...html.matchAll(/<tr>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)].map(
    (match) => ({
      label: normalizeHongKongCfsText(match[1]),
      value: normalizeHongKongCfsText(match[2]),
      lines: htmlLines(match[2])
    })
  );
}

function rowValue(rows: ExtractedHongKongCfsRow[], label: string): string {
  const row = rows.find((item) => normalizeHongKongCfsText(item.label).toLowerCase() === label.toLowerCase());
  return row ? normalizeHongKongCfsText(row.value) : '';
}

function extractLinks(html: string, base: string): HongKongCfsLink[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: absoluteUrl(match[1], base),
      text: normalizeHongKongCfsText(match[2])
    }))
    .filter((link) => link.href && link.text);
}

function imageFromTag(imageTag: string, base: string): HongKongCfsImage | undefined {
  const url = attrValue(imageTag, 'src') || attrValue(imageTag, 'data-src');
  if (!url) {
    return undefined;
  }

  const absolute = absoluteUrl(url, base);
  if (/\b(?:logo|icon|sprite|favicon|header|footer|banner|btn_|arrow|bg_)\b/i.test(absolute)) {
    return undefined;
  }

  return {
    url: absolute,
    thumbnailUrl: absolute,
    alt: attrValue(imageTag, 'alt')
  };
}

function extractImages(html: string, base: string): HongKongCfsImage[] {
  const seen = new Set<string>();
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => imageFromTag(match[0], base))
    .filter((image): image is HongKongCfsImage => Boolean(image?.url))
    .filter((image) => {
      const url = normalizeHongKongCfsText(image.url);
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
}

function extractTitle(html: string): string {
  return (
    html.match(/<div id="content">\s*<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ??
    html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    ''
  );
}

function extractMetaDate(html: string): string {
  return html.match(/<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? '';
}

function extractDetail(html: string, sourceUrl: string): NonNullable<HongKongCfsRaw['detail']> {
  const rows = extractRows(html);
  const bodyText = normalizeHongKongCfsText(html.match(/<div id="content">([\s\S]*?)<\/div>\s*<\/body>/i)?.[1] ?? html);

  return {
    title: normalizeHongKongCfsText(extractTitle(html)).replace(/^Food Alerts \/ Allergy Alerts\s*-\s*/i, ''),
    issueDate: rowValue(rows, 'Issue Date'),
    sourceOfInformation: rowValue(rows, 'Source of Information'),
    metaDate: extractMetaDate(html),
    canonicalUrl: sourceUrl,
    rows,
    links: extractLinks(html, sourceUrl),
    images: extractImages(html, sourceUrl),
    text: bodyText
  };
}

async function enrichRecord(record: HongKongCfsRaw): Promise<HongKongCfsRaw> {
  const sourceUrl = normalizeHongKongCfsText(record.sourceUrl);
  const html = await fetchText(sourceUrl);
  const detail = extractDetail(html, sourceUrl);

  return {
    ...record,
    title: normalizeHongKongCfsText(detail.title) || normalizeHongKongCfsText(record.title),
    publishedDate: detail.issueDate || record.publishedDate,
    detail
  };
}

async function enrichRecords(records: HongKongCfsRaw[]): Promise<HongKongCfsRaw[]> {
  const enriched: HongKongCfsRaw[] = [];

  for (const [index, record] of records.entries()) {
    try {
      enriched.push(await enrichRecord(record));
    } catch (error) {
      console.warn(
        `Hong Kong CFS detail fetch failed for ${record.sourceUrl} (${index + 1}/${records.length}): ${
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
  const xml = await fetchText(options.xmlFeed, 'application/xml,text/xml,*/*');
  const xmlItems = extractXmlItems(xml);
  const xmlItemsByUrl = new Map(xmlItems.map((item) => [normalizeHongKongCfsText(item.link), item]));
  const listHtml = await fetchText(options.listPage);
  const archivePages = extractArchivePages(listHtml, options.listPage);
  const candidateMap = new Map<string, HongKongCfsRaw>();
  let archivePagesScanned = 0;

  for (const archivePage of archivePages) {
    if (candidateMap.size >= maxCandidateRecords) {
      break;
    }

    const html = await fetchText(archivePage);
    archivePagesScanned += 1;

    for (const record of extractListingRecords(html, archivePage)) {
      const sourceUrl = normalizeHongKongCfsText(record.sourceUrl);
      const xmlItem = xmlItemsByUrl.get(sourceUrl);
      candidateMap.set(sourceUrl, {
        ...record,
        ...(xmlItem ? { xmlItem, publishedDate: xmlItem.pubDate } : {})
      });

      if (candidateMap.size >= maxCandidateRecords) {
        break;
      }
    }
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length < options.limit) {
    throw new Error(
      `Hong Kong CFS source returned ${candidates.length} candidate records, below requested limit ${options.limit}; existing data was not overwritten.`
    );
  }

  const enrichedCandidates = await enrichRecords(candidates);
  const records = enrichedCandidates.slice().sort(compareHongKongCfsDateDescending).slice(0, options.limit);

  if (records.length === 0) {
    throw new Error('Hong Kong CFS source returned zero eligible records; existing data was not overwritten.');
  }

  if (records.length < options.limit) {
    throw new Error(
      `Hong Kong CFS source returned ${records.length} eligible records, below requested limit ${options.limit}; existing data was not overwritten.`
    );
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawHongKongCfsPath, {
    fetchedAt,
    source: 'HK_CFS',
    endpoint: options.listPage,
    xmlFeed: options.xmlFeed,
    accessMode: 'official DATA.GOV.HK XML plus official CFS annual HTML archive and detail pages',
    limit: options.limit,
    xmlItemCount: xmlItems.length,
    archivePagesScanned,
    candidateRecordsScanned: candidates.length,
    count: records.length,
    records
  });

  const rawPayload = {
    records
  };
  const processed = await writeNormalizedHongKongCfsRecalls(
    extractHongKongCfsRecords(rawPayload),
    defaultHongKongCfsProcessedPath
  );
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: options.listPage,
        xmlFeed: options.xmlFeed,
        rawPath: defaultRawHongKongCfsPath,
        processedPath: defaultHongKongCfsProcessedPath,
        canonicalPath: canonicalProcessedPath,
        accessMode: 'official DATA.GOV.HK XML plus official CFS annual HTML archive and detail pages',
        xmlItemCount: xmlItems.length,
        archivePagesScanned,
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
