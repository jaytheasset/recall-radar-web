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

  const galleryToken = image.dataset.galleryToken ?? '';
  image.dataset.progressiveState = 'loading';

  const fullImage = new Image();
  fullImage.decoding = 'async';
  setBackgroundImagePriority(fullImage);

  fullImage.onload = () => {
    if ((image.dataset.galleryToken ?? '') !== galleryToken || image.dataset.fullSrc?.trim() !== fullSrc) {
      return;
    }

    image.src = fullSrc;
    image.removeAttribute('srcset');
    image.classList.add('image-loaded');
    image.dataset.progressiveState = 'loaded';
  };

  fullImage.onerror = () => {
    if ((image.dataset.galleryToken ?? '') !== galleryToken || image.dataset.fullSrc?.trim() !== fullSrc) {
      return;
    }

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

function resetImageFallback(image: HTMLImageElement): void {
  const shell = image.closest<HTMLElement>('.image-shell');
  const placeholder =
    image.nextElementSibling instanceof HTMLElement && image.nextElementSibling.classList.contains('image-placeholder')
      ? image.nextElementSibling
      : null;

  image.hidden = false;
  image.removeAttribute('aria-hidden');
  shell?.classList.remove('image-shell-fallback');
  if (placeholder) {
    placeholder.hidden = true;
  }
}

function updateGalleryCaption(captionElement: HTMLElement | null, caption: string): void {
  if (!captionElement) {
    return;
  }

  captionElement.textContent = caption;
  captionElement.hidden = !caption;
}

function setSelectedThumbnail(buttons: HTMLButtonElement[], selectedButton: HTMLButtonElement): void {
  for (const button of buttons) {
    const isSelected = button === selectedButton;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    if (isSelected) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  }
}

function loadGalleryFullImage(image: HTMLImageElement, fullSrc: string, token: string): void {
  const fullImage = new Image();
  fullImage.decoding = 'async';
  setBackgroundImagePriority(fullImage);

  fullImage.onload = () => {
    if (image.dataset.galleryToken !== token) {
      return;
    }

    image.src = fullSrc;
    image.removeAttribute('srcset');
    image.classList.add('image-loaded');
    image.dataset.progressiveState = 'loaded';
  };

  fullImage.onerror = () => {
    if (image.dataset.galleryToken === token) {
      image.dataset.progressiveState = 'error';
    }
  };

  fullImage.src = fullSrc;
}

export function initDetailImageGallery(): void {
  const mainImage = document.querySelector<HTMLImageElement>('[data-detail-gallery-main]');
  const captionElement = document.querySelector<HTMLElement>('[data-detail-gallery-caption]');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-gallery-thumbnail]')];

  if (!mainImage || buttons.length < 2) {
    return;
  }

  const selectGalleryImage = (button: HTMLButtonElement): void => {
    const fullSrc = button.dataset.fullSrc?.trim() ?? '';
    const initialSrc = button.dataset.initialSrc?.trim() || button.dataset.thumbnailSrc?.trim() || fullSrc;
    const thumbnailSrc = button.dataset.thumbnailSrc?.trim() ?? '';
    const alt = button.dataset.alt?.trim() || mainImage.alt;
    const caption = button.dataset.caption?.trim() ?? '';
    const srcset = button.dataset.srcset?.trim() ?? '';

    if (!initialSrc && !fullSrc) {
      return;
    }

    const token = `${Date.now()}-${button.dataset.galleryIndex ?? ''}`;
    mainImage.dataset.galleryToken = token;
    mainImage.alt = alt;
    mainImage.classList.remove('image-loaded');
    mainImage.dataset.fullSrc = fullSrc;
    if (thumbnailSrc) {
      mainImage.dataset.thumbnailSrc = thumbnailSrc;
    } else {
      delete mainImage.dataset.thumbnailSrc;
    }

    if (fullSrc && initialSrc && fullSrc !== initialSrc) {
      mainImage.dataset.progressiveMode = 'detail';
      mainImage.dataset.progressiveState = 'loading';
    } else {
      delete mainImage.dataset.progressiveMode;
      mainImage.dataset.progressiveState = 'loaded';
    }

    if (srcset) {
      mainImage.srcset = srcset;
    } else {
      mainImage.removeAttribute('srcset');
    }

    resetImageFallback(mainImage);
    mainImage.src = initialSrc || fullSrc;
    updateGalleryCaption(captionElement, caption);
    setSelectedThumbnail(buttons, button);

    if (fullSrc && fullSrc !== mainImage.src) {
      loadGalleryFullImage(mainImage, fullSrc, token);
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => selectGalleryImage(button));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
        return;
      }

      event.preventDefault();
      selectGalleryImage(button);
    });
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
