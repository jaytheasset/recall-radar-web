import type { RecallSource } from './recall-types';
import type {
  ClassificationEvidenceField,
  HazardType,
  ProductFamily,
  ProductType,
  RecallAudience,
  RecallClassificationV2,
  RecallDomain
} from './recall-taxonomy-v2';

export const RECALL_DATA_SCHEMA_VERSION = 'recall-data-schema-v2' as const;

export type RecallIdentifierTypeV2 =
  | 'barcode'
  | 'gtin'
  | 'upc'
  | 'ean'
  | 'model-number'
  | 'item-number'
  | 'serial-number'
  | 'lot-code'
  | 'batch-code'
  | 'date-code'
  | 'best-before-date'
  | 'use-by-date'
  | 'expiry-date'
  | 'pack-size'
  | 'certification-number'
  | 'recall-number'
  | 'alert-number'
  | 'notice-id'
  | 'sku'
  | 'product-code'
  | 'manufacturer-code'
  | 'retailer'
  | 'importer'
  | 'distributor'
  | 'origin-country'
  | 'date-range'
  | 'other';

export type RecallIdentifierV2 = {
  type: RecallIdentifierTypeV2;
  value: string;
  label?: string;
  sourceField?: ClassificationEvidenceField | 'raw' | string;
  confidence?: number;
  display?: boolean;
};

export type RecallImageV2 = {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  alt?: string;
  sourceField?: 'images' | 'primaryImageUrl' | 'raw';
};

export type RecallDataSourceV2 = {
  source: RecallSource;
  sourceLabel: string;
  market: string;
  agency: string;
  expectedCurrentCount?: number;
};

export type NormalizedRecallV2 = {
  schemaVersion: typeof RECALL_DATA_SCHEMA_VERSION;
  id: string;
  source: RecallSource;
  sourceRecordId?: string;
  sourceUrl: string;
  sourceLabel?: string;
  market?: string;
  agency?: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  recallDate: string;
  lastUpdated?: string;
  description?: string;
  hazard?: string;
  remedy?: string;
  affectedUnits?: string;
  identifiers?: RecallIdentifierV2[];
  images?: RecallImageV2[];
  classification: RecallClassificationV2;
  legacyCategory?: string;
  raw: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type RecallSchemaV2ValidationResult = {
  passed: boolean;
  recordCount: number;
  sourceCounts: Partial<Record<RecallSource, number>>;
  missingRequiredFields: Array<{
    id: string;
    field: keyof NormalizedRecallV2;
  }>;
  invalidTaxonomyValues: Array<{
    id: string;
    field: 'productFamily' | 'productType' | 'hazardType' | 'recallDomain' | 'audience';
    value: ProductFamily | ProductType | HazardType | RecallDomain | RecallAudience | string;
  }>;
  needsReviewIds: string[];
  warnings: string[];
};

export type RecallSchemaV2MigrationPlan = {
  sourcePath: 'data/processed/recalls.json';
  classifierOutputPath: 'outputs/llm-classifier/per-source/';
  futureCanonicalPath: 'data/processed/recalls-v2.json';
  autoAcceptConfidenceMinimum: 0.75;
  reviewRules: Array<'needsReview' | 'low-confidence' | 'unknown-product-family' | 'invalid-enum' | 'missing-required-field'>;
  targetRuntimeFields: Array<keyof NormalizedRecallV2>;
};
