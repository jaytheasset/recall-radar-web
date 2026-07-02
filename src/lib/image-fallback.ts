function showImageFallback(image: HTMLImageElement): void {
  const shell = image.closest<HTMLElement>('.image-shell');
  if (!shell) {
    return;
  }

  const label = image.dataset.fallbackLabel?.trim() || 'Recall notice';
  let placeholder: HTMLElement | null =
    image.nextElementSibling instanceof HTMLElement ? image.nextElementSibling : null;

  if (!placeholder || !placeholder.classList.contains('image-placeholder')) {
    placeholder = document.createElement('span');
    placeholder.className = 'image-placeholder image-placeholder-fallback';
    shell.append(placeholder);
  }

  placeholder.textContent = label;
  placeholder.hidden = false;
  image.hidden = true;
  image.setAttribute('aria-hidden', 'true');
  shell.classList.add('image-shell-fallback');
}

export function initImageFallbacks(): void {
  document.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement && target.dataset.fallbackLabel) {
        showImageFallback(target);
      }
    },
    true
  );

  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-fallback-label]')) {
    if (image.complete && image.naturalWidth === 0) {
      showImageFallback(image);
    }
  }
}
