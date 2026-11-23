import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
export const cpscProcessedPath = resolve(projectRoot, 'data/processed/cpsc-recalls.json');
export const fdaProcessedPath = resolve(projectRoot, 'data/processed/fda-recalls.json');
export const rappelConsoProcessedPath = resolve(projectRoot, 'data/processed/rappelconso-recalls.json');
export const canadaProcessedPath = resolve(projectRoot, 'data/processed/canada-recalls.json');
export const euSafetyGateProcessedPath = resolve(projectRoot, 'data/processed/eu-safety-gate-recalls.json');
export const ukFsaProcessedPath = resolve(projectRoot, 'data/processed/uk-fsa-alerts.json');
export const australiaProductSafetyProcessedPath = resolve(
  projectRoot,
  'data/processed/australia-product-safety-recalls.json'
);
export const newZealandProductSafetyProcessedPath = resolve(
  projectRoot,
  'data/processed/new-zealand-product-safety-recalls.json'
);
export const hongKongCfsProcessedPath = resolve(projectRoot, 'data/processed/hong-kong-cfs-food-alerts.json');
export const fsanzFoodRecallsProcessedPath = resolve(projectRoot, 'data/processed/fsanz-food-recalls.json');

type MergeResult = ProcessedRecallFile & {
  countsBySource: Record<RecallSource, number>;
};

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  try {
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function readProcessedFile(path: string): Promise<ProcessedRecallFile | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as ProcessedRecallFile;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function sourceRecords(file: ProcessedRecallFile | null, source: RecallSource): NormalizedRecall[] {
  if (!file || !Array.isArray(file.records)) {
    return [];
  }

  return file.records.filter((record) => record.source === source);
}

function compareRecallDateDescending(a: NormalizedRecall, b: NormalizedRecall): number {
  const dateDifference = b.recallDate.localeCompare(a.recallDate);
  return dateDifference === 0 ? a.id.localeCompare(b.id) : dateDifference;
}

function mergeRecords(records: NormalizedRecall[]): NormalizedRecall[] {
  const merged = new Map<string, NormalizedRecall>();

  for (const record of records) {
    if (!record.id) {
      continue;
    }

    merged.set(record.id, record);
  }

  return [...merged.values()].sort(compareRecallDateDescending);
}

function countBySource(records: NormalizedRecall[]): Record<RecallSource, number> {
  return {
    CPSC: records.filter((record) => record.source === 'CPSC').length,
    FDA: records.filter((record) => record.source === 'FDA').length,
    FR_RAPPELCONSO: records.filter((record) => record.source === 'FR_RAPPELCONSO').length,
    CA_RECALLS: records.filter((record) => record.source === 'CA_RECALLS').length,
    EU_SAFETY_GATE: records.filter((record) => record.source === 'EU_SAFETY_GATE').length,
    UK_FSA: records.filter((record) => record.source === 'UK_FSA').length,
    AU_PRODUCT_SAFETY: records.filter((record) => record.source === 'AU_PRODUCT_SAFETY').length,
    NZ_PRODUCT_SAFETY: records.filter((record) => record.source === 'NZ_PRODUCT_SAFETY').length,
    HK_CFS: records.filter((record) => record.source === 'HK_CFS').length,
    FSANZ_FOOD_RECALLS: records.filter((record) => record.source === 'FSANZ_FOOD_RECALLS').length
  };
}

export async function mergeProcessedRecalls(): Promise<MergeResult> {
  const [
    canonicalFile,
    cpscFile,
    fdaFile,
    rappelConsoFile,
    canadaFile,
    euSafetyGateFile,
    ukFsaFile,
    australiaProductSafetyFile,
    newZealandProductSafetyFile,
    hongKongCfsFile,
    fsanzFoodRecallsFile
  ] = await Promise.all([
    readProcessedFile(canonicalProcessedPath),
    readProcessedFile(cpscProcessedPath),
    readProcessedFile(fdaProcessedPath),
    readProcessedFile(rappelConsoProcessedPath),
    readProcessedFile(canadaProcessedPath),
    readProcessedFile(euSafetyGateProcessedPath),
    readProcessedFile(ukFsaProcessedPath),
    readProcessedFile(australiaProductSafetyProcessedPath),
    readProcessedFile(newZealandProductSafetyProcessedPath),
    readProcessedFile(hongKongCfsProcessedPath),
    readProcessedFile(fsanzFoodRecallsProcessedPath)
  ]);
  const previous = canonicalFile?.records ?? [];
  const archive = previous.some((record) => record.siteSlug);
  const previousById = new Map(previous.map((record) => [record.id, record]));
  const sources: Array<[ProcessedRecallFile | null, RecallSource]> = [
    [cpscFile, 'CPSC'], [fdaFile, 'FDA'], [rappelConsoFile, 'FR_RAPPELCONSO'], [canadaFile, 'CA_RECALLS'],
    [euSafetyGateFile, 'EU_SAFETY_GATE'], [ukFsaFile, 'UK_FSA'], [australiaProductSafetyFile, 'AU_PRODUCT_SAFETY'],
    [newZealandProductSafetyFile, 'NZ_PRODUCT_SAFETY'], [hongKongCfsFile, 'HK_CFS'], [fsanzFoodRecallsFile, 'FSANZ_FOOD_RECALLS']
  ];
  const updates = sources.flatMap(([file, source]) => {
    if (archive && (!file || file.generatedAt <= (canonicalFile?.generatedAt ?? ''))) return [];
    const incoming = sourceRecords(file, source);
    if (!archive && source === 'CPSC' && !incoming.length) return sourceRecords(canonicalFile, source);
    return incoming.map((record) => {
      const prior = previousById.get(record.id);
      return archive && prior?.siteSlug
        ? { ...record, siteSlug: prior.siteSlug, previousSiteSlugs: prior.previousSiteSlugs }
        : record;
    });
  });
  if (canonicalFile && archive && !updates.length) {
    return { ...canonicalFile, countsBySource: countBySource(previous) };
  }
  const records = mergeRecords(archive ? [...previous, ...updates] : updates);

  if (records.length === 0) {
    throw new Error('Recall merge produced zero records; canonical processed data was not overwritten.');
  }

  const output: MergeResult = {
    generatedAt: new Date().toISOString(),
    source: 'MULTI',
    count: records.length,
    countsBySource: countBySource(records),
    records
  };

  await writeJsonAtomic(canonicalProcessedPath, output);
  return output;
}

async function runMerge(): Promise<void> {
  const output = await mergeProcessedRecalls();
  console.log(
    JSON.stringify(
      {
        processedPath: canonicalProcessedPath,
        mergedRecordsSaved: output.count,
        countsBySource: output.countsBySource
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  runMerge().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
