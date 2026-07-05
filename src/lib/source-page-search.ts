import { categorySearchTextFor } from './category-search';
import type { SiteRecall } from './recall-data';

export function sourcePageSearchTextFor(recall: SiteRecall): string {
  return [
    categorySearchTextFor(recall),
    recall.source,
    recall.sourceUrl,
    recall.classification ?? '',
    recall.status ?? '',
    recall.taxonomyProductFamily ?? '',
    recall.taxonomyProductFamilyLabel ?? '',
    recall.taxonomyProductType ?? '',
    recall.taxonomyProductTypeLabel ?? '',
    recall.taxonomyHazardType ?? '',
    recall.taxonomyHazardTypeLabel ?? '',
    recall.taxonomyRecallDomain ?? '',
    recall.taxonomyRecallDomainLabel ?? '',
    recall.taxonomyReason ?? '',
    ...(recall.taxonomyHazardTags ?? []),
    ...(recall.taxonomyAudienceLabels ?? [])
  ].join(' ');
}
