import type { SiteRecall } from './recall-data';
import type { RecallImage } from '../data/recall-types';

export type RecallImageContext = 'card' | 'list' | 'related' | 'detailHero';

export type RecallImageSelection = {
  url?: string;
  alt: string;
};

export type DetailHeroImageSources = {
  initialSrc?: string;
  fullSrc?: string;
  thumbnailSrc?: string;
  srcset?: string;
  sizes?: string;
  isProgressive: boolean;
  loading: 'eager' | 'lazy';
  decoding: 'async';
  fetchpriority?: 'high';
};

export type DetailHeroImagePreloadAttributes = {
  href: string;
  imagesrcset?: string;
  imagesizes?: string;
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

export function getDetailHeroImageSources(
  recall: Pick<SiteRecall, 'source' | 'primaryImageUrl' | 'primaryImageThumbnailUrl'>,
  image?: RecallImage
): DetailHeroImageSources {
  const loadingAttributes = getImageLoadingAttributes('detailHero');
  const fullSrc = image?.url || recall.primaryImageUrl;
  const thumbnailSrc = image?.thumbnailUrl || recall.primaryImageThumbnailUrl;
  const isProgressive = recall.source === 'EU_SAFETY_GATE' && Boolean(fullSrc && thumbnailSrc && fullSrc !== thumbnailSrc);

  if (isProgressive) {
    return {
      initialSrc: thumbnailSrc,
      fullSrc,
      thumbnailSrc,
      isProgressive,
      ...loadingAttributes
    };
  }

  return {
    initialSrc: fullSrc,
    fullSrc,
    thumbnailSrc,
    isProgressive: false,
    ...loadingAttributes
  };
}

export function getDetailHeroImagePreloadAttributes(
  recall: Pick<SiteRecall, 'source' | 'primaryImageUrl' | 'primaryImageThumbnailUrl'>,
  image?: RecallImage
): DetailHeroImagePreloadAttributes | undefined {
  const sources = getDetailHeroImageSources(recall, image);
  const href = sources.initialSrc;
  if (!href) {
    return undefined;
  }

  return {
    href,
    ...(sources.srcset ? { imagesrcset: sources.srcset } : {}),
    ...(sources.sizes ? { imagesizes: sources.sizes } : {})
  };
}
