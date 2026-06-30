export type RecallSource = 'CPSC';

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
  raw: unknown;
};

export type ProcessedRecallFile = {
  generatedAt: string;
  source: RecallSource;
  count: number;
  records: NormalizedRecall[];
};
