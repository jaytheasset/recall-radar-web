import type { SiteRecall } from './recall-data';
import { buildRecallSearchText } from './multilingual-search';

export function categorySearchTextFor(recall: SiteRecall): string {
  return buildRecallSearchText(recall);
}
