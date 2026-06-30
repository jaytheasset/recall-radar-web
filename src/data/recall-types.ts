export type RecallSource = 'CPSC' | 'FDA';
export type ProcessedRecallSource = RecallSource | 'MULTI';

export type NormalizedRecall = {
  id: string;
  source: RecallSource;
  sourceUrl: string;
  title: string;
  brandNames: string[];
  productNames: string[];
  category: string;
  hazard: string;
  remedy: string;
  recallDate: string;
  affectedUnits: string;
  description: string;
  slug: string;
  classification?: string;
  reason?: string;
  distributionPattern?: string;
  productQuantity?: string;
  recallNumber?: string;
  status?: string;
  raw: unknown;
};

export type ProcessedRecallFile = {
  generatedAt: string;
  source: ProcessedRecallSource;
  count: number;
  records: NormalizedRecall[];
};
