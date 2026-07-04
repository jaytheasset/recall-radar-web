import { readFile } from 'node:fs/promises';
import { isOfficialCanadaImageUrl, isSuspectedCanadaChromeImage } from './canada-detail-images.ts';

type SourceSummary = {
  source: string;
  totalRecords: number;
  recordsWithImageUrls: number;
  recordsWithoutImageUrls: number;
  recordsWithPrimaryImageUrl: number;
  recordsWithPrimaryImageThumbnailUrl: number;
  totalImageUrls: number;
  uniqueImageUrls: number;
  duplicateImageUrls: number;
  totalThumbnailImageUrls: number;
  uniqueThumbnailImageUrls: number;
  hosts: Map<string, number>;
  extensions: Map<string, number>;
  suspicious: Map<string, number>;
  officialImageUrlIssues: number;
  live?: LiveSummary;
  liveThumbnails?: LiveSummary;
};

type LiveSummary = {
  checked: number;
  okImage: number;
  empty2xx: number;
  nonImage2xx: number;
  redirect3xx: number;
  forbidden403: number;
  notFound404: number;
  timeout: number;
  other: number;
};

type RawObject = Record<string, unknown>;

const processedFiles = [
  'data/processed/recalls.json',
  'data/processed/eu-safety-gate-recalls.json',
  'data/processed/rappelconso-recalls.json',
  'data/processed/canada-recalls.json',
  'data/processed/uk-fsa-alerts.json',
  'data/processed/australia-product-safety-recalls.json',
  'data/processed/new-zealand-product-safety-recalls.json'
];

const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};
const liveCheck = runtimeEnv.IMAGE_LIVE_CHECK === '1';
const liveLimitPerSource = 20;
const liveTimeoutMs = 10000;

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function orderedObject(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

async function recordsFromFile(filePath: string): Promise<RawObject[]> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  const records = isObject(parsed) && Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed) ? parsed : [];
  return records.filter(isObject);
}

function sourceFor(record: RawObject, fallback: string): string {
  return stringValue(record.source) || fallback;
}

function addUrl(urls: string[], value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  for (const part of value.split(/[|\n;]/)) {
    urls.push(part.trim());
  }
}

function imageUrlsFor(record: RawObject): string[] {
  const urls: string[] = [];

  addUrl(urls, record.primaryImageUrl);

  if (Array.isArray(record.images)) {
    for (const image of record.images) {
      if (isObject(image)) {
        addUrl(urls, image.url);
        addUrl(urls, image.URL);
      }
    }
  }

  if (isObject(record.raw)) {
    addUrl(urls, record.raw.primaryImageUrl);
    addUrl(urls, record.raw.liens_vers_les_images);

    if (Array.isArray(record.raw.Images)) {
      for (const image of record.raw.Images) {
        if (isObject(image)) {
          addUrl(urls, image.url);
          addUrl(urls, image.URL);
        }
      }
    }
  }

  return urls.map((url) => url.trim()).filter((url, index, list) => url || list.indexOf(url) === index);
}

function thumbnailImageUrlsFor(record: RawObject): string[] {
  const urls: string[] = [];

  addUrl(urls, record.primaryImageThumbnailUrl);

  if (Array.isArray(record.images)) {
    for (const image of record.images) {
      if (isObject(image)) {
        addUrl(urls, image.thumbnailUrl);
        addUrl(urls, image.thumbnailURL);
        addUrl(urls, image.ThumbnailURL);
      }
    }
  }

  if (isObject(record.raw)) {
    addUrl(urls, record.raw.primaryImageThumbnailUrl);
  }

  return urls.map((url) => url.trim()).filter((url, index, list) => url && list.indexOf(url) === index);
}

function extensionFor(url: URL): string {
  const extension = url.pathname.match(/\.([a-z0-9]{2,6})$/i)?.[1]?.toLowerCase() ?? '';
  return extension || 'api-or-no-extension';
}

