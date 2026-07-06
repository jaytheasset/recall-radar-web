import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type CanonicalRecall = {
  id: string;
  source: string;
};

type ClassificationResult = {
  recordId: string;
  source: string;
  success?: boolean;
  failed?: boolean;
  qualityFlags?: string[];
  classification?: {
    productFamily?: string;
    productType?: string;
    hazardType?: string;
    confidence?: number;
    needsReview?: boolean;
  };
};

type ProcessedRecallFile = {
  records?: CanonicalRecall[];
};

type ClassificationFile = {
  promptVersion?: string;
  provider?: string;
  model?: string;
  taxonomyVersion?: string;
  totalRecords?: number;
  success?: number;
  failed?: number;
  qualityFlagCounts?: Record<string, number>;
  records?: ClassificationResult[];
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const blockers: string[] = [];
const warnings: string[] = [];

async function readText(relativePath: string): Promise<string> {
  return readFile(resolve(projectRoot, relativePath), 'utf8');
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readText(relativePath)) as T;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    blockers.push(message);
  }
}

function countBySource(records: Array<{ source: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
  }
  return counts;
}

const recallsFile = await readJson<ProcessedRecallFile>('data/processed/recalls.json');
const classificationFile = await readJson<ClassificationFile>('data/processed/recall-classifications-v2.json');
const recallDataSource = await readText('src/lib/recall-data.ts');
const classificationRuntimeSource = await readText('src/lib/classification-results-v2.ts');
const recallRecords = Array.isArray(recallsFile.records) ? recallsFile.records : [];
const classificationRecords = Array.isArray(classificationFile.records) ? classificationFile.records : [];
const canonicalIds = new Set(recallRecords.map((record) => record.id));
const successfulClassifications = classificationRecords.filter(
  (record) => record.success && !record.failed && record.classification
);
const classificationById = new Map(successfulClassifications.map((record) => [record.recordId, record]));
const missingRuntimeIds = recallRecords
  .filter((record) => !classificationById.has(record.id))
  .map((record) => record.id);
const extraRuntimeIds = successfulClassifications
  .filter((record) => !canonicalIds.has(record.recordId))
  .map((record) => record.recordId);
const missingFamily = successfulClassifications
  .filter((record) => !record.classification?.productFamily)
  .map((record) => record.recordId);
const missingProductType = successfulClassifications
  .filter((record) => !record.classification?.productType)
  .map((record) => record.recordId);
const missingHazard = successfulClassifications
  .filter((record) => !record.classification?.hazardType)
  .map((record) => record.recordId);
const reviewRows = successfulClassifications.filter(
  (record) =>
    record.classification?.needsReview ||
    (typeof record.classification?.confidence === 'number' && record.classification.confidence < 0.75) ||
    record.classification?.productFamily === 'unknown' ||
    record.classification?.hazardType === 'unknown' ||
    (record.qualityFlags?.length ?? 0) > 0
);

assert(recallRecords.length === 1201, `Expected 1201 canonical recalls, found ${recallRecords.length}.`);
assert(classificationFile.totalRecords === recallRecords.length, 'Classification totalRecords does not match canonical recall count.');
assert(classificationFile.success === recallRecords.length, 'Classification success count does not match canonical recall count.');
assert(classificationFile.failed === 0, 'Classification file contains failed rows.');
assert(successfulClassifications.length === recallRecords.length, 'Successful classification rows do not match canonical recall count.');
assert(missingRuntimeIds.length === 0, `Missing classifications for ${missingRuntimeIds.length} canonical recalls.`);
assert(extraRuntimeIds.length === 0, `Extra classifications not in canonical recalls: ${extraRuntimeIds.length}.`);
assert(missingFamily.length === 0, `Missing productFamily for ${missingFamily.length} classifications.`);
assert(missingProductType.length === 0, `Missing productType for ${missingProductType.length} classifications.`);
assert(missingHazard.length === 0, `Missing hazardType for ${missingHazard.length} classifications.`);
assert(
  classificationRuntimeSource.includes('processedClassificationV2Data') &&
    classificationRuntimeSource.includes('classificationV2ResultsById') &&
    classificationRuntimeSource.includes('getClassificationV2Result'),
  'src/lib/classification-results-v2.ts does not expose the expected runtime classification helpers.'
);
assert(
  recallDataSource.includes("from './classification-results-v2'") &&
    recallDataSource.includes('getClassificationV2Result(record.id)') &&
    recallDataSource.includes('taxonomyV2Record?.classification'),
  'src/lib/recall-data.ts does not join V2 classifications into SiteRecall records.'
);

if (reviewRows.length > 0) {
  warnings.push(`${reviewRows.length} classifications remain review candidates by confidence, unknown values, or quality flags.`);
}

const result = {
  passed: blockers.length === 0,
  runtimeJoin: {
    canonicalRecallCount: recallRecords.length,
    classificationRows: classificationRecords.length,
    successfulClassificationRows: successfulClassifications.length,
    promptVersion: classificationFile.promptVersion,
    provider: classificationFile.provider,
    model: classificationFile.model,
    taxonomyVersion: classificationFile.taxonomyVersion,
    canonicalSourceCounts: countBySource(recallRecords),
    classificationSourceCounts: countBySource(successfulClassifications)
  },
  quality: {
    reviewRows: reviewRows.length,
    qualityFlagCounts: classificationFile.qualityFlagCounts ?? {}
  },
  blockers,
  warnings,
  samples: {
    missingRuntimeIds: missingRuntimeIds.slice(0, 10),
    reviewCandidateIds: reviewRows.slice(0, 10).map((record) => record.recordId)
  }
};

console.log(JSON.stringify(result, null, 2));

if (blockers.length) {
  process.exitCode = 1;
}
