import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
export const cpscProcessedPath = resolve(projectRoot, 'data/processed/cpsc-recalls.json');
export const fdaProcessedPath = resolve(projectRoot, 'data/processed/fda-recalls.json');

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
    FDA: records.filter((record) => record.source === 'FDA').length
  };
}

export async function mergeProcessedRecalls(): Promise<MergeResult> {
  const [canonicalFile, cpscFile, fdaFile] = await Promise.all([
    readProcessedFile(canonicalProcessedPath),
    readProcessedFile(cpscProcessedPath),
    readProcessedFile(fdaProcessedPath)
  ]);
  const cpscRecords = sourceRecords(cpscFile, 'CPSC').length
    ? sourceRecords(cpscFile, 'CPSC')
    : sourceRecords(canonicalFile, 'CPSC');
  const fdaRecords = sourceRecords(fdaFile, 'FDA');
  const records = mergeRecords([...cpscRecords, ...fdaRecords]);

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
