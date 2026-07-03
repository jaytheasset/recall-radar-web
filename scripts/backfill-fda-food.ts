import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall } from '../src/data/recall-types.ts';
import { extractFdaFoodRecords, normalizeFdaFoodRecords, type FdaFoodRecallRaw } from './normalize-fda-food.ts';

const endpointBase = 'https://api.fda.gov/food/enforcement.json';
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutDir = 'data/backfill/fda-food';
const maxSafePageSize = 100;
const sampleRecordLimit = 5;
const sampleRecallNumberLimit = 15;

type Options = {
  dryRun: boolean;
  fromDate: string | null;
  toDate: string | null;
  pageSize: number;
  maxPages: number;
  maxRecords: number;
  delayMs: number;
  outDir: string;
  writeChunks: boolean;
  writeCheckpoint: boolean;
  resume: boolean;
};

type FetchJsonResult = {
  endpoint: string;
  httpStatus: number | null;
  ok: boolean;
  retryable: boolean;
  json: unknown;
  error: string | null;
  openFdaError: unknown;
};

type OpenFdaPayload = {
  meta?: {
    results?: {
      total?: unknown;
      skip?: unknown;
      limit?: unknown;
    };
  };
  results?: unknown;
  error?: unknown;
};

type PageResult = {
  pageIndex: number;
  skip: number;
  endpoint: string;
  httpStatus: number | null;
  retryable: boolean;
  rawRecords: FdaFoodRecallRaw[];
  normalizedRecords: NormalizedRecall[];
  error: string | null;
  openFdaError: unknown;
};

type Checkpoint = {
  generatedAt: string;
  fromDate: string | null;
  toDate: string | null;
  lastSuccessfulPage: number;
  lastSkip: number;
  recordsFetched: number;
  normalizedRecords: number;
  completed: boolean;
  nextSkip: number;
  warnings: string[];
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (/^(true|1|yes)$/i.test(value)) {
    return true;
  }

  if (/^(false|0|no)$/i.test(value)) {
    return false;
  }

  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  return /^\d{8}$/.test(text) ? text : null;
}

function getOptions(): Options {
  const pageSize = Math.min(parsePositiveInt(readOption('page-size'), 100), maxSafePageSize);

  return {
    dryRun: parseBoolean(readOption('dry-run'), true),
    fromDate: parseDate(readOption('from-date')),
    toDate: parseDate(readOption('to-date')),
    pageSize,
    maxPages: parsePositiveInt(readOption('max-pages'), 3),
    maxRecords: parsePositiveInt(readOption('max-records'), 300),
    delayMs: parsePositiveInt(readOption('delay-ms'), 250),
    outDir: readOption('out-dir')?.trim() || defaultOutDir,
    writeChunks: parseBoolean(readOption('write-chunks'), false),
    writeCheckpoint: parseBoolean(readOption('write-checkpoint'), false),
    resume: parseBoolean(readOption('resume'), false)
  };
}

function asPayload(json: unknown): OpenFdaPayload {
  return json && typeof json === 'object' ? (json as OpenFdaPayload) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function totalFrom(json: unknown): number | null {
  return asNumber(asPayload(json).meta?.results?.total);
}

function buildUrl(options: Options, skip: number): URL {
  const url = new URL(endpointBase);
  const hasDateWindow = Boolean(options.fromDate && options.toDate);

  if (hasDateWindow) {
    url.searchParams.set('search', `report_date:[${options.fromDate} TO ${options.toDate}]`);
  }

  url.searchParams.set('sort', 'report_date:desc');
  url.searchParams.set('limit', String(options.pageSize));
  url.searchParams.set('skip', String(skip));
  return url;
}

function isRetryableStatus(status: number | null): boolean {
  return status === null || status === 408 || status === 429 || (typeof status === 'number' && status >= 500);
}

async function fetchJson(url: URL): Promise<FetchJsonResult> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar FDA food backfill dry run'
      }
    });
    const text = await response.text();
    let json: unknown = null;

    try {
      json = text.trim() ? (JSON.parse(text) as unknown) : null;
    } catch (error) {
      return {
        endpoint: url.toString(),
        httpStatus: response.status,
        ok: false,
        retryable: isRetryableStatus(response.status),
        json: null,
        error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        openFdaError: null
      };
    }

    return {
      endpoint: url.toString(),
      httpStatus: response.status,
      ok: response.ok,
      retryable: isRetryableStatus(response.status),
      json,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
      openFdaError: asPayload(json).error ?? null
    };
  } catch (error) {
    return {
      endpoint: url.toString(),
      httpStatus: null,
      ok: false,
      retryable: true,
      json: null,
      error: error instanceof Error ? error.message : String(error),
      openFdaError: null
    };
  }
}

function increment(map: Record<string, number>, key: string): void {
  const label = key || '(missing)';
  map[label] = (map[label] ?? 0) + 1;
}

