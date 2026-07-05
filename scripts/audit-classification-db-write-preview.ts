// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES,
  CLASSIFICATION_METHOD_VALUES,
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_AUDIENCE_VALUES,
  RECALL_DOMAIN_VALUES,
  RECALL_TAXONOMY_VERSION
} from '../src/data/recall-taxonomy-v2.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = 'outputs/llm-classifier/db-write-preview';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const runPath = resolve(absoluteOutputDir, 'classification-run.json');
const rowsPath = resolve(absoluteOutputDir, 'recall-classifications.json');
const auditJsonPath = resolve(absoluteOutputDir, 'classification-db-write-preview-audit.json');
const auditMarkdownPath = resolve(absoluteOutputDir, 'classification-db-write-preview-audit.md');

function gitOutput(args: string[]): string {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8'
  }).trim();
}

function add(blockers: string[], condition: boolean, message: string): void {
  if (!condition) {
    blockers.push(message);
  }
}

function sourceCounts(records: Array<{ source: string }>): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
}

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.every((key) => left[key] === right[key]);
}

function invalidValues(rows: Array<Record<string, unknown>>): Array<{ id: string; field: string; value: unknown }> {
  const invalid: Array<{ id: string; field: string; value: unknown }> = [];

  for (const row of rows) {
    const id = String(row.recallId ?? row.id ?? 'unknown');
    for (const [field, allowed] of [
      ['taxonomyVersion', [RECALL_TAXONOMY_VERSION]],
      ['method', CLASSIFICATION_METHOD_VALUES],
      ['productFamily', PRODUCT_FAMILY_VALUES],
      ['productType', PRODUCT_TYPE_VALUES],
      ['hazardType', HAZARD_TYPE_VALUES],
      ['recallDomain', RECALL_DOMAIN_VALUES]
    ] as const) {
      if (!allowed.includes(row[field] as never)) {
        invalid.push({ id, field, value: row[field] });
      }
    }

    if (!Array.isArray(row.audience) || row.audience.some((value) => !RECALL_AUDIENCE_VALUES.includes(value as never))) {
      invalid.push({ id, field: 'audience', value: row.audience });
    }
    if (!Array.isArray(row.evidenceFields) || row.evidenceFields.some((value) => !CLASSIFICATION_EVIDENCE_FIELD_VALUES.includes(value as never))) {
      invalid.push({ id, field: 'evidenceFields', value: row.evidenceFields });
    }
    if (!Array.isArray(row.hazardTags)) {
      invalid.push({ id, field: 'hazardTags', value: row.hazardTags });
    }
    if (typeof row.confidence !== 'number' || row.confidence < 0 || row.confidence > 1) {
      invalid.push({ id, field: 'confidence', value: row.confidence });
    }
    if (typeof row.needsReview !== 'boolean') {
      invalid.push({ id, field: 'needsReview', value: row.needsReview });
    }
  }

  return invalid;
}

function requiredMissing(rows: Array<Record<string, unknown>>): Array<{ id: string; field: string }> {
  const required = [
    'id',
    'runId',
    'recallId',
    'source',
    'sourceUrl',
    'taxonomyVersion',
    'method',
    'provider',
    'model',
    'promptVersion',
    'productFamily',
    'productType',
    'hazardType',
    'hazardTags',
    'recallDomain',
    'audience',
    'confidence',
    'needsReview',
    'reviewStatus',
    'reason',
    'evidenceFields',
    'createdAt'
  ];
  const missing: Array<{ id: string; field: string }> = [];

  for (const row of rows) {
    const id = String(row.recallId ?? row.id ?? 'unknown');
    for (const field of required) {
      if (!(field in row) || row[field] === undefined || row[field] === null || row[field] === '') {
        missing.push({ id, field });
      }
    }
  }

  return missing;
}

function markdown(audit: Record<string, unknown>): string {
  return [
    '# Classification DB Write Preview Audit',
    '',
    `Passed: ${String(audit.passed)}`,
    '',
    '## Blockers',
    '',
    Array.isArray(audit.blockers) && audit.blockers.length ? audit.blockers.map((item) => `- ${item}`).join('\n') : '- None',
    '',
    '## Warnings',
    '',
    Array.isArray(audit.warnings) && audit.warnings.length ? audit.warnings.map((item) => `- ${item}`).join('\n') : '- None',
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(audit.summary, null, 2),
    '```',
    '',
    '## Review Counts',
    '',
    '```json',
    JSON.stringify(audit.reviewCounts, null, 2),
    '```'
  ].join('\n');
}

