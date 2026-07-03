import type { SiteRecall } from './recall-data';
import type { RecallImage } from '../data/recall-types';

export type RecallImageContext = 'card' | 'list' | 'related' | 'detailHero';

export type RecallImageSelection = {
  url?: string;
  alt: string;
};

export type DetailHeroImageSourceAttributes = {
  srcset?: string;
  sizes?: string;
};

export type DetailHeroImagePreloadAttributes = {
  href: string;
  imagesrcset?: string;
  imagesizes?: string;
};

const DETAIL_HERO_SIZES = '(max-width: 680px) calc(100vw - 2rem), (max-width: 980px) calc(100vw - 4rem), 720px';

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

export function getDetailHeroImageSourceAttributes(
  recall: Pick<SiteRecall, 'source' | 'primaryImageUrl' | 'primaryImageThumbnailUrl'>,
  image?: RecallImage
): DetailHeroImageSourceAttributes {
  if (recall.source !== 'EU_SAFETY_GATE') {
    return {};
  }

  const thumbnailUrl = image?.thumbnailUrl || recall.primaryImageThumbnailUrl;
  const fullUrl = image?.url || recall.primaryImageUrl;
  if (!thumbnailUrl || !fullUrl || thumbnailUrl === fullUrl) {
    return {};
  }

  return {
    srcset: `${thumbnailUrl} 480w, ${fullUrl} 1200w`,
    sizes: DETAIL_HERO_SIZES
  };
}

export function getDetailHeroImagePreloadAttributes(
  recall: Pick<SiteRecall, 'source' | 'primaryImageUrl' | 'primaryImageThumbnailUrl'>,
  image?: RecallImage
): DetailHeroImagePreloadAttributes | undefined {
  const href = image?.url || recall.primaryImageUrl;
  if (!href) {
    return undefined;
  }

  const sourceAttributes = getDetailHeroImageSourceAttributes(recall, image);
  return {
    href,
    ...(sourceAttributes.srcset ? { imagesrcset: sourceAttributes.srcset } : {}),
    ...(sourceAttributes.sizes ? { imagesizes: sourceAttributes.sizes } : {})
  };
}
