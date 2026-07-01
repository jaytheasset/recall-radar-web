import type { SiteRecall } from './recall-data';

export type RecallMatchType = 'exact' | 'possible' | 'related' | 'none';

export type RecallSearchResult = {
  query: string;
  match: RecallMatchType;
  recalls: SiteRecall[];
  items: RecallSearchItem[];
};

export type RecallSearchItem = {
  recall: SiteRecall;
  match: Exclude<RecallMatchType, 'none'>;
};

export const MATCH_LABELS: Record<RecallMatchType, string> = {
  exact: 'Exact signal',
  possible: 'Possible signal',
  related: 'Related signal',
  none: 'No local signal'
};

export const NO_MATCH_DISCLAIMER =
  'No matching recall found does not guarantee a product is safe. Always verify with the official recall notice, manufacturer, and applicable government agency.';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokensFor(query: string): string[] {
  return normalize(query)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function searchableText(values: string[]): string {
  return normalize(values.join(' '));
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
    recall.sourceUrl,
    recall.sourceLabel
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
  return tokens.filter((token) => token.length > 2 && text.includes(token)).length;
}

export function getRecallMatch(query: string, recall: SiteRecall): RecallMatchType {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);

  if (!normalizedQuery || queryTokens.length === 0) {
    return 'none';
  }

  if (exactFields(recall).some((field) => isStrongFieldMatch(normalizedQuery, queryTokens, field))) {
    return 'exact';
  }

  const possibleText = possibleFields(recall);
  if (tokenMatchCount(queryTokens, possibleText) > 0) {
    return 'possible';
  }

  const relatedText = relatedFields(recall);
  if (tokenMatchCount(queryTokens, relatedText) > 0) {
    return 'related';
  }

  return 'none';
}

function matchOrder(match: RecallMatchType): number {
  return ['exact', 'possible', 'related', 'none'].indexOf(match);
}

function compareRecalls(
  a: { recall: SiteRecall; match: RecallMatchType },
  b: { recall: SiteRecall; match: RecallMatchType }
): number {
  const matchDifference = matchOrder(a.match) - matchOrder(b.match);
  if (matchDifference !== 0) {
    return matchDifference;
  }

  return b.recall.recallDate.localeCompare(a.recall.recallDate);
}

export function searchRecalls(query: string, recalls: SiteRecall[]): RecallSearchResult {
  const matches = recalls
    .map((recall) => ({ recall, match: getRecallMatch(query, recall) }))
    .filter((result) => result.match !== 'none')
    .sort(compareRecalls) as RecallSearchItem[];

  return {
    query,
    match: matches[0]?.match ?? 'none',
    recalls: matches.map((result) => result.recall),
    items: matches
  };
}
