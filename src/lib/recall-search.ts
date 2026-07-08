import type { SiteRecall } from './recall-data';
import {
  expandSearchQuery,
  normalizeSearchText,
  tokenizeExpandedSearchTerms,
  tokenizeSearchQuery
} from './multilingual-search.ts';
import { getSourceIdentifierGuidance } from './identifier-guidance.ts';

export type RecallMatchType = 'exact' | 'possible' | 'related' | 'none';
export type RecallMatchReason =
  | 'recall-number'
  | 'identifier'
  | 'brand'
  | 'product'
  | 'ingredient'
  | 'product-type'
  | 'hazard'
  | 'source'
  | 'keyword';

export type RecallSearchResult = {
  query: string;
  match: RecallMatchType;
  recalls: SiteRecall[];
  items: RecallSearchItem[];
};

export type RecallSearchItem = {
  recall: SiteRecall;
  match: Exclude<RecallMatchType, 'none'>;
  matchReason: RecallMatchReason;
  matchReasonLabel: string;
  matchedFieldType: RecallMatchReason;
  score: number;
  searchPriorityLabel: string;
  evidenceLabels: string[];
  identifierHint: string;
};

export const MATCH_LABELS: Record<RecallMatchType, string> = {
  exact: 'Strong match',
  possible: 'Possible match',
  related: 'Related notice',
  none: 'No clear match'
};

export const SEARCH_RESULTS_DISCLAIMER =
  'Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.';

export const MATCH_REASON_LABELS: Record<RecallMatchReason, string> = {
  'recall-number': 'Matched by recall number',
  identifier: 'Matched by identifier text',
  brand: 'Matched by brand/company',
  product: 'Matched by product name',
  ingredient: 'Matched by ingredient or allergen',
  'product-type': 'Related by product family',
  hazard: 'Related by hazard or reason',
  source: 'Related by market/source',
  keyword: 'Matched by keyword'
};

const MATCH_BASE_SCORES: Record<Exclude<RecallMatchType, 'none'>, number> = {
  exact: 1000,
  possible: 620,
  related: 260
};

const MATCH_REASON_SCORES: Record<RecallMatchReason, number> = {
  'recall-number': 360,
  identifier: 330,
  brand: 260,
  product: 250,
  ingredient: 230,
  'product-type': 150,
  hazard: 140,
  source: 70,
  keyword: 40
};

const EVIDENCE_LABELS: Record<RecallMatchReason, string> = {
  'recall-number': 'Recall number',
  identifier: 'Model, lot, barcode, or identifier',
  brand: 'Brand or company',
  product: 'Product name',
  ingredient: 'Ingredient or allergen',
  'product-type': 'Product type',
  hazard: 'Issue or hazard',
  source: 'Country or source',
  keyword: 'Keyword'
};

const IDENTIFIER_TERMS = [
  'upc',
  'barcode',
  'gtin',
  'ean',
  'lot',
  'batch',
  'code',
  'model',
  'model no',
  'item no',
  'sku',
  'serial',
  'din',
  'npn',
  'recall number',
  'fda recall number',
  'cpsc recall number',
  'alert id',
  'safety gate reference',
  'safety gate',
  'product safety australia',
  'fsa alert',
  'fsa reference',
  'best before',
  'use by'
];

const ALLERGEN_TERMS = [
  'milk',
  'egg',
  'peanut',
  'tree nut',
  'almond',
  'cashew',
  'walnut',
  'soy',
  'wheat',
  'sesame',
  'fish',
  'shellfish',
  'pistachio',
  'mustard',
  'celery',
  'sulphites',
  'soya'
];

function normalize(value: string): string {
  return normalizeSearchText(value);
}

function tokensFor(query: string): string[] {
  return tokenizeSearchQuery(query).filter((token) => token.length > 1);
}

function expandedTermsFor(query: string): string[] {
  return expandSearchQuery(query);
}

function expandedTokensFor(query: string): string[] {
  return tokenizeExpandedSearchTerms(expandedTermsFor(query)).filter((token) => token.length > 1);
}

