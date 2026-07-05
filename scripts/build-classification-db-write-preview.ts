// @ts-nocheck
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceOutputDir = 'outputs/llm-classifier/full-source-specific-preview';
const sourceResultsPath = resolve(projectRoot, sourceOutputDir, 'full-source-specific-classifier-results.json');
const outputDir = 'outputs/llm-classifier/db-write-preview';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const runPath = resolve(absoluteOutputDir, 'classification-run.json');
const rowsPath = resolve(absoluteOutputDir, 'recall-classifications.json');
const summaryPath = resolve(absoluteOutputDir, 'classification-db-write-preview-summary.json');
const markdownPath = resolve(absoluteOutputDir, 'classification-db-write-preview.md');

type SourceResult = {
  recordId: string;
  source: RecallSource;
  title: string;
  sourceUrl: string;
  recallDate: string;
  success: boolean;
  failed: boolean;
  errors: string[];
  evidenceFieldRepairs?: Array<{ from: string; to: string }>;
  enumRepairs?: Array<{ field: string; from: string; to: string }>;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCharacters: number;
  qualityFlags: string[];
  classification?: {
    taxonomyVersion: string;
    method: string;
    model?: string;
    promptVersion?: string;
    productFamily: string;
    productType: string;
    hazardType: string;
    hazardTags: string[];
    recallDomain: string;
    audience: string[];
    confidence: number;
    needsReview: boolean;
    reason: string;
    evidenceFields: string[];
  };
};

