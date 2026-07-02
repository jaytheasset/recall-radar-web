import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  compareUkFsaAlertDateDescending,
  defaultRawUkFsaAlertsPath,
  defaultUkFsaProcessedPath,
  extractUkFsaAlertRecords,
  writeNormalizedUkFsaAlerts,
  type UkFsaAlertRaw
} from './normalize-uk-fsa-alerts.ts';

const defaultUkFsaEndpoint = 'https://data.food.gov.uk/food-alerts/id.json';
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
  return readOption('limit') ?? runtimeEnv.UK_FSA_LIMIT ?? String(defaultLimit);
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readLimitOption(), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit;
  const endpoint = readOption('url') ?? defaultUkFsaEndpoint;

  return { endpoint, limit };
}

function buildListUrl(options: FetchOptions): string {
  const url = new URL(options.endpoint);
  url.searchParams.set('_limit', String(options.limit));
  url.searchParams.set('_sort', '-created');
  return url.toString();
}

function detailUrlFor(notation: string): string {
  return `https://data.food.gov.uk/food-alerts/id/${encodeURIComponent(notation)}.json`;
}

function notationFor(raw: UkFsaAlertRaw): string {
  const notation = typeof raw.notation === 'string' ? raw.notation.trim() : '';
  if (notation) {
    return notation;
  }

  const id = typeof raw['@id'] === 'string' ? raw['@id'] : '';
  return id.split('/').pop() ?? '';
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

async function fetchJson(endpoint: string, label: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar UK FSA Food Alerts source spike'
      }
    });
  } catch (error) {
    throw new Error(
      `${label} request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status} ${response.statusText}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} returned an empty response; existing data was not overwritten.`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchAlertDetails(records: UkFsaAlertRaw[]): Promise<UkFsaAlertRaw[]> {
  const detailedRecords: UkFsaAlertRaw[] = [];

  for (const record of records) {
    const notation = notationFor(record);
    if (!notation) {
      throw new Error('UK FSA Food Alerts listing returned a record without notation; existing data was not overwritten.');
    }

    const payload = await fetchJson(detailUrlFor(notation), `UK FSA Food Alerts detail ${notation}`);
    const detail = extractUkFsaAlertRecords(payload)[0];
    if (!detail) {
      throw new Error(`UK FSA Food Alerts detail ${notation} returned zero records; existing data was not overwritten.`);
    }

    detailedRecords.push(detail);
  }

  return detailedRecords;
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const endpoint = buildListUrl(options);
  const listingPayload = await fetchJson(endpoint, 'UK FSA Food Alerts listing');
  const listingRecords = extractUkFsaAlertRecords(listingPayload)
    .slice()
    .sort(compareUkFsaAlertDateDescending)
    .slice(0, options.limit);

  if (listingRecords.length === 0) {
    throw new Error('UK FSA Food Alerts returned zero listing records; existing data was not overwritten.');
  }

  const records = await fetchAlertDetails(listingRecords);
  if (records.length === 0) {
    throw new Error('UK FSA Food Alerts returned zero detail records; existing data was not overwritten.');
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawUkFsaAlertsPath, {
    fetchedAt,
    source: 'UK_FSA',
    endpoint,
    detailEndpointPattern: 'https://data.food.gov.uk/food-alerts/id/{notation}.json',
    limit: options.limit,
    count: records.length,
    records
  });

  const processed = await writeNormalizedUkFsaAlerts(records, defaultUkFsaProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint,
        rawPath: defaultRawUkFsaAlertsPath,
        processedPath: defaultUkFsaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        rawRecordsSaved: records.length,
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
