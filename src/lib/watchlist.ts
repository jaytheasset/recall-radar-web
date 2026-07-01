export const WATCHLIST_STORAGE_KEY = 'recall-radar-watchlist-v1';

export type WatchlistSourceFilter = 'all' | 'CPSC' | 'FDA';
export type WatchlistCategoryFilter =
  | 'all'
  | 'baby-kids'
  | 'battery-electronics'
  | 'food-allergy'
  | 'household-appliance'
  | 'food'
  | 'general';

export type WatchlistSearchItem = {
  id: string;
  type: 'search';
  query: string;
  source: WatchlistSourceFilter;
  category: WatchlistCategoryFilter;
  createdAt: string;
};

export type WatchlistBrandItem = {
  id: string;
  type: 'brand';
  brand: string;
  slug: string;
  createdAt: string;
};

export type WatchlistItem = WatchlistSearchItem | WatchlistBrandItem;

export type WatchlistState = {
  version: 1;
  items: WatchlistItem[];
};

const emptyState: WatchlistState = {
  version: 1,
  items: []
};

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseWatchlist(value: string | null): WatchlistState {
  if (!value) {
    return { ...emptyState, items: [] };
  }

  try {
    const parsed = JSON.parse(value) as Partial<WatchlistState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { ...emptyState, items: [] };
    }

    return {
      version: 1,
      items: parsed.items.filter((item): item is WatchlistItem => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
          return false;
        }

        if (item.type === 'search') {
          return typeof item.query === 'string';
        }

        if (item.type === 'brand') {
          return typeof item.brand === 'string' && typeof item.slug === 'string';
        }

        return false;
      })
    };
  } catch {
    return { ...emptyState, items: [] };
  }
}

export function loadWatchlist(): WatchlistState {
  if (!storageAvailable()) {
    return { ...emptyState, items: [] };
  }

  return parseWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY));
}

export function saveWatchlist(state: WatchlistState): WatchlistState {
  if (storageAvailable()) {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(state));
  }

  return state;
}

function upsertItem(item: WatchlistItem): WatchlistState {
  const state = loadWatchlist();
  const items = [item, ...state.items.filter((savedItem) => savedItem.id !== item.id)];
  return saveWatchlist({ version: 1, items });
}

export function upsertWatchlistSearch(input: {
  query: string;
  source?: WatchlistSourceFilter;
  category?: WatchlistCategoryFilter;
}): WatchlistSearchItem {
  const query = input.query.trim();
  const source = input.source ?? 'all';
  const category = input.category ?? 'all';
  const item: WatchlistSearchItem = {
    id: `search:${normalizeId(query)}:${source}:${category}`,
    type: 'search',
    query,
    source,
    category,
    createdAt: new Date().toISOString()
  };

  upsertItem(item);
  return item;
}

export function upsertWatchlistBrand(input: { brand: string; slug: string }): WatchlistBrandItem {
  const brand = input.brand.trim();
  const slug = input.slug.trim();
  const item: WatchlistBrandItem = {
    id: `brand:${slug || normalizeId(brand)}`,
    type: 'brand',
    brand,
    slug,
    createdAt: new Date().toISOString()
  };

  upsertItem(item);
  return item;
}

export function removeWatchlistItem(id: string): WatchlistState {
  const state = loadWatchlist();
  return saveWatchlist({
    version: 1,
    items: state.items.filter((item) => item.id !== id)
  });
}

export function clearWatchlist(): WatchlistState {
  return saveWatchlist({ ...emptyState, items: [] });
}
