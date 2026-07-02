import type { SiteRecall } from './recall-data';

export function categorySearchTextFor(recall: SiteRecall): string {
  return [
    recall.title,
    recall.sourceLabel,
    recall.primaryBrand,
    recall.primaryBrandRawName,
    recall.primaryProductName,
    recall.rawCategory,
    recall.categoryLabel,
    recall.hazard,
    recall.reason ?? '',
    recall.remedy,
    recall.description,
    recall.affectedUnits,
    recall.productQuantity ?? '',
    recall.distributionPattern ?? '',
    recall.recallNumber ?? '',
    ...recall.brandNames,
    ...recall.displayBrandNames,
    ...recall.productNames
  ]
    .join(' ')
    .toLowerCase();
}