function searchableText(values: string[]): string {
  return normalize(values.join(' '));
}

function isUsefulExpandedTerm(term: string): boolean {
  return term.length > 2 || term.includes(' ');
}

function hasExpandedTermMatch(term: string, text: string): boolean {
  const normalizedTerm = normalize(term);
  if (!isUsefulExpandedTerm(normalizedTerm)) {
    return false;
  }

  if (text.includes(normalizedTerm)) {
    return true;
  }

  return !normalizedTerm.includes(' ') && tokenMatchCount(tokensFor(normalizedTerm), text) > 0;
}

function hasTextMatch(
  normalizedQuery: string,
  queryTokens: string[],
  values: string[],
  expandedTerms: string[] = []
): boolean {
  const text = searchableText(values);
  if (!text) {
    return false;
  }

  return (
    text.includes(normalizedQuery) ||
    tokenMatchCount(queryTokens, text) > 0 ||
    expandedTerms.some((term) => hasExpandedTermMatch(term, text))
  );
}

function hasStrongMatch(normalizedQuery: string, queryTokens: string[], values: string[]): boolean {
  return values.map(normalize).some((field) => isStrongFieldMatch(normalizedQuery, queryTokens, field));
}

function exactFields(recall: SiteRecall): string[] {
  return [
    recall.id,
    recall.recallNumber ?? '',
    recall.title,
    recall.slug,
    recall.primaryBrand,
    recall.primaryBrandRawName,
    ...recall.brandNames,
    ...recall.displayBrandNames,
    ...recall.productNames
  ].map(normalize);
}

function possibleFields(recall: SiteRecall): string {
  return searchableText([
    recall.id,
    recall.recallNumber ?? '',
    recall.title,
    recall.slug,
    recall.primaryBrand,
    recall.primaryBrandRawName,
    recall.primaryProductName,
    ...recall.brandNames,
    ...recall.displayBrandNames,
    ...recall.productNames
  ]);
}

function relatedFields(recall: SiteRecall): string {
  return searchableText([
    recall.category,
    recall.rawCategory,
    recall.categoryLabel,
    recall.taxonomyProductFamily ?? '',
    recall.taxonomyProductFamilyLabel ?? '',
    recall.taxonomyProductType ?? '',
    recall.taxonomyProductTypeLabel ?? '',
    recall.taxonomyHazardType ?? '',
    recall.taxonomyHazardTypeLabel ?? '',
    recall.taxonomyRecallDomain ?? '',
    recall.taxonomyRecallDomainLabel ?? '',
    recall.taxonomyReason ?? '',
    recall.hazard,
    recall.remedy,
    recall.reason ?? '',
    recall.classification ?? '',
    recall.distributionPattern ?? '',
    recall.productQuantity ?? '',
    recall.status ?? '',
    recall.description,
    recall.affectedUnits,
    recall.source,
    recall.sourceLabel,
    ...(recall.taxonomyHazardTags ?? []),
    ...(recall.taxonomyAudienceLabels ?? []),
    ...(recall.taxonomyQualityFlags ?? [])
  ]);
}

function isStrongFieldMatch(normalizedQuery: string, queryTokens: string[], field: string): boolean {
  if (!field) {
    return false;
  }

  if (field === normalizedQuery || field === normalizedQuery.replace(/\s+/g, '-')) {
    return true;
  }

  if (queryTokens.length >= 2 && queryTokens.every((token) => field.includes(token))) {
    return true;
  }

  return normalizedQuery.length >= 4 && field.startsWith(normalizedQuery);
}

function tokenMatchCount(tokens: string[], text: string): number {
  const words = text.split(' ').filter(Boolean);
  return tokens.filter((token) => {
    if (token.length <= 2) {
      return false;
    }

    return words.some((word) => word === token || (token.length >= 4 && word.startsWith(token)));
  }).length;
}

