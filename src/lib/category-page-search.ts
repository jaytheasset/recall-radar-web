function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function termsFor(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function setUrlQuery(query: string): void {
  const url = new URL(window.location.href);

  query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
  window.history.replaceState({}, '', url);
}

export function initCategoryPageSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-category-search-root]');
  const form = document.querySelector<HTMLFormElement>('[data-category-search-form]');
  const input = document.querySelector<HTMLInputElement>('[data-category-search-input]');
  const clearButton = document.querySelector<HTMLButtonElement>('[data-category-search-clear]');
  const countLabel = document.querySelector<HTMLElement>('[data-category-result-count]');
  const emptyState = document.querySelector<HTMLElement>('[data-category-no-results]');
  const cards = [...document.querySelectorAll<HTMLElement>('[data-category-card]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-category-group]')];

  if (!root || !form || !input || !countLabel) {
    return;
  }

  const resultCountLabel = countLabel;
  const total = Number(root.dataset.categoryTotal ?? cards.length);
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q')?.trim() ?? '';

  if (initialQuery) {
    input.value = initialQuery;
  }

  function updateResults(syncUrl = true): void {
    const query = input?.value.trim() ?? '';
    const terms = termsFor(query);
    let visibleCount = 0;

    for (const card of cards) {
      const text = normalize(card.dataset.searchText ?? '');
      const visible = terms.length === 0 || terms.every((term) => text.includes(term));
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    for (const group of groups) {
      const groupCards = [...group.querySelectorAll<HTMLElement>('[data-category-card]')];
      const hasVisibleCard = groupCards.some((card) => !card.hidden);
      group.hidden = terms.length > 0 && !hasVisibleCard;
    }

    resultCountLabel.textContent = `${visibleCount} of ${total} indexed notice${total === 1 ? '' : 's'} shown`;

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }

    if (clearButton) {
      clearButton.hidden = query.length === 0;
    }

    if (syncUrl) {
      setUrlQuery(query);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    updateResults();
  });

  input.addEventListener('input', () => updateResults());
  clearButton?.addEventListener('click', () => {
    input.value = '';
    updateResults();
    input.focus();
  });

  updateResults(false);
}
