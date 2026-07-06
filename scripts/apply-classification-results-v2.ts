// @ts-nocheck
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { RECALL_TAXONOMY_VERSION } from '../src/data/recall-taxonomy-v2.ts';
import { validateClassificationOutput } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceResultsPath = resolve(
  projectRoot,
  'outputs/llm-classifier/full-source-specific-preview/full-source-specific-classifier-results.json'
);
const processedRecallsPath = resolve(projectRoot, 'data/processed/recalls.json');
const outputPath = resolve(projectRoot, 'data/processed/recall-classifications-v2.json');

type SourceResult = {
  recordId: string;
  source: RecallSource;
  title: string;
  sourceUrl: string;
  recallDate: string;
  success: boolean;
  failed: boolean;
  errors?: string[];
  qualityFlags?: string[];
  enumRepairs?: Array<{ field: string; from: string; to: string }>;
  evidenceFieldRepairs?: Array<{ from: string; to: string }>;
  classification?: unknown;
};

type SourcePayload = {
  generatedAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  totalRecords: number;
  success: number;
  failed: number;
  results: SourceResult[];
};

function sourceCounts(records: Array<{ source: string }>): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
}

function qualityFlagCounts(results: SourceResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((counts, result) => {
    for (const flag of result.qualityFlags ?? []) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
    return counts;
  }, {});
}

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.every((key) => left[key] === right[key]);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildOutput(payload: SourcePayload, records: NormalizedRecall[]) {
  const resultIds = new Set(payload.results.map((result) => result.recordId));
  const canonicalIds = new Set(records.map((record) => record.id));
  const recordsById = new Map(records.map((record) => [record.id, record]));

  const missing = records.filter((record) => !resultIds.has(record.id)).map((record) => record.id);
  const extra = payload.results.filter((result) => !canonicalIds.has(result.recordId)).map((result) => result.recordId);
  assert(missing.length === 0, `Missing ${missing.length} classification results. First: ${missing[0] ?? 'none'}`);
  assert(extra.length === 0, `Found ${extra.length} classification results not in canonical recalls. First: ${extra[0] ?? 'none'}`);
  assert(new Set(payload.results.map((result) => result.recordId)).size === payload.results.length, 'Duplicate classification result ids found.');
  assert(payload.failed === 0, `Cannot apply classifier results with ${payload.failed} failed records.`);
  assert(payload.success === records.length, `Classifier success ${payload.success} does not match canonical count ${records.length}.`);
  assert(payload.totalRecords === records.length, `Classifier totalRecords ${payload.totalRecords} does not match canonical count ${records.length}.`);
  assert(sameCounts(sourceCounts(payload.results), sourceCounts(records)), 'Classifier source counts do not match canonical source counts.');

  const outputRecords = payload.results.map((result) => {
    const record = recordsById.get(result.recordId)!;
    const validation = validateClassificationOutput(result.classification);
    assert(validation.ok, `${record.id} has invalid classification: ${validation.errors.join('; ')}`);

    return {
      recordId: record.id,
      source: record.source,
      title: result.title || record.title,
      recallDate: result.recallDate || record.recallDate,
      sourceUrl: result.sourceUrl || record.sourceUrl,
      success: result.success === true,
      failed: result.failed === true,
      errors: result.errors ?? [],
      qualityFlags: result.qualityFlags ?? [],
      enumRepairs: result.enumRepairs ?? [],
      evidenceFieldRepairs: result.evidenceFieldRepairs ?? [],
      classification: validation.classification
    };
  });

  return {
    generatedAt: payload.generatedAt,
    provider: payload.provider,
    model: payload.model,
    promptVersion: payload.promptVersion,
    taxonomyVersion: RECALL_TAXONOMY_VERSION,
    totalRecords: records.length,
    success: payload.success,
    failed: payload.failed,
    sourceCounts: sourceCounts(records),
    qualityFlagCounts: qualityFlagCounts(outputRecords),
    records: outputRecords
  };
}

async function run(): Promise<void> {
  const [sourceText, processedText] = await Promise.all([
    readFile(sourceResultsPath, 'utf8'),
    readFile(processedRecallsPath, 'utf8')
  ]);
  const payload = JSON.parse(sourceText) as SourcePayload;
  const processed = JSON.parse(processedText) as ProcessedRecallFile;
  const records = Array.isArray(processed.records) ? processed.records : [];
  const output = buildOutput(payload, records);
  const outputText = `${JSON.stringify(output, null, 2)}\n`;
  const currentText = await readFile(outputPath, 'utf8').catch(() => '');

  if (currentText !== outputText) {
    await writeFile(outputPath, outputText, 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        wrote: currentText !== outputText,
        outputPath: 'data/processed/recall-classifications-v2.json',
        totalRecords: output.totalRecords,
        success: output.success,
        failed: output.failed,
        sourceCounts: output.sourceCounts,
        qualityFlagCounts: output.qualityFlagCounts
      },
      null,
      2
    )
  );
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
