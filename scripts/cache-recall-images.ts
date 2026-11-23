import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { officialRecallImages, officialRecallImageUrl } from '../src/lib/official-recall-images.ts';
import { recallImageCacheDirectory, recallImageCacheFilename, savedRecallImageUrls } from '../src/lib/recall-image-cache.ts';
import { readLocalJson, readLocalRecallInputs, writeLocalJson } from './refresh-local-recall-inputs.ts';

type ImageFailure = { message: string; checkedAt: string; retryAt: string };
type ImageReport = {
  failures: Record<string, ImageFailure>;
  pausedHosts?: Record<string, string>;
  thumbnailFallbacks?: Record<string, string>;
};

const maxDownloadBytes = 24 * 1024 * 1024;
const dayMs = 86_400_000;
const imageFormats = new Set(['jpeg', 'png', 'webp', 'gif', 'tiff', 'heif', 'avif']);

class ImageHttpError extends Error {
  status: number;
  retryAfter: number;

  constructor(status: number, retryAfter: string | null) {
    super(`HTTP ${status}`);
    this.status = status;
    const delayMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1_000 : Date.parse(retryAfter ?? '') - Date.now();
    this.retryAfter = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  }
}

async function downloadImage(sourceUrl: string): Promise<Buffer> {
  const signal = AbortSignal.timeout(18_000);
  let url = sourceUrl;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      const next = location && officialRecallImageUrl(new URL(location, url).href);
      if (!next || next === url) throw new Error('Image redirected outside its official source or back to itself.');
      url = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ImageHttpError(response.status, response.headers.get('retry-after'));
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (/^text\/|json|xml|svg/i.test(contentType) || Number(response.headers.get('content-length')) > maxDownloadBytes) {
      await response.body?.cancel();
      throw new Error('Response was not a supported image or exceeded the download limit.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty image response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxDownloadBytes) {
        await reader.cancel();
        throw new Error('Image exceeded the download limit.');
      }
      chunks.push(value);
    }
    if (!size) throw new Error('Empty image response.');
    return Buffer.concat(chunks, size);
  }
  throw new Error('Too many image redirects.');
}

async function convertImage(sourceUrl: string): Promise<Buffer> {
  const input = await downloadImage(sourceUrl);
  const options = { animated: true, limitInputPixels: 32_000_000 };
  const metadata = await sharp(input, options).metadata();
  if (!metadata.format || !imageFormats.has(metadata.format)) throw new Error('Unsupported image format.');
  const image = sharp(input, options).timeout({ seconds: 20 });
  if ((metadata.pages ?? 1) < 2) image.rotate();
  return image.resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 81, effort: 3 }).toBuffer();
}

function shouldPauseSource(error: unknown): error is ImageHttpError {
  return error instanceof ImageHttpError && (error.status === 429 || error.retryAfter > 0);
}

