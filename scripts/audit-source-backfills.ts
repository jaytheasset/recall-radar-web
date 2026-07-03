// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { sourceBackfillRegistry } from './source-backfill-registry.ts';

const backfillRoot = path.resolve(process.cwd(), 'data', 'backfill');
const registryByOutputKey = new Map(sourceBackfillRegistry.map((entry) => [entry.outputKey, entry]));
const requiredProcessedFields = ['id', 'source', 'sourceUrl', 'title', 'recallDate', 'slug'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function increment(map: Record<string, number>, key: string): void {
  const label = key || '(missing)';
  map[label] = (map[label] ?? 0) + 1;
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function isCandidateChunk(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');

  if (!/\.(json|jsonl)$/i.test(normalized)) {
    return false;
  }

  if (/\/checkpoints\//.test(normalized) || /\/manifest\.json$/i.test(normalized)) {
    return false;
  }

  return true;
}

function outputKeyFor(file: string): string {
  const relative = path.relative(backfillRoot, file).replace(/\\/g, '/');
  return relative.split('/')[0] ?? '';
}

function parsePayloads(file: string): unknown[] {
  const text = fs.readFileSync(file, 'utf8');

  if (/\.jsonl$/i.test(file)) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
  }

  return [JSON.parse(text) as unknown];
}

function recordsArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }

  if (isObject(payload) && Array.isArray(payload.records)) {
    return payload.records.filter(isObject);
  }

  if (isObject(payload) && Array.isArray(payload.results)) {
    return payload.results.filter(isObject);
  }

  return [];
}

function isProcessedFile(file: string, records: Record<string, unknown>[]): boolean {
  const normalizedPath = file.replace(/\\/g, '/');

  if (/\/processed\//.test(normalizedPath) || /\.processed\.json$/i.test(normalizedPath)) {
    return true;
  }

  return records.some((record) => requiredProcessedFields.every((field) => field in record));
}

function validDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function duplicateSummary(values: string[]): { duplicateKeys: number; duplicateRecords: number; samples: string[] } {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

  return {
    duplicateKeys: duplicates.length,
    duplicateRecords: duplicates.reduce((total, [, count]) => total + count - 1, 0),
    samples: duplicates.map(([value]) => value).slice(0, 20)
  };
}

function isIgnoredGeneratedPath(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return /\/data\/backfill\/[^/]+\/.+\.(json|jsonl|tmp|log)$/i.test(normalized);
}

function auditFile(file: string) {
  const outputKey = outputKeyFor(file);
  const registryEntry = registryByOutputKey.get(outputKey);
  const payloads = parsePayloads(file);
  const records = payloads.flatMap(recordsArray);
  const processed = isProcessedFile(file, records);
  const sourceMismatches: string[] = [];
  const missingRequired: string[] = [];
  const invalidDateIds: string[] = [];

  if (processed && registryEntry) {
    for (const record of records) {
      const id = asString(record.id) || '(missing id)';
      for (const field of requiredProcessedFields) {
        if (!asString(record[field])) {
          missingRequired.push(`${id}:${field}`);
        }
      }

      if (asString(record.source) !== registryEntry.sourceId) {
        sourceMismatches.push(`${id}:${asString(record.source) || '(missing)'}`);
      }

      if (!validDate(asString(record.recallDate))) {
        invalidDateIds.push(id);
      }
    }
  }

  if (!processed && registryEntry) {
    for (const payload of payloads) {
      if (isObject(payload) && typeof payload.source === 'string' && payload.source !== registryEntry.sourceId) {
        sourceMismatches.push(`${file}:wrapper-source=${payload.source}`);
      }
    }
  }

  return {
    file,
    outputKey,
    sourceId: registryEntry?.sourceId ?? null,
    processed,
    records,
    missingRequired,
    invalidDateIds,
    sourceMismatches,
    ignoredByPolicy: isIgnoredGeneratedPath(file)
  };
}

async function run(): Promise<void> {
  const allFiles = walkFiles(backfillRoot).filter(isCandidateChunk).sort();

  if (allFiles.length === 0) {
    console.log(
      JSON.stringify(
        {
          passed: true,
          message: 'No source backfill chunks found; nothing to audit.',
          backfillRoot
        },
        null,
        2
      )
    );
    return;
  }

  const auditedFiles = allFiles.map((file) => {
    try {
      return auditFile(file);
    } catch (error) {
      return {
        file,
        outputKey: outputKeyFor(file),
        sourceId: registryByOutputKey.get(outputKeyFor(file))?.sourceId ?? null,
        processed: false,
        records: [],
        missingRequired: [],
        invalidDateIds: [],
        sourceMismatches: [error instanceof Error ? error.message : String(error)],
        ignoredByPolicy: isIgnoredGeneratedPath(file)
      };
    }
  });
  const processedRecords = auditedFiles.filter((file) => file.processed).flatMap((file) => file.records);
  const rawRecords = auditedFiles.filter((file) => !file.processed).flatMap((file) => file.records);
  const sourceCounts: Record<string, number> = {};

  for (const record of processedRecords) {
    increment(sourceCounts, asString(record.source));
  }

  const duplicateIds = duplicateSummary(processedRecords.map((record) => asString(record.id)));
  const slugCollisions = duplicateSummary(processedRecords.map((record) => asString(record.slug)));
  const missingRequired = auditedFiles.flatMap((file) => file.missingRequired);
  const invalidDates = auditedFiles.flatMap((file) => file.invalidDateIds);
  const sourceMismatches = auditedFiles.flatMap((file) => file.sourceMismatches);
  const unknownSourceDirs = auditedFiles.filter((file) => !file.sourceId).map((file) => file.outputKey);
  const nonIgnoredGeneratedFiles = auditedFiles.filter((file) => !file.ignoredByPolicy).map((file) => file.file);
  const blockers = [
    ...sourceMismatches.map((value) => `Source mismatch: ${value}`),
    ...unknownSourceDirs.map((value) => `Unknown backfill source directory: ${value}`),
    missingRequired.length ? `${missingRequired.length} processed record required fields are missing.` : '',
    invalidDates.length ? `${invalidDates.length} processed records have invalid dates.` : '',
    duplicateIds.duplicateKeys ? `${duplicateIds.duplicateKeys} duplicate processed ids found.` : '',
    slugCollisions.duplicateKeys ? `${slugCollisions.duplicateKeys} slug collisions found.` : '',
    nonIgnoredGeneratedFiles.length ? `${nonIgnoredGeneratedFiles.length} generated chunk files are outside the ignore policy.` : ''
  ].filter(Boolean);
  const passed = blockers.length === 0;

  console.log(
    JSON.stringify(
      {
        passed,
        backfillRoot,
        totalFiles: auditedFiles.length,
        totalRawRecords: rawRecords.length,
        totalProcessedRecords: processedRecords.length,
        sourceCounts,
        duplicateIds,
        slugCollisions,
        invalidDates: invalidDates.length,
        sourceMismatches: sourceMismatches.length,
        nonIgnoredGeneratedFiles,
        blockers,
        files: auditedFiles.map((file) => ({
          file: file.file,
          outputKey: file.outputKey,
          sourceId: file.sourceId,
          processed: file.processed,
          records: file.records.length,
          missingRequired: file.missingRequired.length,
          invalidDates: file.invalidDateIds.length,
          sourceMismatches: file.sourceMismatches.length,
          ignoredByPolicy: file.ignoredByPolicy
        }))
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
