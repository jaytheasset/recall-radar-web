import type { SiteRecall } from './recall-data';
import { normalizeBrandName } from './brand-normalize';

const GENERIC_BRAND_TOKENS = new Set([
  'and',
  'brand',
  'brands',
  'co',
  'company',
  'corp',
  'corporation',
  'dba',
  'distributor',
  'distributors',
  'inc',
  'importer',
  'importers',
  'llc',
  'limited',
  'ltd',
  'manufacturer',
  'manufacturers',
  'of',
  'the',
  'usa'
]);

const RELATED_STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'because',
  'consumer',
  'consumers',
  'contact',
  'from',
  'have',
  'into',
  'more',
  'notice',
  'official',
  'product',
  'products',
  'recall',
  'recalled',
  'recalls',
  'risk',
  'should',
  'source',
  'that',
  'their',
  'these',
  'this',
  'using',
  'with'
]);

const HAZARD_KEYWORDS = [
  'burn',
  'fire',
  'choking',
  'ingestion',
  'laceration',
  'tip over',
  'tip-over',
  'entrapment',
  'fall',
  'crash',
  'allergy',
  'undeclared',
  'salmonella',
  'listeria',
  'e coli',
  'e. coli',
  'lead',
  'carbon monoxide',
  'electric shock',
  'overheating'
];

type BrandIdentity = {
  slugs: Set<string>;
  displayNames: Set<string>;
  rawNames: Set<string>;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function meaningfulBrandTokens(value: string): string[] {
  return tokens(value).filter((token) => token.length > 1 && !GENERIC_BRAND_TOKENS.has(token));
}

function isMeaningfulBrandName(value: string): boolean {
  return meaningfulBrandTokens(value).length > 0;
}

function addIfMeaningful(set: Set<string>, value: string): void {
  const normalized = normalizeText(value);
  if (normalized && isMeaningfulBrandName(normalized)) {
    set.add(normalized);
  }
}

function addSlugIfMeaningful(set: Set<string>, value: string): void {
  if (value && isMeaningfulBrandName(value)) {
    set.add(value);
  }
}

function brandIdentityFor(recall: SiteRecall): BrandIdentity {
  const identity: BrandIdentity = {
    slugs: new Set<string>(),
    displayNames: new Set<string>(),
    rawNames: new Set<string>()
  };

  for (const rawName of recall.brandNames) {
    const normalized = normalizeBrandName(rawName);
    addSlugIfMeaningful(identity.slugs, normalized.slug);
    addIfMeaningful(identity.displayNames, normalized.displayName);
    addIfMeaningful(identity.rawNames, normalized.rawName);
  }

  for (const displayName of recall.displayBrandNames) {
    const normalized = normalizeBrandName(displayName);
    addSlugIfMeaningful(identity.slugs, normalized.slug);
    addIfMeaningful(identity.displayNames, normalized.displayName);
  }

  addSlugIfMeaningful(identity.slugs, recall.primaryBrandSlug);
  addIfMeaningful(identity.displayNames, recall.primaryBrand);
  addIfMeaningful(identity.rawNames, recall.primaryBrandRawName);

  return identity;
}

function setIntersectionCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const value of a) {
    if (b.has(value)) {
      count += 1;
    }
  }
  return count;
}

function companyMatchScore(current: BrandIdentity, candidate: BrandIdentity): number {
  if (setIntersectionCount(current.slugs, candidate.slugs) > 0) {
    return 100;
  }

  if (setIntersectionCount(current.displayNames, candidate.displayNames) > 0) {
    return 90;
  }

  if (setIntersectionCount(current.rawNames, candidate.rawNames) > 0) {
    return 80;
  }

  return 0;
}

function compareByScoreThenDate(
  a: { recall: SiteRecall; score: number },
  b: { recall: SiteRecall; score: number }
): number {
  const scoreDifference = b.score - a.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const dateDifference = b.recall.recallDate.localeCompare(a.recall.recallDate);
  return dateDifference === 0 ? a.recall.id.localeCompare(b.recall.id) : dateDifference;
}

export function getCompanyRecallHistory(
  currentRecall: SiteRecall,
  allRecalls: SiteRecall[],
  limit = 4
): SiteRecall[] {
  const currentIdentity = brandIdentityFor(currentRecall);

  return allRecalls
    .filter((recall) => recall.id !== currentRecall.id)
    .map((recall) => ({
      recall,
      score: companyMatchScore(currentIdentity, brandIdentityFor(recall))
    }))
    .filter((result) => result.score > 0)
    .sort(compareByScoreThenDate)
    .slice(0, limit)
    .map((result) => result.recall);
}

function hazardKeywordSet(recall: SiteRecall): Set<string> {
  const text = normalizeText(
    [
      recall.title,
      recall.categoryLabel,
      recall.hazard,
      recall.reason ?? '',
      recall.description
    ].join(' ')
  );

  return new Set(
    HAZARD_KEYWORDS.filter((keyword) => text.includes(normalizeText(keyword))).map(normalizeText)
  );
}

function productKeywordSet(recall: SiteRecall): Set<string> {
  return new Set(
    tokens([recall.title, recall.primaryProductName, ...recall.productNames].join(' '))
      .filter((token) => token.length > 2)
      .filter((token) => !RELATED_STOP_WORDS.has(token))
      .slice(0, 40)
  );
}

function relatedScore(currentRecall: SiteRecall, candidate: SiteRecall): number {
  let score = 0;

  if (
    currentRecall.taxonomyProductFamily &&
    candidate.taxonomyProductFamily === currentRecall.taxonomyProductFamily
  ) {
    score += 34;
  } else if (candidate.category === currentRecall.category) {
    score += 18;
  }

  if (
    currentRecall.taxonomyProductType &&
    candidate.taxonomyProductType === currentRecall.taxonomyProductType
  ) {
    score += 24;
  }

  if (
    currentRecall.taxonomyHazardType &&
    candidate.taxonomyHazardType === currentRecall.taxonomyHazardType
  ) {
    score += 22;
  }

  if (
    currentRecall.taxonomyRecallDomain &&
    candidate.taxonomyRecallDomain === currentRecall.taxonomyRecallDomain
  ) {
    score += 6;
  }

  score += Math.min(
    setIntersectionCount(hazardKeywordSet(currentRecall), hazardKeywordSet(candidate)) * 18,
    54
  );
  score += Math.min(
    setIntersectionCount(productKeywordSet(currentRecall), productKeywordSet(candidate)) * 9,
    36
  );

  if (candidate.source === currentRecall.source) {
    score += 4;
  }

  return score;
}

export function getRelatedRecalls(
  currentRecall: SiteRecall,
  allRecalls: SiteRecall[],
  limit = 4,
  excludeIds = new Set<string>()
): SiteRecall[] {
  return allRecalls
    .filter((recall) => recall.id !== currentRecall.id && !excludeIds.has(recall.id))
    .map((recall) => ({
      recall,
      score: relatedScore(currentRecall, recall)
    }))
    .filter((result) => result.score >= 32)
    .sort(compareByScoreThenDate)
    .slice(0, limit)
    .map((result) => result.recall);
}
