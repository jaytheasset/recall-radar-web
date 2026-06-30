import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import {
  defaultFdaProcessedPath,
  defaultRawFdaFoodPath,
  extractFdaFoodRecords,
  writeNormalizedFdaFoodRecalls
} from './normalize-fda-food.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

const openFdaFoodEnforcementEndpoint = 'https://api.fda.gov/food/enforcement.json';

type FetchOptions = {
  limit: number;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function getFetchOptions(): FetchOptions {
  const parsedLimit = Number.parseInt(readOption('limit') ?? '100', 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 100;

  return { limit };
}

function buildFdaFoodUrl(options: FetchOptions): string {
  const url = new URL(openFdaFoodEnforcementEndpoint);
  url.searchParams.set('sort', 'report_date:desc');
  url.searchParams.set('limit', String(options.limit));
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

async function fetchFdaFoodRecalls(endpoint: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar local MVP FDA food data fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `openFDA food enforcement API request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`openFDA food enforcement API returned HTTP ${response.status} ${response.statusText}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('openFDA food enforcement API returned an empty response; existing data was not overwritten.');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `openFDA food enforcement API returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const endpoint = buildFdaFoodUrl(options);
  const payload = await fetchFdaFoodRecalls(endpoint);
  const records = extractFdaFoodRecords(payload);

  if (records.length === 0) {
    throw new Error('openFDA food enforcement API returned zero records; existing data was not overwritten.');
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawFdaFoodPath, {
    fetchedAt,
    source: 'FDA',
    endpoint,
    count: records.length,
    results: records
  });

  const processed = await writeNormalizedFdaFoodRecalls(records, defaultFdaProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint,
        rawPath: defaultRawFdaFoodPath,
        processedPath: defaultFdaProcessedPath,
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