function hasMeaningfulTokenMatch(tokens: string[], text: string): boolean {
  const count = tokenMatchCount(tokens, text);
  return tokens.length >= 3 ? count >= 2 : count > 0;
}

function hasIdentifierCue(normalizedQuery: string): boolean {
  return IDENTIFIER_TERMS.some((term) => normalizedQuery.includes(term));
}

function looksLikeIdentifier(query: string, normalizedQuery: string): boolean {
  const compact = query.trim().replace(/\s+/g, '');
  const normalizedCompact = normalizedQuery.replace(/\s+/g, '');

  if (/^\d{6,}$/.test(compact)) {
    return true;
  }

  if (/^[a-z0-9]+-[a-z0-9-]+$/i.test(compact) && /\d/.test(compact)) {
    return true;
  }

  return normalizedCompact.length >= 6 && /[a-z]/i.test(normalizedCompact) && /\d/.test(normalizedCompact);
}

function compactIdentifier(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function hasExactIdentifierMatch(normalizedQuery: string, values: string[]): boolean {
  const compactQuery = compactIdentifier(normalizedQuery);
  if (!compactQuery || compactQuery.length < 4) {
    return false;
  }

  return values.some((value) => {
    const compactValue = compactIdentifier(value);
    return compactValue.length >= compactQuery.length && compactValue.includes(compactQuery);
  });
}

function hasAllergenQuery(normalizedQuery: string, queryTokens: string[]): boolean {
  return ALLERGEN_TERMS.some((term) => {
    const normalizedTerm = normalize(term);
    return normalizedQuery.includes(normalizedTerm) || queryTokens.includes(normalizedTerm);
  });
}

function identifierFields(recall: SiteRecall): string[] {
  return [
    recall.id,
    recall.recallNumber ?? '',
    recall.title,
    recall.slug,
    recall.primaryProductName,
    ...recall.productNames,
    recall.description,
    recall.affectedUnits,
    recall.productQuantity ?? '',
    recall.distributionPattern ?? ''
  ];
}

function brandFields(recall: SiteRecall): string[] {
  return [
    recall.primaryBrand,
    recall.primaryBrandRawName,
    ...recall.brandNames,
    ...recall.displayBrandNames
  ];
}

function productFields(recall: SiteRecall): string[] {
  return [recall.title, recall.slug, recall.primaryProductName, ...recall.productNames];
}

function ingredientFields(recall: SiteRecall): string[] {
  return [
    recall.title,
    recall.primaryProductName,
    ...recall.productNames,
    recall.hazard,
    recall.reason ?? '',
    recall.description,
    recall.classification ?? '',
    recall.distributionPattern ?? ''
  ];
}

function productTypeFields(recall: SiteRecall): string[] {
  return [
    recall.category,
    recall.rawCategory,
    recall.categoryLabel,
    recall.taxonomyProductFamily ?? '',
    recall.taxonomyProductFamilyLabel ?? '',
    recall.taxonomyProductType ?? '',
    recall.taxonomyProductTypeLabel ?? ''
  ];
}

function hazardFields(recall: SiteRecall): string[] {
  return [
    recall.taxonomyHazardType ?? '',
    recall.taxonomyHazardTypeLabel ?? '',
    recall.taxonomyReason ?? '',
    recall.hazard,
    recall.remedy,
    recall.reason ?? '',
    recall.classification ?? '',
    recall.status ?? '',
    recall.description,
    ...(recall.taxonomyHazardTags ?? [])
  ];
}

function sourceFields(recall: SiteRecall): string[] {
  return [recall.source, recall.sourceLabel];
}

function scoreTextMatch(normalizedQuery: string, queryTokens: string[], values: string[], weight: number): number {
  const text = searchableText(values);
  if (!text) {
    return 0;
  }

  if (text.includes(normalizedQuery)) {
    return weight;
  }

  const matchedTokens = tokenMatchCount(queryTokens, text);
  if (matchedTokens === 0) {
    return 0;
  }

  return Math.min(weight, Math.round((matchedTokens / Math.max(1, queryTokens.length)) * weight));
}

function getEvidenceLabels(query: string, recall: SiteRecall, primaryReason: RecallMatchReason): string[] {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);
  const evidence = new Set<string>([EVIDENCE_LABELS[primaryReason]]);

  if (scoreTextMatch(normalizedQuery, queryTokens, brandFields(recall), 1) > 0) {
    evidence.add(EVIDENCE_LABELS.brand);
  }
  if (scoreTextMatch(normalizedQuery, queryTokens, productFields(recall), 1) > 0) {
    evidence.add(EVIDENCE_LABELS.product);
  }
  if (scoreTextMatch(normalizedQuery, queryTokens, identifierFields(recall), 1) > 0) {
    evidence.add(EVIDENCE_LABELS.identifier);
  }
  if (scoreTextMatch(normalizedQuery, queryTokens, productTypeFields(recall), 1) > 0) {
    evidence.add(EVIDENCE_LABELS['product-type']);
  }
  if (scoreTextMatch(normalizedQuery, queryTokens, hazardFields(recall), 1) > 0) {
    evidence.add(EVIDENCE_LABELS.hazard);
  }

  return [...evidence].slice(0, 4);
}

