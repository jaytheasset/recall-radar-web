import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { expandSearchQuery, matchesMultilingualSearch } from '../src/lib/multilingual-search.ts';

type QueryGroup = 'Korean' | 'Japanese' | 'English control' | 'French/source';

type QueryCase = {
  group: QueryGroup;
  query: string;
  mustMatch?: boolean;
  expectedAliases?: string[];
};

const queryCases: QueryCase[] = [
  { group: 'Korean', query: '蹂댁“諛고꽣由?', mustMatch: true, expectedAliases: ['power bank', 'portable charger'] },
  { group: 'Korean', query: '蹂댁“諛고꽣由??붿옱', expectedAliases: ['power bank', 'fire'] },
  { group: 'Korean', query: '異⑹쟾湲?', mustMatch: true, expectedAliases: ['charger', 'adapter'] },
  { group: 'Korean', query: '諛고꽣由?怨쇱뿴', expectedAliases: ['battery', 'overheating'] },
  { group: 'Korean', query: '?쇱뒪?移섏삤', mustMatch: true, expectedAliases: ['pistachio', 'pistache'] },
  { group: 'Korean', query: '?뚮젅瑜닿린', mustMatch: true, expectedAliases: ['allergen', 'undeclared'] },
  { group: 'Korean', query: '?꾧린移⑤?', expectedAliases: ['crib', 'baby sleeper'] },
  { group: 'Korean', query: '?λ궃媛?', expectedAliases: ['toy'] },
  { group: 'Korean', query: '?대┛???좎샆', expectedAliases: ['sleepwear', 'loungewear'] },
  { group: 'Korean', query: '媛??', expectedAliases: ['appliance'] },
  { group: 'Korean', query: '媛먯쟾', expectedAliases: ['electric shock'] },
  { group: 'Korean', query: '吏덉떇', expectedAliases: ['choking'] },
  { group: 'Japanese', query: '?㏂깘?ㅳ꺂?먦긿?녴꺁??', expectedAliases: ['power bank', 'portable charger'] },
  { group: 'Japanese', query: '?낂쎔??', expectedAliases: ['charger', 'adapter'] },
  { group: 'Japanese', query: '?ョ겱', expectedAliases: ['fire', 'overheating'] },
  { group: 'Japanese', query: '?㏂꺃?ャ궙??', expectedAliases: ['allergen', 'undeclared'] },
  { group: 'Japanese', query: '?붵궧?욍긽??', expectedAliases: ['pistachio'] },
  { group: 'Japanese', query: '?듽굚?▲굛', expectedAliases: ['toy'] },
  { group: 'English control', query: 'power bank', mustMatch: true, expectedAliases: ['portable charger'] },
  { group: 'English control', query: 'pistachio', mustMatch: true, expectedAliases: ['pistache'] },
  { group: 'English control', query: 'baby sleeper', expectedAliases: ['crib'] },
  { group: 'English control', query: 'smoke detector', mustMatch: true },
  { group: 'English control', query: 'charger', mustMatch: true, expectedAliases: ['adapter'] },
  { group: 'English control', query: 'overheating', mustMatch: true, expectedAliases: ['fire hazard'] },
  { group: 'French/source', query: 'rappel', mustMatch: true, expectedAliases: ['recall'] },
  { group: 'French/source', query: 'pistache', mustMatch: true, expectedAliases: ['pistachio'] },
  { group: 'French/source', query: 'allerg챔ne', expectedAliases: ['allergen'] },
  { group: 'French/source', query: 'lait', mustMatch: true, expectedAliases: ['milk'] }
];

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');

function toSearchRecord(record: NormalizedRecall) {
  const primaryBrand = record.brandNames[0] ?? 'Unknown brand';
  const primaryProductName = record.productNames[0] ?? record.title;

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
    productNames: record.productNames,
    primaryProductName,
    category: record.category,
    rawCategory: record.category,
    categoryLabel: record.category,
    hazard: record.hazard,
    remedy: record.remedy,
    affectedUnits: record.affectedUnits,
    description: record.description,
    slug: record.slug,
    classification: record.classification,
    reason: record.reason,
    distributionPattern: record.distributionPattern,
    productQuantity: record.productQuantity,
    recallNumber: record.recallNumber,
    status: record.status
  };
}

function includesExpandedTerm(expandedTerms: string[], expected: string): boolean {
  return expandedTerms.includes(expected);
}

const processedFile = JSON.parse(await readFile(canonicalProcessedPath, 'utf8')) as ProcessedRecallFile;
const searchableRecords = processedFile.records.map(toSearchRecord);

const results = queryCases.map((test) => {
  const expandedTerms = expandSearchQuery(test.query);
  const matches = searchableRecords.filter((recall) => matchesMultilingualSearch(recall, test.query));
  const missingAliases = (test.expectedAliases ?? []).filter((alias) => !includesExpandedTerm(expandedTerms, alias));

  return {
    group: test.group,
    query: test.query,
    expandedTerms,
    matches: matches.length,
    sampleMatchedTitles: matches.slice(0, 5).map((recall) => recall.title),
    sampleMatchedSources: [...new Set(matches.slice(0, 10).map((recall) => recall.source))],
    missingAliases,
    warnings: [
      ...(matches.length === 0 ? ['No current indexed records matched this query.'] : []),
      ...(missingAliases.length ? [`Missing expected aliases: ${missingAliases.join(', ')}`] : [])
    ]
  };
});

const blockers = results.flatMap((result) => {
  const test = queryCases.find((queryCase) => queryCase.query === result.query);
  const failures: string[] = [];

  if (test?.mustMatch && result.matches === 0) {
    failures.push(`${result.query} produced no matches`);
  }

  if (result.missingAliases.length > 0) {
    failures.push(`${result.query} did not expand to expected aliases: ${result.missingAliases.join(', ')}`);
  }

  return failures;
});

const summary = {
  passed: blockers.length === 0,
  totalRecords: searchableRecords.length,
  queriesTested: queryCases.length,
  blockers,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
