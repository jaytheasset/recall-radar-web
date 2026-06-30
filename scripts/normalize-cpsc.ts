import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, cpscProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';

type NamedValue = {
  Name?: unknown;
  URL?: unknown;
  Option?: unknown;
  NumberOfUnits?: unknown;
  Type?: unknown;
  CategoryID?: unknown;
};

export type CpscRecallRaw = {
  RecallID?: unknown;
  RecallNumber?: unknown;
  RecallDate?: unknown;
  Description?: unknown;
  URL?: unknown;
  Title?: unknown;
  Products?: NamedValue[];
  Hazards?: NamedValue[];
  Remedies?: NamedValue[];
  RemedyOptions?: NamedValue[];
  Manufacturers?: NamedValue[];
  Importers?: NamedValue[];
  Distributors?: NamedValue[];
};

type RawCpscFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawPath = resolve(projectRoot, 'data/raw/cpsc-recalls.json');
export const defaultCpscProcessedPath = cpscProcessedPath;
export const defaultProcessedPath = canonicalProcessedPath;

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

function namesFrom(values: NamedValue[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniqueNonEmpty(values.map((value) => asString(value.Name)));
}

function joinNames(values: NamedValue[] | undefined, fallback = ''): string {
  return namesFrom(values).join(' ').trim() || fallback;
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    return dateOnly[1];
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function fallbackId(raw: CpscRecallRaw, title: string): string {
  const sourceValue = firstNonEmpty([raw.RecallID, raw.RecallNumber]);
  return sourceValue || slugify(title).slice(0, 72) || 'unknown';
}

function getAffectedUnits(products: NamedValue[] | undefined): string {
  if (!Array.isArray(products)) {
    return '';
  }

  return uniqueNonEmpty(products.map((product) => asString(product.NumberOfUnits))).join('; ');
}

function getCategory(products: NamedValue[] | undefined): string {
  if (!Array.isArray(products)) {
    return 'consumer product';
  }

  return firstNonEmpty(
    products.flatMap((product) => [product.Type, product.CategoryID]),
    'consumer product'
  );
}

export function normalizeCpscRecords(records: CpscRecallRaw[]): NormalizedRecall[] {
  return records
    .map((raw) => {
      const title = firstNonEmpty([raw.Title], 'Untitled CPSC recall');
      const id = `cpsc-${fallbackId(raw, title)}`;
      const productNames = namesFrom(raw.Products);
      const companyNames = uniqueNonEmpty([
        ...namesFrom(raw.Manufacturers),
        ...namesFrom(raw.Importers),
        ...namesFrom(raw.Distributors)
      ]);

      return {
        id,
        source: 'CPSC',
        sourceUrl: firstNonEmpty([raw.URL]),
        title,
        brandNames: companyNames,
        productNames,
        category: getCategory(raw.Products),
        hazard: joinNames(raw.Hazards),
        remedy: uniqueNonEmpty([...namesFrom(raw.Remedies), ...namesFrom(raw.RemedyOptions)]).join(' '),
        recallDate: normalizeDate(raw.RecallDate),
        affectedUnits: getAffectedUnits(raw.Products),
        description: firstNonEmpty([raw.Description]),
        slug: slugify(`${title}-${id}`),
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.title && record.id);
}

export function extractRawRecords(payload: unknown): CpscRecallRaw[] {
  if (Array.isArray(payload)) {
    return payload as CpscRecallRaw[];
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawCpscFile;
    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records as CpscRecallRaw[];
    }

    for (const key of ['Recalls', 'recalls', 'Results', 'results']) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as CpscRecallRaw[];
      }
    }
  }

  return [];
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  try {
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function writeNormalizedCpscRecalls(
  records: CpscRecallRaw[],
  processedPath = defaultCpscProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeCpscRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('CPSC normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'CPSC',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractRawRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No CPSC raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedCpscRecalls(records);
  const merged = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultCpscProcessedPath,
        canonicalPath: defaultProcessedPath,
        mergedRecordsSaved: merged.count,
        countsBySource: merged.countsBySource,
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
              slug: sample.slug
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
