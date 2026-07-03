import { readFile } from 'node:fs/promises';
import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  defaultEuSafetyGateProcessedPath,
  defaultRawEuSafetyGatePath,
  extractEuSafetyGateRecords,
  writeNormalizedEuSafetyGateRecalls,
  type EuSafetyGateRaw
} from './normalize-eu-safety-gate.ts';

const mostRecentEndpoint = 'https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?';
const detailEndpointBase = 'https://ec.europa.eu/safety-gate-alerts/public/api/notification/';
const officialReferer = 'https://ec.europa.eu/safety-gate-alerts/screen/webReport';
const defaultLimit = 100;
const maxLimit = 300;
const detailConcurrency = 8;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

type FetchOptions = {
  limit: number;
  refreshExistingRecordIds: boolean;
};

type PagePayload = {
  content?: EuSafetyGateRaw[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  last?: boolean;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.EU_SAFETY_GATE_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;
  const refreshExistingRecordIds =
    process.argv.includes('--refresh-existing-record-ids') || process.argv.includes('--existing-record-ids');

  return { limit, refreshExistingRecordIds };
}

function commonHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    language: 'en',
    lang: 'en',
    origin: 'https://ec.europa.eu',
    referer: officialReferer,
    'user-agent': 'Recall Radar EU Safety Gate source spike'
  };
}

async function fetchJson(endpoint: string, init: RequestInit, label: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(endpoint, {
        ...init,
        signal: controller.signal
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status} ${response.statusText}: ${text.slice(0, 220)}`);
      }

      if (!text.trim()) {
        throw new Error(`${label} returned an empty response.`);
      }

      return JSON.parse(text) as unknown;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `${label} request failed before data could be saved: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function fetchMostRecentPage(page: number): Promise<PagePayload> {
  const payload = await fetchJson(
    mostRecentEndpoint,
    {
      method: 'POST',
      headers: commonHeaders(),
      body: JSON.stringify({ language: 'en', page: String(page) })
    },
    `EU Safety Gate most recent page ${page}`
  );

  return payload && typeof payload === 'object' ? (payload as PagePayload) : {};
}

async function fetchNotificationDetail(summary: EuSafetyGateRaw): Promise<EuSafetyGateRaw> {
  const id = typeof summary.id === 'string' || typeof summary.id === 'number' ? String(summary.id) : '';
  if (!id) {
    throw new Error(`EU Safety Gate summary record is missing id: ${JSON.stringify(summary).slice(0, 220)}`);
  }

  const payload = await fetchJson(
    `${detailEndpointBase}${encodeURIComponent(id)}?language=en`,
    {
      method: 'GET',
      headers: commonHeaders()
    },
    `EU Safety Gate detail ${id}`
  );

  if (!payload || typeof payload !== 'object') {
    throw new Error(`EU Safety Gate detail ${id} returned a non-object payload.`);
  }

  return payload as EuSafetyGateRaw;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function collectMostRecentSummaries(limit: number): Promise<{ records: EuSafetyGateRaw[]; totalAvailable: number }> {
  const records: EuSafetyGateRaw[] = [];
  let page = 0;
  let totalAvailable = 0;

  while (records.length < limit) {
    const pagePayload = await fetchMostRecentPage(page);
    const pageRecords = extractEuSafetyGateRecords(pagePayload);

    if (page === 0) {
      totalAvailable = Number(pagePayload.totalElements ?? pageRecords.length);
    }

    if (pageRecords.length === 0) {
      break;
    }

    records.push(...pageRecords);

    if (pagePayload.last === true) {
      break;
    }

    page += 1;
  }

  return {
    records: records.slice(0, limit),
    totalAvailable
  };
}

async function collectExistingRawSummaries(): Promise<EuSafetyGateRaw[]> {
  const rawText = await readFile(defaultRawEuSafetyGatePath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const existingRecords = extractEuSafetyGateRecords(rawPayload);

  if (existingRecords.length === 0) {
    throw new Error('No existing EU Safety Gate raw records found; existing data was not overwritten.');
  }

  return existingRecords.map((record) => ({
    id:
      typeof record.id === 'string' || typeof record.id === 'number'
        ? String(record.id)
        : String(record.sourceId ?? record.reference ?? '')
  }));
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
  slug: string;
  classification?: string;
  recallNumber?: string;
}): {
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
  slug: string;
  classification?: string;
  recallNumber?: string;
} {
  return {
    id: record.id,
    source: record.source,
    sourceUrl: record.sourceUrl,
    title: record.title,
    brandNames: record.brandNames,
    productNames: record.productNames,
    category: record.category,
    hazard: record.hazard,
    remedy: record.remedy,
    recallDate: record.recallDate,
    slug: record.slug,
    classification: record.classification,
    recallNumber: record.recallNumber
  };
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const { records: summaries, totalAvailable } = options.refreshExistingRecordIds
    ? {
        records: await collectExistingRawSummaries(),
        totalAvailable: 0
      }
    : await collectMostRecentSummaries(options.limit);

  if (summaries.length === 0) {
    throw new Error('EU Safety Gate returned zero records; existing data was not overwritten.');
  }

  const details = await mapWithConcurrency(summaries, detailConcurrency, fetchNotificationDetail);

  if (details.length === 0) {
    throw new Error('EU Safety Gate detail fetch returned zero records; existing data was not overwritten.');
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawEuSafetyGatePath, {
    fetchedAt,
    source: 'EU_SAFETY_GATE',
    endpoint: mostRecentEndpoint,
    detailEndpointBase,
    mode: options.refreshExistingRecordIds ? 'existing-record-detail-refresh' : 'most-recent',
    limit: options.limit,
    totalAvailable,
    count: details.length,
    records: details
  });

  const processed = await writeNormalizedEuSafetyGateRecalls(details, defaultEuSafetyGateProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: mostRecentEndpoint,
        rawPath: defaultRawEuSafetyGatePath,
        processedPath: defaultEuSafetyGateProcessedPath,
        canonicalPath: canonicalProcessedPath,
        totalAvailable,
        rawRecordsSaved: details.length,
        normalizedRecordsSaved: processed.count,
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
