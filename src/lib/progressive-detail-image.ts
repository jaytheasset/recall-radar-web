function setBackgroundImagePriority(image: HTMLImageElement): void {
  if ('fetchPriority' in image) {
    (image as HTMLImageElement & { fetchPriority: 'low' | 'auto' | 'high' }).fetchPriority = 'low';
  }
}

function fullImageFromEuThumbnail(src: string): string {
  try {
    const url = new URL(src);
    if (
      url.hostname === 'ec.europa.eu' &&
      url.pathname.includes('/safety-gate-alerts/public/api/notification/thumbnail/')
    ) {
      url.pathname = url.pathname.replace('/notification/thumbnail/', '/notification/image/');
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
}

function loadFullImageAfterThumbnail(image: HTMLImageElement): void {
  const fullSrc = image.dataset.fullSrc?.trim();
  if (!fullSrc || image.dataset.progressiveState) {
    return;
  }

  image.dataset.progressiveState = 'loading';

  const fullImage = new Image();
  fullImage.decoding = 'async';
  setBackgroundImagePriority(fullImage);

  fullImage.onload = () => {
    image.src = fullSrc;
    image.removeAttribute('srcset');
    image.classList.add('image-loaded');
    image.dataset.progressiveState = 'loaded';
  };

  fullImage.onerror = () => {
    image.dataset.progressiveState = 'error';
  };

  fullImage.src = fullSrc;
}

function loadWhenThumbnailIsReady(image: HTMLImageElement): void {
  if (image.complete && image.naturalWidth > 0) {
    loadFullImageAfterThumbnail(image);
    return;
  }

  image.addEventListener('load', () => loadFullImageAfterThumbnail(image), { once: true });
}

export function initProgressiveDetailImages(): void {
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-full-src]')) {
    if ((image.dataset.progressiveMode || 'detail') !== 'detail') {
      continue;
    }

    loadWhenThumbnailIsReady(image);
  }
}

export function initProgressiveCardImages(): void {
  const images = [
    ...document.querySelectorAll<HTMLImageElement>('img[data-progressive-mode="viewport"][data-full-src]'),
    ...document.querySelectorAll<HTMLImageElement>(
      'img[src*="/safety-gate-alerts/public/api/notification/thumbnail/"]'
    )
  ];

  const uniqueImages = [...new Set(images)].filter(
    (image) => !image.dataset.progressiveState && !image.dataset.progressiveObserved
  );
  for (const image of uniqueImages) {
    if (!image.dataset.fullSrc) {
      const fullSrc = fullImageFromEuThumbnail(image.currentSrc || image.src);
      if (!fullSrc) {
        continue;
      }

      image.dataset.fullSrc = fullSrc;
      image.dataset.thumbnailSrc = image.currentSrc || image.src;
      image.dataset.progressiveMode = 'viewport';
    }

    if (!('IntersectionObserver' in window)) {
      continue;
    }

    image.dataset.progressiveObserved = 'true';
    const observer = new IntersectionObserver(
      (entries, activeObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          activeObserver.unobserve(image);
          loadWhenThumbnailIsReady(image);
        }
      },
      { rootMargin: '480px 0px' }
    );
    observer.observe(image);
  }
}
