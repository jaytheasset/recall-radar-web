import { PRODUCT_TYPE_VALUES, type ProductType } from '../data/recall-taxonomy-v2.ts';
import { SEARCH_ALIAS_GROUPS } from './search-aliases.ts';
import { getProductTypeLabel } from './taxonomy-v2-display.ts';
import {
  normalizeTaxonomySearchText,
  removeTaxonomySearchTerms,
  taxonomyTermMatchesQuery
} from './taxonomy-search-text.ts';

export type ProductTypeSearchIntent = {
  productTypes: ProductType[];
  remainingQuery: string;
  isProductTypeOnly: boolean;
};

const PRODUCT_TYPE_ALIAS_GROUP_TYPES: Partial<Record<string, ProductType[]>> = {
  beverage: ['beverage'],
  'meat-seafood': ['meat-seafood'],
  'infant-food': ['infant-food'],
  'power-bank': ['power-bank'],
  charger: ['charger'],
  battery: ['battery'],
  milk: ['dairy'],
  'cleaner-detergent': ['cleaning-product', 'detergent'],
  'chemical-product': ['chemical-product'],
  toy: ['toy'],
  stroller: ['stroller-pram']
};

const SPECIFIC_ALIAS_GROUP_SUPPRESSIONS: Partial<Record<string, string[]>> = {
  'power-bank': ['battery']
};

export function getProductTypeSearchIntent(query: string): ProductTypeSearchIntent | null {
  const normalizedQuery = normalizeTaxonomySearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  const explicitProductTypeMatches = PRODUCT_TYPE_VALUES
    .filter((productType) => productType !== 'other' && productType !== 'unknown')
    .map((productType) => ({
      productType,
      matchedTerms: [productType, getProductTypeLabel(productType)].filter((term) =>
        taxonomyTermMatchesQuery(query, normalizedQuery, term)
      )
    }))
    .filter(({ matchedTerms }) => matchedTerms.length > 0);
  const greatestExplicitSpecificity = Math.max(
    0,
    ...explicitProductTypeMatches.flatMap(({ matchedTerms }) =>
      matchedTerms.map((term) => normalizeTaxonomySearchText(term).length)
    )
  );
  const explicitProductTypes = explicitProductTypeMatches
    .filter(({ matchedTerms }) =>
      matchedTerms.some((term) => normalizeTaxonomySearchText(term).length === greatestExplicitSpecificity)
    )
    .map(({ productType }) => productType);

  const matchingAliasGroups = SEARCH_ALIAS_GROUPS.filter(
    (group) =>
      PRODUCT_TYPE_ALIAS_GROUP_TYPES[group.id] &&
      [...group.terms, ...group.aliases].some((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
  );
  const suppressedAliasGroups = new Set(
    matchingAliasGroups.flatMap((group) => SPECIFIC_ALIAS_GROUP_SUPPRESSIONS[group.id] ?? [])
  );
  const selectedAliasGroups = matchingAliasGroups.filter((group) => !suppressedAliasGroups.has(group.id));

  const productTypes = explicitProductTypes.length > 0
    ? explicitProductTypes
    : [...new Set(selectedAliasGroups.flatMap((group) => PRODUCT_TYPE_ALIAS_GROUP_TYPES[group.id] ?? []))];

  if (productTypes.length === 0) {
    return null;
  }

  const matchedTerms = explicitProductTypes.length > 0
    ? explicitProductTypes.flatMap((productType) => [productType, getProductTypeLabel(productType)])
    : selectedAliasGroups.flatMap((group) =>
      [...group.terms, ...group.aliases].filter((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
    );
  const remainingQuery = removeTaxonomySearchTerms(normalizedQuery, matchedTerms);

  return {
    productTypes,
    remainingQuery,
    isProductTypeOnly: !remainingQuery
  };
}
