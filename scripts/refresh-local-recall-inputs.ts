import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { isAbsolute, join, relative } from 'node:path';
import type { NormalizedRecall, ProcessedRecallFile, RecallSource } from '../src/data/recall-types.ts';
import { normalizeEuSafetyGateRecords } from './normalize-eu-safety-gate.ts';

const sources: Array<{ source: RecallSource; script: string; file: string; limit?: number; maxPages?: number }> = [
  { source: 'CPSC', script: 'fetch-cpsc', file: 'cpsc-recalls' },
  { source: 'FDA', script: 'fetch-fda-food', file: 'fda-recalls', limit: 100, maxPages: 15 },
  { source: 'FR_RAPPELCONSO', script: 'fetch-rappelconso', file: 'rappelconso-recalls', limit: 100, maxPages: 30 },
  { source: 'CA_RECALLS', script: 'fetch-canada-recalls', file: 'canada-recalls', limit: 100, maxPages: 15 },
  { source: 'EU_SAFETY_GATE', script: 'fetch-eu-safety-gate', file: 'eu-safety-gate-recalls', limit: 100, maxPages: 15 },
  { source: 'UK_FSA', script: 'fetch-uk-fsa-alerts', file: 'uk-fsa-alerts', limit: 100 },
  { source: 'AU_PRODUCT_SAFETY', script: 'fetch-australia-product-safety', file: 'australia-product-safety-recalls', limit: 100 },
  { source: 'NZ_PRODUCT_SAFETY', script: 'fetch-new-zealand-product-safety', file: 'new-zealand-product-safety-recalls', limit: 100 },
  { source: 'HK_CFS', script: 'fetch-hong-kong-cfs-food-alerts', file: 'hong-kong-cfs-food-alerts', limit: 100 },
  { source: 'FSANZ_FOOD_RECALLS', script: 'fetch-fsanz-food-recalls', file: 'fsanz-food-recalls', limit: 60 }
];

export async function readLocalJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writeLocalJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function runFetcher(workspace: string, script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join('scripts', `${script}.ts`), ...args], {
      cwd: workspace,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
      timeout: 180_000
    });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (text: string) => { stderr = (stderr + text).slice(-1_200); });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Fetcher exited with ${signal ?? code}`));
    });
  });
}

export type RecallRefreshResult = {
  checkedAt: string;
  earliest: string | null;
  latest: string | null;
  found: number;
  added: number;
  coverageStart?: string;
  warning?: string;
};

function noticeDate(record: NormalizedRecall): string {
  if (record.source === 'FDA') {
    const date = (record.raw as { report_date?: unknown } | undefined)?.report_date;
    if (typeof date === 'string' && /^\d{8}$/.test(date)) return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`;
  }
  return record.recallDate;
}

function preserveSafetyGateMeasureOrder(record: NormalizedRecall, previous: NormalizedRecall): NormalizedRecall {
  type RawAlert = { measureTaken?: { measures?: Array<{ id?: number | string }> } };
  const raw = record.raw as RawAlert | undefined;
  const measures = raw?.measureTaken?.measures;
  const previousMeasures = (previous.raw as RawAlert | undefined)?.measureTaken?.measures;
  if (!Array.isArray(measures) || measures.length < 2 || !Array.isArray(previousMeasures)) return record;
  const order = new Map(previousMeasures.flatMap((measure, index) => measure?.id === undefined ? [] : [[measure.id, index] as const]));
  const rank = (measure: { id?: number | string }) => measure?.id === undefined ? Infinity : order.get(measure.id) ?? Infinity;
  const ordered = measures.slice().sort((left, right) => rank(left) - rank(right));
  if (ordered.every((measure, index) => measure === measures[index])) return record;
  return normalizeEuSafetyGateRecords([{ ...raw, measureTaken: { ...raw?.measureTaken, measures: ordered } }])[0] ?? record;
}

