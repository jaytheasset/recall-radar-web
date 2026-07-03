import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { enrichCanadaRecordsWithDetailImages } from './canada-detail-images.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareCanadaRecallDateDescending,
  defaultCanadaProcessedPath,
  defaultRawCanadaRecallsPath,
  extractCanadaRecallRecords,
  writeNormalizedCanadaRecalls
} from './normalize-canada-recalls.ts';

const defaultCanadaEndpoint =
  'https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json';
const defaultLimit = 100;
const maxLimit = 500;
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

type FetchOptions = {
  endpoint: string;
  limit: number;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readLimitOption(): string {
  return readOption('limit') ?? runtimeEnv.CANADA_RECALLS_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;
  const endpoint = readOption('url') ?? defaultCanadaEndpoint;

  return { endpoint, limit };
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
  status?: string;
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
  description: string;
  slug: string;
  classification?: string;
  recallNumber?: string;
  status?: string;
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
    description: record.description,
    slug: record.slug,
    classification: record.classification,
    recallNumber: record.recallNumber,
    status: record.status
  };
}

async function fetchCanadaRecalls(endpoint: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar local Canada recalls data fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `Canada Recalls open data request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`Canada Recalls open data returned HTTP ${response.status} ${response.statusText}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('Canada Recalls open data returned an empty response; existing data was not overwritten.');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `Canada Recalls open data returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const payload = await fetchCanadaRecalls(options.endpoint);
  const allRecords = extractCanadaRecallRecords(payload);
  const records = allRecords.slice().sort(compareCanadaRecallDateDescending).slice(0, options.limit);

  if (records.length === 0) {
    throw new Error('Canada Recalls open data returned zero records; existing data was not overwritten.');
  }

  const { records: enrichedRecords, results } = await enrichCanadaRecordsWithDetailImages(records);
  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawCanadaRecallsPath, {
    fetchedAt,
    detailImagesFetchedAt: fetchedAt,
    detailImageSource: 'official Canada recall detail pages',
    source: 'CA_RECALLS',
    endpoint: options.endpoint,
    limit: options.limit,
    totalAvailable: allRecords.length,
    count: enrichedRecords.length,
    records: enrichedRecords
  });

  const processed = await writeNormalizedCanadaRecalls(enrichedRecords, defaultCanadaProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint: options.endpoint,
        rawPath: defaultRawCanadaRecallsPath,
        processedPath: defaultCanadaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        totalAvailable: allRecords.length,
        rawRecordsSaved: enrichedRecords.length,
        rawRecordsWithImages: enrichedRecords.filter((record) => Array.isArray(record.Images) && record.Images.length > 0)
          .length,
        detailPagesChecked: results.length,
        detailPagesFetched: results.filter((result) => result.ok).length,
        detailPageFetchFailures: results.filter((result) => !result.ok).length,
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
