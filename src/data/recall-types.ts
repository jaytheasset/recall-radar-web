export type RecallSource =
  | 'CPSC'
  | 'FDA'
  | 'FR_RAPPELCONSO'
  | 'CA_RECALLS'
  | 'EU_SAFETY_GATE'
  | 'UK_FSA'
  | 'AU_PRODUCT_SAFETY'
  | 'NZ_PRODUCT_SAFETY'
  | 'HK_CFS'
  | 'FSANZ_FOOD_RECALLS';
export type ProcessedRecallSource = RecallSource | 'MULTI';

export type RecallImage = {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  alt?: string;
};

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
  images?: RecallImage[];
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  primaryImageAlt?: string;
  raw: unknown;
};

export type ProcessedRecallFile = {
  generatedAt: string;
  source: ProcessedRecallSource;
  count: number;
  records: NormalizedRecall[];
};
