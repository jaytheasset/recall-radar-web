import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';
import {
  defaultRappelConsoProcessedPath,
  defaultRawRappelConsoPath,
  extractRappelConsoRecords,
  writeNormalizedRappelConsoRecalls
} from './normalize-rappelconso.ts';

const defaultRappelConsoEndpoint =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records';
const defaultLimit = 100;

type FetchOptions = {
  endpoint: string;
  limit: number;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readOption('limit') ?? String(defaultLimit), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : defaultLimit;
  const endpoint = readOption('url') ?? defaultRappelConsoEndpoint;

  return { endpoint, limit };
}

function buildRappelConsoUrl(options: FetchOptions): string {
  const url = new URL(options.endpoint);
  url.searchParams.set('limit', String(options.limit));
  url.searchParams.set('order_by', 'date_publication desc');
  return url.toString();
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
  affectedUnits: string;
  description: string;
  slug: string;
  classification?: string;
  reason?: string;
  distributionPattern?: string;
  productQuantity?: string;
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
  affectedUnits: string;
  description: string;
  slug: string;
  classification?: string;
  reason?: string;
  distributionPattern?: string;
  productQuantity?: string;
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
    affectedUnits: record.affectedUnits,
    description: record.description,
    slug: record.slug,
    classification: record.classification,
    reason: record.reason,
    distributionPattern: record.distributionPattern,
    productQuantity: record.productQuantity,
    recallNumber: record.recallNumber,
    status: record.status
  };
}

async function fetchRappelConsoRecalls(endpoint: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar local RappelConso data fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `RappelConso open data request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`RappelConso open data returned HTTP ${response.status} ${response.statusText}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('RappelConso open data returned an empty response; existing data was not overwritten.');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `RappelConso open data returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const endpoint = buildRappelConsoUrl(options);
  const payload = await fetchRappelConsoRecalls(endpoint);
  const records = extractRappelConsoRecords(payload);

  if (records.length === 0) {
    throw new Error('RappelConso open data returned zero records; existing data was not overwritten.');
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawRappelConsoPath, {
    fetchedAt,
    source: 'FR_RAPPELCONSO',
    endpoint,
    limit: options.limit,
    count: records.length,
    records
  });

  const processed = await writeNormalizedRappelConsoRecalls(records, defaultRappelConsoProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint,
        rawPath: defaultRawRappelConsoPath,
        processedPath: defaultRappelConsoProcessedPath,
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
