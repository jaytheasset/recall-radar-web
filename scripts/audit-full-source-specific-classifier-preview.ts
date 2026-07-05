// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProcessedRecallFile } from '../src/data/recall-types.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = 'outputs/llm-classifier/full-source-specific-preview';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const resultsPath = resolve(absoluteOutputDir, 'full-source-specific-classifier-results.json');
const auditJsonPath = resolve(absoluteOutputDir, 'full-source-specific-classifier-audit.json');
const auditMarkdownPath = resolve(absoluteOutputDir, 'full-source-specific-classifier-audit.md');

type PreviewResult = {
  recordId: string;
  source: string;
  success: boolean;
  failed: boolean;
  errors: string[];
  qualityFlags: string[];
  evidenceFieldRepairs: Array<{ from: string; to: string }>;
  enumRepairs?: Array<{ field: string; from: string; to: string }>;
  classification?: {
    productFamily: string;
    productType: string;
    hazardType: string;
    recallDomain: string;
    confidence: number;
    needsReview: boolean;
  };
};

type PreviewPayload = {
  provider: string;
  model: string;
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
  costEstimate: unknown;
  results: PreviewResult[];
};

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

function topReviewCandidates(results: PreviewResult[]): PreviewResult[] {
  return results
    .filter((result) => result.failed || result.qualityFlags.length > 0 || result.classification?.needsReview)
    .sort((left, right) => {
      const leftScore = (left.failed ? 100 : 0) + left.qualityFlags.length * 5 + (left.classification?.needsReview ? 10 : 0) - (left.classification?.confidence ?? 0);
      const rightScore = (right.failed ? 100 : 0) + right.qualityFlags.length * 5 + (right.classification?.needsReview ? 10 : 0) - (right.classification?.confidence ?? 0);
      return rightScore - leftScore;
    })
    .slice(0, 50);
}

function markdown(audit: Record<string, unknown>): string {
  const candidates = audit.reviewCandidates as Array<{
    source: string;
    recordId: string;
    family?: string;
    type?: string;
    hazard?: string;
    confidence?: number;
    flags: string[];
  }>;

  return [
    '# Full Source-Specific Classifier Preview Audit',
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
    '## Quality Metrics',
    '',
    '```json',
    JSON.stringify(audit.quality, null, 2),
    '```',
    '',
    '## Review Candidates',
    '',
    candidates.length
      ? candidates.map((item) => `- ${item.source} ${item.recordId}: ${item.family ?? 'failed'} / ${item.type ?? 'failed'} / ${item.hazard ?? 'failed'} confidence=${item.confidence ?? 'n/a'} flags=${item.flags.join(', ') || 'none'}`).join('\n')
      : '- None'
  ].join('\n');
}

async function run(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  add(blockers, existsSync(resultsPath), `${resultsPath} is missing. Run npm run classify:recalls:taxonomy-v2:full-source-specific-preview first.`);

  const processed = JSON.parse(await readFile(resolve(projectRoot, 'data/processed/recalls.json'), 'utf8')) as ProcessedRecallFile;
  const records = Array.isArray(processed.records) ? processed.records : [];
  const expectedSourceCounts = sourceCounts(records);

  let payload: PreviewPayload | null = null;
  if (existsSync(resultsPath)) {
    payload = JSON.parse(await readFile(resultsPath, 'utf8')) as PreviewPayload;
  }

  if (payload) {
    add(blockers, payload.totalRecords === records.length, `Preview totalRecords ${payload.totalRecords} does not match canonical count ${records.length}.`);
    add(blockers, payload.selectedRecords === records.length, `Preview selectedRecords ${payload.selectedRecords} does not match canonical count ${records.length}.`);
    add(blockers, payload.completedRecords === records.length, `Preview completedRecords ${payload.completedRecords} does not match canonical count ${records.length}.`);
    add(blockers, payload.success === records.length, `Preview success ${payload.success} does not match canonical count ${records.length}.`);
    add(blockers, payload.failed === 0, `Preview has ${payload.failed} failed classifications.`);
    add(blockers, Array.isArray(payload.results) && payload.results.length === records.length, 'Preview results length must match canonical count.');
    add(blockers, sameCounts(payload.sourceCounts, expectedSourceCounts), 'Preview source counts do not match canonical source counts.');

    const duplicateIds = payload.results.length - new Set(payload.results.map((result) => result.recordId)).size;
    add(blockers, duplicateIds === 0, `Preview has ${duplicateIds} duplicate record ids.`);

    if (payload.needsReview > Math.ceil(records.length * 0.2)) {
      warnings.push(`High needsReview volume: ${payload.needsReview}.`);
    }
    if (payload.unknownProductFamily > Math.ceil(records.length * 0.08)) {
      warnings.push(`High unknown productFamily volume: ${payload.unknownProductFamily}.`);
    }
    if (payload.unknownHazardType > Math.ceil(records.length * 0.18)) {
      warnings.push(`High unknown hazardType volume: ${payload.unknownHazardType}.`);
    }
  }

  const trackedOutputs = gitOutput(['ls-files', outputDir]);
  add(blockers, trackedOutputs.length === 0, `${outputDir} must remain untracked.`);

  const dataChanges = gitOutput(['diff', '--name-only', '--', 'data/raw', 'data/processed']);
  add(blockers, dataChanges.length === 0, `Canonical data changed unexpectedly: ${dataChanges}`);

  const sourceChanges = gitOutput(['diff', '--name-only', '--cached', '--', 'data/raw', 'data/processed']);
  add(blockers, sourceChanges.length === 0, `Canonical data is staged unexpectedly: ${sourceChanges}`);

  const quality = payload
    ? {
        needsReview: payload.needsReview,
        lowConfidence: payload.lowConfidence,
        unknownProductFamily: payload.unknownProductFamily,
        unknownProductType: payload.unknownProductType,
        unknownHazardType: payload.unknownHazardType,
        sourceNeedsReview: payload.sourceNeedsReview,
        qualityFlagCounts: payload.qualityFlagCounts,
        evidenceFieldRepairRecords: payload.results.filter((result) => result.evidenceFieldRepairs.length > 0).length,
        enumRepairRecords: payload.results.filter((result) => (result.enumRepairs ?? []).length > 0).length
      }
    : null;

  const audit = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    summary: payload
      ? {
          provider: payload.provider,
          model: payload.model,
          totalRecords: payload.totalRecords,
          selectedRecords: payload.selectedRecords,
          completedRecords: payload.completedRecords,
          success: payload.success,
          failed: payload.failed,
          sourceCounts: payload.sourceCounts,
          costEstimate: payload.costEstimate
        }
      : null,
    quality,
    reviewCandidates: payload
      ? topReviewCandidates(payload.results).map((result) => ({
          source: result.source,
          recordId: result.recordId,
          family: result.classification?.productFamily,
          type: result.classification?.productType,
          hazard: result.classification?.hazardType,
          confidence: result.classification?.confidence,
          flags: result.qualityFlags,
          errors: result.errors
        }))
      : [],
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
