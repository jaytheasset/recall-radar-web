// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';

type ProcessedRecall = {
  id: string;
  source: string;
  slug: string;
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  images?: Array<{ url?: string; thumbnailUrl?: string }>;
};

type ProcessedRecallFile = {
  records?: ProcessedRecall[];
};

type AuditSummary = {
  passed: boolean;
  blockers: string[];
  counts: {
    totalRecords: number;
    euRecords: number;
    euRecordsWithThumbnail: number;
    heroImageRecords: number;
    htmlFilesChecked: number;
    fetchpriorityHighTotal: number;
    fetchpriorityHighOutsideDetailPages: number;
    homepageFetchpriorityHigh: number;
    detailHeroPreloads: number;
    euDetailHeroSrcsets: number;
    euListThumbnailHits: number;
    euListFullImageMisuseHits: number;
  };
  checks: {
    resourceHintsExist: boolean;
    euCardsOrListsUseThumbnails: boolean;
    noEuFullImageMisuseInCardsOrLists: boolean;
    detailHeroPreloadExists: boolean;
    euDetailHeroSrcsetExists: boolean;
    fetchpriorityHighNotOverusedOutsideDetailPages: boolean;
  };
};

const root = process.cwd();
const distDir = path.join(root, 'dist');
const processedPath = path.join(root, 'data', 'processed', 'recalls.json');

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function readProcessedRecords(): ProcessedRecall[] {
  const file = JSON.parse(readText(processedPath)) as ProcessedRecallFile | ProcessedRecall[];
  return Array.isArray(file) ? file : file.records ?? [];
}

function walkHtmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkHtmlFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  });
}

function detailHtmlPathFor(slug: string): string {
  return path.join(distDir, 'recalls', slug, 'index.html');
}

function isDetailHtml(filePath: string): boolean {
  return filePath.includes(`${path.sep}recalls${path.sep}`);
}