async function run(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  add(blockers, existsSync(runPath), `${runPath} is missing. Run npm run preview:classification-db-write first.`);
  add(blockers, existsSync(rowsPath), `${rowsPath} is missing. Run npm run preview:classification-db-write first.`);

  const processed = JSON.parse(await readFile(resolve(projectRoot, 'data/processed/recalls.json'), 'utf8')) as ProcessedRecallFile;
  const canonicalRecords = Array.isArray(processed.records) ? processed.records : [];
  const canonicalCounts = sourceCounts(canonicalRecords);
  const canonicalIds = new Set(canonicalRecords.map((record: NormalizedRecall) => record.id));

  let runRecord: Record<string, unknown> | null = null;
  let rows: Array<Record<string, unknown>> = [];

  if (existsSync(runPath)) {
    runRecord = JSON.parse(await readFile(runPath, 'utf8')) as Record<string, unknown>;
  }
  if (existsSync(rowsPath)) {
    rows = JSON.parse(await readFile(rowsPath, 'utf8')) as Array<Record<string, unknown>>;
  }

  if (runRecord) {
    add(blockers, runRecord.status === 'preview', 'classification-run status must be preview.');
    add(blockers, runRecord.dbWrites === false, 'classification-run must record dbWrites=false.');
    add(blockers, runRecord.canonicalDataWrites === false, 'classification-run must record canonicalDataWrites=false.');
    add(blockers, runRecord.targetTables?.run === 'classification_runs', 'classification-run target table must be classification_runs.');
    add(blockers, runRecord.targetTables?.classifications === 'recall_classifications', 'classification rows target table must be recall_classifications.');
    add(blockers, runRecord.totalRecords === canonicalRecords.length, `Run totalRecords ${runRecord.totalRecords} does not match canonical count ${canonicalRecords.length}.`);
    add(blockers, runRecord.success === canonicalRecords.length, `Run success ${runRecord.success} does not match canonical count ${canonicalRecords.length}.`);
    add(blockers, runRecord.failed === 0, `Run has ${runRecord.failed} failed classifications.`);
    add(blockers, sameCounts(runRecord.sourceCounts as Record<string, number>, canonicalCounts), 'Run source counts do not match canonical source counts.');
  }

  add(blockers, Array.isArray(rows), 'recall-classifications output must be an array.');
  add(blockers, rows.length === canonicalRecords.length, `Classification rows ${rows.length} do not match canonical count ${canonicalRecords.length}.`);

  const rowIds = new Set(rows.map((row) => row.recallId));
  const duplicateKeys = rows.length - new Set(rows.map((row) => `${row.runId}:${row.recallId}`)).size;
  add(blockers, duplicateKeys === 0, `Classification output has ${duplicateKeys} duplicate runId/recallId rows.`);

  const missingCanonicalIds = [...canonicalIds].filter((id) => !rowIds.has(id));
  const extraRowIds = [...rowIds].filter((id) => !canonicalIds.has(id as string));
  add(blockers, missingCanonicalIds.length === 0, `Classification output is missing ${missingCanonicalIds.length} canonical ids.`);
  add(blockers, extraRowIds.length === 0, `Classification output has ${extraRowIds.length} ids not present in canonical data.`);

  const rowCounts = sourceCounts(rows);
  add(blockers, sameCounts(rowCounts, canonicalCounts), 'Classification row source counts do not match canonical source counts.');

  if (runRecord) {
    const mismatchedRunIds = rows.filter((row) => row.runId !== runRecord?.runId).length;
    add(blockers, mismatchedRunIds === 0, `${mismatchedRunIds} classification rows do not match the run id.`);
  }

  const missingFields = requiredMissing(rows);
  const invalidEnums = invalidValues(rows);
  add(blockers, missingFields.length === 0, `Classification rows have ${missingFields.length} missing required fields.`);
  add(blockers, invalidEnums.length === 0, `Classification rows have ${invalidEnums.length} invalid taxonomy values.`);

  const rawLeakRows = rows.filter((row) => Object.prototype.hasOwnProperty.call(row, 'raw')).length;
  add(blockers, rawLeakRows === 0, `${rawLeakRows} classification rows include raw payloads.`);

  const trackedOutputs = gitOutput(['ls-files', outputDir]);
  add(blockers, trackedOutputs.length === 0, `${outputDir} must remain untracked.`);

  const dataChanges = gitOutput(['diff', '--name-only', '--', 'data/raw', 'data/processed']);
  add(blockers, dataChanges.length === 0, `Canonical data changed unexpectedly: ${dataChanges}`);

  const stagedDataChanges = gitOutput(['diff', '--cached', '--name-only', '--', 'data/raw', 'data/processed']);
  add(blockers, stagedDataChanges.length === 0, `Canonical data is staged unexpectedly: ${stagedDataChanges}`);

  const reviewCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const key = String(row.reviewStatus ?? 'unknown');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  const needsReviewRows = rows.filter((row) => row.needsReview === true).length;
  const lowConfidenceRows = rows.filter((row) => typeof row.confidence === 'number' && row.confidence < 0.75).length;
  const unknownProductTypeRows = rows.filter((row) => row.productType === 'unknown').length;
  const unknownHazardTypeRows = rows.filter((row) => row.hazardType === 'unknown').length;

  if (needsReviewRows > 0) {
    warnings.push(`${needsReviewRows} rows are marked needsReview.`);
  }
  if (lowConfidenceRows > 0) {
    warnings.push(`${lowConfidenceRows} rows are below the 0.75 migration confidence gate.`);
  }
  if (unknownProductTypeRows > 0) {
    warnings.push(`${unknownProductTypeRows} rows use productType=unknown.`);
  }
  if (unknownHazardTypeRows > 0) {
    warnings.push(`${unknownHazardTypeRows} rows use hazardType=unknown.`);
  }

  const audit = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    summary: {
      runId: runRecord?.runId ?? null,
      totalRecords: canonicalRecords.length,
      classificationRows: rows.length,
      sourceCounts: canonicalCounts,
      outputDir,
      dbWrites: runRecord?.dbWrites ?? null,
      canonicalDataWrites: runRecord?.canonicalDataWrites ?? null,
      missingFields: missingFields.length,
      invalidEnums: invalidEnums.length,
      duplicateKeys
    },
    reviewCounts,
    quality: {
      needsReviewRows,
      lowConfidenceRows,
      unknownProductTypeRows,
      unknownHazardTypeRows
    },
    invalidEnums: invalidEnums.slice(0, 50),
    missingFields: missingFields.slice(0, 50),
    trackedOutputs: trackedOutputs ? trackedOutputs.split(/\r?\n/).filter(Boolean) : [],
    dataChanges: dataChanges ? dataChanges.split(/\r?\n/).filter(Boolean) : []
  };

  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  await writeFile(auditMarkdownPath, `${markdown(audit)}\n`, 'utf8');

  console.log(JSON.stringify(audit, null, 2));
  if (!audit.passed) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
