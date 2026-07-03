import type { SiteRecall } from './recall-data';

export type RecallImageContext = 'card' | 'list' | 'related' | 'detailHero';

export type RecallImageSelection = {
  url?: string;
  alt: string;
};

export function getRecallImageForContext(
  recall: Pick<SiteRecall, 'source' | 'title' | 'primaryImageUrl' | 'primaryImageThumbnailUrl' | 'primaryImageAlt'>,
  context: RecallImageContext
): RecallImageSelection {
  const shouldUseThumbnail =
    recall.source === 'EU_SAFETY_GATE' && (context === 'card' || context === 'list' || context === 'related');
  const url = shouldUseThumbnail ? recall.primaryImageThumbnailUrl || recall.primaryImageUrl : recall.primaryImageUrl;

  return {
    url,
    alt: recall.primaryImageAlt || recall.title
  };
}

export function getImageLoadingAttributes(
  context: RecallImageContext,
  index = 0
): { loading: 'eager' | 'lazy'; decoding: 'async'; fetchpriority?: 'high' } {
  if (context === 'detailHero') {
    return { loading: 'eager', decoding: 'async', fetchpriority: 'high' };
  }

  if (context === 'card' && index === 0) {
    return { loading: 'eager', decoding: 'async', fetchpriority: 'high' };
  }

  return { loading: 'lazy', decoding: 'async' };
}
