import type { MockRecall } from '../data/mock-recalls';

export type RecallMatchType = 'exact' | 'possible' | 'related' | 'none';

export type RecallSearchResult = {
  query: string;
  match: RecallMatchType;
  recalls: MockRecall[];
};

export const MATCH_LABELS: Record<RecallMatchType, string> = {
  exact: 'Exact local match',
  possible: 'Possible local match',
  related: 'Related local match',
  none: 'No local match'
};

export const NO_MATCH_DISCLAIMER =
  '?쏯o matching recall found does not guarantee a product is safe. Always verify with the official recall notice, manufacturer, and applicable government agency.??';

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

function searchableText(recall: MockRecall): string {
  return normalize(
    [
      recall.title,
      recall.brand,
      recall.category,
      recall.categoryLabel,
      recall.productName,
      recall.summary,
      recall.hazard,
      recall.remedy,
      recall.recallNumber,
      ...recall.modelNumbers,
      ...recall.upcs,
      ...recall.lotCodes,
      ...recall.keywords
    ].join(' ')
  );
}

function exactFields(recall: MockRecall): string[] {
  return [
    recall.title,
    recall.brand,
    recall.productName,
    recall.recallNumber,
    ...recall.modelNumbers,
    ...recall.upcs,
    ...recall.lotCodes
  ].map(normalize);
}

export function getRecallMatch(query: string, recall: MockRecall): RecallMatchType {
  const normalizedQuery = normalize(query);
  const queryTokens = tokensFor(query);

  if (!normalizedQuery || queryTokens.length === 0) {
    return 'none';
  }

  const fields = exactFields(recall);
  if (fields.some((field) => field === normalizedQuery)) {
    return 'exact';
  }

  const text = searchableText(recall);
  if (queryTokens.every((token) => text.includes(token))) {
    return 'possible';
  }

  if (queryTokens.some((token) => token.length > 2 && text.includes(token))) {
    return 'related';
  }

  return 'none';
}

export function searchRecalls(query: string, recalls: MockRecall[]): RecallSearchResult {
  const matches = recalls
    .map((recall) => ({ recall, match: getRecallMatch(query, recall) }))
    .filter((result) => result.match !== 'none');

  const orderedTypes: RecallMatchType[] = ['exact', 'possible', 'related'];
  const topMatch = orderedTypes.find((type) => matches.some((result) => result.match === type)) ?? 'none';

  return {
    query,
    match: topMatch,
    recalls: matches
      .sort((a, b) => orderedTypes.indexOf(a.match) - orderedTypes.indexOf(b.match))
      .map((result) => result.recall)
  };
}
