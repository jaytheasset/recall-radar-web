import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES, HAZARD_TYPE_VALUES, PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES, RECALL_AUDIENCE_VALUES, RECALL_DOMAIN_VALUES, RECALL_TAXONOMY_VERSION,
  type RecallClassificationV2
} from '../src/data/recall-taxonomy-v2.ts';
import { buildSourceSpecificClassifierInput } from './build-source-specific-classifier-input.ts';
import { buildRecallClassifierPromptFromInput, RECALL_CLASSIFIER_PROMPT_VERSION } from './llm-recall-classifier-prompt.ts';
import { cacheRecallImages } from './cache-recall-images.ts';
import { readLocalJson, readLocalRecallInputs, refreshLocalRecallInputs, writeLocalJson, type RecallRefreshResult } from './refresh-local-recall-inputs.ts';
import { validateClassificationOutput } from './validate-recall-classification-output.ts';

type ClassificationRow = {
  recordId: string;
  source: NormalizedRecall['source'];
  title: string;
  recallDate: string;
  sourceUrl: string;
  success: boolean;
  failed: boolean;
  qualityFlags?: string[];
  classification: RecallClassificationV2;
};

type Checkpoint = { inputHash: string; row: ClassificationRow };
type WorkItem = { record: NormalizedRecall; input: ReturnType<typeof buildSourceSpecificClassifierInput>; inputHash: string };
type EnrichedRecall = { recall: NormalizedRecall; result: ClassificationRow };

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = join(root, 'outputs', 'llm-classifier', 'local');
const model = process.env.RECALL_CODEX_MODEL || 'gpt-6-luna';
const batchSize = 24;
const { values: options } = parseArgs({ options: {
  refresh: { type: 'boolean' },
  backfill: { type: 'boolean' },
  source: { type: 'string' },
  plan: { type: 'boolean' },
  jobs: { type: 'string', default: '1' },
  limit: { type: 'string', default: '120' }
} });
const limit = Number(options.limit);
const jobs = Number(options.jobs);
const classificationSchema = {
  productFamily: { enum: PRODUCT_FAMILY_VALUES },
  productType: { enum: PRODUCT_TYPE_VALUES },
  hazardType: { enum: HAZARD_TYPE_VALUES },
  hazardTags: { type: 'array', items: { type: 'string' } },
  recallDomain: { enum: RECALL_DOMAIN_VALUES },
  audience: { type: 'array', items: { enum: RECALL_AUDIENCE_VALUES } },
  confidence: { type: 'number' },
  needsReview: { type: 'boolean' },
  reason: { type: 'string' },
  evidenceFields: { type: 'array', items: { enum: CLASSIFICATION_EVIDENCE_FIELD_VALUES } }
};
const responseSchema = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: { results: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['recordId', 'classification'],
    properties: {
      recordId: { type: 'string' },
      classification: { type: 'object', additionalProperties: false, required: Object.keys(classificationSchema), properties: classificationSchema }
    }
  } } }
};

function codexExecutable(): string {
  if (process.env.RECALL_CODEX_BIN) return process.env.RECALL_CODEX_BIN;
  if (process.platform !== 'win32') return 'codex';
  const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
  const target = architecture === 'arm64' ? 'aarch64' : 'x86_64';
  const install = join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@openai', 'codex');
  const executable = join(install, 'node_modules', '@openai', `codex-win32-${architecture}`, 'vendor', `${target}-pc-windows-msvc`, 'bin', 'codex.exe');
  return existsSync(executable) ? executable : 'codex.exe';
}

