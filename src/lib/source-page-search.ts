import { categorySearchTextFor } from './category-search';
import type { SiteRecall } from './recall-data';

export function sourcePageSearchTextFor(recall: SiteRecall): string {
  return [
    categorySearchTextFor(recall),
    recall.source,
    recall.sourceUrl,
    recall.classification ?? '',
    recall.status ?? ''
  ].join(' ');
}
