import processedClassificationV2Data from '../../data/processed/recall-classifications-v2.json';
import type { RecallClassificationV2 } from '../data/recall-taxonomy-v2';

export type ProcessedClassificationV2Record = {
  recordId: string;
  source: string;
  success?: boolean;
  failed?: boolean;
  errors?: string[];
  qualityFlags?: string[];
  classification?: RecallClassificationV2;
};

type ProcessedClassificationV2File = {
  generatedAt?: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  taxonomyVersion?: string;
  totalRecords?: number;
  success?: number;
  failed?: number;
  sourceCounts?: Record<string, number>;
  qualityFlagCounts?: Record<string, number>;
  records?: ProcessedClassificationV2Record[];
};

const processedClassificationV2File = processedClassificationV2Data as ProcessedClassificationV2File;
const classificationRecords = Array.isArray(processedClassificationV2File.records)
  ? processedClassificationV2File.records
  : [];

export const classificationV2ResultsById = new Map<string, ProcessedClassificationV2Record>(
  classificationRecords
    .filter((record) => record.success && !record.failed && record.classification)
    .map((record) => [record.recordId, record])
);

export const classificationV2RuntimeStats = {
  generatedAt: processedClassificationV2File.generatedAt ?? '',
  provider: processedClassificationV2File.provider ?? '',
  model: processedClassificationV2File.model ?? '',
  promptVersion: processedClassificationV2File.promptVersion ?? '',
  taxonomyVersion: processedClassificationV2File.taxonomyVersion ?? '',
  totalRecords: processedClassificationV2File.totalRecords ?? classificationRecords.length,
  success: processedClassificationV2File.success ?? classificationV2ResultsById.size,
  failed: processedClassificationV2File.failed ?? 0,
  recordCount: classificationRecords.length,
  classifiedRecordCount: classificationV2ResultsById.size,
  sourceCounts: processedClassificationV2File.sourceCounts ?? {},
  qualityFlagCounts: processedClassificationV2File.qualityFlagCounts ?? {}
};

export function getClassificationV2Result(recordId: string): ProcessedClassificationV2Record | undefined {
  return classificationV2ResultsById.get(recordId);
}

export function hasCompleteClassificationV2Coverage(expectedRecordCount: number): boolean {
  return (
    expectedRecordCount > 0 &&
    classificationV2RuntimeStats.failed === 0 &&
    classificationV2RuntimeStats.totalRecords === expectedRecordCount &&
    classificationV2RuntimeStats.success === expectedRecordCount &&
    classificationV2RuntimeStats.classifiedRecordCount === expectedRecordCount
  );
}
