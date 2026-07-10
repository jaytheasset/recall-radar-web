import { HAZARD_TYPE_VALUES, type HazardType } from '../data/recall-taxonomy-v2.ts';
import { SEARCH_ALIAS_GROUPS } from './search-aliases.ts';
import { getHazardTypeLabel } from './taxonomy-v2-display.ts';
import {
  normalizeTaxonomySearchText,
  removeTaxonomySearchTerms,
  taxonomyTermMatchesQuery
} from './taxonomy-search-text.ts';

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

export function getHazardSearchIntent(query: string): HazardSearchIntent | null {
  const normalizedQuery = normalizeTaxonomySearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  const explicitHazardTypes = HAZARD_TYPE_VALUES.filter(
    (hazardType) =>
      hazardType !== 'unknown' &&
      [hazardType, getHazardTypeLabel(hazardType)].some((term) =>
        taxonomyTermMatchesQuery(query, normalizedQuery, term)
      )
  );

  const matchingAliasGroups = SEARCH_ALIAS_GROUPS.filter(
    (group) =>
      HAZARD_ALIAS_GROUP_TYPES[group.id] &&
      [...group.terms, ...group.aliases].some((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
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
      [...group.terms, ...group.aliases].filter((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
    );
  const remainingQuery = removeTaxonomySearchTerms(normalizedQuery, matchedTerms);

  return {
    hazardTypes,
    remainingQuery,
    isHazardOnly: !remainingQuery
  };
}
