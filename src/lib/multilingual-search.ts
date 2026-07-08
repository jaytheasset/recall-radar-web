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
  'de',
  'la',
  'le',
  'les',
  'des',
  'du',
  'el',
  'los',
  'las',
  'y',
  'e',
  'da',
  'do',
  'dos',
  'das',
  'para',
  'por',
  'con',
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
const GENERIC_ALLERGEN_TERMS = [
  'allergen',
  'allergy',
  'undeclared allergen',
  'undeclared',
  'allergene',
  'allergie',
  'alergeno',
  'alergia',
  'allergenhinweis',
  '알레르기',
  '알레르겐',
  'アレルゲン',
  '过敏原',
  '過敏原'
].map(normalizeSearchText);
const SPECIFIC_ALLERGEN_TERMS = new Set(
  [
    'milk',
    'dairy',
    'egg',
    'peanut',
    'tree nut',
    'nuts',
    'almond',
    'cashew',
    'walnut',
    'hazelnut',
    'soy',
    'wheat',
    'gluten',
    'sesame',
    'fish',
    'shellfish',
    'pistachio',
    'mustard',
    'celery',
    'sulphites',
    'soya'
  ].map(normalizeSearchText)
);
const GENERIC_ALLERGEN_QUERY_TERMS = SEARCH_ALIAS_GROUPS.filter((group) => group.id === 'allergen')
  .flatMap((group) => [...group.terms, ...group.aliases])
  .map(normalizeSearchText);
const SPECIFIC_ALIAS_GROUP_SUPPRESSIONS: Record<string, string[]> = {
  'baby-sleep': ['baby-kids'],
  'clothing-sleepwear': ['baby-kids'],
  charger: ['appliance-electric'],
  'power-bank': ['battery']
};
const SPECIFIC_ALIAS_TOKEN_SUPPRESSIONS: Record<string, string[]> = {
  'baby-sleep': ['baby']
};
const NON_EXPANDING_ALIAS_GROUP_IDS = new Set(['recall-alert']);

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
  const matchedGroupIds = new Set<string>();

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

  function aliasTermMatchesQuery(rawTerm: string): boolean {
    const term = normalizeSearchText(rawTerm);
    const rawNeedle = rawTerm.trim().toLowerCase();
    const termTokens = term.split(' ').filter(Boolean);
    const isNonAscii = /[^\x00-\x7F]/.test(rawNeedle);

    if (!normalizedQuery || !term) {
      return false;
    }

    if (normalizedQuery === term || baseTokens.includes(term)) {
      return true;
    }

    if (termTokens.length > 1) {
      return normalizedQuery.includes(term) || termTokens.every((token) => baseTokens.includes(token));
    }

    if (isNonAscii && rawNeedle.length > 1) {
      return rawQuery.includes(rawNeedle);
    }

    return false;
  }

  const matchingGroups = SEARCH_ALIAS_GROUPS.filter((group) => {
    if ((group.id === 'recall-alert' || group.id === 'identifiers') && hasNoiseStopWord) {
      return false;
    }

    return [...group.terms, ...group.aliases].some((rawTerm) => aliasTermMatchesQuery(rawTerm));
  });

  for (const group of matchingGroups) {
    matchedGroupIds.add(group.id);
  }

  const suppressedGroupIds = new Set(
    [...matchedGroupIds].flatMap((groupId) => SPECIFIC_ALIAS_GROUP_SUPPRESSIONS[groupId] ?? [])
  );
  const suppressedTokens = new Set(
    [...matchedGroupIds].flatMap((groupId) => SPECIFIC_ALIAS_TOKEN_SUPPRESSIONS[groupId] ?? []).map(normalizeSearchText)
  );

  for (const token of suppressedTokens) {
    expanded.delete(token);
  }

  for (const group of matchingGroups) {
    if (suppressedGroupIds.has(group.id)) {
      continue;
    }

    if (NON_EXPANDING_ALIAS_GROUP_IDS.has(group.id)) {
      continue;
    }

    for (const term of [...group.terms, ...group.aliases]) {
      add(term);
    }
  }

  return [...expanded];
}

