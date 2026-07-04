import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { getSourceOptionsForCurrentCoverage } from '../src/lib/recall-sources.ts';

type MissingCounts = {
  sourceUrl: number;
  title: number;
  recallDate: number;
  productNames: number;
  brandNames: number;
  hazardOrReason: number;
  remedyOrAction: number;
};

type DuplicateId = {
  id: string;
  count: number;
};

const expectedCounts: Record<RecallSource, number> = {
  CPSC: 301,
  FDA: 100,
  FR_RAPPELCONSO: 100,
  CA_RECALLS: 100,
  EU_SAFETY_GATE: 100,
  UK_FSA: 100,
  AU_PRODUCT_SAFETY: 100
};

const expectedTotal = Object.values(expectedCounts).reduce((total, count) => total + count, 0);
const expectedSourceIds = Object.keys(expectedCounts) as RecallSource[];
const expectedSourceFilterValues = ['all', ...expectedSourceIds];
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function emptyMissingCounts(): MissingCounts {
  return {
    sourceUrl: 0,
    title: 0,
    recallDate: 0,
    productNames: 0,
    brandNames: 0,
    hazardOrReason: 0,
    remedyOrAction: 0
  };
}

function missingCountsFor(records: NormalizedRecall[]): MissingCounts {
  const missing = emptyMissingCounts();

  for (const record of records) {
    if (!record.sourceUrl) missing.sourceUrl += 1;
    if (!record.title) missing.title += 1;
    if (!record.recallDate) missing.recallDate += 1;
    if (!record.productNames.length) missing.productNames += 1;
    if (!record.brandNames.length) missing.brandNames += 1;
    if (!record.hazard && !record.reason) missing.hazardOrReason += 1;
    if (!record.remedy) missing.remedyOrAction += 1;
  }

  return missing;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceCounts(records: NormalizedRecall[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const record of records) {
    increment(counts, record.source);
  }

  return counts;
}

function categoryDistribution(records: NormalizedRecall[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const record of records) {
    increment(distribution, record.category || '(missing)');
  }

  return Object.fromEntries(Object.entries(distribution).sort((a, b) => b[1] - a[1]));
}

async function readCanonicalRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(canonicalProcessedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records) ? payload.records : [];
}

function duplicateIds(records: NormalizedRecall[]): DuplicateId[] {
  const idCounts = new Map<string, number>();

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
  }

  return [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildWarnings(missingBySource: Record<string, MissingCounts>): string[] {
  return Object.entries(missingBySource)
    .flatMap(([source, missing]) =>
      Object.entries(missing)
        .filter(([, count]) => count > 0)
        .map(([field, count]) => `${source} has ${count} records missing ${field}.`)
    )
    .sort();
}

async function runAudit(): Promise<void> {
  const records = await readCanonicalRecords();
  const activeSourceFilterValues = ['all', ...getSourceOptionsForCurrentCoverage().map((option) => option.value)];
  const activeSourceIds = activeSourceFilterValues.filter((value) => value !== 'all');
  const counts = sourceCounts(records);
  const dataSourceIds = Object.keys(counts).sort();
  const duplicateIdValues = duplicateIds(records);
  const unexpectedSourceIds = dataSourceIds.filter((source) => !expectedSourceIds.includes(source as RecallSource));
  const missingSourceConfigs = dataSourceIds.filter((source) => !activeSourceIds.includes(source));
  const sourceIdsWithNoRecords = activeSourceIds.filter((source) => (counts[source] ?? 0) === 0);
  const missingBySource = Object.fromEntries(
    activeSourceIds.map((source) => [
      source,
      missingCountsFor(records.filter((record) => record.source === source))
    ])
  );
  const categoryDistributionBySource = Object.fromEntries(
    activeSourceIds.map((source) => [
      source,
      categoryDistribution(records.filter((record) => record.source === source))
    ])
  );
  const expectedCountMismatches = expectedSourceIds
    .map((source) => {
      const actual = counts[source] ?? 0;
      const expected = expectedCounts[source];
      return actual === expected ? '' : `${source} count ${actual} does not match expected ${expected}.`;
    })
    .filter(Boolean);
  const blockers = [
    records.length === expectedTotal ? '' : `Total record count ${records.length} does not match expected ${expectedTotal}.`,
    ...expectedCountMismatches,
    unexpectedSourceIds.length ? `Unexpected source ids found: ${unexpectedSourceIds.join(', ')}.` : '',
    missingSourceConfigs.length ? `Source ids missing from active registry: ${missingSourceConfigs.join(', ')}.` : '',
    sourceIdsWithNoRecords.length ? `Active source ids with no records: ${sourceIdsWithNoRecords.join(', ')}.` : '',
    duplicateIdValues.length ? `Duplicate ids found: ${duplicateIdValues.length}.` : '',
    arraysEqual(activeSourceFilterValues, expectedSourceFilterValues)
      ? ''
      : `Source filter values changed unexpectedly: ${activeSourceFilterValues.join(', ')}.`,
    arraysEqual(dataSourceIds, [...activeSourceIds].sort())
      ? ''
      : `Source registry active list does not match current data sources: data=${dataSourceIds.join(', ')} registry=${activeSourceIds.join(', ')}.`
  ].filter(Boolean);
  const passed = blockers.length === 0;

  console.log(
    JSON.stringify(
      {
        passed,
        summaryLine: `${passed ? 'PASS' : 'FAIL'} total=${records.length} sources=${activeSourceIds.length} duplicateIds=${duplicateIdValues.length}`,
        blockers,
        warnings: buildWarnings(missingBySource),
        auditSummary: {
          result: passed ? 'pass' : 'fail',
          totalRecordCount: records.length,
          expectedTotalRecordCount: expectedTotal,
          perSourceCounts: counts,
          expectedSourceIds,
          activeSourceFilterValues,
          unexpectedSourceIds,
          missingSourceConfigs,
          sourceIdsWithNoRecords,
          duplicateIds: duplicateIdValues.length,
          sourceRegistryMatchesCurrentData: arraysEqual(dataSourceIds, [...activeSourceIds].sort())
        },
        missingBySource,
        categoryDistributionBySource,
        duplicateIdValues
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
