import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBalancedRecentRecalls,
  hasBalancedRecentImage,
  type BalancedRecentRecallCandidate
} from '../src/lib/homepage-recent.ts';

type ProcessedRecallFile = {
  records?: BalancedRecentRecallCandidate[];
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/recalls.json');
const selectedCountWarningThreshold = 9;
const sourceDominanceWarningThreshold = 5;
const targetCount = 12;

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function distributionFor(
  recalls: BalancedRecentRecallCandidate[],
  key: keyof Pick<BalancedRecentRecallCandidate, 'source' | 'category'>
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const recall of recalls) {
    increment(distribution, String(recall[key] || 'Uncategorized'));
  }

  return distribution;
}

function sortedEntries(distribution: Record<string, number>): [string, number][] {
  return Object.entries(distribution).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function titlesFor(recalls: BalancedRecentRecallCandidate[]): string[] {
  return recalls.map((recall) => {
    const title = 'title' in recall && typeof recall.title === 'string' ? recall.title : recall.id;
    return `${recall.source}: ${title}`;
  });
}

async function main(): Promise<void> {
  const raw = await readFile(processedPath, 'utf8');
  const processed = JSON.parse(raw) as ProcessedRecallFile;
  const records = Array.isArray(processed.records) ? processed.records : [];
  const selected = getBalancedRecentRecalls(records, { limit: targetCount });
  const sourceDistribution = distributionFor(selected, 'source');
  const categoryDistribution = distributionFor(selected, 'category');
  const recordsWithRealImages = selected.filter(hasBalancedRecentImage).length;
  const imageLessSelectedCount = selected.length - recordsWithRealImages;
  const warnings: string[] = [];

  if (selected.length < selectedCountWarningThreshold) {
    warnings.push(`selectedCount below ${selectedCountWarningThreshold}`);
  }

  if (recordsWithRealImages < selected.length) {
    warnings.push('recordsWithRealImages below selectedCount');
  }

  if (imageLessSelectedCount > 0) {
    warnings.push(`${imageLessSelectedCount} selected records have no real product image`);
  }

  for (const [source, count] of sortedEntries(sourceDistribution)) {
    if (count > sourceDominanceWarningThreshold) {
      warnings.push(`${source} has ${count} selected records`);
    }
  }

  if (Object.keys(sourceDistribution).length === 1 && selected.length > 1) {
    warnings.push('all selected records are from one source');
  }

  if (Object.keys(categoryDistribution).length === 1 && selected.length > 1) {
    warnings.push('all selected records are from one category');
  }

  console.log(`selectedCount: ${selected.length}`);
  console.log(`recordsWithRealImages: ${recordsWithRealImages}`);
  console.log(`imageLessSelectedCount: ${imageLessSelectedCount}`);
  console.log(`sourceDistribution: ${JSON.stringify(sourceDistribution)}`);
  console.log(`categoryDistribution: ${JSON.stringify(categoryDistribution)}`);
  console.log(`selectedTitles: ${JSON.stringify(titlesFor(selected), null, 2)}`);
  console.log(`selectedSources: ${JSON.stringify(selected.map((recall) => recall.source))}`);
  console.log(`selectedCategories: ${JSON.stringify(selected.map((recall) => recall.category || 'Uncategorized'))}`);
  console.log(`selectedImageStatus: ${JSON.stringify(selected.map((recall) => hasBalancedRecentImage(recall) ? 'real-image' : 'fallback'))}`);
  console.log(`warnings: ${JSON.stringify(warnings)}`);
  console.log(warnings.length ? 'WARN homepage recent audit completed' : 'PASS homepage recent audit completed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
