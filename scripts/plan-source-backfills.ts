import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProcessedRecallFile } from '../src/data/recall-types.ts';
import { sourceBackfillRegistry, type SourceBackfillRegistryEntry } from './source-backfill-registry.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const validSourceFilterValues = [
  'all',
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS',
  'FSANZ_FOOD_RECALLS'
];

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

async function readCanonicalCounts(): Promise<{ total: number; countsBySource: Record<string, number> }> {
  const text = await readFile(canonicalProcessedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  const records = Array.isArray(payload.records) ? payload.records : [];
  const countsBySource: Record<string, number> = {};

  for (const record of records) {
    increment(countsBySource, record.source);
  }

  return {
    total: records.length,
    countsBySource
  };
}

function scriptsFor(entry: SourceBackfillRegistryEntry): Record<string, string> {
  return {
    fetch: entry.existingFetchScript,
    normalize: entry.existingNormalizeScript,
    audit: entry.existingAuditScript,
    update: entry.existingUpdateScript
  };
}

function sourceReport(entry: SourceBackfillRegistryEntry, actualCount: number) {
  return {
    sourceId: entry.sourceId,
    label: entry.label,
    currentCount: actualCount,
    expectedCurrentCount: entry.currentCount,
    countMatchesRegistry: actualCount === entry.currentCount,
    backfillStatus: entry.backfillStatus,
    suggestedBackfillMode: entry.suggestedBackfillMode,
    existingScripts: scriptsFor(entry),
    rawPath: entry.rawPath,
    processedPath: entry.processedPath,
    outputDir: entry.outputDir,
    checkpointPath: entry.checkpointPath,
    endpointOrInput: entry.endpointOrInput,
    currentFetchMode: entry.currentFetchMode,
    paginationStatus: entry.paginationStatus,
    dateFilterStatus: entry.dateFilterStatus,
    detailRefreshStatus: entry.detailRefreshStatus,
    imageSupport: entry.imageSupport,
    knownLimitations: entry.knownLimitations,
    recommendedNextStep: entry.recommendedNextStep,
    estimatedRisk: entry.estimatedRisk,
    riskNotes: entry.riskNotes,
    deferredWork: entry.deferredWork
  };
}

function selectedEntries(sourceOption: string): SourceBackfillRegistryEntry[] {
  if (sourceOption === 'all') {
    return sourceBackfillRegistry;
  }

  return sourceBackfillRegistry.filter((entry) => entry.sourceId === sourceOption);
}

async function run(): Promise<void> {
  const sourceOption = readOption('source')?.trim() || 'all';
  const counts = await readCanonicalCounts();
  const entries = selectedEntries(sourceOption);
  const warnings: string[] = [];

  if (entries.length === 0) {
    warnings.push(
      `Unknown source option: ${sourceOption}. Use all, CPSC, FDA, FR_RAPPELCONSO, CA_RECALLS, EU_SAFETY_GATE, UK_FSA, AU_PRODUCT_SAFETY, NZ_PRODUCT_SAFETY, HK_CFS, or FSANZ_FOOD_RECALLS.`
    );
  }

  const sources = entries.map((entry) => sourceReport(entry, counts.countsBySource[entry.sourceId] ?? 0));
  const countMismatches = sources
    .filter((source) => !source.countMatchesRegistry)
    .map((source) => `${source.sourceId} registry=${source.expectedCurrentCount} actual=${source.currentCount}`);

  if (countMismatches.length) {
    warnings.push(`Source count mismatches: ${countMismatches.join('; ')}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'planning',
    selectedSource: sourceOption,
    totalCurrentCanonicalRecords: counts.total,
    countsBySource: counts.countsBySource,
    sourceFilterValues: validSourceFilterValues,
    sources,
    globalRecommendations: [
      'Keep canonical data unchanged until a launch-time or staging backfill branch is explicitly approved.',
      'Use source-specific dry-run pipelines before any chunk writing.',
      'Write generated chunks only under ignored data/backfill/{source}/ directories.',
      'Audit each source chunk before any canonical merge.',
      'Measure canonical file size, static route count, brand page growth, and build time before expanding records.',
      'Keep source ids and source filter values stable.'
    ],
    launchTimeBackfillOrder: [
      'FDA: dry-run tooling already exists; choose a launch subset before expansion.',
      'CPSC: add date-window dry-run and chunk audit next because the API supports date windows.',
      'UK_FSA: add list pagination plus detail refresh controls.',
      'AU_PRODUCT_SAFETY: add dry-run pagination and detail refresh controls before full Australia expansion.',
      'NZ_PRODUCT_SAFETY: add dry-run start-pagination and detail refresh controls before full New Zealand expansion.',
      'HK_CFS: add dry-run annual archive chunking before full Hong Kong CFS expansion.',
      'FSANZ_FOOD_RECALLS: add dry-run listing-pagination chunking before full FSANZ expansion.',
      'FR_RAPPELCONSO: add offset/date filters and recall-level dedupe.',
      'CA_RECALLS: design full-feed chunking and optional detail-image refresh.',
      'EU_SAFETY_GATE: investigate historical/date strategy before full backfill because payloads and images are verbose.'
    ],
    doNotCommitPatterns: [
      'data/backfill/*/**/*.json',
      'data/backfill/*/**/*.jsonl',
      'data/backfill/*/**/*.tmp',
      'data/backfill/*/**/*.log'
    ],
    deferredWork: [
      'No full backfill in this phase.',
      'No source-specific non-FDA backfill execution.',
      'No canonical expansion.',
      'No source refresh.',
      'No image scraping.',
      'No backend or runtime API.'
    ],
    warnings
  };

  console.log(JSON.stringify(report, null, 2));

  if (entries.length === 0 || countMismatches.length > 0 || counts.total !== 1201) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
