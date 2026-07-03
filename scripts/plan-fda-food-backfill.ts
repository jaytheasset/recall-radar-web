import { extractFdaFoodRecords, normalizeFdaFoodRecords } from './normalize-fda-food.ts';

const openFdaFoodEnforcementEndpoint = 'https://api.fda.gov/food/enforcement.json';
const defaultSamplePages = 3;
const defaultPageSize = 100;
const defaultRecallNumber = 'H-0950-2026';
const maxSafePageSize = 100;
const sampleRecallNumberLimit = 8;

type PlanningOptions = {
  samplePages: number;
  pageSize: number;
  recallNumber: string;
};

type FetchJsonResult = {
  endpoint: string;
  httpStatus: number | null;
  ok: boolean;
  json: unknown;
  error: string | null;
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

type OpenFdaCountResult = {
  term?: unknown;
  count?: unknown;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptions(): PlanningOptions {
  const samplePages = Math.min(parsePositiveInt(readOption('sample-pages'), defaultSamplePages), 10);
  const pageSize = Math.min(parsePositiveInt(readOption('page-size'), defaultPageSize), maxSafePageSize);
  const recallNumber = readOption('recall-number')?.trim() || defaultRecallNumber;

  return { samplePages, pageSize, recallNumber };
}

function buildUrl(params: Record<string, string>): URL {
  const url = new URL(openFdaFoodEnforcementEndpoint);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function fetchJson(url: URL): Promise<FetchJsonResult> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Recall Radar FDA food backfill planning'
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
        json: null,
        error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    return {
      endpoint: url.toString(),
      httpStatus: response.status,
      ok: response.ok,
      json,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`
    };
  } catch (error) {
    return {
      endpoint: url.toString(),
      httpStatus: null,
      ok: false,
      json: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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

function resultsTotal(json: unknown): number | null {
  return asNumber(asPayload(json).meta?.results?.total);
}

function rawResults(json: unknown): Record<string, unknown>[] {
  const records = extractFdaFoodRecords(json);
  return records.filter((record): record is Record<string, unknown> => Boolean(record && typeof record === 'object'));
}

function pageDateSummary(records: Record<string, unknown>[]): { firstReportDate: string | null; lastReportDate: string | null } {
  return {
    firstReportDate: asString(records[0]?.report_date) || null,
    lastReportDate: asString(records[records.length - 1]?.report_date) || null
  };
}

function pageSummary(pageIndex: number, skip: number, result: FetchJsonResult) {
  const records = rawResults(result.json);
  const dates = pageDateSummary(records);

  return {
    pageIndex,
    skip,
    endpoint: result.endpoint,
    httpStatus: result.httpStatus,
    resultsLength: records.length,
    firstReportDate: dates.firstReportDate,
    lastReportDate: dates.lastReportDate,
    sampleRecallNumbers: records
      .map((record) => asString(record.recall_number))
      .filter(Boolean)
      .slice(0, sampleRecallNumberLimit),
    error: result.error
  };
}

function countSummary(result: FetchJsonResult) {
  if (!result.ok) {
    return {
      endpoint: result.endpoint,
      httpStatus: result.httpStatus,
      error: result.error,
      results: []
    };
  }

  const payload = asPayload(result.json);
  const results = Array.isArray(payload.results) ? payload.results : [];

  return {
    endpoint: result.endpoint,
    httpStatus: result.httpStatus,
    error: null,
    results: results
      .filter((item): item is OpenFdaCountResult => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        term: String(item.term ?? ''),
        count: asNumber(item.count) ?? 0
      }))
  };
}

async function optionalCount(field: string) {
  const url = buildUrl({ count: field });
  const result = await fetchJson(url);
  return countSummary(result);
}

async function run(): Promise<void> {
  const options = getOptions();
  const warnings: string[] = [];
  const pageResults: FetchJsonResult[] = [];

  for (let pageIndex = 0; pageIndex < options.samplePages; pageIndex += 1) {
    const skip = pageIndex * options.pageSize;
    const url = buildUrl({
      sort: 'report_date:desc',
      limit: String(options.pageSize),
      skip: String(skip)
    });
    pageResults.push(await fetchJson(url));
  }

  const firstPageResult = pageResults[0];
  const firstPageRecords = rawResults(firstPageResult?.json);
  const firstPageDates = pageDateSummary(firstPageRecords);
  const selectedUrl = buildUrl({
    search: `recall_number:"${options.recallNumber}"`,
    limit: '1'
  });
  const selectedResult = await fetchJson(selectedUrl);
  const selectedRecords = extractFdaFoodRecords(selectedResult.json);
  const selectedNormalized = normalizeFdaFoodRecords(selectedRecords);
  const selectedRaw = selectedRecords[0];
  const earliestResult = await fetchJson(
    buildUrl({
      sort: 'report_date:asc',
      limit: '1'
    })
  );
  const earliestRecords = rawResults(earliestResult.json);
  const classificationCounts = await optionalCount('classification.exact');
  const statusCounts = await optionalCount('status.exact');
  const productTypeCounts = await optionalCount('product_type.exact');

  for (const [name, summary] of [
    ['classificationCounts', classificationCounts],
    ['statusCounts', statusCounts],
    ['productTypeCounts', productTypeCounts]
  ] as const) {
    if (summary.error) {
      warnings.push(`${name} failed: ${summary.error}`);
    }
  }

  if (earliestResult.error) {
    warnings.push(`yearRangeEstimate earliest query failed: ${earliestResult.error}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    endpointBase: openFdaFoodEnforcementEndpoint,
    mode: 'planning',
    pageSize: options.pageSize,
    samplePages: options.samplePages,
    totalAvailable: firstPageResult ? resultsTotal(firstPageResult.json) : null,
    apiLimitNotes: [
      'This planning script caps page-size at 100 and sample-pages at 10.',
      'The default project fetch uses sort=report_date:desc&limit=100 and does not backfill history.',
      'For small/medium subsets, use bounded limit+skip paging with conservative request pacing.',
      'For large historical backfills, avoid relying on very large skip values; use date-windowed queries or an official bulk dataset approach.'
    ],
    firstPage: firstPageResult
      ? {
          endpoint: firstPageResult.endpoint,
          httpStatus: firstPageResult.httpStatus,
          resultsLength: firstPageRecords.length,
          metaTotal: resultsTotal(firstPageResult.json),
          firstReportDate: firstPageDates.firstReportDate,
          lastReportDate: firstPageDates.lastReportDate,
          error: firstPageResult.error
        }
      : null,
    sampledPages: pageResults.map((result, pageIndex) => pageSummary(pageIndex, pageIndex * options.pageSize, result)),
    selectedRecallDiagnostic: {
      recallNumber: options.recallNumber,
      endpoint: selectedResult.endpoint,
      found: selectedRecords.length > 0,
      httpStatus: selectedResult.httpStatus,
      error: selectedResult.error,
      extractCount: selectedRecords.length,
      normalizedCount: selectedNormalized.length,
      reportDate: asString(selectedRaw?.report_date) || null,
      recallInitiationDate: asString(selectedRaw?.recall_initiation_date) || null,
      classification: asString(selectedRaw?.classification) || null,
      status: asString(selectedRaw?.status) || null
    },
    classificationCounts,
    statusCounts,
    productTypeCounts,
    yearRangeEstimate: {
      latestReportDate: firstPageDates.firstReportDate,
      earliestReportDate: asString(earliestRecords[0]?.report_date) || null,
      earliestEndpoint: earliestResult.endpoint,
      earliestHttpStatus: earliestResult.httpStatus,
      earliestError: earliestResult.error
    },
    recommendedBackfillStrategy: [
      'Start with date-windowed backfill by report_date, then use recall_initiation_date for secondary auditing.',
      'Fetch raw FDA food enforcement results in bounded year or year-month chunks.',
      'Normalize each chunk with the existing FDA normalizer and deduplicate by recall_number, then event_id.',
      'Audit chunk counts, missing fields, source ids, and duplicate ids before merging.',
      'Merge into canonical processed data only after the selected backfill scope passes audits and static-site size checks.'
    ],
    recommendedLaunchSelectionStrategy: [
      'Do not keep latest 100 as the long-term FDA selection.',
      'Prioritize Class I records, Ongoing records, recent report_date and recall_initiation_date, undeclared allergen records, and pathogen keywords such as Salmonella, Listeria, and E. coli.',
      'Include explicitly requested recall_number lookups, such as H-0950-2026, only through a documented selection policy.',
      'Deduplicate by recall_number and event_id before writing any larger launch subset.',
      'Keep canonical FDA count unchanged until the larger subset is intentionally selected and audited.'
    ],
    imageAvailabilityConclusion:
      'openFDA food enforcement JSON does not provide product image URLs in the current normalized fields. FDA text backfill can use the API, but FDA image recovery is a separate future task that would require mapping enforcement records to official FDA announcement or press-release pages where available.',
    deferredWork: [
      'No full FDA historical backfill in this phase.',
      'No FDA image scraping in this phase.',
      'No backend, runtime API, or database.',
      'No canonical data, route, slug, source id, or UI copy changes.',
      'No FDA source selection change and no new canonical records.'
    ],
    warnings
  };

  console.log(JSON.stringify(report, null, 2));
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
