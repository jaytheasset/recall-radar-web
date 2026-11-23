import { getSpecificAllergenQueryTerms, normalizeSearchText, searchTextMatchesQuery } from './multilingual-search';
import { formatUiMessage, getCurrentUiLanguage, getMessage, type MessageKey } from './i18n';

function setUrlState(query: string, category: string): void {
  const url = new URL(window.location.href);

  query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
  category && category !== 'all' ? url.searchParams.set('category', category) : url.searchParams.delete('category');
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
  const categoryOptions = [...document.querySelectorAll<HTMLElement>('[data-source-category-option]')];
  const categorySelection = root?.querySelector<HTMLElement>('[data-source-category-selection]');
  const categoryDisclosure = categorySelection?.closest('details');

  if (!root || !form || !input || !countLabel) {
    return;
  }

  const resultCountLabel = countLabel;
  const total = Number(root.dataset.categoryTotal ?? cards.length);
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q')?.trim() ?? '';
  const availableCategories = new Set(categoryOptions.map((option) => option.dataset.sourceCategoryOption ?? 'all'));
  let activeCategory =
    availableCategories.size > 0 && availableCategories.has(params.get('category') ?? '')
      ? params.get('category') ?? 'all'
      : 'all';

  if (initialQuery) {
    input.value = initialQuery;
  }

  function activeCategoryLabel(): string {
    return (
      categoryOptions.find((option) => option.dataset.sourceCategoryOption === activeCategory)?.dataset
        .sourceCategoryLabel ?? ''
    );
  }

  function updateActiveCategoryOptions(): void {
    if (categorySelection) {
      const option = categoryOptions.find((item) => item.dataset.sourceCategoryOption === activeCategory);
      const labelKey = option?.querySelector<HTMLElement>('[data-i18n]')?.dataset.i18n as MessageKey | undefined;
      if (labelKey) {
        categorySelection.dataset.i18n = labelKey;
        categorySelection.textContent = getMessage(labelKey, getCurrentUiLanguage());
      }
    }
    for (const option of categoryOptions) {
      const isActive = option.dataset.sourceCategoryOption === activeCategory;
      option.classList.toggle('is-active', isActive);
      if (isActive) {
        option.setAttribute('aria-current', 'page');
      } else {
        option.removeAttribute('aria-current');
      }
    }
  }

  function updateResults(syncUrl = true): void {
    const query = input?.value.trim() ?? '';
    const hasQuery = normalizeSearchText(query).length > 0;
    const allergens = hasQuery ? getSpecificAllergenQueryTerms(query) : [];
    const categoryLabel = activeCategoryLabel();
    let visibleCount = 0;

    for (const card of cards) {
      const categoryMatches = activeCategory === 'all' || card.dataset.cardCategory === activeCategory;
      const queryMatches = !hasQuery || (allergens.length
        ? allergens.some((allergen) => (card.dataset.officialAllergens ?? '').split('|').includes(allergen))
        : searchTextMatchesQuery(card.dataset.searchText ?? '', query));
      const visible = categoryMatches && queryMatches;
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    for (const group of groups) {
      const groupCards = [...group.querySelectorAll<HTMLElement>('[data-category-card]')];
      const hasVisibleCard = groupCards.some((card) => !card.hidden);
      group.hidden = (hasQuery || activeCategory !== 'all') && !hasVisibleCard;
    }

    if (categorySelection) {
      const key = hasQuery || activeCategory !== 'all' ? 'category.resultCount' : 'common.recallsCount';
      const values = { count: visibleCount.toLocaleString('en-US') };
      resultCountLabel.dataset.i18nTemplate = key;
      resultCountLabel.dataset.i18nValues = JSON.stringify(values);
      resultCountLabel.textContent = formatUiMessage(key, values);
    } else {
      resultCountLabel.textContent = `${visibleCount} of ${total} recall notice${
        total === 1 ? '' : 's'
      } shown${activeCategory !== 'all' && categoryLabel ? ` for ${categoryLabel}` : ''}`;
    }

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }

    if (clearButton) {
      clearButton.hidden = query.length === 0;
    }

    if (syncUrl) {
      setUrlState(query, activeCategory);
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
  for (const option of categoryOptions) {
    option.addEventListener('click', (event) => {
      event.preventDefault();
      activeCategory = option.dataset.sourceCategoryOption ?? 'all';
      updateActiveCategoryOptions();
      updateResults();
      if (categoryDisclosure?.open) {
        categoryDisclosure.open = false;
        categoryDisclosure.querySelector('summary')?.focus();
      }
    });
  }

  updateActiveCategoryOptions();
  updateResults(false);
}
