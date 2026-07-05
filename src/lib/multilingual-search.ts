import { SEARCH_ALIAS_GROUPS } from './search-aliases.ts';

export type RecallSearchTextRecord = {
  id: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  title: string;
  brandNames: string[];
  displayBrandNames: string[];
  primaryBrand: string;
  primaryBrandRawName: string;
  productNames: string[];
  primaryProductName: string;
  category: string;
  rawCategory: string;
  categoryLabel: string;
  taxonomyProductFamily?: string;
  taxonomyProductFamilyLabel?: string;
  taxonomyProductType?: string;
  taxonomyProductTypeLabel?: string;
  taxonomyHazardType?: string;
  taxonomyHazardTypeLabel?: string;
  taxonomyHazardTags?: string[];
  taxonomyRecallDomain?: string;
  taxonomyRecallDomainLabel?: string;
  taxonomyAudienceLabels?: string[];
  taxonomyReason?: string;
  taxonomyQualityFlags?: string[];
  hazard: string;
  remedy: string;
  affectedUnits: string;
  description: string;
  slug: string;
  classification?: string;
  reason?: string;
  distributionPattern?: string;
  productQuantity?: string;
  recallNumber?: string;
  status?: string;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

const SEARCH_STOP_WORDS = new Set([
  'fake',
  'not',
  'real',
  'test',
  'no',
  'qwerty',
  'zzzz',
  'recall',
  'recalls',
  'recalled',
  'alert',
  'alerts',
  'product',
  'products',
  'barcode'
]);
const NOISE_STOP_WORDS = new Set(['fake', 'not', 'real', 'test', 'no', 'qwerty', 'zzzz']);

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  return unique(normalizeSearchText(query).split(' ').filter((token) => token && !SEARCH_STOP_WORDS.has(token)));
}

export function tokenizeExpandedSearchTerms(terms: string[]): string[] {
  return unique(terms.flatMap((term) => tokenizeSearchQuery(term)));
}

export function expandSearchQuery(query: string): string[] {
  const rawQuery = query.trim().toLowerCase();
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTokens = normalizedQuery.split(' ').filter(Boolean);
  const baseTokens = tokenizeSearchQuery(query);
  const hasNoiseStopWord = normalizedTokens.some((token) => NOISE_STOP_WORDS.has(token));
  const expanded = new Set<string>();

  function add(value: string): void {
    const normalized = normalizeSearchText(value);
    if (normalized) {
      expanded.add(normalized);
    }
  }

  add(normalizedQuery);
  for (const token of baseTokens) {
    if (token.length > 1) {
      add(token);
    }
  }

  for (const group of SEARCH_ALIAS_GROUPS) {
    if (group.id === 'recall-alert' && hasNoiseStopWord) {
      continue;
    }

    const shouldExpand = [...group.terms, ...group.aliases].some((rawTerm) => {
      const term = normalizeSearchText(rawTerm);
      const rawNeedle = rawTerm.trim().toLowerCase();

      if (!normalizedQuery || !term) {
        return false;
      }

      return (
        (term.length > 1 && (normalizedQuery.includes(term) || baseTokens.includes(term))) ||
        (rawNeedle.length > 1 && rawQuery.includes(rawNeedle))
      );
    });

    if (shouldExpand) {
      for (const term of [...group.terms, ...group.aliases]) {
        add(term);
      }
    }
  }

  return [...expanded];
}

export function buildRecallSearchText(record: RecallSearchTextRecord): string {
  return [
    record.id,
    record.source,
    record.sourceLabel,
    record.sourceUrl,
    record.title,
    record.primaryBrand,
    record.primaryBrandRawName,
    record.primaryProductName,
    record.category,
    record.rawCategory,
    record.categoryLabel,
    record.taxonomyProductFamily ?? '',
    record.taxonomyProductFamilyLabel ?? '',
    record.taxonomyProductType ?? '',
    record.taxonomyProductTypeLabel ?? '',
    record.taxonomyHazardType ?? '',
    record.taxonomyHazardTypeLabel ?? '',
    record.taxonomyRecallDomain ?? '',
    record.taxonomyRecallDomainLabel ?? '',
    record.taxonomyReason ?? '',
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.affectedUnits,
    record.description,
    record.slug,
    record.classification ?? '',
    record.distributionPattern ?? '',
    record.productQuantity ?? '',
    record.recallNumber ?? '',
    record.status ?? '',
    ...(record.taxonomyHazardTags ?? []),
    ...(record.taxonomyAudienceLabels ?? []),
    ...(record.taxonomyQualityFlags ?? []),
    ...record.brandNames,
    ...record.displayBrandNames,
    ...record.productNames
  ].join(' ');
}

function tokenInText(token: string, normalizedText: string): boolean {
  if (!token || token.length <= 1) {
    return false;
  }

  const words = normalizedText.split(' ').filter(Boolean);
  return words.some((word) => word === token || (token.length >= 4 && word.startsWith(token)));
}

function termMatchesText(term: string, normalizedText: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) {
    return false;
  }

  const termTokens = tokenizeSearchQuery(normalizedTerm);
  if (termTokens.length === 0 || (termTokens.length === 1 && termTokens[0].length <= 2)) {
    return false;
  }

  if (normalizedText.includes(normalizedTerm)) {
    return true;
  }

  if (termTokens.length >= 2) {
    return termTokens.every((token) => tokenInText(token, normalizedText));
  }

  return termTokens.some((token) => tokenInText(token, normalizedText));
}

export function searchTextMatchesQuery(searchText: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const normalizedText = normalizeSearchText(searchText);
  if (!normalizedText) {
    return false;
  }

  return expandSearchQuery(query).some((term) => termMatchesText(term, normalizedText));
}

export function matchesMultilingualSearch(record: RecallSearchTextRecord, query: string): boolean {
  if (!normalizeSearchText(query)) {
    return false;
  }

  return searchTextMatchesQuery(buildRecallSearchText(record), query);
}