function getSearchPriorityLabel(score: number): string {
  if (score >= 1250) {
    return 'Best candidate';
  }
  if (score >= 900) {
    return 'Strong candidate';
  }
  if (score >= 620) {
    return 'Possible candidate';
  }
  return 'Related context';
}

function getMatchScore(query: string, recall: SiteRecall, match: Exclude<RecallMatchType, 'none'>, reason: RecallMatchReason): number {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);
  let score = MATCH_BASE_SCORES[match] + MATCH_REASON_SCORES[reason];

  score += scoreTextMatch(normalizedQuery, queryTokens, [recall.id, recall.recallNumber ?? ''], 180);
  score += scoreTextMatch(normalizedQuery, queryTokens, brandFields(recall), 120);
  score += scoreTextMatch(normalizedQuery, queryTokens, productFields(recall), 120);
  score += scoreTextMatch(normalizedQuery, queryTokens, identifierFields(recall), 110);
  score += scoreTextMatch(normalizedQuery, queryTokens, productTypeFields(recall), 70);
  score += scoreTextMatch(normalizedQuery, queryTokens, hazardFields(recall), 60);

  if (reason === 'ingredient' && hasAllergenQuery(normalizedQuery, queryTokens)) {
    score += 80;
  }

  if (recall.taxonomyProductFamily && recall.taxonomyHazardType) {
    score += 25;
  }

  return score;
}

export function getRecallIdentifierHint(recall: Pick<SiteRecall, 'source'>): string {
  return getSourceIdentifierGuidance(recall.source);
}

function getMatchReason(query: string, recall: SiteRecall): RecallMatchReason {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);
  const expandedTerms = expandedTermsFor(query);
  const expandedTokens = expandedTokensFor(query);

  if (!normalizedQuery || (queryTokens.length === 0 && expandedTokens.length === 0)) {
    return 'keyword';
  }

  const recallNumberFields = [recall.id, recall.recallNumber ?? ''];
  if (
    hasStrongMatch(normalizedQuery, queryTokens, recallNumberFields) ||
    hasTextMatch(normalizedQuery, queryTokens, recallNumberFields)
  ) {
    return 'recall-number';
  }

  if (
    (hasIdentifierCue(normalizedQuery) || looksLikeIdentifier(query, normalizedQuery)) &&
    hasTextMatch(normalizedQuery, queryTokens, identifierFields(recall))
  ) {
    return 'identifier';
  }

  if (hasTextMatch(normalizedQuery, queryTokens, brandFields(recall), expandedTerms)) {
    return 'brand';
  }

  if (
    hasAllergenQuery(normalizedQuery, expandedTokens) &&
    (recall.source === 'FDA' || recall.category === 'food-allergy') &&
    hasTextMatch(normalizedQuery, queryTokens, ingredientFields(recall), expandedTerms)
  ) {
    return 'ingredient';
  }

  if (hasTextMatch(normalizedQuery, queryTokens, productFields(recall), expandedTerms)) {
    return 'product';
  }

  if (
    hasAllergenQuery(normalizedQuery, expandedTokens) &&
    hasTextMatch(normalizedQuery, queryTokens, ingredientFields(recall), expandedTerms)
  ) {
    return 'ingredient';
  }

  if (hasTextMatch(normalizedQuery, queryTokens, productTypeFields(recall), expandedTerms)) {
    return 'product-type';
  }

  if (hasTextMatch(normalizedQuery, queryTokens, hazardFields(recall), expandedTerms)) {
    return 'hazard';
  }

  if (hasTextMatch(normalizedQuery, queryTokens, sourceFields(recall), expandedTerms)) {
    return 'source';
  }

  return 'keyword';
}

