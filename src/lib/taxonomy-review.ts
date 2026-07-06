type TaxonomyReviewInput = {
  taxonomyNeedsReview?: boolean;
  taxonomyConfidence?: number;
  taxonomyProductFamily?: string;
  taxonomyHazardType?: string;
  taxonomyQualityFlags?: string[];
};

const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

export const TAXONOMY_REVIEW_LABEL = 'Category needs review';
export const TAXONOMY_REVIEW_NOTICE =
  'This category label is under review. Verify product details with the official notice.';

export function needsTaxonomyReview(record: TaxonomyReviewInput): boolean {
  const confidenceNeedsReview =
    typeof record.taxonomyConfidence === 'number' && record.taxonomyConfidence < REVIEW_CONFIDENCE_THRESHOLD;

  return Boolean(
    record.taxonomyNeedsReview ||
      confidenceNeedsReview ||
      record.taxonomyProductFamily === 'unknown' ||
      record.taxonomyHazardType === 'unknown' ||
      (record.taxonomyQualityFlags?.length ?? 0) > 0
  );
}
