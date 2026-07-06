// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { RECALL_TAXONOMY_VERSION } from '../src/data/recall-taxonomy-v2.ts';
import { validateClassificationOutput } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedRecallsPath = resolve(projectRoot, 'data/processed/recalls.json');
const classificationsPath = resolve(projectRoot, 'data/processed/recall-classifications-v2.json');
const outputDir = resolve(projectRoot, 'outputs/llm-classifier/classification-results-v2-audit');
const auditJsonPath = resolve(outputDir, 'classification-results-v2-audit.json');
const auditMarkdownPath = resolve(outputDir, 'classification-results-v2-audit.md');

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
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

function add(blockers: string[], condition: boolean, message: string): void {
  if (!condition) {
    blockers.push(message);
  }
}

function markdown(audit: Record<string, unknown>): string {
  return [
    '# Classification Results V2 Audit',
    '',
    `Passed: ${String(audit.passed)}`,
    '',
    '## Blockers',
    '',
    Array.isArray(audit.blockers) && audit.blockers.length ? audit.blockers.map((item) => `- ${item}`).join('\n') : '- None',
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(audit.summary, null, 2),
    '```',
    '',
    '## Quality',
    '',
    '```json',
    JSON.stringify(audit.quality, null, 2),
    '```'
  ].join('\n');
}

async function run(): Promise<void> {
  const blockers: string[] = [];
  const [processedText, classificationText] = await Promise.all([
    readFile(processedRecallsPath, 'utf8'),
    readFile(classificationsPath, 'utf8')
  ]);

  const processed = JSON.parse(processedText) as ProcessedRecallFile;
  const records = Array.isArray(processed.records) ? processed.records : [];
  const payload = JSON.parse(classificationText) as Record<string, unknown>;
  const classificationRows = Array.isArray(payload.records) ? payload.records as Array<Record<string, unknown>> : [];
  const canonicalIds = new Set(records.map((record: NormalizedRecall) => record.id));
  const rowIds = new Set(classificationRows.map((row) => row.recordId));

  add(blockers, payload.taxonomyVersion === RECALL_TAXONOMY_VERSION, `taxonomyVersion must be ${RECALL_TAXONOMY_VERSION}.`);
  add(blockers, payload.totalRecords === records.length, `totalRecords ${payload.totalRecords} does not match canonical count ${records.length}.`);
  add(blockers, payload.success === records.length, `success ${payload.success} does not match canonical count ${records.length}.`);
  add(blockers, payload.failed === 0, `failed must be 0, got ${String(payload.failed)}.`);
  add(blockers, classificationRows.length === records.length, `records length ${classificationRows.length} does not match canonical count ${records.length}.`);
  add(blockers, new Set(classificationRows.map((row) => row.recordId)).size === classificationRows.length, 'Duplicate recordId values found.');

  const missingCanonicalIds = records.filter((record: NormalizedRecall) => !rowIds.has(record.id)).map((record: NormalizedRecall) => record.id);
  const extraRows = classificationRows.filter((row) => !canonicalIds.has(row.recordId as string)).map((row) => row.recordId);
  add(blockers, missingCanonicalIds.length === 0, `Missing ${missingCanonicalIds.length} canonical ids.`);
  add(blockers, extraRows.length === 0, `Found ${extraRows.length} classification ids not in canonical recalls.`);
  add(blockers, sameCounts(sourceCounts(records), sourceCounts(classificationRows as Array<{ source: string }>)), 'Source counts do not match canonical recalls.');
  add(blockers, sameCounts(payload.sourceCounts as Record<string, number>, sourceCounts(records)), 'Payload sourceCounts do not match canonical recalls.');

  const invalidRows: Array<{ recordId: unknown; errors: string[] }> = [];
  let failedRows = 0;
  let needsReviewRows = 0;
  let lowConfidenceRows = 0;
  let qualityFlagRows = 0;
  let unknownProductTypeRows = 0;
  let unknownHazardTypeRows = 0;

  for (const row of classificationRows) {
    if (row.success !== true || row.failed === true) {
      failedRows += 1;
    }
    const validation = validateClassificationOutput(row.classification);
    if (!validation.ok) {
      invalidRows.push({ recordId: row.recordId, errors: validation.errors });
      continue;
    }
    const classification = validation.classification!;
    if (classification.needsReview) {
      needsReviewRows += 1;
    }
    if (classification.confidence < 0.75) {
      lowConfidenceRows += 1;
    }
    if ((row.qualityFlags as unknown[] | undefined)?.length) {
      qualityFlagRows += 1;
    }
    if (classification.productType === 'unknown') {
      unknownProductTypeRows += 1;
    }
    if (classification.hazardType === 'unknown') {
      unknownHazardTypeRows += 1;
    }
  }

  add(blockers, failedRows === 0, `${failedRows} rows have success=false or failed=true.`);
  add(blockers, invalidRows.length === 0, `${invalidRows.length} rows have invalid classifications.`);

  const trackedAuditOutputs = gitOutput(['ls-files', 'outputs/llm-classifier/classification-results-v2-audit']);
  add(blockers, trackedAuditOutputs.length === 0, 'Audit output directory must remain untracked.');

  const audit = {
    passed: blockers.length === 0,
    blockers,
    summary: {
      generatedAt: payload.generatedAt,
      provider: payload.provider,
      model: payload.model,
      promptVersion: payload.promptVersion,
      totalRecords: records.length,
      classificationRows: classificationRows.length,
      sourceCounts: sourceCounts(records)
    },
    quality: {
      needsReviewRows,
      lowConfidenceRows,
      qualityFlagRows,
      unknownProductTypeRows,
      unknownHazardTypeRows
    },
    invalidRows: invalidRows.slice(0, 50),
    missingCanonicalIds: missingCanonicalIds.slice(0, 50),
    extraRows: extraRows.slice(0, 50)
  };

  await mkdir(outputDir, { recursive: true });
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
