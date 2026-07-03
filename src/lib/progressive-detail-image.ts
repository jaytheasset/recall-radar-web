function setBackgroundImagePriority(image: HTMLImageElement): void {
  if ('fetchPriority' in image) {
    (image as HTMLImageElement & { fetchPriority: 'low' | 'auto' | 'high' }).fetchPriority = 'low';
  }
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

export function initProgressiveDetailImages(): void {
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-full-src]')) {
    if (image.complete && image.naturalWidth > 0) {
      loadFullImageAfterThumbnail(image);
      continue;
    }

    image.addEventListener('load', () => loadFullImageAfterThumbnail(image), { once: true });
  }
}
