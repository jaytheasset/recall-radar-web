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
    euProgressiveHeroImages: number;
    euInitialFullImageMisuseHits: number;
    euListThumbnailHits: number;
    euListFullImageMisuseHits: number;
    euCardViewportProgressiveLoaderHits: number;
    detailGalleryPages: number;
    detailGalleryPagesWithControls: number;
  };
  checks: {
    resourceHintsExist: boolean;
    euCardsOrListsUseThumbnails: boolean;
    noEuFullImageMisuseInCardsOrLists: boolean;
    euCardFullImageLoadsNearViewport: boolean;
    detailHeroPreloadExists: boolean;
    euDetailHeroProgressiveExists: boolean;
    noEuFullImageInitialHeroSrc: boolean;
    fetchpriorityHighNotOverusedOutsideDetailPages: boolean;
    detailGalleryControlsExist: boolean;
    detailGalleryKeyboardControlsExist: boolean;
  };
};

const root = process.cwd();
const distDir = path.join(root, 'dist');
const processedPath = path.join(root, 'data', 'processed', 'recalls.json');
const progressiveImageLoaderPath = path.join(root, 'src', 'lib', 'progressive-detail-image.ts');

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

function getAttribute(tag: string, attribute: string): string {
  const match = tag.match(new RegExp(`\\s${attribute}="([^"]*)"`));
  return match?.[1] ?? '';
}