export async function refreshLocalRecallInputs(
  root: string,
  outputDir: string,
  baseline: NormalizedRecall[],
  only?: string,
  backfill = false
): Promise<Record<string, RecallRefreshResult>> {
  const selected = sources.filter(({ source }) => !only || source === only);
  if (!selected.length) throw new Error(`Unknown recall source: ${only}`);
  const outcomes: Record<string, RecallRefreshResult> = {};
  const pastOutcome = await readLocalJson<Record<string, RecallRefreshResult>>(join(outputDir, 'refresh-report.json'));
  const outputRoot = await realpath(outputDir);

  // Each existing fetcher writes its regular data files in a disposable workspace.
  // Their latest-only snapshots cannot remove any previously collected recall.
  for (const { source, script, file, limit, maxPages = 1 } of selected) {
    const inputPath = join(outputDir, `${source}.json`);
    const previous = (await readLocalJson<NormalizedRecall[]>(inputPath)) ?? [];
    const existing = baseline.filter((record) => record.source === source);
    const known = new Map([...existing, ...previous].map((record) => [record.id, record]));
    const oldReport = pastOutcome?.[source];
    const datedRecords = backfill || !oldReport || oldReport.warning ? existing : [...known.values()];
    const priorGap = backfill ? undefined : oldReport?.coverageStart;
    const cutoff = priorGap ?? datedRecords.map(noticeDate).filter(Boolean).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
    const start = new Date(`${cutoff}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 14);
    const startDate = start.toISOString().slice(0, 10);
    const checkedAt = new Date().toISOString();
    const workspace = await mkdtemp(join(outputDir, 'fetch-'));
    const relativeWorkspace = relative(outputRoot, await realpath(workspace));
    if (!/^fetch-[a-z0-9]+$/i.test(relativeWorkspace) || isAbsolute(relativeWorkspace)) throw new Error('Unexpected fetch workspace path.');
    const next = new Map(previous.map((record) => [record.id, record]));
    const fetched = new Set<string>();
    let earliest: string | null = null;
    let latest: string | null = null;
    let warning: string | undefined;

    try {
      await Promise.all([
        cp(join(root, 'scripts'), join(workspace, 'scripts'), { recursive: true }),
        cp(join(root, 'src', 'lib', 'slug.ts'), join(workspace, 'src', 'lib', 'slug.ts')),
        writeFile(join(workspace, 'package.json'), '{"type":"module"}\n'),
        mkdir(join(workspace, 'data', 'processed'), { recursive: true })
      ]);
      for (let page = 0; page < maxPages; page++) {
        const args = limit ? [`--limit=${limit}`, `--offset=${page * limit}`] : [`--start=${startDate}`];
        if (source === 'CA_RECALLS' && page > 0) args.push('--skip-detail-images');
        await runFetcher(workspace, script, args);
        const snapshot = await readLocalJson<ProcessedRecallFile>(join(workspace, 'data', 'processed', `${file}.json`));
        const records = snapshot?.records ?? [];
        if (!records.length || records.some((record) => record.source !== source || !record.id || !record.recallDate)) {
          throw new Error('Fetcher returned no usable source records.');
        }
        const dates = records.map(noticeDate).sort();
        if (!earliest || dates[0] < earliest) earliest = dates[0];
        if (!latest || dates[dates.length - 1] > latest) latest = dates[dates.length - 1];
        for (const record of records) {
          if (fetched.has(record.id)) continue;
          fetched.add(record.id);
          const prior = known.get(record.id);
          if (source === 'CA_RECALLS' && page > 0 && prior && noticeDate(prior) >= noticeDate(record)) continue;
          if (noticeDate(record) >= startDate || prior) {
            const normalized = source === 'EU_SAFETY_GATE' && prior ? preserveSafetyGateMeasureOrder(record, prior) : record;
            next.set(record.id, normalized);
          }
        }
        await writeLocalJson(inputPath, [...next.values()]);
        if (!limit || earliest <= cutoff) break;
        if (page === maxPages - 1) warning = `Collection reached ${earliest}; notices between ${cutoff} and this date may be missing.`;
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
    outcomes[source] = {
      checkedAt, earliest, latest, found: fetched.size,
      added: [...next.keys()].filter((id) => !known.has(id)).length,
      ...(warning ? { warning, coverageStart: cutoff } : {})
    };
    console.log(JSON.stringify({ source, ...outcomes[source] }));
  }
  return outcomes;
}

export async function readLocalRecallInputs(outputDir: string): Promise<NormalizedRecall[]> {
  const snapshots = await Promise.all(sources.map(({ source }) => readLocalJson<NormalizedRecall[]>(join(outputDir, `${source}.json`))));
  return snapshots.flatMap((snapshot) => snapshot ?? []);
}
