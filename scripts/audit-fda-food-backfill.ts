// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall } from '../src/data/recall-types.ts';
import { extractFdaFoodRecords, normalizeFdaFoodRecords, type FdaFoodRecallRaw } from './normalize-fda-food.ts';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutDir = 'data/backfill/fda-food';

type AuditFile = {
  file: string;
  kind: 'raw' | 'processed' | 'unknown';
  records: number;
  normalizedRecords: number;
  errors: string[];
};

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

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

function sortedCounts(map: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
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

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.resolve(dir, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function isChunkFile(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');

  if (!/\.(json|jsonl)$/i.test(normalized)) {
    return false;
  }

  if (/\/checkpoints\//.test(normalized) || /\/manifest\.json$/i.test(normalized)) {
    return false;
  }

  return /\/raw\/|\/processed\//.test(normalized);
}

function recordsFromProcessedPayload(payload: unknown): NormalizedRecall[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject) as NormalizedRecall[];
  }

  if (isObject(payload) && Array.isArray(payload.records)) {
    return payload.records.filter(isObject) as NormalizedRecall[];
  }

  return [];
}

function rawRecordsFromPayload(payload: unknown): FdaFoodRecallRaw[] {
  return extractFdaFoodRecords(payload);
}

function rawField(record: FdaFoodRecallRaw, field: keyof FdaFoodRecallRaw): string {
  return asString(record[field]);
}

function hasValidDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime());
}

function missingRequiredFields(record: NormalizedRecall): string[] {
  const missing: string[] = [];

  if (!record.id) missing.push('id');
  if (!record.title) missing.push('title');
  if (record.source !== 'FDA') missing.push('source');
  if (!record.sourceUrl) missing.push('sourceUrl');
  if (!record.recallDate) missing.push('recallDate');
  if (!record.slug) missing.push('slug');

  return missing;
}

async function parseJsonOrJsonl(file: string): Promise<unknown[]> {
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

async function auditFile(file: string): Promise<{ fileSummary: AuditFile; rawRecords: FdaFoodRecallRaw[]; normalized: NormalizedRecall[] }> {
  const errors: string[] = [];
  const payloads = await parseJsonOrJsonl(file);
  const isProcessed = file.replace(/\\/g, '/').includes('/processed/');
  const allRaw: FdaFoodRecallRaw[] = [];
  const allNormalized: NormalizedRecall[] = [];

  for (const payload of payloads) {
    if (isProcessed) {
      const processedRecords = recordsFromProcessedPayload(payload);
      allNormalized.push(...processedRecords);

      if (!Array.isArray((isObject(payload) ? payload.records : payload) as unknown[])) {
        errors.push('processed payload does not expose a records array');
      }
    } else {
      const rawRecords = rawRecordsFromPayload(payload);
      allRaw.push(...rawRecords);
      allNormalized.push(...normalizeFdaFoodRecords(rawRecords));

      if (rawRecords.length === 0) {
        errors.push('raw payload does not expose extractable FDA food records');
      }
    }
  }

  return {
    fileSummary: {
      file,
      kind: isProcessed ? 'processed' : file.replace(/\\/g, '/').includes('/raw/') ? 'raw' : 'unknown',
      records: isProcessed ? allNormalized.length : allRaw.length,
      normalizedRecords: allNormalized.length,
      errors
    },
    rawRecords: allRaw,
    normalized: allNormalized
  };
}

async function run(): Promise<void> {
  const outDir = path.resolve(projectRoot, readOption('out-dir')?.trim() || defaultOutDir);
  if (!fs.existsSync(outDir)) {
    console.log(
      JSON.stringify(
        {
          passed: true,
          message: 'No FDA backfill chunks found; nothing to audit.',
          outDir
        },
        null,
        2
      )
    );
    return;
  }

  const chunkFiles = listFiles(outDir).filter(isChunkFile).sort();

  if (chunkFiles.length === 0) {
    console.log(
      JSON.stringify(
        {
          passed: true,
          message: 'No FDA backfill chunks found; nothing to audit.',
          outDir
        },
        null,
        2
      )
    );
    return;
  }

  const fileResults = await Promise.all(
    chunkFiles.map(async (file) => {
      try {
        return await auditFile(file);
      } catch (error) {
        return {
          fileSummary: {
            file,
            kind: 'unknown' as const,
            records: 0,
            normalizedRecords: 0,
            errors: [error instanceof Error ? error.message : String(error)]
          },
          rawRecords: [],
          normalized: []
        };
      }
    })
  );

  const rawRecords = fileResults.flatMap((result) => result.rawRecords);
  const normalized = fileResults.flatMap((result) => result.normalized);
  const classificationCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let missingRecallNumbers = 0;
  let invalidDates = 0;
  let missingRequiredRecordFields = 0;

  for (const record of rawRecords) {
    increment(classificationCounts, rawField(record, 'classification'));
    increment(statusCounts, rawField(record, 'status'));
    if (!rawField(record, 'recall_number')) {
      missingRecallNumbers += 1;
    }
  }

  for (const record of normalized) {
    increment(categoryCounts, record.category);
    if (!hasValidDate(record.recallDate)) {
      invalidDates += 1;
    }
    if (missingRequiredFields(record).length > 0) {
      missingRequiredRecordFields += 1;
    }
  }

  const duplicateRecallNumbers = duplicateSummary(rawRecords.map((record) => rawField(record, 'recall_number')));
  const duplicateEventIds = duplicateSummary(rawRecords.map((record) => rawField(record, 'event_id')));
  const duplicateNormalizedIds = duplicateSummary(normalized.map((record) => record.id));
  const slugCollisions = duplicateSummary(normalized.map((record) => record.slug));
  const fileErrors = fileResults.flatMap((result) => result.fileSummary.errors.map((error) => `${result.fileSummary.file}: ${error}`));
  const nonFdaRecords = normalized.filter((record) => record.source !== 'FDA').length;
  const blockers = [
    ...fileErrors,
    nonFdaRecords ? `${nonFdaRecords} normalized records do not use source FDA.` : '',
    invalidDates ? `${invalidDates} normalized records have invalid recallDate values.` : '',
    missingRequiredRecordFields ? `${missingRequiredRecordFields} normalized records are missing required fields.` : '',
    slugCollisions.duplicateKeys ? `${slugCollisions.duplicateKeys} slug collisions found.` : ''
  ].filter(Boolean);
  const passed = blockers.length === 0;

  console.log(
    JSON.stringify(
      {
        passed,
        outDir,
        totalFiles: chunkFiles.length,
        totalRawRecords: rawRecords.length,
        totalNormalizedRecords: normalized.length,
        blockers,
        warnings: missingRecallNumbers ? [`${missingRecallNumbers} raw records are missing recall_number.`] : [],
        classificationCounts: sortedCounts(classificationCounts),
        statusCounts: sortedCounts(statusCounts),
        categoryCounts: sortedCounts(categoryCounts),
        duplicates: {
          recallNumbers: duplicateRecallNumbers,
          eventIds: duplicateEventIds,
          normalizedIds: duplicateNormalizedIds,
          slugs: slugCollisions
        },
        invalidDates,
        missingRecallNumbers,
        files: fileResults.map((result) => result.fileSummary)
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
