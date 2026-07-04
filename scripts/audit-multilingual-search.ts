import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import type { SiteRecall, SiteRecallCategory } from '../src/lib/recall-data.ts';
import {
  buildRecallSearchText,
  expandSearchQuery,
  matchesMultilingualSearch,
  normalizeSearchText,
  searchTextMatchesQuery
} from '../src/lib/multilingual-search.ts';
import { searchRecalls } from '../src/lib/recall-search.ts';
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
  | 'HK_CFS';

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
  expectedRecordId: string;
  expectedTitle: string;
  matchedCount: number;
  expectedRank: number | null;
  expectedMatchType: string | null;
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
  topResults: string[];
  warnings: string[];
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
  HK_CFS: 100
};

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
  }
];

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');

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

function toSiteRecall(record: NormalizedRecall): SiteRecall {
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

function runExactIdentifierCheck(records: SiteRecall[], source: SourceId): ExactIdentifierCheck {
  const candidate = findIdentifierCandidate(records, source);
  const warnings: string[] = [];
  const failures: string[] = [];

  if (!candidate) {
    failures.push(`No ${source} record is available for identifier regression testing.`);
    return {
      source,
      query: '',
      expectedRecordId: '',
      expectedTitle: '',
      matchedCount: 0,
      expectedRank: null,
      expectedMatchType: null,
      topResults: [],
      warnings,
      failures,
      status: 'fail'
    };
  }

  const query = identifierQueryFor(candidate);
  const result = searchRecalls(query, records);
  const expectedRank = result.items.findIndex((item) => item.recall.id === candidate.id);
  const expectedItem = expectedRank >= 0 ? result.items[expectedRank] : null;

  if (expectedRank < 0) {
    failures.push(`Identifier ${query} did not return expected record ${candidate.id}.`);
  } else if (expectedRank > 2) {
    warnings.push(`Identifier ${query} returned expected record at rank ${expectedRank + 1}.`);
  }

  if (result.items.length > 15) {
    warnings.push(`Identifier ${query} returned ${result.items.length} matches; monitor for source-token noise.`);
  }

  return {
    source,
    query,
    expectedRecordId: candidate.id,
    expectedTitle: candidate.title,
    matchedCount: result.items.length,
    expectedRank: expectedRank >= 0 ? expectedRank + 1 : null,
    expectedMatchType: expectedItem?.match ?? null,
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
  const warnings: string[] = [];

  if (!expectedTerms.some((term) => topSearchText.includes(term))) {
    warnings.push(`Top results do not visibly contain expected terms: ${scenario.rankingTerms.join(', ')}.`);
  }

  return {
    id: scenario.id,
    query: scenario.query,
    topResultsChecked: topItems.length,
    expectedTerms: scenario.rankingTerms,
    topResults: topItems.map((item) => `${item.match}:${item.matchReason}:${item.recall.id}:${item.recall.title}`),
    warnings
  };
}

const processedFile = JSON.parse(await readFile(canonicalProcessedPath, 'utf8')) as ProcessedRecallFile;
const records = processedFile.records.map(toSiteRecall);
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
const negativeQueryChecks = scenarioResults.filter((result) => result.group === 'negative/noise');

const warningCount =
  scenarioResults.reduce((total, result) => total + result.warnings.length, 0) +
  exactIdentifierChecks.reduce((total, result) => total + result.warnings.length, 0) +
  sourceCategoryChecks.reduce((total, result) => total + result.warnings.length, 0) +
  rankingNotes.reduce((total, result) => total + result.warnings.length, 0);
const failCount =
  sourceCountFailures.length +
  scenarioResults.reduce((total, result) => total + result.failures.length, 0) +
  exactIdentifierChecks.reduce((total, result) => total + result.failures.length, 0) +
  sourceCategoryChecks.reduce((total, result) => total + result.failures.length, 0);

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
  negativeQueryChecks,
  rankingNotes
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
