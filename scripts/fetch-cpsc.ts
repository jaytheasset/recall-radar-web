import {
  defaultProcessedPath,
  defaultRawPath,
  extractRawRecords,
  writeJsonAtomic,
  writeNormalizedCpscRecalls
} from './normalize-cpsc.ts';

const cpscRecallEndpoint = 'https://www.saferproducts.gov/RestWebServices/Recall';

type FetchOptions = {
  startDate: string;
  endDate: string;
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function getFetchOptions(): FetchOptions {
  return {
    startDate: readOption('start') ?? defaultStartDate(),
    endDate: readOption('end') ?? toDateOnly(new Date())
  };
}

function buildCpscUrl(options: FetchOptions): string {
  const url = new URL(cpscRecallEndpoint);
  url.searchParams.set('format', 'json');
  url.searchParams.set('RecallDateStart', options.startDate);
  url.searchParams.set('RecallDateEnd', options.endDate);
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
    slug: record.slug
  };
}

async function fetchCpscRecalls(endpoint: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar local MVP data fetch'
      }
    });
  } catch (error) {
    throw new Error(
      `CPSC recall API request failed before a response was received: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(`CPSC recall API returned HTTP ${response.status} ${response.statusText}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('CPSC recall API returned an empty response; existing data was not overwritten.');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `CPSC recall API returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function runFetch(): Promise<void> {
  const options = getFetchOptions();
  const endpoint = buildCpscUrl(options);
  const payload = await fetchCpscRecalls(endpoint);
  const records = extractRawRecords(payload);

  if (records.length === 0) {
    throw new Error('CPSC recall API returned zero records; existing data was not overwritten.');
  }

  const fetchedAt = new Date().toISOString();
  await writeJsonAtomic(defaultRawPath, {
    fetchedAt,
    source: 'CPSC',
    endpoint,
    count: records.length,
    records
  });

  const processed = await writeNormalizedCpscRecalls(records, defaultProcessedPath);
  const sample = processed.records[0];

  console.log(
    JSON.stringify(
      {
        fetchedAt,
        endpoint,
        rawPath: defaultRawPath,
        processedPath: defaultProcessedPath,
        rawRecordsSaved: records.length,
        normalizedRecordsSaved: processed.count,
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