function priorityImageTag(html: string): string {
  return html.match(/<img[^>]+fetchpriority="high"[^>]*>/)?.[0] ?? '';
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

const progressiveImageLoader = fs.existsSync(progressiveImageLoaderPath) ? readText(progressiveImageLoaderPath) : '';
const euCardViewportProgressiveLoaderHits =
  progressiveImageLoader.includes('IntersectionObserver') &&
  progressiveImageLoader.includes('rootMargin') &&
  progressiveImageLoader.includes('/notification/thumbnail/') &&
  progressiveImageLoader.includes('/notification/image/')
    ? 1
    : 0;

if (!euCardViewportProgressiveLoaderHits) {
  blockers.push('EU card/list progressive full-image loading is not gated by a viewport observer.');
}

let detailHeroPreloads = 0;
let detailHeroPriorityImages = 0;
let detailGalleryPages = 0;
let detailGalleryPagesWithControls = 0;
let euProgressiveHeroImages = 0;
let euInitialFullImageMisuseHits = 0;
for (const filePath of detailHtmlFiles) {
  const detailHtml = htmlByPath.get(filePath) ?? '';
  if (detailHtml.includes('fetchpriority="high"')) {
    detailHeroPriorityImages += 1;
  }

  if (detailHtml.includes('rel="preload"') && detailHtml.includes('as="image"')) {
    detailHeroPreloads += 1;
  }

  const galleryCount = Number(detailHtml.match(/data-detail-gallery-image-count="(\d+)"/)?.[1] ?? 0);
  if (galleryCount > 1) {
    detailGalleryPages += 1;

    const hasMainImage = detailHtml.includes('data-detail-gallery-main');
    const hasThumbnailControl = detailHtml.includes('data-gallery-thumbnail');
    const hasFullSource = detailHtml.includes('data-full-src=');
    const hasInitialSource = detailHtml.includes('data-initial-src=');
    const hasSelectedState = detailHtml.includes('is-selected') && detailHtml.includes('aria-pressed="true"');

    if (hasMainImage && hasThumbnailControl && hasFullSource && hasInitialSource && hasSelectedState) {
      detailGalleryPagesWithControls += 1;
    }
  }
}

for (const record of euRecordsWithThumbnails) {
  const detailPath = detailHtmlPathFor(record.slug);
  const detailHtml = htmlByPath.get(detailPath);
  const fullUrl = firstFullImage(record);
  const thumbnailUrl = firstThumbnailImage(record);
  if (!detailHtml) {
    blockers.push(`Missing built EU detail page for ${record.id}: ${detailPath}`);
    continue;
  }

  const heroTag = priorityImageTag(detailHtml);
  const heroSrc = getAttribute(heroTag, 'src');
  const fullDataSrc = getAttribute(heroTag, 'data-full-src');
  const thumbnailDataSrc = getAttribute(heroTag, 'data-thumbnail-src');

  if (heroSrc === fullUrl) {
    euInitialFullImageMisuseHits += 1;
  }

  if (heroSrc === thumbnailUrl && fullDataSrc === fullUrl && thumbnailDataSrc === thumbnailUrl) {
    euProgressiveHeroImages += 1;
  }
}

if (detailHeroPriorityImages && detailHeroPreloads !== detailHeroPriorityImages) {
  blockers.push(`Expected ${detailHeroPriorityImages} built detail hero preload link(s), found ${detailHeroPreloads}.`);
}

if (euRecordsWithThumbnails.length && euProgressiveHeroImages !== euRecordsWithThumbnails.length) {
  blockers.push(`Expected ${euRecordsWithThumbnails.length} progressive EU detail hero image(s), found ${euProgressiveHeroImages}.`);
}

if (euInitialFullImageMisuseHits > 0) {
  blockers.push(`Found ${euInitialFullImageMisuseHits} EU detail hero image(s) using the full image as the initial src.`);
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

if (detailGalleryPages > 0 && detailGalleryPagesWithControls !== detailGalleryPages) {
  blockers.push(
    `Expected ${detailGalleryPages} multi-image detail page(s) to include gallery controls, found ${detailGalleryPagesWithControls}.`
  );
}

const detailGallerySwitcherExists =
  progressiveImageLoader.includes('initDetailImageGallery') &&
  progressiveImageLoader.includes('data-gallery-thumbnail') &&
  progressiveImageLoader.includes('aria-pressed');
const detailGalleryKeyboardControlsExist =
  progressiveImageLoader.includes("addEventListener('keydown'") &&
  progressiveImageLoader.includes("event.key !== 'Enter'") &&
  progressiveImageLoader.includes("event.key !== ' '");

if (detailGalleryPages > 0 && !detailGallerySwitcherExists) {
  blockers.push('Detail image gallery thumbnail switching script was not found.');
}

if (detailGalleryPages > 0 && !detailGalleryKeyboardControlsExist) {
  blockers.push('Detail image gallery keyboard switching handler was not found.');
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
    euProgressiveHeroImages,
    euInitialFullImageMisuseHits,
    euListThumbnailHits,
    euListFullImageMisuseHits,
    euCardViewportProgressiveLoaderHits,
    detailGalleryPages,
    detailGalleryPagesWithControls
  },
  checks: {
    resourceHintsExist,
    euCardsOrListsUseThumbnails: euListThumbnailHits > 0,
    noEuFullImageMisuseInCardsOrLists: euListFullImageMisuseHits === 0,
    euCardFullImageLoadsNearViewport: euCardViewportProgressiveLoaderHits > 0,
    detailHeroPreloadExists: detailHeroPriorityImages > 0 && detailHeroPreloads === detailHeroPriorityImages,
    euDetailHeroProgressiveExists: euRecordsWithThumbnails.length > 0 && euProgressiveHeroImages === euRecordsWithThumbnails.length,
    noEuFullImageInitialHeroSrc: euInitialFullImageMisuseHits === 0,
    fetchpriorityHighNotOverusedOutsideDetailPages: homepageFetchpriorityHigh <= 1 && fetchpriorityHighOutsideDetailPages <= 1,
    detailGalleryControlsExist:
      detailGalleryPages === 0 || (detailGalleryPagesWithControls === detailGalleryPages && detailGallerySwitcherExists),
    detailGalleryKeyboardControlsExist: detailGalleryPages === 0 || detailGalleryKeyboardControlsExist
  }
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