function suspiciousReasons(rawUrl: string): string[] {
  const reasons: string[] = [];
  const url = rawUrl.trim();

  if (!url) {
    return ['empty'];
  }

  if (url.startsWith('/')) {
    reasons.push('relative-url');
  }

  if (/^data:/i.test(url)) {
    reasons.push('data-url');
  }

  if (!/^https?:\/\//i.test(url)) {
    reasons.push('non-http-url');
  }

  try {
    const parsed = new URL(url);
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsed.hostname)) {
      reasons.push('localhost-url');
    }

    for (const key of parsed.searchParams.keys()) {
      if (/token|session|signature|sig|apikey|api_key|access_token|auth/i.test(key)) {
        reasons.push('token-like-param');
      }
    }
  } catch {
    reasons.push('invalid-url');
  }

  return reasons;
}

function getSummary(summaries: Map<string, SourceSummary>, source: string): SourceSummary {
  const existing = summaries.get(source);
  if (existing) {
    return existing;
  }

  const summary: SourceSummary = {
    source,
    totalRecords: 0,
    recordsWithImageUrls: 0,
    recordsWithoutImageUrls: 0,
    recordsWithPrimaryImageUrl: 0,
    recordsWithPrimaryImageThumbnailUrl: 0,
    totalImageUrls: 0,
    uniqueImageUrls: 0,
    duplicateImageUrls: 0,
    totalThumbnailImageUrls: 0,
    uniqueThumbnailImageUrls: 0,
    hosts: new Map(),
    extensions: new Map(),
    suspicious: new Map(),
    officialImageUrlIssues: 0
  };
  summaries.set(source, summary);
  return summary;
}

function sourceSpecificImageIssue(source: string, rawUrl: string): string {
  if (source === 'CA_RECALLS') {
    if (isSuspectedCanadaChromeImage(rawUrl)) {
      return 'suspected-canada-chrome-image';
    }

    return isOfficialCanadaImageUrl(rawUrl) ? '' : 'non-official-canada-image-url';
  }

  if (source === 'AU_PRODUCT_SAFETY') {
    try {
      const url = new URL(rawUrl);
      return url.hostname === 'www.productsafety.gov.au' &&
        /^\/system\/files\/(?:styles\/[^/]+\/)?(?:public|private)\//i.test(url.pathname)
        ? ''
        : 'non-official-australia-image-url';
    } catch {
      return 'non-official-australia-image-url';
    }
  }

  if (source === 'NZ_PRODUCT_SAFETY') {
    try {
      const url = new URL(rawUrl);
      return url.hostname === 'www.productsafety.govt.nz' && /^\/assets\/uploads\//i.test(url.pathname)
        ? ''
        : 'non-official-new-zealand-image-url';
    } catch {
      return 'non-official-new-zealand-image-url';
    }
  }

  return '';
}

async function fetchStatus(
  url: string
): Promise<'image' | 'empty-2xx' | 'non-image-2xx' | '3xx' | '403' | '404' | 'timeout' | 'other'> {
  let lastStatus: 'image' | 'empty-2xx' | 'non-image-2xx' | '3xx' | '403' | '404' | 'timeout' | 'other' = 'other';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), liveTimeoutMs);

    try {
      const parsedUrl = new URL(url);
      const headers: Record<string, string> = {
        accept: 'image/*,*/*',
        'user-agent': 'Recall Radar image audit',
        range: 'bytes=0-1024'
      };

      if (parsedUrl.hostname === 'ec.europa.eu') {
        headers.language = 'en';
        headers.lang = 'en';
        headers.origin = 'https://ec.europa.eu';
        headers.referer = 'https://ec.europa.eu/safety-gate-alerts/screen/webReport';
      }

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers
      });
      const body = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') ?? '';

      if (response.status >= 200 && response.status < 300) {
        if (body.length === 0) {
          lastStatus = 'empty-2xx';
        } else {
          lastStatus = /^image\//i.test(contentType) ? 'image' : 'non-image-2xx';
        }
      } else if (response.status >= 300 && response.status < 400) {
        lastStatus = '3xx';
      } else if (response.status === 403) {
        lastStatus = '403';
      } else if (response.status === 404) {
        lastStatus = '404';
      } else {
        lastStatus = 'other';
      }
    } catch (error) {
      lastStatus = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'other';
    } finally {
      clearTimeout(timeout);
    }

    if (lastStatus === 'image') {
      return lastStatus;
    }
  }

  return lastStatus;
}