function isRecallIndexHtml(filePath: string): boolean {
  return filePath.endsWith(`${path.sep}recalls${path.sep}index.html`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstFullImage(record: ProcessedRecall): string {
  return record.primaryImageUrl || record.images?.find((image) => image.url)?.url || '';
}

function firstThumbnailImage(record: ProcessedRecall): string {
  return record.primaryImageThumbnailUrl || record.images?.find((image) => image.thumbnailUrl)?.thumbnailUrl || '';
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

const records = readProcessedRecords();
const euRecords = records.filter((record) => record.source === 'EU_SAFETY_GATE');
const euRecordsWithThumbnails = euRecords.filter((record) => firstFullImage(record) && firstThumbnailImage(record));
const htmlFiles = walkHtmlFiles(distDir);
const htmlByPath = new Map(htmlFiles.map((filePath) => [filePath, readText(filePath)]));
const detailHtmlFiles = htmlFiles.filter((filePath) => isDetailHtml(filePath) && !isRecallIndexHtml(filePath));
const nonDetailHtmlFiles = htmlFiles.filter((filePath) => !isDetailHtml(filePath));
const nonDetailHtml = nonDetailHtmlFiles.map((filePath) => htmlByPath.get(filePath) ?? '').join('\n');
const homepageHtml = htmlByPath.get(path.join(distDir, 'index.html')) ?? '';
const allHtml = [...htmlByPath.values()].join('\n');
const blockers: string[] = [];

if (!htmlFiles.length) {
  blockers.push('dist HTML files were not found. Run npm run build before npm run audit:image-performance.');
}

const hasPreconnect = allHtml.includes('<link rel="preconnect" href="https://ec.europa.eu" crossorigin>');
const hasDnsPrefetch = allHtml.includes('<link rel="dns-prefetch" href="https://ec.europa.eu"');
const resourceHintsExist = hasPreconnect && hasDnsPrefetch;
if (!resourceHintsExist) {
  blockers.push('EU image host preconnect/dns-prefetch resource hints were not found in built HTML.');
}

let euListThumbnailHits = 0;
let euListFullImageMisuseHits = 0;
for (const record of euRecordsWithThumbnails) {
  const thumbnailUrl = firstThumbnailImage(record);
  const fullUrl = firstFullImage(record);
  if (thumbnailUrl && nonDetailHtml.includes(thumbnailUrl)) {
    euListThumbnailHits += 1;
  }

  const fullImgSrcPattern = new RegExp(`<img[^>]+src="${escapeRegExp(fullUrl)}"`, 'g');
  const fullCardImageDataPattern = new RegExp(`"cardImageUrl":"${escapeRegExp(fullUrl)}"`, 'g');
  euListFullImageMisuseHits += countMatches(nonDetailHtml, fullImgSrcPattern);
  euListFullImageMisuseHits += countMatches(nonDetailHtml, fullCardImageDataPattern);
}

if (euRecordsWithThumbnails.length && euListThumbnailHits === 0) {
  blockers.push('No EU thumbnail URLs were found in card/list built HTML.');
}

if (euListFullImageMisuseHits > 0) {
  blockers.push(`Found ${euListFullImageMisuseHits} EU full image use(s) in card/list contexts where thumbnails should be used.`);
}

let detailHeroPreloads = 0;
let detailHeroPriorityImages = 0;
let euDetailHeroSrcsets = 0;
for (const filePath of detailHtmlFiles) {
  const detailHtml = htmlByPath.get(filePath) ?? '';
  if (detailHtml.includes('fetchpriority="high"')) {
    detailHeroPriorityImages += 1;
  }

  if (detailHtml.includes('rel="preload"') && detailHtml.includes('as="image"')) {
    detailHeroPreloads += 1;
  }
}

for (const record of euRecordsWithThumbnails) {
  const detailPath = detailHtmlPathFor(record.slug);
  const detailHtml = htmlByPath.get(detailPath);
  const fullUrl = firstFullImage(record);
  if (!detailHtml) {
    blockers.push(`Missing built EU detail page for ${record.id}: ${detailPath}`);
    continue;
  }

  if (
    detailHtml.includes(`src="${fullUrl}"`) &&
    detailHtml.includes(`${firstThumbnailImage(record)} 480w`) &&
    detailHtml.includes(`${fullUrl} 1200w`) &&
    detailHtml.includes('sizes=')
  ) {
    euDetailHeroSrcsets += 1;
  }
}

if (detailHeroPriorityImages && detailHeroPreloads !== detailHeroPriorityImages) {
  blockers.push(`Expected ${detailHeroPriorityImages} built detail hero preload link(s), found ${detailHeroPreloads}.`);
}

if (euRecordsWithThumbnails.length && euDetailHeroSrcsets !== euRecordsWithThumbnails.length) {
  blockers.push(`Expected ${euRecordsWithThumbnails.length} EU detail hero srcset/sizes image(s), found ${euDetailHeroSrcsets}.`);
}

/*
  Some older processed records carry stale slug fields from earlier source imports.
  The runtime site regenerates detail routes from source ids and titles, so detail
  preload coverage is audited against built HTML above. EU records are still
  checked by stored slug because the Phase 16 image recovery regenerated them.
*/

const fetchpriorityHighTotal = countMatches(allHtml, /fetchpriority="high"/g);
const homepageFetchpriorityHigh = countMatches(homepageHtml, /fetchpriority="high"/g);
const fetchpriorityHighOutsideDetailPages = countMatches(nonDetailHtml, /fetchpriority="high"/g);

if (homepageFetchpriorityHigh > 1) {
  blockers.push(`Homepage has ${homepageFetchpriorityHigh} fetchpriority="high" image(s); expected at most 1.`);
}

if (fetchpriorityHighOutsideDetailPages > 1) {
  blockers.push(`Non-detail pages have ${fetchpriorityHighOutsideDetailPages} fetchpriority="high" image(s); expected at most 1.`);
}

const summary: AuditSummary = {
  passed: blockers.length === 0,
  blockers,
  counts: {
    totalRecords: records.length,
    euRecords: euRecords.length,
    euRecordsWithThumbnail: euRecordsWithThumbnails.length,
    heroImageRecords: detailHeroPriorityImages,
    htmlFilesChecked: htmlFiles.length,
    fetchpriorityHighTotal,
    fetchpriorityHighOutsideDetailPages,
    homepageFetchpriorityHigh,
    detailHeroPreloads,
    euDetailHeroSrcsets,
    euListThumbnailHits,
    euListFullImageMisuseHits
  },
  checks: {
    resourceHintsExist,
    euCardsOrListsUseThumbnails: euListThumbnailHits > 0,
    noEuFullImageMisuseInCardsOrLists: euListFullImageMisuseHits === 0,
    detailHeroPreloadExists: detailHeroPriorityImages > 0 && detailHeroPreloads === detailHeroPriorityImages,
    euDetailHeroSrcsetExists: euRecordsWithThumbnails.length > 0 && euDetailHeroSrcsets === euRecordsWithThumbnails.length,
    fetchpriorityHighNotOverusedOutsideDetailPages: homepageFetchpriorityHigh <= 1 && fetchpriorityHighOutsideDetailPages <= 1
  }
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
