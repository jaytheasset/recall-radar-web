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
    (recall.source === 'EU_SAFETY_GATE' ||
      recall.source === 'CA_RECALLS' ||
      recall.source === 'AU_PRODUCT_SAFETY' ||
      recall.source === 'NZ_PRODUCT_SAFETY' ||
      recall.source === 'HK_CFS' ||
      recall.source === 'FSANZ_FOOD_RECALLS') &&
    (context === 'card' || context === 'list' || context === 'related');
  const fullUrl = recall.primaryImageUrl;
  const thumbnailUrl = recall.primaryImageThumbnailUrl;
  const url = shouldUseThumbnail ? thumbnailUrl || fullUrl : fullUrl;

  return {
    url,
    alt: recall.primaryImageAlt || recall.title
  };
}

export function getDisplayImageCaption(caption?: string): string | undefined {
  const cleanCaption = caption?.trim().replace(/\s+/g, ' ');
  if (!cleanCaption) {
    return undefined;
  }

  const imageFilenamePattern = /(?:^|[\\/])[^\\/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)(?:\?.*)?$/i;
  const genericCaptionPattern = /^(?:image|photo|product image|recall image|notification image|safety gate product image)$/i;
  if (imageFilenamePattern.test(cleanCaption) || genericCaptionPattern.test(cleanCaption)) {
    return undefined;
  }

  return cleanCaption;
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
  const isProgressive =
    (recall.source === 'EU_SAFETY_GATE' ||
      recall.source === 'AU_PRODUCT_SAFETY' ||
      recall.source === 'NZ_PRODUCT_SAFETY' ||
      recall.source === 'HK_CFS' ||
      recall.source === 'FSANZ_FOOD_RECALLS') &&
    Boolean(fullSrc && thumbnailSrc && fullSrc !== thumbnailSrc);

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