function incrementLive(summary: LiveSummary, status: Awaited<ReturnType<typeof fetchStatus>>): void {
  summary.checked += 1;
  if (status === 'image') {
    summary.okImage += 1;
  } else if (status === 'empty-2xx') {
    summary.empty2xx += 1;
  } else if (status === 'non-image-2xx') {
    summary.nonImage2xx += 1;
  } else if (status === '3xx') {
    summary.redirect3xx += 1;
  } else if (status === '403') {
    summary.forbidden403 += 1;
  } else if (status === '404') {
    summary.notFound404 += 1;
  } else if (status === 'timeout') {
    summary.timeout += 1;
  } else {
    summary.other += 1;
  }
}

async function run(): Promise<void> {
  const summaries = new Map<string, SourceSummary>();
  const sourceFullUrls = new Map<string, string[]>();
  const sourceThumbnailUrls = new Map<string, string[]>();

  for (const file of processedFiles) {
    const records = await recordsFromFile(file);
    const fallbackSource = file.includes('eu-safety-gate')
      ? 'EU_SAFETY_GATE'
      : file.includes('rappelconso')
        ? 'FR_RAPPELCONSO'
        : file.includes('canada')
          ? 'CA_RECALLS'
          : file.includes('uk-fsa')
            ? 'UK_FSA'
            : file.includes('australia-product-safety')
              ? 'AU_PRODUCT_SAFETY'
              : file.includes('new-zealand-product-safety')
                ? 'NZ_PRODUCT_SAFETY'
              : 'UNKNOWN';

    for (const record of records) {
      const source = sourceFor(record, fallbackSource);

      if (file !== 'data/processed/recalls.json') {
        continue;
      }

      const summary = getSummary(summaries, source);
      const fullUrls = imageUrlsFor(record);
      const thumbnailUrls = thumbnailImageUrlsFor(record);
      const urls = [...fullUrls, ...thumbnailUrls];
      const uniqueUrls = [...new Set(urls.filter(Boolean))];
      const uniqueThumbnailUrls = [...new Set(thumbnailUrls.filter(Boolean))];
      summary.totalRecords += 1;
      summary.totalImageUrls += urls.length;
      summary.uniqueImageUrls += uniqueUrls.length;
      summary.duplicateImageUrls += urls.length - uniqueUrls.length;
      summary.totalThumbnailImageUrls += thumbnailUrls.length;
      summary.uniqueThumbnailImageUrls += uniqueThumbnailUrls.length;

      if (uniqueUrls.length) {
        summary.recordsWithImageUrls += 1;
      } else {
        summary.recordsWithoutImageUrls += 1;
      }

      if (stringValue(record.primaryImageUrl)) {
        summary.recordsWithPrimaryImageUrl += 1;
      }

      if (stringValue(record.primaryImageThumbnailUrl)) {
        summary.recordsWithPrimaryImageThumbnailUrl += 1;
      }

      for (const url of urls) {
        for (const reason of suspiciousReasons(url)) {
          count(summary.suspicious, reason);
        }

        const sourceIssue = sourceSpecificImageIssue(source, url);
        if (sourceIssue) {
          summary.officialImageUrlIssues += 1;
          count(summary.suspicious, sourceIssue);
        }

        try {
          const parsed = new URL(url);
          count(summary.hosts, parsed.hostname);
          count(summary.extensions, extensionFor(parsed));
        } catch {
          // Suspicious reasons already capture invalid URLs.
        }
      }

      sourceFullUrls.set(source, [...(sourceFullUrls.get(source) ?? []), ...new Set(fullUrls.filter(Boolean))]);
      sourceThumbnailUrls.set(source, [...(sourceThumbnailUrls.get(source) ?? []), ...uniqueThumbnailUrls]);
    }
  }

  if (liveCheck) {
    for (const [source, urls] of sourceFullUrls.entries()) {
      const summary = getSummary(summaries, source);
      summary.live = {
        checked: 0,
        okImage: 0,
        empty2xx: 0,
        nonImage2xx: 0,
        redirect3xx: 0,
        forbidden403: 0,
        notFound404: 0,
        timeout: 0,
        other: 0
      };

      for (const url of [...new Set(urls)].slice(0, liveLimitPerSource)) {
        incrementLive(summary.live, await fetchStatus(url));
      }
    }

    for (const [source, urls] of sourceThumbnailUrls.entries()) {
      const summary = getSummary(summaries, source);
      summary.liveThumbnails = {
        checked: 0,
        okImage: 0,
        empty2xx: 0,
        nonImage2xx: 0,
        redirect3xx: 0,
        forbidden403: 0,
        notFound404: 0,
        timeout: 0,
        other: 0
      };

      for (const url of [...new Set(urls)].slice(0, liveLimitPerSource)) {
        incrementLive(summary.liveThumbnails, await fetchStatus(url));
      }
    }
  }

  console.log(`Image audit mode: ${liveCheck ? 'live bounded check enabled' : 'local metadata only'}`);
  console.log(`Files read: ${processedFiles.join(', ')}`);
  console.log('');

  for (const summary of [...summaries.values()].sort((a, b) => a.source.localeCompare(b.source))) {
    console.log(`${summary.source}`);
    console.log(`  total records: ${summary.totalRecords}`);
    console.log(`  records with image URLs: ${summary.recordsWithImageUrls}`);
    console.log(`  records with no image URLs: ${summary.recordsWithoutImageUrls}`);
    console.log(`  records with primaryImageUrl: ${summary.recordsWithPrimaryImageUrl}`);
    console.log(`  records with primaryImageThumbnailUrl: ${summary.recordsWithPrimaryImageThumbnailUrl}`);
    console.log(`  total image URL references: ${summary.totalImageUrls}`);
    console.log(`  unique image URL references: ${summary.uniqueImageUrls}`);
    console.log(`  duplicate image URL references: ${summary.duplicateImageUrls}`);
    console.log(`  total thumbnail URL references: ${summary.totalThumbnailImageUrls}`);
    console.log(`  unique thumbnail URL references: ${summary.uniqueThumbnailImageUrls}`);
    console.log(`  hosts: ${JSON.stringify(orderedObject(summary.hosts))}`);
    console.log(`  extensions/types: ${JSON.stringify(orderedObject(summary.extensions))}`);
    console.log(`  suspicious: ${JSON.stringify(orderedObject(summary.suspicious))}`);
    console.log(`  official image URL issues: ${summary.officialImageUrlIssues}`);

    if (summary.live) {
      console.log(`  live full image sample: ${JSON.stringify(summary.live)}`);
    }

    if (summary.liveThumbnails) {
      console.log(`  live thumbnail image sample: ${JSON.stringify(summary.liveThumbnails)}`);
    }

    console.log('');
  }

  const blockers = [...summaries.values()].flatMap((summary) => {
    const failures: string[] = [];
    if (summary.live && summary.live.checked !== summary.live.okImage) {
      failures.push(`${summary.source} full image live sample has ${summary.live.checked - summary.live.okImage} non-image responses.`);
    }
    if (summary.liveThumbnails && summary.liveThumbnails.checked !== summary.liveThumbnails.okImage) {
      failures.push(
        `${summary.source} thumbnail image live sample has ${summary.liveThumbnails.checked - summary.liveThumbnails.okImage} non-image responses.`
      );
    }
    if (summary.source === 'CA_RECALLS' && summary.officialImageUrlIssues > 0) {
      failures.push(`CA_RECALLS image audit found ${summary.officialImageUrlIssues} non-official or chrome image URL issue(s).`);
    }
    if (summary.source === 'AU_PRODUCT_SAFETY' && summary.officialImageUrlIssues > 0) {
      failures.push(`AU_PRODUCT_SAFETY image audit found ${summary.officialImageUrlIssues} non-official image URL issue(s).`);
    }
    if (summary.source === 'NZ_PRODUCT_SAFETY' && summary.officialImageUrlIssues > 0) {
      failures.push(`NZ_PRODUCT_SAFETY image audit found ${summary.officialImageUrlIssues} non-official image URL issue(s).`);
    }
    return failures;
  });

  if (blockers.length) {
    console.error(blockers.join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log('PASS image audit completed');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