function runCodex(prompt: string, schemaPath: string): Promise<string> {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.OPENAI_BASE_URL;
  return new Promise((resolve, reject) => {
    const child = spawn(codexExecutable(), [
      '-a', 'never', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
      '--sandbox', 'read-only', '--color', 'never', '--json', '-m', model,
      '--disable', 'shell_tool', '--disable', 'hooks', '-c', 'web_search="disabled"',
      '-c', 'model_reasoning_effort="low"', '--output-schema', schemaPath, '-'
    ], { cwd: outputDir, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 150_000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (text: string) => { stdout += text; });
    child.stderr.setEncoding('utf8').on('data', (text: string) => { stderr = (stderr + text).slice(-1_000); });
    child.stdin.on('error', () => undefined);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      try {
        const events = stdout.trim().split(/\r?\n/).filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
        if (code !== 0) {
          const message = events.findLast((event) => event.type === 'error')?.message ?? stderr.trim();
          throw new Error(message || `Codex exited with ${signal ?? code}`);
        }
        const lastMessage = events.findLast((event) => event.type === 'item.completed' && event.item?.type === 'agent_message');
        if (!lastMessage?.item.text) throw new Error('Codex returned no structured answer.');
        resolve(lastMessage.item.text);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(prompt, 'utf8');
  });
}

function createWorkItem(record: NormalizedRecall): WorkItem {
  const input = buildSourceSpecificClassifierInput(record);
  return { record, input, inputHash: createHash('sha256').update(JSON.stringify(input)).digest('hex') };
}

function countBySource(rows: Array<{ source: string }>): Record<string, number> {
  return Object.fromEntries(Object.entries(Object.groupBy(rows, (row) => row.source)).map(([source, records]) => [source, records?.length ?? 0]));
}

async function classifyBatch(batch: WorkItem[], schemaPath: string): Promise<Checkpoint[]> {
  const prompt = buildRecallClassifierPromptFromInput(batch.map(({ input }) => input), model, 'Recall records', true);
  const result = JSON.parse(await runCodex(prompt, schemaPath)) as { results: Array<{ recordId: string; classification: unknown }> };
  const byId = new Map(result.results.map((item) => [item.recordId, item.classification]));
  if (result.results.length !== batch.length || byId.size !== batch.length || batch.some(({ record }) => !byId.has(record.id))) {
    if (batch.length === 1) {
      console.error(`Codex returned an incorrect recall ID for ${batch[0].record.id}.`);
      return [];
    }
    const midpoint = Math.floor(batch.length / 2);
    return [...await classifyBatch(batch.slice(0, midpoint), schemaPath), ...await classifyBatch(batch.slice(midpoint), schemaPath)];
  }
  const validated: Checkpoint[] = [];
  for (const { record, inputHash } of batch) {
    const value = byId.get(record.id);
    const validation = validateClassificationOutput(value && typeof value === 'object' && !Array.isArray(value) ? {
      ...value, taxonomyVersion: RECALL_TAXONOMY_VERSION, method: 'llm', model, promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION
    } : value);
    const classification = validation.classification;
    if (!validation.ok || !classification || classification.method !== 'llm' || classification.model !== model ||
        classification.promptVersion !== RECALL_CLASSIFIER_PROMPT_VERSION || !classification.evidenceFields?.length) {
      console.error(`Unvalidated classification for ${record.id}: ${validation.errors.join(', ') || 'missing evidence or model metadata'}`);
      continue;
    }
    const qualityFlags = [
      ...(classification.needsReview ? ['needs-review'] : []),
      ...(classification.confidence < 0.75 ? ['low-confidence'] : []),
      ...(classification.productFamily === 'unknown' ? ['unknown-product-family'] : []),
      ...(classification.productType === 'unknown' ? ['unknown-product-type'] : []),
      ...(classification.hazardType === 'unknown' ? ['unknown-hazard-type'] : []),
      ...(classification.recallDomain === 'unknown' ? ['unknown-recall-domain'] : [])
    ];
    if (qualityFlags.length) classification.needsReview = true;
    validated.push({ inputHash, row: {
      recordId: record.id, source: record.source, title: record.title, recallDate: record.recallDate,
      sourceUrl: record.sourceUrl, success: true, failed: false, qualityFlags, classification
    } });
  }
  return validated;
}

async function loadQueue(baseline: NormalizedRecall[], checkpoints: Checkpoint[], baselineRows: ClassificationRow[]) {
  const items = new Map(baseline.map((record) => [record.id, createWorkItem(record)]));
  const completed = new Map<string, Checkpoint>();
  for (const row of baselineRows) {
    const item = items.get(row.recordId);
    if (item && row.source === item.record.source && row.success && !row.failed && validateClassificationOutput(row.classification).ok) {
      completed.set(row.recordId, { inputHash: item.inputHash, row });
    }
  }
  for (const checkpoint of checkpoints) completed.set(checkpoint.row.recordId, checkpoint);
  for (const record of await readLocalRecallInputs(outputDir)) items.set(record.id, createWorkItem(record));
  const pending = [...items.values()].filter(({ record, inputHash }) => completed.get(record.id)?.inputHash !== inputHash);
  pending.sort((a, b) => Number(completed.has(a.record.id)) - Number(completed.has(b.record.id)) ||
    b.record.recallDate.localeCompare(a.record.recallDate) || a.record.id.localeCompare(b.record.id));
  return { items, completed, pending };
}

async function run(): Promise<void> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5_000) throw new Error('Limit must be between 1 and 5000.');
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 6) throw new Error('Jobs must be between 1 and 6.');
  if (options.source && !options.refresh) throw new Error('--source requires --refresh.');
  if (options.backfill && !options.refresh) throw new Error('--backfill requires --refresh.');
  if (options.plan && options.refresh) throw new Error('--plan reads the existing queue.');
  const dataDir = join(root, 'data', 'processed');
  const [baseline, baselineClassifications] = await Promise.all([
    readLocalJson<ProcessedRecallFile>(join(dataDir, 'recalls.json')),
    readLocalJson<{ records: ClassificationRow[] }>(join(dataDir, 'recall-classifications-v2.json'))
  ]);
  if (!baseline?.records.length || !baselineClassifications) throw new Error('Project baseline is missing.');
  const checkpointPath = join(outputDir, 'checkpoints.json');
  if (options.plan) {
    const queue = await loadQueue(baseline.records, (await readLocalJson<Checkpoint[]>(checkpointPath)) ?? [], baselineClassifications.records);
    console.log(JSON.stringify({ candidates: queue.items.size, pending: queue.pending.length, pendingBySource: countBySource(queue.pending.map(({ record }) => record)) }));
    return;
  }

  await mkdir(outputDir, { recursive: true });
  const lockPath = join(outputDir, 'worker.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const owner = Number(await readFile(lockPath, 'utf8').catch(() => ''));
    if (!owner) throw new Error('Recall worker lock is being created.');
    try { process.kill(owner, 0); } catch (probeError) {
      if ((probeError as NodeJS.ErrnoException).code === 'ESRCH') {
        await rm(lockPath, { force: true });
        lock = await open(lockPath, 'wx');
      } else { throw probeError; }
    }
    if (!lock) throw new Error(`Recall worker is already running (PID ${owner}).`);
  }
  try {
    await lock.writeFile(String(process.pid));
    const reportPath = join(outputDir, 'refresh-report.json');
    const previousRefresh = (await readLocalJson<Record<string, RecallRefreshResult>>(reportPath)) ?? {};
    const refresh = options.refresh ? await refreshLocalRecallInputs(root, outputDir, baseline.records, options.source, options.backfill) : {};
    const sourceReports = { ...previousRefresh, ...refresh };
    if (options.refresh) await writeLocalJson(reportPath, sourceReports);
    const stored = new Map(((await readLocalJson<Checkpoint[]>(checkpointPath)) ?? []).map((checkpoint) => [checkpoint.row.recordId, checkpoint]));
    const { items, completed, pending } = await loadQueue(baseline.records, [...stored.values()], baselineClassifications.records);
    if (options.refresh) {
      try {
        const recordsWithImages = [...baseline.records, ...Array.from(items.values(), ({ record }) => record)];
        const imageSummary = await cacheRecallImages(root, outputDir, recordsWithImages);
        console.log(JSON.stringify({ imageCache: imageSummary }));
      } catch (error) {
        console.error('Recall image conversion:', error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
    console.log(JSON.stringify({ candidates: items.size, pending: pending.length, pendingBySource: countBySource(pending.map(({ record }) => record)), model }));
    const schemaPath = join(outputDir, 'codex-response-schema.json');
    await writeLocalJson(schemaPath, responseSchema);
    let newClassifications = 0;
    let errorMessage: string | undefined;
    const batches: WorkItem[][] = [];
    for (let offset = 0; offset < Math.min(limit, pending.length); offset += batchSize) {
      batches.push(pending.slice(offset, Math.min(offset + batchSize, limit)));
    }
    let attempted = 0;
    let nextBatch = 0;
    let save = Promise.resolve();
    const processBatches = async () => {
      while (!errorMessage && nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        try {
          const accepted = await classifyBatch(batch, schemaPath);
          for (const checkpoint of accepted) {
            stored.set(checkpoint.row.recordId, checkpoint);
            completed.set(checkpoint.row.recordId, checkpoint);
            newClassifications++;
          }
          attempted += batch.length;
          save = save.then(() => writeLocalJson(checkpointPath, [...stored.values()]));
          await save;
          console.log(JSON.stringify({ attempted, classified: newClassifications }));
        } catch (error) {
          errorMessage ??= error instanceof Error ? error.message : String(error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(jobs, batches.length) }, processBatches));
    const currentPath = join(outputDir, 'current.json');
    const baselineResults = new Map(baselineClassifications.records.map((row) => [row.recordId, row]));
    const prior = new Map(baseline.records.flatMap((recall) => {
      const result = baselineResults.get(recall.id);
      return result?.success && !result.failed ? [[recall.id, { recall, result }] as const] : [];
    }));
    for (const entry of (await readLocalJson<{ records: EnrichedRecall[] }>(currentPath))?.records ?? []) {
      prior.set(entry.recall.id, entry);
    }
    let remaining = 0;
    const current = [...items.values()].flatMap(({ record, inputHash }) => {
      const checkpoint = completed.get(record.id);
      if (checkpoint?.inputHash === inputHash) return [{ recall: record, result: checkpoint.row }];
      remaining++;
      const previous = prior.get(record.id);
      return previous ? [previous] : [];
    });
    const summary = { generatedAt: new Date().toISOString(), model, candidates: items.size,
      classified: current.length, newlyClassified: newClassifications, remaining,
      needsReview: current.filter(({ result }) => result.classification.needsReview || result.qualityFlags?.length).length,
      sourceWarnings: Object.keys(sourceReports).filter((source) => sourceReports[source].warning), error: errorMessage };
    await writeLocalJson(currentPath, { ...summary, records: current });
    console.log(JSON.stringify(summary));
    if (errorMessage) throw new Error(errorMessage);
    if (Object.values(refresh).some(({ warning }) => warning)) process.exitCode = 1;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