export function getRecallMatch(query: string, recall: SiteRecall): RecallMatchType {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);
  const expandedTerms = expandedTermsFor(query);
  const expandedTokens = expandedTokensFor(query);

  if (!normalizedQuery || (queryTokens.length === 0 && expandedTokens.length === 0)) {
    return 'none';
  }

  if (exactFields(recall).some((field) => isStrongFieldMatch(normalizedQuery, queryTokens, field))) {
    return 'exact';
  }

  if (looksLikeIdentifier(query, normalizedQuery)) {
    return hasExactIdentifierMatch(normalizedQuery, identifierFields(recall)) ? 'possible' : 'none';
  }

  const possibleText = possibleFields(recall);
  if (
    hasMeaningfulTokenMatch(queryTokens, possibleText) ||
    hasMeaningfulTokenMatch(expandedTokens, possibleText) ||
    expandedTerms.some((term) => hasExpandedTermMatch(term, possibleText))
  ) {
    return 'possible';
  }

  if (
    hasAllergenQuery(normalizedQuery, expandedTokens) &&
    !hasTextMatch(normalizedQuery, queryTokens, ingredientFields(recall), expandedTerms)
  ) {
    return 'none';
  }

  const relatedText = relatedFields(recall);
  if (
    hasMeaningfulTokenMatch(queryTokens, relatedText) ||
    hasMeaningfulTokenMatch(expandedTokens, relatedText) ||
    expandedTerms.some((term) => hasExpandedTermMatch(term, relatedText))
  ) {
    return 'related';
  }

  return 'none';
}

function matchOrder(match: RecallMatchType): number {
  return ['exact', 'possible', 'related', 'none'].indexOf(match);
}

function compareRecalls(
  a: { recall: SiteRecall; match: RecallMatchType; score?: number },
  b: { recall: SiteRecall; match: RecallMatchType; score?: number }
): number {
  const matchDifference = matchOrder(a.match) - matchOrder(b.match);
  if (matchDifference !== 0) {
    return matchDifference;
  }

  const scoreDifference = (b.score ?? 0) - (a.score ?? 0);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return b.recall.recallDate.localeCompare(a.recall.recallDate);
}

export function searchRecalls(query: string, recalls: SiteRecall[]): RecallSearchResult {
  const matches = recalls
    .map((recall) => {
      const match = getRecallMatch(query, recall);
      const matchReason = getMatchReason(query, recall);
      const score = match === 'none' ? 0 : getMatchScore(query, recall, match, matchReason);
      return {
        recall,
        match,
        matchReason,
        matchReasonLabel: MATCH_REASON_LABELS[matchReason],
        matchedFieldType: matchReason,
        score,
        searchPriorityLabel: getSearchPriorityLabel(score),
        evidenceLabels: getEvidenceLabels(query, recall, matchReason),
        identifierHint: getRecallIdentifierHint(recall)
      };
    })
    .filter((result) => result.match !== 'none')
    .sort(compareRecalls) as RecallSearchItem[];

  return {
    query,
    match: matches[0]?.match ?? 'none',
    recalls: matches.map((result) => result.recall),
    items: matches
  };
}
