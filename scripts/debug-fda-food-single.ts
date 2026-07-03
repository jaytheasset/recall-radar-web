import { readFile } from 'node:fs/promises';
import {
  defaultRawFdaFoodPath,
  diagnoseFdaFoodRecord,
  extractFdaFoodRecords,
  normalizeFdaFoodRecords,
  type FdaFoodRecallRaw
} from './normalize-fda-food.ts';

const openFdaFoodEnforcementEndpoint = 'https://api.fda.gov/food/enforcement.json';
const defaultRecallNumber = 'H-0950-2026';

const selectedFieldNames = [
  'recall_number',
  'event_id',
  'product_description',
  'product_quantity',
  'reason_for_recall',
  'recalling_firm',
  'classification',
  'status',
  'distribution_pattern',
  'recall_initiation_date',
  'report_date',
  'code_info',
  'voluntary_mandated',
  'product_type'
] as const;

type OpenFdaError = {
  code?: unknown;
  message?: unknown;
};

type RawFdaFoodFile = {
  results?: unknown;
  records?: unknown;
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function buildSingleRecordUrl(recallNumber: string): URL {
  const url = new URL(openFdaFoodEnforcementEndpoint);
  url.searchParams.set('search', `recall_number:"${recallNumber}"`);
  url.searchParams.set('limit', '1');
  return url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function selectedFields(raw: FdaFoodRecallRaw | undefined): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  return Object.fromEntries(selectedFieldNames.map((field) => [field, raw[field] ?? null]));
}

function publicNormalizedPreview(record: ReturnType<typeof normalizeFdaFoodRecords>[number] | undefined) {
  if (!record) {
    return null;
  }

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
    recallNumber: record.recallNumber,
    status: record.status
  };
}

function openFdaErrorFrom(payload: unknown): OpenFdaError | null {
  if (!isObject(payload) || !isObject(payload.error)) {
    return null;
  }

  return payload.error;
}

function droppedReason(params: {
  parsedJsonOk: boolean;
  openFdaError: OpenFdaError | null;
  resultsLength: number;
  extractCount: number;
  normalizedCount: number;
  recordDiagnostic: ReturnType<typeof diagnoseFdaFoodRecord> | null;
}): string | null {
  if (!params.parsedJsonOk) {
    return 'API returned invalid JSON';
  }

  if (params.openFdaError) {
    return `API returned error JSON: ${String(params.openFdaError.code ?? 'unknown')}`;
  }

  if (params.resultsLength === 0) {
    return 'API returned zero results';
  }

  if (params.extractCount === 0) {
    return 'extraction returned zero records';
  }

  if (params.normalizedCount === 0) {
    const reasons = params.recordDiagnostic?.droppedReasons ?? [];
    return reasons.length ? reasons.join('; ') : 'normalization returned zero records for an unknown required-field failure';
  }

  return null;
}

function suspectedRootCause(params: {
  parsedJsonOk: boolean;
  openFdaError: OpenFdaError | null;
  resultsLength: number;
  extractCount: number;
  normalizedCount: number;
}): string {
  if (!params.parsedJsonOk) {
    return 'The openFDA response was not valid JSON.';
  }

  if (params.openFdaError) {
    return 'openFDA returned an error JSON payload, so the record could not be parsed as a result list.';
  }

  if (params.resultsLength === 0) {
    return 'openFDA returned zero results for this recall_number.';
  }

  if (params.extractCount === 0) {
    return 'extractFdaFoodRecords() did not recognize the response shape.';
  }

  if (params.normalizedCount === 0) {
    return 'normalizeFdaFoodRecords() dropped the extracted record.';
  }

  return 'No parser failure reproduced: openFDA returned one result, extraction found it, and normalization produced one FDA recall record.';
}

async function loadWorkingControlRecord(requestedRecallNumber: string): Promise<FdaFoodRecallRaw | null> {
  const rawText = await readFile(defaultRawFdaFoodPath, 'utf8');
  const payload = JSON.parse(rawText) as RawFdaFoodFile;
  const records = extractFdaFoodRecords(payload);

  return records.find((record) => record.recall_number !== requestedRecallNumber) ?? records[0] ?? null;
}

async function run(): Promise<void> {
  const requestedRecallNumber = readOption('recall-number') ?? defaultRecallNumber;
  const url = buildSingleRecordUrl(requestedRecallNumber);
  const endpoint = url.toString();
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Recall Radar FDA food single-record diagnostic'
    }
  });
  const rawText = await response.text();
  let payload: unknown = null;
  let parsedJsonOk = false;
  let parseError: string | null = null;

  try {
    payload = JSON.parse(rawText) as unknown;
    parsedJsonOk = true;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const openFdaError = parsedJsonOk ? openFdaErrorFrom(payload) : null;
  const records = parsedJsonOk ? extractFdaFoodRecords(payload) : [];
  const firstRecord = records[0];
  const normalizedRecords = normalizeFdaFoodRecords(records);
  const recordDiagnostic = firstRecord ? diagnoseFdaFoodRecord(firstRecord) : null;
  const resultsLength = Array.isArray((payload as RawFdaFoodFile | null)?.results)
    ? ((payload as RawFdaFoodFile).results as unknown[]).length
    : 0;
  const controlRecord = await loadWorkingControlRecord(requestedRecallNumber);
  const controlNormalized = controlRecord ? normalizeFdaFoodRecords([controlRecord]) : [];
  const diagnostic = {
    requestedRecallNumber,
    endpoint,
    httpStatus: response.status,
    responseOk: response.ok,
    rawTextLength: rawText.length,
    parsedJsonOk,
    parseError,
    openFdaError,
    resultsLength,
    firstResultKeys: firstRecord ? Object.keys(firstRecord) : [],
    selectedFields: selectedFields(firstRecord),
    extractCount: records.length,
    normalizedCount: normalizedRecords.length,
    normalizedRecordPreview: publicNormalizedPreview(normalizedRecords[0]),
    droppedReason: droppedReason({
      parsedJsonOk,
      openFdaError,
      resultsLength,
      extractCount: records.length,
      normalizedCount: normalizedRecords.length,
      recordDiagnostic
    }),
    recordDiagnostic,
    suspectedRootCause: suspectedRootCause({
      parsedJsonOk,
      openFdaError,
      resultsLength,
      extractCount: records.length,
      normalizedCount: normalizedRecords.length
    }),
    workingControlComparison: controlRecord
      ? {
          recallNumber: controlRecord.recall_number,
          selectedFields: selectedFields(controlRecord),
          normalizedCount: controlNormalized.length,
          normalizedRecordPreview: publicNormalizedPreview(controlNormalized[0]),
          recordDiagnostic: diagnoseFdaFoodRecord(controlRecord)
        }
      : null
  };

  console.log(JSON.stringify(diagnostic, null, 2));
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
