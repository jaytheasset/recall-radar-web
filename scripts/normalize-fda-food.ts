import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, fdaProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type FdaFoodRecallRaw = {
  recall_number?: unknown;
  event_id?: unknown;
  product_description?: unknown;
  product_quantity?: unknown;
  reason_for_recall?: unknown;
  recalling_firm?: unknown;
  classification?: unknown;
  status?: unknown;
  distribution_pattern?: unknown;
  recall_initiation_date?: unknown;
  report_date?: unknown;
  code_info?: unknown;
  voluntary_mandated?: unknown;
  product_type?: unknown;
};

type RawFdaFoodFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  results?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawFdaFoodPath = resolve(projectRoot, 'data/raw/fda-food-recalls.json');
export const defaultFdaProcessedPath = fdaProcessedPath;
const openFdaFoodEnforcementEndpoint = 'https://api.fda.gov/food/enforcement.json';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function truncateText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 40 ? wordBoundary : maxLength).trim()}...`;
}

function normalizeFdaDate(value: unknown): string {
  const text = asString(value);
  const dateMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function makeSourceUrl(raw: FdaFoodRecallRaw): string {
  const recallNumber = asString(raw.recall_number);
  if (!recallNumber) {
    return openFdaFoodEnforcementEndpoint;
  }

  const url = new URL(openFdaFoodEnforcementEndpoint);
  url.searchParams.set('search', `recall_number:"${recallNumber}"`);
  url.searchParams.set('limit', '1');
  return url.toString();
}

function fallbackId(raw: FdaFoodRecallRaw, title: string): string {
  return firstNonEmpty([raw.recall_number, raw.event_id], slugify(title).slice(0, 72) || 'unknown');
}

function categoryFor(reason: string): string {
  const text = reason.toLowerCase();
  return /allergen|undeclared|milk|egg|peanut|soy|wheat|sesame|tree nut|almond|cashew|walnut/.test(text)
    ? 'food/allergy'
    : 'food';
}

export function normalizeFdaFoodRecords(records: FdaFoodRecallRaw[]): NormalizedRecall[] {
  return records
    .map((raw) => {
      const productDescription = firstNonEmpty([raw.product_description], 'FDA food recall');
      const recallingFirm = firstNonEmpty([raw.recalling_firm], 'FDA food recall');
      const reason = firstNonEmpty([raw.reason_for_recall]);
      const recallNumber = asString(raw.recall_number);
      const id = `fda-${fallbackId(raw, `${recallingFirm}-${productDescription}`)}`;
      const productNames = uniqueNonEmpty([truncateText(productDescription)]);
      const brandNames = uniqueNonEmpty([recallingFirm]);
      const title = `${truncateText(productDescription, 120)} recalled by ${recallingFirm}`;
      const recallDate = normalizeFdaDate(firstNonEmpty([raw.recall_initiation_date, raw.report_date]));
      const distributionPattern = asString(raw.distribution_pattern);
      const productQuantity = asString(raw.product_quantity);
      const classification = asString(raw.classification);
      const status = asString(raw.status);

      return {
        id,
        source: 'FDA',
        sourceUrl: makeSourceUrl(raw),
        title,
        brandNames,
        productNames,
        category: categoryFor(reason),
        hazard: reason,
        remedy: status ? `FDA enforcement status: ${status}. Verify current instructions with the FDA notice and recalling firm.` : '',
        recallDate,
        affectedUnits: productQuantity,
        description: uniqueNonEmpty([
          productDescription,
          distributionPattern ? `Distribution: ${distributionPattern}` : '',
          classification ? `Classification: ${classification}` : ''
        ]).join(' '),
        slug: slugify(`${title}-${id}`),
        classification,
        reason,
        distributionPattern,
        productQuantity,
        recallNumber,
        status,
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.title && record.id && record.recallDate);
}

export function extractFdaFoodRecords(payload: unknown): FdaFoodRecallRaw[] {
  if (Array.isArray(payload)) {
    return payload as FdaFoodRecallRaw[];
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawFdaFoodFile;
    if (Array.isArray(maybeFile.results)) {
      return maybeFile.results as FdaFoodRecallRaw[];
    }

    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records as FdaFoodRecallRaw[];
    }
  }

  return [];
}

export async function writeNormalizedFdaFoodRecalls(
  records: FdaFoodRecallRaw[],
  processedPath = defaultFdaProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeFdaFoodRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('FDA food normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'FDA',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawFdaFoodPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractFdaFoodRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No FDA food raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedFdaFoodRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultFdaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        mergedRecordsSaved: mergedOutput.count,
        countsBySource: mergedOutput.countsBySource,
        sample: sample
          ? {
              id: sample.id,
              source: sample.source,
              sourceUrl: sample.sourceUrl,
              title: sample.title,
              brandNames: sample.brandNames,
              productNames: sample.productNames,
              category: sample.category,
              hazard: sample.hazard,
              remedy: sample.remedy,
              recallDate: sample.recallDate,
              affectedUnits: sample.affectedUnits,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              reason: sample.reason,
              distributionPattern: sample.distributionPattern,
              productQuantity: sample.productQuantity,
              recallNumber: sample.recallNumber,
              status: sample.status
            }
          : null
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  runNormalize().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
