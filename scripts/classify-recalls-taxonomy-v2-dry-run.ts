import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall } from '../src/data/recall-types.ts';
import type { RecallClassificationV2 } from '../src/data/recall-taxonomy-v2.ts';
import {
  buildRecallClassifierInput,
  estimateClassifierInput,
  estimateTokensFromText,
  readProcessedRecalls,
  type RecallClassifierInput
} from './build-recall-classifier-input.ts';
import { buildRecallClassifierPrompt, RECALL_CLASSIFIER_PROMPT_VERSION } from './llm-recall-classifier-prompt.ts';
import { loadLocalEnv } from './load-local-env.ts';
import {
  classifyWithProvider,
  getProviderSettingsFromEnv,
  type RecallClassifierProviderName,
  type RecallClassifierProviderSettings
} from './llm-recall-classifier-provider.ts';
import { selectRecallClassifierDryRunSample } from './select-recall-classifier-dry-run-sample.ts';
import { parseStrictClassifierJson } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

type LegacyComparison = {
  legacyCategory: string;
  productFamily: string;
  productType: string;
  hazardType: string;
  flags: string[];
};

type DryRunResult = {
  recordId: string;
  source: string;
  title: string;
  legacyCategory: string;
  input: RecallClassifierInput;
  provider: RecallClassifierProviderName;
  model: string;
  mocked: boolean;
  success: boolean;
  failed: boolean;
  errors: string[];
  rawText?: string;
  classification?: RecallClassificationV2;
  legacyComparison?: LegacyComparison;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

type CostProjection = {
  records: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number | null;
};

type DryRunPayload = {
  generatedAt: string;
  provider: RecallClassifierProviderName;
  model: string;
  promptVersion: typeof RECALL_CLASSIFIER_PROMPT_VERSION;
  outputSchema: string;
  sampleStrategy: string;
  sampleCount: number;
  forcedIds: string[];
  samplingNotes: string[];
  success: number;
  failed: number;
  needsReview: number;
  knownSuspiciousCase?: {
    recordId: string;
    title: string;
    legacyCategory: string;
    productFamily?: string;
    productType?: string;
    hazardType?: string;
    needsReview?: boolean;
    flags: string[];
  };
  costEstimate: {
    inputTokens: number;
    outputTokens: number;
    inputUsdPer1M: number | null;
    outputUsdPer1M: number | null;
    sampleCostUsd: number | null;
    projections: {
      current1201: CostProjection;
      tenK: CostProjection;
      hundredK: CostProjection;
    };
    pricingSource: string;
  };
  results: DryRunResult[];
};

function envFlag(name: string): boolean {
  const env = (process as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return ['1', 'true', 'yes'].includes((env[name] ?? '').toLowerCase());
}

function sourceCounts(records: NormalizedRecall[]): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildLegacyComparison(input: RecallClassifierInput, classification: RecallClassificationV2): LegacyComparison {
  const text = normalize([
    input.source,
    input.title,
    input.legacyCategory,
    input.hazard,
    input.description,
    ...input.productNames,
    ...input.brandNames
  ].join(' '));
  const flags: string[] = [];

  if (
    /yamaha|umax|golf cart|golf car|utility vehicle/.test(text) &&
    (classification.productFamily === 'food-grocery' || classification.productType === 'packaged-food')
  ) {
    flags.push('likely-llm-error: vehicle-like Yamaha/UMAX text was classified as food.');
  }

  if (
    /yamaha|umax|golf cart|golf car|utility vehicle/.test(text) &&
    classification.productFamily === 'vehicles-mobility' &&
    input.legacyCategory === 'food-allergy'
  ) {
    flags.push('likely-legacy-error: legacy category says food-allergy but taxonomy v2 points to vehicles-mobility.');
  }

  if (input.source === 'CPSC' && input.legacyCategory === 'food-allergy' && classification.recallDomain !== 'food') {
    flags.push('review: CPSC record carried legacy food-allergy category but taxonomy v2 is not food.');
  }

  if (
    /salmonella|listeria|e coli|undeclared|allergen|milk|egg|peanut|pistachio|foreign matter/.test(text) &&
    classification.productFamily !== 'food-grocery'
  ) {
    flags.push('review: food-hazard terms did not classify to food-grocery.');
  }

  if (classification.needsReview) {
    flags.push('review: classifier marked needsReview.');
  }

  return {
    legacyCategory: input.legacyCategory,
    productFamily: classification.productFamily,
    productType: classification.productType,
    hazardType: classification.hazardType,
    flags
  };
}

function projectedCost(records: number, averageInputTokens: number, averageOutputTokens: number, settings: RecallClassifierProviderSettings): CostProjection {
  const estimatedInputTokens = Math.round(records * averageInputTokens);
  const estimatedOutputTokens = Math.round(records * averageOutputTokens);
  const estimatedCostUsd =
    typeof settings.inputUsdPer1M === 'number' && typeof settings.outputUsdPer1M === 'number'
      ? Number((((estimatedInputTokens / 1_000_000) * settings.inputUsdPer1M) + ((estimatedOutputTokens / 1_000_000) * settings.outputUsdPer1M)).toFixed(6))
      : null;

  return {
    records,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd
  };
}

function buildCostEstimate(results: DryRunResult[], settings: RecallClassifierProviderSettings): DryRunPayload['costEstimate'] {
  const inputTokens = results.reduce((total, result) => total + result.estimatedInputTokens, 0);
  const outputTokens = results.reduce((total, result) => total + result.estimatedOutputTokens, 0);
  const sampleCostUsd =
    typeof settings.inputUsdPer1M === 'number' && typeof settings.outputUsdPer1M === 'number'
      ? Number((((inputTokens / 1_000_000) * settings.inputUsdPer1M) + ((outputTokens / 1_000_000) * settings.outputUsdPer1M)).toFixed(6))
      : null;
  const averageInputTokens = results.length ? inputTokens / results.length : 0;
  const averageOutputTokens = results.length ? outputTokens / results.length : 0;

  return {
    inputTokens,
    outputTokens,
    inputUsdPer1M: settings.inputUsdPer1M ?? null,
    outputUsdPer1M: settings.outputUsdPer1M ?? null,
    sampleCostUsd,
    projections: {
      current1201: projectedCost(1201, averageInputTokens, averageOutputTokens, settings),
      tenK: projectedCost(10_000, averageInputTokens, averageOutputTokens, settings),
      hundredK: projectedCost(100_000, averageInputTokens, averageOutputTokens, settings)
    },
    pricingSource:
      typeof settings.inputUsdPer1M === 'number' && typeof settings.outputUsdPer1M === 'number'
        ? 'RECALL_CLASSIFIER_INPUT_USD_PER_1M and RECALL_CLASSIFIER_OUTPUT_USD_PER_1M environment variables'
        : 'Token-only estimate; pricing environment variables not set'
  };
}

function knownSuspiciousResult(results: DryRunResult[]): DryRunPayload['knownSuspiciousCase'] {
  const result = results.find((item) => /yamaha|umax|bistro|golf cart|golf car|utility vehicle/i.test([item.title, item.legacyCategory, ...item.input.productNames].join(' ')));
  if (!result) {
    return undefined;
  }

  return {
    recordId: result.recordId,
    title: result.title,
    legacyCategory: result.legacyCategory,
    productFamily: result.classification?.productFamily,
    productType: result.classification?.productType,
    hazardType: result.classification?.hazardType,
    needsReview: result.classification?.needsReview,
    flags: result.legacyComparison?.flags ?? []
  };
}

function markdownReport(payload: DryRunPayload, sourceCountSummary: Record<string, number>): string {
  const topFlags = payload.results
    .flatMap((result) => result.legacyComparison?.flags ?? [])
    .reduce<Record<string, number>>((counts, flag) => {
      counts[flag] = (counts[flag] ?? 0) + 1;
      return counts;
    }, {});

  return [
    '# Recall Taxonomy V2 Classifier Dry Run',
    '',
    `Generated: ${payload.generatedAt}`,
    `Provider: ${payload.provider}`,
    `Model: ${payload.model}`,
    `Prompt version: ${payload.promptVersion}`,
    `Sample count: ${payload.sampleCount}`,
    `Success: ${payload.success}`,
    `Failed: ${payload.failed}`,
    `Needs review: ${payload.needsReview}`,
    '',
    '## Source Counts',
    '',
    '```json',
    JSON.stringify(sourceCountSummary, null, 2),
    '```',
    '',
    '## Known Suspicious Case',
    '',
    '```json',
    JSON.stringify(payload.knownSuspiciousCase ?? null, null, 2),
    '```',
    '',
    '## Cost Estimate',
    '',
    '```json',
    JSON.stringify(payload.costEstimate, null, 2),
    '```',
    '',
    '## Legacy Comparison Flags',
    '',
    '```json',
    JSON.stringify(topFlags, null, 2),
    '```'
  ].join('\n');
}

async function writeDryRunOutputs(payload: DryRunPayload, outputDir: string, sourceCountSummary: Record<string, number>): Promise<void> {
  const absoluteOutputDir = resolve(projectRoot, outputDir);
  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(resolve(absoluteOutputDir, 'dry-run-results.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'dry-run-cost-estimate.json'), `${JSON.stringify(payload.costEstimate, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(absoluteOutputDir, 'dry-run-mismatches.json'),
    `${JSON.stringify(payload.results.filter((result) => (result.legacyComparison?.flags.length ?? 0) > 0), null, 2)}\n`,
    'utf8'
  );
  await writeFile(resolve(absoluteOutputDir, 'dry-run-failures.json'), `${JSON.stringify(payload.results.filter((result) => result.failed), null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'dry-run-report.md'), `${markdownReport(payload, sourceCountSummary)}\n`, 'utf8');
}

async function runDryRun(): Promise<void> {
  await loadLocalEnv();
  const settings = getProviderSettingsFromEnv();
  const records = await readProcessedRecalls();
  const sourceCountSummary = sourceCounts(records);

  if (settings.provider !== 'mock' && !settings.liveAvailable) {
    console.log(JSON.stringify({
      skipped: true,
      provider: settings.provider,
      model: settings.model,
      reason: settings.missingReason
    }, null, 2));
    return;
  }

  const sample = selectRecallClassifierDryRunSample(records, settings.limit);
  const results: DryRunResult[] = [];

  for (const record of sample.records) {
    const input = buildRecallClassifierInput(record);
    const prompt = buildRecallClassifierPrompt(input, settings.model);
    const inputEstimate = estimateClassifierInput(input, prompt);

    try {
      const providerResult = await classifyWithProvider(input, settings);
      const validation = parseStrictClassifierJson(providerResult.rawText);
      const estimatedOutputTokens = estimateTokensFromText(providerResult.rawText);

      if (!validation.ok || !validation.classification) {
        results.push({
          recordId: record.id,
          source: record.source,
          title: record.title,
          legacyCategory: record.category,
          input,
          provider: providerResult.provider,
          model: providerResult.model,
          mocked: providerResult.mocked,
          success: false,
          failed: true,
          errors: validation.errors,
          rawText: providerResult.rawText,
          estimatedInputTokens: inputEstimate.estimatedInputTokens,
          estimatedOutputTokens
        });
        continue;
      }

      const legacyComparison = buildLegacyComparison(input, validation.classification);
      results.push({
        recordId: record.id,
        source: record.source,
        title: record.title,
        legacyCategory: record.category,
        input,
        provider: providerResult.provider,
        model: providerResult.model,
        mocked: providerResult.mocked,
        success: true,
        failed: false,
        errors: [],
        classification: validation.classification,
        legacyComparison,
        estimatedInputTokens: inputEstimate.estimatedInputTokens,
        estimatedOutputTokens
      });
    } catch (error) {
      results.push({
        recordId: record.id,
        source: record.source,
        title: record.title,
        legacyCategory: record.category,
        input,
        provider: settings.provider,
        model: settings.model,
        mocked: settings.provider === 'mock',
        success: false,
        failed: true,
        errors: [error instanceof Error ? error.message : String(error)],
        estimatedInputTokens: inputEstimate.estimatedInputTokens,
        estimatedOutputTokens: 0
      });
    }
  }

  const payload: DryRunPayload = {
    generatedAt: new Date().toISOString(),
    provider: settings.provider,
    model: settings.model,
    promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION,
    outputSchema: 'RecallClassificationV2 strict JSON',
    sampleStrategy: settings.sampleStrategy,
    sampleCount: results.length,
    forcedIds: sample.forcedIds,
    samplingNotes: sample.notes,
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => result.failed).length,
    needsReview: results.filter((result) => result.classification?.needsReview).length,
    knownSuspiciousCase: knownSuspiciousResult(results),
    costEstimate: buildCostEstimate(results, settings),
    results
  };

  if (!envFlag('RECALL_CLASSIFIER_NO_WRITE')) {
    await writeDryRunOutputs(payload, settings.outputDir, sourceCountSummary);
  }

  console.log(JSON.stringify({
    provider: payload.provider,
    model: payload.model,
    promptVersion: payload.promptVersion,
    sampleCount: payload.sampleCount,
    success: payload.success,
    failed: payload.failed,
    needsReview: payload.needsReview,
    knownSuspiciousCase: payload.knownSuspiciousCase,
    costEstimate: payload.costEstimate,
    outputDir: settings.outputDir,
    wroteOutputs: !envFlag('RECALL_CLASSIFIER_NO_WRITE')
  }, null, 2));

  if (payload.failed > 0) {
    process.exitCode = 1;
  }
}

runDryRun().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
