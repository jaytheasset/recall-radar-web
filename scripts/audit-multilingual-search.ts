import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { HAZARD_TYPE_VALUES, PRODUCT_TYPE_VALUES, type RecallClassificationV2 } from '../src/data/recall-taxonomy-v2.ts';
import type { SiteRecall, SiteRecallCategory } from '../src/lib/recall-data.ts';
import {
  buildRecallSearchText,
  expandSearchQuery,
  matchesMultilingualSearch,
  normalizeSearchText,
  searchTextMatchesQuery
} from '../src/lib/multilingual-search.ts';
import { searchRecalls } from '../src/lib/recall-search.ts';
import { getMessage, getProductFamilyI18nKey, SUPPORTED_LOCALES } from '../src/lib/i18n.ts';
import { getHazardTypeLabel, getProductTypeLabel } from '../src/lib/taxonomy-v2-display.ts';
import { MULTILINGUAL_SEARCH_SCENARIOS } from './multilingual-search-scenarios.ts';

type AuditStatus = 'pass' | 'warning' | 'fail';
type SourceId =
  | 'CPSC'
  | 'FDA'
  | 'FR_RAPPELCONSO'
  | 'CA_RECALLS'
  | 'EU_SAFETY_GATE'
  | 'UK_FSA'
  | 'AU_PRODUCT_SAFETY'
  | 'NZ_PRODUCT_SAFETY'
  | 'HK_CFS'
  | 'FSANZ_FOOD_RECALLS';