function categorySearchLabel(category: string, categoryLabel: string): string {
  if (category === 'food-allergy' || normalizeSearchText(categoryLabel) === 'food allergy') {
    return 'food grocery packaged food';
  }

  return `${category} ${categoryLabel}`;
}

export function buildRecallSearchText(record: RecallSearchTextRecord): string {
  return [
    record.id,
    record.source,
    record.sourceLabel,
    record.title,
    record.primaryBrand,
    record.primaryBrandRawName,
    record.primaryProductName,
    record.rawCategory,
    categorySearchLabel(record.category, record.categoryLabel),
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
  return words.some((word) => word === token || (token.length >= 5 && word.startsWith(token)));
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

  if (termTokens.length >= 2 && normalizedText.includes(normalizedTerm)) {
    return true;
  }

  if (termTokens.length >= 2) {
    return termTokens.every((token) => tokenInText(token, normalizedText));
  }

  return termTokens.some((token) => tokenInText(token, normalizedText));
}

function specificAllergenTermsForExpandedTerms(expandedTerms: string[]): string[] {
  return expandedTerms
    .map(normalizeSearchText)
    .filter((term) => SPECIFIC_ALLERGEN_TERMS.has(term));
}

function requiresSpecificAllergenMatch(query: string, expandedTerms: string[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchQuery(query);
  const expandedTokens = tokenizeExpandedSearchTerms(expandedTerms);
  const hasGenericCue = GENERIC_ALLERGEN_TERMS.some(
    (term) => normalizedQuery.includes(term) || queryTokens.includes(term) || expandedTokens.includes(term)
  );

  return hasGenericCue && specificAllergenTermsForExpandedTerms(expandedTerms).length > 0;
}

function requiresGenericAllergenEvidence(query: string, expandedTerms: string[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchQuery(query);
  const expandedTokens = tokenizeExpandedSearchTerms(expandedTerms);
  const hasGenericCue = GENERIC_ALLERGEN_TERMS.some(
    (term) => normalizedQuery.includes(term) || queryTokens.includes(term) || expandedTokens.includes(term)
  );

  return hasGenericCue && specificAllergenTermsForExpandedTerms(expandedTerms).length === 0;
}

function queryHasGenericAllergenCue(query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchQuery(query);

  return GENERIC_ALLERGEN_QUERY_TERMS.some(
    (term) => normalizedQuery.includes(term) || queryTokens.includes(term)
  );
}

function buildAllergenEvidenceText(record: RecallSearchTextRecord): string {
  return [
    record.title,
    record.primaryProductName,
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.description,
    record.classification ?? '',
    record.taxonomyHazardType ?? '',
    record.taxonomyHazardTypeLabel ?? '',
    record.taxonomyReason ?? '',
    ...(record.taxonomyHazardTags ?? []),
    ...record.productNames,
    ...record.brandNames,
    ...record.displayBrandNames
  ].join(' ');
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

  const expandedTerms = expandSearchQuery(query);

  if (
    requiresSpecificAllergenMatch(query, expandedTerms) &&
    !specificAllergenTermsForExpandedTerms(expandedTerms).some((term) => termMatchesText(term, normalizedText))
  ) {
    return false;
  }

  return expandedTerms.some((term) => termMatchesText(term, normalizedText));
}

export function matchesMultilingualSearch(record: RecallSearchTextRecord, query: string): boolean {
  if (!normalizeSearchText(query)) {
    return false;
  }

  const expandedTerms = queryHasGenericAllergenCue(query) ? expandSearchQuery(query) : [];
  if (
    expandedTerms.length > 0 &&
    requiresGenericAllergenEvidence(query, expandedTerms) &&
    !searchTextMatchesQuery(buildAllergenEvidenceText(record), query)
  ) {
    return false;
  }

  return searchTextMatchesQuery(buildRecallSearchText(record), query);
}