type SourcePreviewPayload = {
  generatedAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputMode: 'source-specific';
  totalRecords: number;
  selectedRecords: number;
  completedRecords: number;
  success: number;
  failed: number;
  needsReview: number;
  lowConfidence: number;
  unknownProductFamily: number;
  unknownProductType: number;
  unknownHazardType: number;
  sourceCounts: Record<string, number>;
  sourceSuccess: Record<string, number>;
  sourceFailures: Record<string, number>;
  sourceNeedsReview: Record<string, number>;
  qualityFlagCounts: Record<string, number>;
  familyDistribution: Record<string, number>;
  hazardDistribution: Record<string, number>;
  costEstimate: {
    totalInputTokens: number;
    totalOutputTokens: number;
    inputUsdPer1M: number | null;
    outputUsdPer1M: number | null;
    estimatedCostUsd: number | null;
  };
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

function stableRunId(payload: SourcePreviewPayload): string {
  const material = payload.results
    .map((result) => ({
      id: result.recordId,
      source: result.source,
      classification: result.classification
        ? {
            productFamily: result.classification.productFamily,
            productType: result.classification.productType,
            hazardType: result.classification.hazardType,
            recallDomain: result.classification.recallDomain,
            audience: result.classification.audience,
            confidence: result.classification.confidence,
            needsReview: result.classification.needsReview
          }
        : null
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const hash = createHash('sha256')
    .update(JSON.stringify({
      provider: payload.provider,
      model: payload.model,
      promptVersion: payload.promptVersion,
      inputMode: payload.inputMode,
      totalRecords: payload.totalRecords,
      material
    }))
    .digest('hex')
    .slice(0, 16);

  return `taxonomy-v2-${payload.provider}-${hash}`;
}

function reviewStatus(result: SourceResult): 'auto-accept-candidate' | 'manual-review-candidate' | 'failed' {
  if (!result.classification || result.failed) {
    return 'failed';
  }
  if (
    result.classification.needsReview ||
    result.classification.confidence < 0.75 ||
    result.classification.productFamily === 'unknown'
  ) {
    return 'manual-review-candidate';
  }
  return 'auto-accept-candidate';
}

function buildRun(payload: SourcePreviewPayload, records: NormalizedRecall[], runId: string, createdAt: string) {
  return {
    runId,
    status: 'preview',
    dbWrites: false,
    canonicalDataWrites: false,
    sourceResultPath: `${sourceOutputDir}/full-source-specific-classifier-results.json`,
    targetTables: {
      run: 'classification_runs',
      classifications: 'recall_classifications'
    },
    taxonomyVersion: 'recall-taxonomy-v2',
    provider: payload.provider,
    model: payload.model,
    promptVersion: payload.promptVersion,
    inputMode: payload.inputMode,
    createdAt,
    sourceGeneratedAt: payload.generatedAt,
    totalRecords: records.length,
    selectedRecords: payload.selectedRecords,
    completedRecords: payload.completedRecords,
    success: payload.success,
    failed: payload.failed,
    needsReview: payload.needsReview,
    lowConfidence: payload.lowConfidence,
    unknownProductFamily: payload.unknownProductFamily,
    unknownProductType: payload.unknownProductType,
    unknownHazardType: payload.unknownHazardType,
    sourceCounts: sourceCounts(records),
    sourceSuccess: payload.sourceSuccess,
    sourceFailures: payload.sourceFailures,
    sourceNeedsReview: payload.sourceNeedsReview,
    qualityFlagCounts: qualityFlagCounts(payload.results),
    familyDistribution: payload.familyDistribution,
    hazardDistribution: payload.hazardDistribution,
    costEstimate: payload.costEstimate,
    outputFiles: {
      run: `${outputDir}/classification-run.json`,
      classifications: `${outputDir}/recall-classifications.json`,
      summary: `${outputDir}/classification-db-write-preview-summary.json`
    }
  };
}

function buildRows(payload: SourcePreviewPayload, records: NormalizedRecall[], runId: string, createdAt: string) {
  const recordMap = new Map(records.map((record) => [record.id, record]));

  return payload.results.map((result) => {
    const record = recordMap.get(result.recordId);
    const classification = result.classification;

    return {
      id: `${runId}:${result.recordId}`,
      runId,
      recallId: result.recordId,
      source: result.source,
      sourceUrl: result.sourceUrl || record?.sourceUrl || '',
      recallDate: result.recallDate || record?.recallDate || '',
      title: result.title || record?.title || '',
      taxonomyVersion: classification?.taxonomyVersion ?? 'recall-taxonomy-v2',
      method: classification?.method ?? 'llm',
      provider: payload.provider,
      model: classification?.model ?? payload.model,
      promptVersion: classification?.promptVersion ?? payload.promptVersion,
      productFamily: classification?.productFamily ?? 'unknown',
      productType: classification?.productType ?? 'unknown',
      hazardType: classification?.hazardType ?? 'unknown',
      hazardTags: classification?.hazardTags ?? [],
      recallDomain: classification?.recallDomain ?? 'unknown',
      audience: classification?.audience ?? ['unknown'],
      confidence: classification?.confidence ?? 0,
      needsReview: classification?.needsReview ?? true,
      reviewStatus: reviewStatus(result),
      reason: classification?.reason ?? '',
      evidenceFields: classification?.evidenceFields ?? [],
      qualityFlags: result.qualityFlags ?? [],
      evidenceFieldRepairs: result.evidenceFieldRepairs ?? [],
      enumRepairs: result.enumRepairs ?? [],
      classifierMetrics: {
        estimatedInputTokens: result.estimatedInputTokens,
        estimatedOutputTokens: result.estimatedOutputTokens,
        inputCharacters: result.inputCharacters
      },
      sourceSnapshot: {
        productNames: record?.productNames ?? [],
        brandNames: record?.brandNames ?? [],
        legacyCategory: record?.category ?? '',
        recallNumber: record?.recallNumber ?? ''
      },
      errors: result.errors ?? [],
      createdAt
    };
  });
}

function markdown(run: Record<string, unknown>, rows: Array<Record<string, unknown>>): string {
  const reviewCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const key = String(row.reviewStatus ?? 'unknown');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return [
    '# Classification DB Write Preview',
    '',
    'This preview shapes the full source-specific Gemini classification output into records that could be inserted later. It does not write to a database or canonical data.',
    '',
    `Run ID: ${run.runId}`,
    `Status: ${run.status}`,
    `DB writes: ${String(run.dbWrites)}`,
    `Canonical data writes: ${String(run.canonicalDataWrites)}`,
    '',
    '## Target Tables',
    '',
    '- `classification_runs`',
    '- `recall_classifications`',
    '',
    '## Counts',
    '',
    '```json',
    JSON.stringify({
      totalRecords: run.totalRecords,
      rows: rows.length,
      success: run.success,
      failed: run.failed,
      reviewCounts,
      sourceCounts: run.sourceCounts
    }, null, 2),
    '```',
    '',
    '## Quality',
    '',
    '```json',
    JSON.stringify({
      needsReview: run.needsReview,
      lowConfidence: run.lowConfidence,
      unknownProductFamily: run.unknownProductFamily,
      unknownProductType: run.unknownProductType,
      unknownHazardType: run.unknownHazardType,
      qualityFlagCounts: run.qualityFlagCounts
    }, null, 2),
    '```',
    '',
    '## Next Gate',
    '',
    'Review this preview and its audit before any database insert, canonical V2 JSON generation, or runtime migration phase.'
  ].join('\n');
}

async function run(): Promise<void> {
  const [sourceText, processedText] = await Promise.all([
    readFile(sourceResultsPath, 'utf8'),
    readFile(resolve(projectRoot, 'data/processed/recalls.json'), 'utf8')
  ]);

  const payload = JSON.parse(sourceText) as SourcePreviewPayload;
  const processed = JSON.parse(processedText) as ProcessedRecallFile;
  const records = Array.isArray(processed.records) ? processed.records : [];
  const createdAt = new Date().toISOString();
  const runId = stableRunId(payload);
  const runRecord = buildRun(payload, records, runId, createdAt);
  const classificationRows = buildRows(payload, records, runId, createdAt);

  const summary = {
    generatedAt: createdAt,
    runId,
    sourceResultPath: `${sourceOutputDir}/full-source-specific-classifier-results.json`,
    outputDir,
    dbWrites: false,
    canonicalDataWrites: false,
    targetTables: runRecord.targetTables,
    counts: {
      canonicalRecords: records.length,
      previewResults: payload.results.length,
      classificationRows: classificationRows.length,
      success: payload.success,
      failed: payload.failed
    },
    sourceCounts: runRecord.sourceCounts,
    quality: {
      needsReview: runRecord.needsReview,
      lowConfidence: runRecord.lowConfidence,
      unknownProductFamily: runRecord.unknownProductFamily,
      unknownProductType: runRecord.unknownProductType,
      unknownHazardType: runRecord.unknownHazardType,
      qualityFlagCounts: runRecord.qualityFlagCounts
    }
  };

  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(runPath, `${JSON.stringify(runRecord, null, 2)}\n`, 'utf8');
  await writeFile(rowsPath, `${JSON.stringify(classificationRows, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${markdown(runRecord, classificationRows)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