async function saveWebp(sourceUrl: string, thumbnailUrl: string | undefined, outputPath: string, temporaryPath: string) {
  let output: Buffer;
  let thumbnailUsed: string | undefined;
  try {
    output = await convertImage(sourceUrl);
  } catch (error) {
    if (!thumbnailUrl || shouldPauseSource(error)) throw error;
    try {
      output = await convertImage(thumbnailUrl);
      thumbnailUsed = thumbnailUrl;
    } catch (thumbnailError) {
      throw shouldPauseSource(thumbnailError) ? thumbnailError : error;
    }
  }
  try {
    await writeFile(temporaryPath, output);
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return thumbnailUsed;
}

async function acquireImageLock(path: string) {
  try {
    return await open(path, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const owner = Number(await readFile(path, 'utf8').catch(() => ''));
    if (Number.isSafeInteger(owner) && owner > 0) {
      try {
        process.kill(owner, 0);
        return;
      } catch (probeError) {
        if ((probeError as NodeJS.ErrnoException).code !== 'ESRCH') return;
      }
    } else {
      const lockInfo = await stat(path).catch(() => undefined);
      if (!lockInfo || Date.now() - lockInfo.mtimeMs < 30_000) return;
    }
    await rm(path, { force: true });
    return await open(path, 'wx').catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
}

export async function cacheRecallImages(
  root: string,
  outputDir: string,
  records: NormalizedRecall[],
  { limit = Infinity, plan = false, retry = false }: { limit?: number; plan?: boolean; retry?: boolean } = {}
) {
  const images = new Map<string, string | undefined>();
  for (const record of records) {
    for (const { url, thumbnailUrl } of officialRecallImages(record)) {
      if (!images.get(url)) images.set(url, thumbnailUrl === url ? undefined : thumbnailUrl);
    }
  }
  const urls = [...images.keys()];
  const assetDir = join(root, recallImageCacheDirectory);
  const reportPath = join(outputDir, 'image-cache-report.json');
  if (!plan) await mkdir(outputDir, { recursive: true });
  const lockPath = join(outputDir, 'image-cache.lock');
  const lock = plan ? undefined : await acquireImageLock(lockPath);
  if (!plan && !lock) return { imageCache: 'already running' };

  try {
    await lock?.writeFile(String(process.pid));
    await lock?.sync();
    const existing = new Set((await readdir(assetDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })).filter((name) => /^[\da-f]{32}\.webp$/.test(name)));
    const previous = await readLocalJson<ImageReport>(reportPath);
    const failures = new Map(Object.entries(previous?.failures ?? {}));
    const thumbnailFallbacks = new Map(Object.entries(previous?.thumbnailFallbacks ?? {}));
    const pausedHosts = new Map(Object.entries(previous?.pausedHosts ?? {})
      .filter(([, retryAt]) => Date.parse(retryAt) > Date.now()));
    const buckets = new Map<string, string[]>();
    let reused = 0;
    let deferred = 0;
    for (const url of urls) {
      const host = new URL(url).hostname;
      const failure = failures.get(url);
      const retryEligible = retry && failure && failure.message !== 'HTTP 429' &&
        (images.get(url) || /fetch failed|timeout|HTTP 5\d\d/i.test(failure.message));
      if (savedRecallImageUrls.has(url) || existing.has(recallImageCacheFilename(url))) {
        reused++;
        failures.delete(url);
      } else if (pausedHosts.has(host) || (!retryEligible && Date.parse(failure?.retryAt ?? '') > Date.now())) {
        deferred++;
      } else {
        if (!buckets.has(host)) buckets.set(host, []);
        buckets.get(host)!.push(url);
      }
    }
    const summary = { candidates: urls.length, reused, deferred, attempted: 0, converted: 0, failed: 0, pending: urls.length - reused - deferred };
    let availableSlots = limit;
    if (plan) return { ...summary, pending: urls.length - reused - deferred, hosts: Object.fromEntries([...buckets].map(([host, entries]) => [host, entries.length])) };
    console.log(JSON.stringify({ imageCache: 'started', ...summary, pending: urls.length - reused - deferred }));
    await mkdir(assetDir, { recursive: true });
    sharp.concurrency(1);
    sharp.cache(false);
    let checkpoint = Promise.resolve();
    const saveReport = () => {
      const report = {
        ...summary,
        updatedAt: new Date().toISOString(),
        failures: Object.fromEntries(failures),
        pausedHosts: Object.fromEntries(pausedHosts),
        thumbnailFallbacks: Object.fromEntries(thumbnailFallbacks)
      };
      checkpoint = checkpoint.then(() => writeLocalJson(reportPath, report));
      return checkpoint;
    };

    await Promise.all([...buckets].map(async ([host, entries]) => {
      let next = 0;
      let nextSlot = 0;
      let hostPaused = false;
      await Promise.all(Array.from({ length: Math.min(5, entries.length) }, async () => {
        while (next < entries.length && availableSlots > 0 && !hostPaused) {
          const url = entries[next++];
          const slot = Math.max(nextSlot, Date.now());
          nextSlot = slot + 170;
          if (slot > Date.now()) await delay(slot - Date.now());
          if (hostPaused || availableSlots <= 0) return;
          availableSlots--;
          const filename = recallImageCacheFilename(url);
          try {
            const thumbnail = await saveWebp(url, images.get(url), join(assetDir, filename), join(outputDir, `${filename}.${process.pid}.tmp`));
            if (thumbnail) thumbnailFallbacks.set(url, thumbnail);
            else thumbnailFallbacks.delete(url);
            failures.delete(url);
            summary.converted++;
          } catch (error) {
            const http = error instanceof ImageHttpError ? error : undefined;
            const retryAfter = http?.status === 429 ? Math.max(http.retryAfter, 15 * 60_000)
              : Math.max(http?.retryAfter ?? 0, http && [403, 404, 410].includes(http.status) ? 7 * dayMs : dayMs);
            failures.set(url, {
              message: error instanceof Error ? error.message : String(error),
              checkedAt: new Date().toISOString(),
              retryAt: new Date(Date.now() + retryAfter).toISOString()
            });
            summary.failed++;
            if (shouldPauseSource(error)) {
              hostPaused = true;
              const retryAt = new Date(Date.now() + Math.max(error.retryAfter, 15 * 60_000)).toISOString();
              pausedHosts.set(host, retryAt);
              console.log(JSON.stringify({ imageCache: 'source paused', host, retryAt, status: error.status }));
            }
          }
          summary.attempted++;
          summary.pending--;
          if (summary.attempted % 200 === 0) {
            console.log(JSON.stringify({ imageCache: 'progress', ...summary }));
            await saveReport();
          }
        }
      }));
    }));
    await saveReport();
    return summary;
  } finally {
    if (lock) {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: {
    plan: { type: 'boolean' }, retry: { type: 'boolean' }, limit: { type: 'string' }
  } });
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (values.limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error('--limit must be a positive integer.');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outputDir = join(root, 'outputs', 'llm-classifier', 'local');
  const [baseline, latest] = await Promise.all([
    readLocalJson<ProcessedRecallFile>(join(root, 'data', 'processed', 'recalls.json')),
    readLocalRecallInputs(outputDir)
  ]);
  if (!baseline?.records.length) throw new Error('Project recall snapshot is missing.');
  console.log(JSON.stringify(await cacheRecallImages(root, outputDir, [...baseline.records, ...latest], { ...values, limit })));
}