function sortedCounts(map: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function rawField(record: FdaFoodRecallRaw, field: keyof FdaFoodRecallRaw): string {
  return asString(record[field]);
}

function dateRange(values: string[]): { min: string | null; max: string | null } {
  const valid = values.filter((value) => /^\d{8}$/.test(value)).sort();
  return {
    min: valid[0] ?? null,
    max: valid[valid.length - 1] ?? null
  };
}

function duplicateSummary(values: string[]): { duplicateKeys: number; duplicateRecords: number; samples: string[] } {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

  return {
    duplicateKeys: duplicates.length,
    duplicateRecords: duplicates.reduce((total, [, count]) => total + count - 1, 0),
    samples: duplicates.map(([value]) => value).slice(0, 10)
  };
}

function sampleNormalized(record: NormalizedRecall) {
  return {
    id: record.id,
    source: record.source,
    sourceUrl: record.sourceUrl,
    title: record.title,
    brandNames: record.brandNames,
    productNames: record.productNames,
    category: record.category,
    hazard: record.hazard,
    recallDate: record.recallDate,
    slug: record.slug,
    recallNumber: record.recallNumber,
    status: record.status,
    classification: record.classification
  };
}

function yearFor(options: Options): string {
  return options.fromDate?.slice(0, 4) || 'latest';
}

function pageFileName(options: Options, pageNumber: number, suffix: string): string {
  const from = options.fromDate ?? 'latest';
  const to = options.toDate ?? 'latest';
  return `fda-food-${from}-${to}-page-${String(pageNumber).padStart(4, '0')}${suffix}`;
}

function absoluteOutDir(options: Options): string {
  return resolve(projectRoot, options.outDir);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readCheckpoint(options: Options): Promise<Checkpoint | null> {
  const path = resolve(absoluteOutDir(options), 'checkpoints', 'fda-food-backfill-checkpoint.json');

  try {
    return JSON.parse(await readFile(path, 'utf8')) as Checkpoint;
  } catch {
    return null;
  }
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function writePageChunks(options: Options, page: PageResult, pageNumber: number): Promise<void> {
  if (options.dryRun || !options.writeChunks) {
    return;
  }

  const outDir = absoluteOutDir(options);
  const year = yearFor(options);
  await writeJson(resolve(outDir, 'raw', year, pageFileName(options, pageNumber, '.json')), {
    generatedAt: new Date().toISOString(),
    endpoint: page.endpoint,
    httpStatus: page.httpStatus,
    count: page.rawRecords.length,
    records: page.rawRecords
  });
  await writeJson(resolve(outDir, 'processed', year, pageFileName(options, pageNumber, '.processed.json')), {
    generatedAt: new Date().toISOString(),
    source: 'FDA',
    endpoint: page.endpoint,
    count: page.normalizedRecords.length,
    records: page.normalizedRecords
  });
}

async function writeCheckpoint(options: Options, checkpoint: Checkpoint): Promise<void> {
  if (options.dryRun || !options.writeCheckpoint) {
    return;
  }

  await writeJson(resolve(absoluteOutDir(options), 'checkpoints', 'fda-food-backfill-checkpoint.json'), checkpoint);
}

async function writeManifest(options: Options, report: unknown): Promise<void> {
  if (options.dryRun || !options.writeChunks) {
    return;
  }

  await writeJson(resolve(absoluteOutDir(options), 'manifest.json'), report);
}

async function run(): Promise<void> {
  const options = getOptions();
  const warnings: string[] = [];
  const hasDateWindow = Boolean(options.fromDate && options.toDate);
  let startSkip = 0;

  if ((options.fromDate && !options.toDate) || (!options.fromDate && options.toDate)) {
    warnings.push('Incomplete date range ignored; provide both --from-date and --to-date for date-window mode.');
  }

  if (!hasDateWindow) {
    warnings.push('No date range provided; using latest sample mode instead of all-history backfill.');
  }

  if (!options.dryRun && !options.writeChunks) {
    warnings.push('dry-run=false but write-chunks=false; this run will fetch bounded pages without writing chunks.');
  }

  if (options.resume) {
    const checkpoint = await readCheckpoint(options);
    if (checkpoint) {
      startSkip = checkpoint.nextSkip;
      warnings.push(`Resume enabled; continuing from checkpoint nextSkip=${checkpoint.nextSkip}.`);
    } else {
      warnings.push('Resume enabled but no checkpoint was found; starting from skip=0.');
    }
  }

  const pageResults: PageResult[] = [];
  let totalAvailableFromFirstPage: number | null = null;
  let stopReason = 'max-pages reached';

  for (let pageIndex = 0; pageIndex < options.maxPages; pageIndex += 1) {
    const skip = startSkip + pageIndex * options.pageSize;
    const url = buildUrl(options, skip);
    const result = await fetchJson(url);
    const rawRecords = result.ok ? extractFdaFoodRecords(result.json) : [];
    const limitedRawRecords =
      pageResults.reduce((total, page) => total + page.rawRecords.length, 0) + rawRecords.length > options.maxRecords
        ? rawRecords.slice(0, Math.max(options.maxRecords - pageResults.reduce((total, page) => total + page.rawRecords.length, 0), 0))
        : rawRecords;
    const normalizedRecords = normalizeFdaFoodRecords(limitedRawRecords);
    const page: PageResult = {
      pageIndex,
      skip,
      endpoint: result.endpoint,
      httpStatus: result.httpStatus,
      retryable: result.retryable,
      rawRecords: limitedRawRecords,
      normalizedRecords,
      error: result.error,
      openFdaError: result.openFdaError
    };

    if (pageIndex === 0) {
      totalAvailableFromFirstPage = result.ok ? totalFrom(result.json) : null;
    }

    pageResults.push(page);

    if (result.error) {
      warnings.push(`Page ${pageIndex} failed: ${result.error}`);
      stopReason = result.retryable ? 'retryable error' : 'non-retryable error';
      break;
    }

    await writePageChunks(options, page, pageIndex + 1);

    const recordsFetched = pageResults.reduce((total, current) => total + current.rawRecords.length, 0);
    const completed = rawRecords.length < options.pageSize || recordsFetched >= options.maxRecords;
    const checkpoint: Checkpoint = {
      generatedAt: new Date().toISOString(),
      fromDate: hasDateWindow ? options.fromDate : null,
      toDate: hasDateWindow ? options.toDate : null,
      lastSuccessfulPage: pageIndex,
      lastSkip: skip,
      recordsFetched,
      normalizedRecords: pageResults.reduce((total, current) => total + current.normalizedRecords.length, 0),
      completed,
      nextSkip: skip + rawRecords.length,
      warnings
    };
    await writeCheckpoint(options, checkpoint);

    if (completed) {
      stopReason = rawRecords.length < options.pageSize ? 'last page had fewer records than page-size' : 'max-records reached';
      break;
    }

    if (pageIndex < options.maxPages - 1) {
      await delay(options.delayMs);
    }
  }

  const rawRecords = pageResults.flatMap((page) => page.rawRecords);
  const normalizedRecords = pageResults.flatMap((page) => page.normalizedRecords);
  const classificationCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const record of rawRecords) {
    increment(classificationCounts, rawField(record, 'classification'));
    increment(statusCounts, rawField(record, 'status'));
  }

  for (const record of normalizedRecords) {
    increment(categoryCounts, record.category);
  }

  const reportDateRange = dateRange(rawRecords.map((record) => rawField(record, 'report_date')));
  const recallInitiationDateRange = dateRange(rawRecords.map((record) => rawField(record, 'recall_initiation_date')));
  const duplicateRecallNumbers = duplicateSummary(rawRecords.map((record) => rawField(record, 'recall_number')));
  const duplicateEventIds = duplicateSummary(rawRecords.map((record) => rawField(record, 'event_id')));
  const duplicateNormalizedIds = duplicateSummary(normalizedRecords.map((record) => record.id));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : options.writeChunks ? 'write-chunks' : 'fetch-only',
    endpointBase,
    fromDate: hasDateWindow ? options.fromDate : null,
    toDate: hasDateWindow ? options.toDate : null,
    pageSize: options.pageSize,
    maxPages: options.maxPages,
    maxRecords: options.maxRecords,
    delayMs: options.delayMs,
    outDir: options.outDir,
    writeChunks: options.writeChunks,
    writeCheckpoint: options.writeCheckpoint,
    resume: options.resume,
    totalAvailableFromFirstPage,
    pagesFetched: pageResults.length,
    recordsFetched: rawRecords.length,
    normalizedRecords: normalizedRecords.length,
    duplicateRecallNumbers,
    duplicateEventIds,
    duplicateNormalizedIds,
    classificationCounts: sortedCounts(classificationCounts),
    statusCounts: sortedCounts(statusCounts),
    categoryCounts: sortedCounts(categoryCounts),
    reportDateRange,
    recallInitiationDateRange,
    sampleRecallNumbers: rawRecords.map((record) => rawField(record, 'recall_number')).filter(Boolean).slice(0, sampleRecallNumberLimit),
    sampleNormalizedRecords: normalizedRecords.slice(0, sampleRecordLimit).map(sampleNormalized),
    pages: pageResults.map((page) => ({
      pageIndex: page.pageIndex,
      skip: page.skip,
      endpoint: page.endpoint,
      httpStatus: page.httpStatus,
      retryable: page.retryable,
      rawRecords: page.rawRecords.length,
      normalizedRecords: page.normalizedRecords.length,
      error: page.error,
      openFdaError: page.openFdaError
    })),
    stopReason,
    warnings,
    nextRecommendedCommand: hasDateWindow
      ? 'npm run audit:fda-food-backfill'
      : 'npm run backfill:fda-food -- --from-date=20260101 --to-date=20261231 --max-pages=2 --page-size=100'
  };

  await writeManifest(options, report);
  console.log(JSON.stringify(report, null, 2));

  if (pageResults.length === 0 || (pageResults[0]?.error && rawRecords.length === 0)) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
