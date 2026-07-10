import { HAZARD_TYPE_VALUES, type HazardType } from '../data/recall-taxonomy-v2.ts';
import { SEARCH_ALIAS_GROUPS } from './search-aliases.ts';
import { getHazardTypeLabel } from './taxonomy-v2-display.ts';

export type HazardSearchIntent = {
  hazardTypes: HazardType[];
  remainingQuery: string;
  isHazardOnly: boolean;
};

const HAZARD_ALIAS_GROUP_TYPES: Partial<Record<string, HazardType[]>> = {
  allergen: ['allergen'],
  'pathogen-contamination': ['contamination-pathogen'],
  'chemical-contamination': ['contamination-chemical', 'chemical-exposure'],
  'foreign-matter': ['foreign-matter'],
  'fire-burn-overheat': ['fire', 'burn', 'battery-overheat'],
  'electric-shock': ['electric-shock'],
  'choking-suffocation': ['choking', 'suffocation'],
  strangulation: ['strangulation'],
  'fall-injury': ['fall', 'injury'],
  'cut-laceration': ['laceration'],
  entrapment: ['entrapment'],
  poisoning: ['poisoning'],
  'crash-drowning': ['crash', 'drowning'],
  'labeling-quality': ['labeling-error', 'regulatory-noncompliance', 'quality-defect']
};

function normalizeHazardSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function termMatchesQuery(query: string, normalizedQuery: string, rawTerm: string): boolean {
  const normalizedTerm = normalizeHazardSearchText(rawTerm);
  const rawNeedle = rawTerm.trim().toLowerCase();
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  if (!normalizedTerm) {
    return false;
  }

  if (normalizedQuery === normalizedTerm || queryTokens.includes(normalizedTerm)) {
    return true;
  }

  if (normalizedTerm.includes(' ')) {
    return normalizedQuery.includes(normalizedTerm);
  }

  return /[^\x00-\x7F]/.test(rawNeedle) && rawNeedle.length > 1 && query.toLowerCase().includes(rawNeedle);
}

function removeMatchedTerms(query: string, terms: string[]): string {
  let remaining = query;

  for (const term of [...new Set(terms.map(normalizeHazardSearchText))].sort((a, b) => b.length - a.length)) {
    if (!term) {
      continue;
    }

    if (/[^\x00-\x7F]/.test(term) || term.includes(' ')) {
      remaining = remaining.split(term).join(' ');
      continue;
    }

    remaining = remaining
      .split(' ')
      .filter((token) => token !== term)
      .join(' ');
  }

  return remaining.replace(/\s+/g, ' ').trim();
}

export function getHazardSearchIntent(query: string): HazardSearchIntent | null {
  const normalizedQuery = normalizeHazardSearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  const explicitHazardTypes = HAZARD_TYPE_VALUES.filter(
    (hazardType) =>
      hazardType !== 'unknown' &&
      [hazardType, getHazardTypeLabel(hazardType)].some((term) => termMatchesQuery(query, normalizedQuery, term))
  );

  const matchingAliasGroups = SEARCH_ALIAS_GROUPS.filter(
    (group) =>
      HAZARD_ALIAS_GROUP_TYPES[group.id] &&
      [...group.terms, ...group.aliases].some((term) => termMatchesQuery(query, normalizedQuery, term))
  );

  const hazardTypes = explicitHazardTypes.length > 0
    ? explicitHazardTypes
    : [...new Set(matchingAliasGroups.flatMap((group) => HAZARD_ALIAS_GROUP_TYPES[group.id] ?? []))];

  if (hazardTypes.length === 0) {
    return null;
  }

  const matchedTerms = explicitHazardTypes.length > 0
    ? explicitHazardTypes.flatMap((hazardType) => [hazardType, getHazardTypeLabel(hazardType)])
    : matchingAliasGroups.flatMap((group) =>
      [...group.terms, ...group.aliases].filter((term) => termMatchesQuery(query, normalizedQuery, term))
    );
  const remainingQuery = removeMatchedTerms(normalizedQuery, matchedTerms);

  return {
    hazardTypes,
    remainingQuery,
    isHazardOnly: !remainingQuery
  };
}