type ScenarioResult = {
  id: string;
  group: string;
  query: string;
  normalizedQuery: string;
  searchedRecords: number;
  matchedCount: number;
  expandedTerms: string[];
  sampleMatchedTitles: string[];
  sampleMatchedSources: string[];
  missingAliases: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type ExactIdentifierCheck = {
  source: SourceId;
  query: string;
  labelledQuery: string;
  expectedRecordId: string;
  expectedTitle: string;
  matchedCount: number;
  expectedRank: number | null;
  expectedMatchType: string | null;
  labelledExpectedRank: number | null;
  labelledExpectedMatchType: string | null;
  unexpectedExactMatches: string[];
  topResults: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type SourceCategoryCheck = {
  id: string;
  label: string;
  sources: SourceId[];
  category: SiteRecallCategory;
  query: string;
  searchedRecords: number;
  matchedCount: number;
  sampleMatchedTitles: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type RankingNote = {
  id: string;
  query: string;
  topResultsChecked: number;
  expectedTerms: string[];
  topResultTermMatches: number;
  minimumTopResultTermMatches: number | null;
  unexpectedTopMatchReasons: string[];
  topResults: string[];
  warnings: string[];
  failures: string[];
};

type SourceSearchIntentCheck = {
  id: string;
  query: string;
  expectedSources: SourceId[];
  expectedCount: number;
  matchedCount: number;
  matchedSources: string[];
  mixedQuery?: string;
  mixedQueryMatchCount?: number;
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type ProductFamilySearchCheck = {
  productFamily: string;
  locale: string;
  query: string;
  availableRecordCount: number;
  matchingRecordCount: number;
  topResultFamilies: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type HazardSearchCheck = {
  id: string;
  query: string;
  expectedHazardTypes: string[];
  expectedSources?: string[];
  matchedCount: number;
  matchedHazardTypes: string[];
  matchedSources: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type ProductTypeSearchCheck = {
  id: string;
  query: string;
  expectedProductTypes: string[];
  expectedSources?: string[];
  matchedCount: number;
  matchedProductTypes: string[];
  matchedSources: string[];
  warnings: string[];
  failures: string[];
  status: AuditStatus;
};

type ClassificationV2File = {
  records?: Array<{
    recordId: string;
    success?: boolean;
    failed?: boolean;
    classification?: RecallClassificationV2;
  }>;
};

const EXPECTED_SOURCE_COUNTS: Record<SourceId, number> = {
  CPSC: 301,
  FDA: 100,
  FR_RAPPELCONSO: 100,
  CA_RECALLS: 100,
  EU_SAFETY_GATE: 100,
  UK_FSA: 100,
  AU_PRODUCT_SAFETY: 100,
  NZ_PRODUCT_SAFETY: 100,
  HK_CFS: 100,
  FSANZ_FOOD_RECALLS: 100
};

const SOURCE_SEARCH_INTENT_CHECKS: Array<{
  id: string;
  query: string;
  expectedSources: SourceId[];
  mixedQuery?: string;
}> = [
  { id: 'united-states', query: 'United States', expectedSources: ['CPSC', 'FDA'] },
  { id: 'united-states-korean', query: '\uBBF8\uAD6D', expectedSources: ['CPSC', 'FDA'] },
  { id: 'fda-korean', query: '\uBBF8\uAD6D\uC2DD\uD488\uC758\uC57D\uAD6D', expectedSources: ['FDA'] },
  { id: 'canada', query: 'Canada', expectedSources: ['CA_RECALLS'] },
  { id: 'canada-korean', query: '\uCE90\uB098\uB2E4', expectedSources: ['CA_RECALLS'] },
  { id: 'eu-safety-gate', query: 'EU Safety Gate', expectedSources: ['EU_SAFETY_GATE'] },
  { id: 'eu-korean', query: '\uC720\uB7FD\uC5F0\uD569', expectedSources: ['EU_SAFETY_GATE'] },
  { id: 'france', query: 'France', expectedSources: ['FR_RAPPELCONSO'] },
  { id: 'uk-fsa', query: 'United Kingdom FSA', expectedSources: ['UK_FSA'] },
  { id: 'uk-fsa-korean', query: '\uC601\uAD6D\uC2DD\uD488\uAE30\uC900\uCCAD', expectedSources: ['UK_FSA'] },
  { id: 'australia-product-safety', query: 'Product Safety Australia', expectedSources: ['AU_PRODUCT_SAFETY'] },
  { id: 'new-zealand-product-safety', query: 'New Zealand Product Safety', expectedSources: ['NZ_PRODUCT_SAFETY'] },
  { id: 'hong-kong-cfs', query: '\uD64D\uCF69\uC2DD\uD488\uC548\uC804\uC13C\uD130', expectedSources: ['HK_CFS'] },
  { id: 'fsanz', query: 'FSANZ', expectedSources: ['FSANZ_FOOD_RECALLS'] },
  {
    id: 'fda-with-product',
    query: 'FDA',
    expectedSources: ['FDA'],
    mixedQuery: 'pistachio FDA'
  }
];

const SEARCHABLE_PRODUCT_FAMILIES = [
  'food-grocery',
  'baby-kids',
  'electronics-batteries',
  'home-appliances',
  'furniture-household',
  'vehicles-mobility',
  'sports-outdoor',
  'tools-equipment',
  'clothing-accessories',
  'health-personal-care',
  'chemicals-cleaning',
  'pet-products',
  'industrial-workplace'
] as const;

const MULTILINGUAL_HAZARD_SEARCH_CHECKS: Array<{
  id: string;
  query: string;
  expectedHazardTypes: string[];
  expectedSources?: string[];
}> = [
  { id: 'ko-fire', query: '\uD654\uC7AC', expectedHazardTypes: ['fire', 'burn', 'battery-overheat'] },
  { id: 'ko-electric-shock', query: '\uAC10\uC804', expectedHazardTypes: ['electric-shock'] },
  { id: 'ko-allergen', query: '\uC54C\uB808\uB974\uAE30', expectedHazardTypes: ['allergen'] },
  { id: 'ko-pathogen', query: '\uC138\uADE0', expectedHazardTypes: ['contamination-pathogen'] },
  { id: 'ko-foreign-matter', query: '\uC774\uBB3C\uC9C8', expectedHazardTypes: ['foreign-matter'] },
  { id: 'ko-chemical', query: '\uD654\uD559\uC624\uC5FC', expectedHazardTypes: ['contamination-chemical', 'chemical-exposure'] },
  { id: 'ja-poisoning', query: '\u4E2D\u6BD2', expectedHazardTypes: ['poisoning'] },
  { id: 'zh-burn', query: '\u70E7\u4F24', expectedHazardTypes: ['fire', 'burn', 'battery-overheat'] },
  { id: 'fr-strangulation', query: 'etranglement', expectedHazardTypes: ['strangulation'] },
  { id: 'es-suffocation', query: 'asfixia', expectedHazardTypes: ['choking', 'suffocation'] },
  { id: 'de-electric-shock', query: 'stromschlag', expectedHazardTypes: ['electric-shock'] },
  { id: 'pt-fall', query: 'queda', expectedHazardTypes: ['fall', 'injury'] },
  { id: 'cpsc-fire', query: 'CPSC Fire', expectedHazardTypes: ['fire'], expectedSources: ['CPSC'] }
];

const MULTILINGUAL_PRODUCT_TYPE_SEARCH_CHECKS: Array<{
  id: string;
  query: string;
  expectedProductTypes: string[];
  expectedSources?: string[];
}> = [
  { id: 'ko-power-bank', query: '\uBCF4\uC870\uBC30\uD130\uB9AC', expectedProductTypes: ['power-bank'] },
  { id: 'ja-charger', query: '\u5145\u96FB\u5668', expectedProductTypes: ['charger'] },
  { id: 'zh-battery', query: '\u7535\u6C60', expectedProductTypes: ['battery'] },
  { id: 'pt-toy', query: 'brinquedo', expectedProductTypes: ['toy'] },
  { id: 'de-stroller', query: 'kinderwagen', expectedProductTypes: ['stroller-pram'] },
  { id: 'fr-dairy', query: 'lait', expectedProductTypes: ['dairy'] },
  { id: 'ko-cleaner', query: '\uC138\uC81C', expectedProductTypes: ['cleaning-product', 'detergent'] },
  { id: 'cpsc-power-bank', query: 'CPSC Power bank', expectedProductTypes: ['power-bank'], expectedSources: ['CPSC'] }
];

const SOURCE_CATEGORY_CHECKS: Array<{
  id: string;
  label: string;
  sources: SourceId[];
  category: SiteRecallCategory;
  query: string;
  minMatches: number;
}> = [
  {
    id: 'us-fda-food-pistachio',
    label: 'United States FDA food search',
    sources: ['FDA'],
    category: 'food-allergy',
    query: 'pistachio',
    minMatches: 1
  },
  {
    id: 'canada-food-allergen',
    label: 'Canada food/allergen search',
    sources: ['CA_RECALLS'],
    category: 'food-allergy',
    query: 'allergen',
    minMatches: 1
  },
  {
    id: 'eu-battery-charger',
    label: 'EU battery/electronics search',
    sources: ['EU_SAFETY_GATE'],
    category: 'battery-electronics',
    query: 'charger',
    minMatches: 1
  },
  {
    id: 'france-food-lait',
    label: 'France food/allergy search',
    sources: ['FR_RAPPELCONSO'],
    category: 'food-allergy',
    query: 'lait',
    minMatches: 1
  },
  {
    id: 'uk-food-allergen',
    label: 'UK food/allergen search',
    sources: ['UK_FSA'],
    category: 'food-allergy',
    query: 'allergen',
    minMatches: 1
  },
  {
    id: 'australia-product-safety-button-battery',
    label: 'Australia Product Safety battery search',
    sources: ['AU_PRODUCT_SAFETY'],
    category: 'battery-electronics',
    query: 'button battery',
    minMatches: 1
  },
  {
    id: 'new-zealand-product-safety-toy',
    label: 'New Zealand Product Safety toy search',
    sources: ['NZ_PRODUCT_SAFETY'],
    category: 'baby-kids',
    query: 'toy',
    minMatches: 1
  },
  {
    id: 'hong-kong-cfs-food-alert',
    label: 'Hong Kong CFS food alert search',
    sources: ['HK_CFS'],
    category: 'food-allergy',
    query: 'allergen',
    minMatches: 1
  },
  {
    id: 'fsanz-food-recalls-allergen',
    label: 'FSANZ food recall search',
    sources: ['FSANZ_FOOD_RECALLS'],
    category: 'food-allergy',
    query: 'allergen',
    minMatches: 1
  }
];

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const classificationProcessedPath = resolve(projectRoot, 'data/processed/recall-classifications-v2.json');

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeBasic(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textHasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function inferAuditCategory(record: NormalizedRecall): SiteRecallCategory {
  if (record.source === 'FDA' || record.source === 'UK_FSA' || record.source === 'HK_CFS') {
    return 'food-allergy';
  }

  const text = normalizeBasic(
    [
      record.title,
      record.category,
      record.hazard,
      record.reason ?? '',
      record.remedy,
      record.description,
      ...record.productNames,
      ...record.brandNames
    ].join(' ')
  );

  if (
    textHasAny(text, [
      'food',
      'alimentation',
      'allergen',
      'allergy',
      'allergene',
      'undeclared',
      'lait',
      'milk',
      'egg',
      'wheat',
      'soy',
      'sesame',
      'pistachio',
      'peanut',
      'salmonella',
      'listeria'
    ])
  ) {
    return 'food-allergy';
  }

  if (
    textHasAny(text, [
      'toy',
      'toys',
      'baby',
      'infant',
      'child',
      'children',
      'kids',
      'crib',
      'bassinet',
      'nursery',
      'childcare'
    ])
  ) {
    return 'baby-kids';
  }

  if (
    textHasAny(text, [
      'battery',
      'batteries',
      'charger',
      'charging',
      'power bank',
      'lithium',
      'adapter',
      'usb',
      'electrical appliances',
      'electronics'
    ])
  ) {
    return 'battery-electronics';
  }

  if (
    textHasAny(text, [
      'appliance',
      'household',
      'furniture',
      'kitchen',
      'lamp',
      'lighting',
      'heater',
      'cooker',
      'iron',
      'electromenager'
    ])
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function toSiteRecall(record: NormalizedRecall, taxonomyV2?: RecallClassificationV2): SiteRecall {
  const primaryBrand = record.brandNames[0] ?? 'Unknown brand';
  const primaryProductName = record.productNames[0] ?? record.title;
  const category = inferAuditCategory(record);

  return {
    id: record.id,
    source: record.source,
    sourceLabel: record.source,
    sourceUrl: record.sourceUrl,
    title: record.title,
    brandNames: record.brandNames,
    displayBrandNames: record.brandNames,
    primaryBrand,
    primaryBrandRawName: primaryBrand,
    primaryBrandSlug: '',
    productNames: record.productNames,
    primaryProductName,
    category,
    rawCategory: record.category,
    categoryLabel: category,
    taxonomyV2,
    taxonomyProductFamily: taxonomyV2?.productFamily,
    taxonomyProductType: taxonomyV2?.productType,
    taxonomyHazardType: taxonomyV2?.hazardType,
    taxonomyHazardTags: taxonomyV2?.hazardTags ?? [],
    taxonomyRecallDomain: taxonomyV2?.recallDomain,
    taxonomyAudienceLabels: taxonomyV2?.audience ?? [],
    taxonomyReason: taxonomyV2?.reason,
    hazard: record.hazard,
    remedy: record.remedy,
    recallDate: record.recallDate,
    affectedUnits: record.affectedUnits,
    description: record.description,
    slug: record.slug,
    detailPath: `/recalls/${record.slug}`,
    classification: record.classification,
    reason: record.reason,
    distributionPattern: record.distributionPattern,
    productQuantity: record.productQuantity,
    recallNumber: record.recallNumber,
    status: record.status,
    images: [],
    primaryImageUrl: record.primaryImageUrl,
    primaryImageThumbnailUrl: record.primaryImageThumbnailUrl,
    primaryImageAlt: record.primaryImageAlt
  };
}

function includesExpandedTerm(expandedTerms: string[], expected: string): boolean {
  const normalizedExpected = normalizeSearchText(expected);
  return expandedTerms.includes(normalizedExpected);
}

function statusFor(warnings: string[], failures: string[]): AuditStatus {
  if (failures.length > 0) {
    return 'fail';
  }

  return warnings.length > 0 ? 'warning' : 'pass';
}

function sampleTitles(records: SiteRecall[]): string[] {
  return records.slice(0, 5).map((recall) => recall.title);
}

function sampleSources(records: SiteRecall[]): string[] {
  return unique(records.slice(0, 10).map((recall) => recall.source));
}

function visibleResultText(recall: SiteRecall): string {
  return normalizeSearchText(
    [
      recall.title,
      recall.primaryProductName,
      recall.primaryBrand,
      ...recall.productNames,
      ...recall.brandNames,
      ...recall.displayBrandNames
    ].join(' ')
  );
}

function recordMatchesQuery(record: SiteRecall, query: string): boolean {
  return matchesMultilingualSearch(record, query);
}

function sourceCounts(records: SiteRecall[]): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
}

function runScenario(recordPool: SiteRecall[], scenario: (typeof MULTILINGUAL_SEARCH_SCENARIOS)[number]): ScenarioResult {
  const expandedTerms = expandSearchQuery(scenario.query);
  const matches = recordPool.filter((record) => recordMatchesQuery(record, scenario.query));
  const missingAliases = (scenario.expectedAliases ?? []).filter((alias) => !includesExpandedTerm(expandedTerms, alias));
  const matchedSources = unique(matches.map((recall) => recall.source));
  const sampleMatchedSources = sampleSources(matches);
  const warnings: string[] = [];
  const failures: string[] = [];

  if (scenario.minMatches !== undefined && matches.length < scenario.minMatches) {
    failures.push(`Expected at least ${scenario.minMatches} match(es), found ${matches.length}.`);
  }

  if (scenario.maxMatches !== undefined && matches.length > scenario.maxMatches) {
    failures.push(`Expected no more than ${scenario.maxMatches} match(es), found ${matches.length}.`);
  }

  if (missingAliases.length > 0) {
    failures.push(`Missing expected aliases: ${missingAliases.join(', ')}.`);
  }

  for (const source of scenario.expectedSources ?? []) {
    if (!matchedSources.includes(source)) {
      failures.push(`Expected source ${source} to appear in matches.`);
    }
  }

  if (scenario.minMatches === undefined && scenario.maxMatches === undefined && matches.length === 0) {
    warnings.push('No current indexed records matched this scenario.');
  }

  if (matches.length > 300) {
    warnings.push('Broad query matched more than 300 indexed notices; monitor result ranking.');
  }

  return {
    id: scenario.id,
    group: scenario.group,
    query: scenario.query,
    normalizedQuery: normalizeSearchText(scenario.query),
    searchedRecords: recordPool.length,
    matchedCount: matches.length,
    expandedTerms,
    sampleMatchedTitles: sampleTitles(matches),
    sampleMatchedSources,
    missingAliases,
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function searchableIdentifierText(record: SiteRecall): string {
  return [record.recallNumber, record.title, ...record.productNames, record.description, record.hazard, record.remedy]
    .filter(Boolean)
    .join(' ');
}

function findIdentifierCandidate(records: SiteRecall[], source: SourceId): SiteRecall | undefined {
  if (source === 'NZ_PRODUCT_SAFETY') {
    return (
      records.find(
        (record) =>
          record.source === source &&
          /\b(?:model|sku|serial numbers?)\s*:/i.test(searchableIdentifierText(record))
      ) ?? records.find((record) => record.source === source)
    );
  }

  return (
    records.find((record) => record.source === source && Boolean(record.recallNumber)) ??
    records.find((record) => record.source === source)
  );
}

function identifierQueryFor(record: SiteRecall): string {
  if (record.source === 'NZ_PRODUCT_SAFETY') {
    const identifier = searchableIdentifierText(record).match(/\b(?:model|sku)\s*:\s*([A-Z0-9][A-Z0-9-]{2,})/i)?.[1];
    if (identifier) {
      return identifier;
    }
  }

  return record.recallNumber || record.id;
}

function labelledIdentifierQueryFor(source: SourceId, query: string): string {
  if (source === 'NZ_PRODUCT_SAFETY') {
    return `barcode ${query}`;
  }

  if (source === 'EU_SAFETY_GATE') {
    return `Safety Gate reference ${query}`;
  }

  if (source === 'UK_FSA') {
    return `FSA reference ${query}`;
  }

  if (source === 'HK_CFS') {
    return `Food alert reference ${query}`;
  }

  return `recall number ${query}`;
}

function runExactIdentifierCheck(records: SiteRecall[], source: SourceId): ExactIdentifierCheck {
  const candidate = findIdentifierCandidate(records, source);
  const warnings: string[] = [];
  const failures: string[] = [];

  if (!candidate) {
    failures.push(`No ${source} record is available for identifier regression testing.`);
    return {
      source,
      query: '',
      labelledQuery: '',
      expectedRecordId: '',
      expectedTitle: '',
      matchedCount: 0,
      expectedRank: null,
      expectedMatchType: null,
      labelledExpectedRank: null,
      labelledExpectedMatchType: null,
      unexpectedExactMatches: [],
      topResults: [],
      warnings,
      failures,
      status: 'fail'
    };
  }

  const query = identifierQueryFor(candidate);
  const labelledQuery = labelledIdentifierQueryFor(source, query);
  const result = searchRecalls(query, records);
  const labelledResult = searchRecalls(labelledQuery, records);
  const expectedRank = result.items.findIndex((item) => item.recall.id === candidate.id);
  const expectedItem = expectedRank >= 0 ? result.items[expectedRank] : null;
  const labelledExpectedRank = labelledResult.items.findIndex((item) => item.recall.id === candidate.id);
  const labelledExpectedItem = labelledExpectedRank >= 0 ? labelledResult.items[labelledExpectedRank] : null;
  const unexpectedExactMatches = result.items
    .filter((item) => item.match === 'exact' && item.recall.id !== candidate.id)
    .map((item) => item.recall.id);

  if (expectedRank < 0) {
    failures.push(`Identifier ${query} did not return expected record ${candidate.id}.`);
  } else if (expectedRank > 2) {
    warnings.push(`Identifier ${query} returned expected record at rank ${expectedRank + 1}.`);
  }

  if (labelledExpectedRank < 0) {
    failures.push(`Labelled identifier ${labelledQuery} did not return expected record ${candidate.id}.`);
  } else if (labelledExpectedRank > 2) {
    warnings.push(`Labelled identifier ${labelledQuery} returned expected record at rank ${labelledExpectedRank + 1}.`);
  }

  if (result.items.length > 15) {
    warnings.push(`Identifier ${query} returned ${result.items.length} matches; monitor for source-token noise.`);
  }

  if (unexpectedExactMatches.length > 0) {
    failures.push(
      `Identifier ${query} marked unrelated records as exact: ${unexpectedExactMatches.join(', ')}.`
    );
  }

  return {
    source,
    query,
    labelledQuery,
    expectedRecordId: candidate.id,
    expectedTitle: candidate.title,
    matchedCount: result.items.length,
    expectedRank: expectedRank >= 0 ? expectedRank + 1 : null,
    expectedMatchType: expectedItem?.match ?? null,
    labelledExpectedRank: labelledExpectedRank >= 0 ? labelledExpectedRank + 1 : null,
    labelledExpectedMatchType: labelledExpectedItem?.match ?? null,
    unexpectedExactMatches,
    topResults: result.items.slice(0, 5).map((item) => `${item.match}:${item.recall.id}:${item.recall.title}`),
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function runSourceCategoryCheck(records: SiteRecall[], check: (typeof SOURCE_CATEGORY_CHECKS)[number]): SourceCategoryCheck {
  const scopedRecords = records.filter(
    (record) => check.sources.includes(record.source as SourceId) && record.category === check.category
  );
  const matches = scopedRecords.filter((record) => searchTextMatchesQuery(buildRecallSearchText(record), check.query));
  const warnings: string[] = [];
  const failures: string[] = [];

  if (scopedRecords.length === 0) {
    failures.push(`No records found for ${check.sources.join(', ')} / ${check.category}.`);
  }

  if (matches.length < check.minMatches) {
    failures.push(`Expected at least ${check.minMatches} match(es), found ${matches.length}.`);
  }

  if (matches.length > 300) {
    warnings.push('Scoped query is broad; monitor ranking before adding more data.');
  }

  return {
    id: check.id,
    label: check.label,
    sources: check.sources,
    category: check.category,
    query: check.query,
    searchedRecords: scopedRecords.length,
    matchedCount: matches.length,
    sampleMatchedTitles: sampleTitles(matches),
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function runRankingNote(records: SiteRecall[], scenario: (typeof MULTILINGUAL_SEARCH_SCENARIOS)[number]): RankingNote | null {
  if (!scenario.rankingTerms?.length) {
    return null;
  }

  const result = searchRecalls(scenario.query, records);
  const topItems = result.items.slice(0, 5);
  const topSearchText = normalizeSearchText(topItems.map((item) => buildRecallSearchText(item.recall)).join(' '));
  const expectedTerms = scenario.rankingTerms.map((term) => normalizeSearchText(term));
  const topResultTermMatches = topItems.filter((item) => {
    const itemSearchText = visibleResultText(item.recall);
    return expectedTerms.some((term) => itemSearchText.includes(term));
  }).length;
  const warnings: string[] = [];
  const failures: string[] = [];
  const unexpectedTopMatchReasons = topItems
    .filter((item) => scenario.disallowedTopMatchReasons?.includes(item.matchReason))
    .map((item) => `${item.matchReason}:${item.recall.id}`);

  if (!expectedTerms.some((term) => topSearchText.includes(term))) {
    warnings.push(`Top results do not visibly contain expected terms: ${scenario.rankingTerms.join(', ')}.`);
  }

  if (
    scenario.minTopResultTermMatches &&
    topResultTermMatches < scenario.minTopResultTermMatches
  ) {
    warnings.push(
      `Only ${topResultTermMatches} of the top ${topItems.length} results contain a primary term; expected at least ${scenario.minTopResultTermMatches}.`
    );
  }

  if (unexpectedTopMatchReasons.length > 0) {
    failures.push(
      `Top results used disallowed match reasons: ${unexpectedTopMatchReasons.join(', ')}.`
    );
  }

  return {
    id: scenario.id,
    query: scenario.query,
    topResultsChecked: topItems.length,
    expectedTerms: scenario.rankingTerms,
    topResultTermMatches,
    minimumTopResultTermMatches: scenario.minTopResultTermMatches ?? null,
    unexpectedTopMatchReasons,
    topResults: topItems.map((item) => `${item.match}:${item.matchReason}:${item.recall.id}:${item.recall.title}`),
    warnings,
    failures
  };
}

function runSourceSearchIntentCheck(
  records: SiteRecall[],
  check: (typeof SOURCE_SEARCH_INTENT_CHECKS)[number]
): SourceSearchIntentCheck {
  const result = searchRecalls(check.query, records);
  const expectedCount = check.expectedSources.reduce((total, source) => total + EXPECTED_SOURCE_COUNTS[source], 0);
  const matchedSources = [...new Set(result.items.map((item) => item.recall.source))].sort();
  const expectedSources = [...check.expectedSources].sort();
  const warnings: string[] = [];
  const failures: string[] = [];
  const mixedResult = check.mixedQuery ? searchRecalls(check.mixedQuery, records) : null;

  if (result.items.length !== expectedCount) {
    failures.push(`Expected ${expectedCount} source-only results, found ${result.items.length}.`);
  }

  if (matchedSources.join(',') !== expectedSources.join(',')) {
    failures.push(
      `Expected source-only results from ${expectedSources.join(', ')}, found ${matchedSources.join(', ') || 'none'}.`
    );
  }

  if (result.items.some((item) => item.matchReason !== 'source' || item.match !== 'related')) {
    failures.push('Source-only results must be marked as related source matches.');
  }

  if (mixedResult) {
    const mixedSources = [...new Set(mixedResult.items.map((item) => item.recall.source))].sort();
    if (mixedResult.items.length === 0) {
      failures.push(`Mixed source/product query ${check.mixedQuery} returned no results.`);
    }
    if (mixedSources.join(',') !== expectedSources.join(',')) {
      failures.push(
        `Mixed source/product query ${check.mixedQuery} returned unexpected sources: ${mixedSources.join(', ') || 'none'}.`
      );
    }
  }

  if (result.items.length > 500) {
    warnings.push('Source-only result group is broad; the checker should continue to support follow-up product searches.');
  }

  return {
    id: check.id,
    query: check.query,
    expectedSources,
    expectedCount,
    matchedCount: result.items.length,
    matchedSources,
    mixedQuery: check.mixedQuery,
    mixedQueryMatchCount: mixedResult?.items.length,
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function runProductFamilySearchCheck(
  records: SiteRecall[],
  productFamily: (typeof SEARCHABLE_PRODUCT_FAMILIES)[number],
  locale: (typeof SUPPORTED_LOCALES)[number]
): ProductFamilySearchCheck {
  const query = getMessage(getProductFamilyI18nKey(productFamily), locale);
  const expectedRecords = records.filter((record) => record.taxonomyProductFamily === productFamily);
  const result = searchRecalls(query, records);
  const matchingItems = result.items.filter((item) => item.recall.taxonomyProductFamily === productFamily);
  const warnings: string[] = [];
  const failures: string[] = [];

  if (matchingItems.length === 0) {
    failures.push(`Translated product-family query did not return a ${productFamily} record.`);
  }

  if (result.items.length > 0 && result.items[0].recall.taxonomyProductFamily !== productFamily) {
    failures.push(`Top result belongs to ${result.items[0].recall.taxonomyProductFamily ?? 'an unclassified family'}.`);
  }

  return {
    productFamily,
    locale,
    query,
    availableRecordCount: expectedRecords.length,
    matchingRecordCount: matchingItems.length,
    topResultFamilies: result.items.slice(0, 5).map((item) => item.recall.taxonomyProductFamily ?? 'unclassified'),
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function runHazardSearchCheck(
  records: SiteRecall[],
  check: (typeof MULTILINGUAL_HAZARD_SEARCH_CHECKS)[number]
): HazardSearchCheck {
  const result = searchRecalls(check.query, records);
  const matchedHazardTypes = [...new Set(result.items.map((item) => item.recall.taxonomyHazardType ?? 'unclassified'))].sort();
  const matchedSources = [...new Set(result.items.map((item) => item.recall.source))].sort();
  const expectedHazardTypes = [...check.expectedHazardTypes].sort();
  const warnings: string[] = [];
  const failures: string[] = [];

  if (result.items.length === 0) {
    failures.push('Hazard query returned no results.');
  }

  const unexpectedHazardTypes = matchedHazardTypes.filter((hazardType) => !expectedHazardTypes.includes(hazardType));
  if (unexpectedHazardTypes.length > 0) {
    failures.push(
      `Expected only hazards ${expectedHazardTypes.join(', ')}, found unexpected ${unexpectedHazardTypes.join(', ')}.`
    );
  }

  if (check.expectedSources && matchedSources.join(',') !== [...check.expectedSources].sort().join(',')) {
    failures.push(
      `Expected sources ${check.expectedSources.join(', ')}, found ${matchedSources.join(', ') || 'none'}.`
    );
  }

  return {
    id: check.id,
    query: check.query,
    expectedHazardTypes,
    expectedSources: check.expectedSources,
    matchedCount: result.items.length,
    matchedHazardTypes,
    matchedSources,
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

function runProductTypeSearchCheck(
  records: SiteRecall[],
  check: (typeof MULTILINGUAL_PRODUCT_TYPE_SEARCH_CHECKS)[number]
): ProductTypeSearchCheck {
  const result = searchRecalls(check.query, records);
  const matchedProductTypes = [...new Set(result.items.map((item) => item.recall.taxonomyProductType ?? 'unclassified'))].sort();
  const matchedSources = [...new Set(result.items.map((item) => item.recall.source))].sort();
  const expectedProductTypes = [...check.expectedProductTypes].sort();
  const warnings: string[] = [];
  const failures: string[] = [];

  if (result.items.length === 0) {
    failures.push('Product-type query returned no results.');
  }

  const unexpectedProductTypes = matchedProductTypes.filter((productType) => !expectedProductTypes.includes(productType));
  if (unexpectedProductTypes.length > 0) {
    failures.push(
      `Expected only product types ${expectedProductTypes.join(', ')}, found unexpected ${unexpectedProductTypes.join(', ')}.`
    );
  }

  if (check.expectedSources && matchedSources.join(',') !== [...check.expectedSources].sort().join(',')) {
    failures.push(
      `Expected sources ${check.expectedSources.join(', ')}, found ${matchedSources.join(', ') || 'none'}.`
    );
  }

  return {
    id: check.id,
    query: check.query,
    expectedProductTypes,
    expectedSources: check.expectedSources,
    matchedCount: result.items.length,
    matchedProductTypes,
    matchedSources,
    warnings,
    failures,
    status: statusFor(warnings, failures)
  };
}

const processedFile = JSON.parse(await readFile(canonicalProcessedPath, 'utf8')) as ProcessedRecallFile;
const classificationFile = JSON.parse(await readFile(classificationProcessedPath, 'utf8')) as ClassificationV2File;
const classificationsByRecordId = new Map(
  (classificationFile.records ?? [])
    .filter((record): record is { recordId: string; classification: RecallClassificationV2 } =>
      Boolean(record.success && !record.failed && record.classification)
    )
    .map((record) => [record.recordId, record.classification])
);
const records = processedFile.records.map((record) => toSiteRecall(record, classificationsByRecordId.get(record.id)));
const counts = sourceCounts(records);

const sourceCountFailures = Object.entries(EXPECTED_SOURCE_COUNTS).flatMap(([source, expected]) => {
  const actual = counts[source] ?? 0;
  return actual === expected ? [] : [`${source} expected ${expected} records, found ${actual}.`];
});

const scenarioResults = MULTILINGUAL_SEARCH_SCENARIOS.map((scenario) => runScenario(records, scenario));
const exactIdentifierChecks = (Object.keys(EXPECTED_SOURCE_COUNTS) as SourceId[]).map((source) =>
  runExactIdentifierCheck(records, source)
);
const sourceCategoryChecks = SOURCE_CATEGORY_CHECKS.map((check) => runSourceCategoryCheck(records, check));
const rankingNotes = MULTILINGUAL_SEARCH_SCENARIOS.map((scenario) => runRankingNote(records, scenario)).filter(
  (note): note is RankingNote => Boolean(note)
);
const sourceSearchIntentChecks = SOURCE_SEARCH_INTENT_CHECKS.map((check) =>
  runSourceSearchIntentCheck(records, check)
);
const productFamilySearchChecks = SEARCHABLE_PRODUCT_FAMILIES
  .filter((productFamily) => records.some((record) => record.taxonomyProductFamily === productFamily))
  .flatMap((productFamily) =>
    SUPPORTED_LOCALES.map((locale) => runProductFamilySearchCheck(records, productFamily, locale))
  );
const directHazardSearchChecks = HAZARD_TYPE_VALUES
  .filter((hazardType) => hazardType !== 'unknown' && records.some((record) => record.taxonomyHazardType === hazardType))
  .map((hazardType) => ({
    id: `hazard-${hazardType}`,
    query: getHazardTypeLabel(hazardType),
    expectedHazardTypes: [hazardType]
  }));
const hazardSearchChecks = [...directHazardSearchChecks, ...MULTILINGUAL_HAZARD_SEARCH_CHECKS].map((check) =>
  runHazardSearchCheck(records, check)
);
const directProductTypeSearchChecks = PRODUCT_TYPE_VALUES
  .filter((productType) => productType !== 'other' && productType !== 'unknown')
  .filter((productType) => records.some((record) => record.taxonomyProductType === productType))
  .map((productType) => ({
    id: `product-type-${productType}`,
    query: getProductTypeLabel(productType),
    expectedProductTypes: [productType]
  }));
const productTypeSearchChecks = [...directProductTypeSearchChecks, ...MULTILINGUAL_PRODUCT_TYPE_SEARCH_CHECKS].map((check) =>
  runProductTypeSearchCheck(records, check)
);
const negativeQueryChecks = scenarioResults.filter((result) => result.group === 'negative/noise');

const warningCount =
  scenarioResults.reduce((total, result) => total + result.warnings.length, 0) +
  exactIdentifierChecks.reduce((total, result) => total + result.warnings.length, 0) +
  sourceCategoryChecks.reduce((total, result) => total + result.warnings.length, 0) +
  rankingNotes.reduce((total, result) => total + result.warnings.length, 0) +
  sourceSearchIntentChecks.reduce((total, result) => total + result.warnings.length, 0) +
  productFamilySearchChecks.reduce((total, result) => total + result.warnings.length, 0) +
  hazardSearchChecks.reduce((total, result) => total + result.warnings.length, 0) +
  productTypeSearchChecks.reduce((total, result) => total + result.warnings.length, 0);
const failCount =
  sourceCountFailures.length +
  scenarioResults.reduce((total, result) => total + result.failures.length, 0) +
  exactIdentifierChecks.reduce((total, result) => total + result.failures.length, 0) +
  sourceCategoryChecks.reduce((total, result) => total + result.failures.length, 0) +
  rankingNotes.reduce((total, result) => total + result.failures.length, 0) +
  sourceSearchIntentChecks.reduce((total, result) => total + result.failures.length, 0) +
  productFamilySearchChecks.reduce((total, result) => total + result.failures.length, 0) +
  hazardSearchChecks.reduce((total, result) => total + result.failures.length, 0) +
  productTypeSearchChecks.reduce((total, result) => total + result.failures.length, 0);

const summary = {
  passed: failCount === 0,
  generatedAt: new Date().toISOString(),
  totalRecords: records.length,
  sourceCounts: counts,
  expectedSourceCounts: EXPECTED_SOURCE_COUNTS,
  sourceCountFailures,
  scenariosTested: scenarioResults.length,
  passCount: scenarioResults.filter((result) => result.status === 'pass').length,
  warningCount,
  failCount,
  scenarioResults,
  exactIdentifierChecks,
  sourceCategoryChecks,
  sourceSearchIntentChecks,
  productFamilySearchChecks,
  hazardSearchChecks,
  productTypeSearchChecks,
  negativeQueryChecks,
  rankingNotes
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
