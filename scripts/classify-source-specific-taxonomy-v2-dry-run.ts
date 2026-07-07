// @ts-nocheck
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecallClassificationV2 } from '../src/data/recall-taxonomy-v2.ts';
import {
  estimateTokensFromText,
  type RecallClassifierInput
} from './build-recall-classifier-input.ts';
import {
  getLocalEnvValue,
  loadLocalEnv
} from './load-local-env.ts';
import {
  buildRecallClassifierPrompt,
  buildRecallClassifierPromptFromInput,
  RECALL_CLASSIFIER_PROMPT_VERSION
} from './llm-recall-classifier-prompt.ts';
import {
  getProviderSettingsFromEnv,
  type RecallClassifierProviderName,
  type RecallClassifierProviderSettings
} from './llm-recall-classifier-provider.ts';
import { repairClassifierEvidenceFields } from './repair-classifier-output.ts';
import { parseStrictClassifierJson } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = 'outputs/llm-classifier/source-specific-dry-run';
const absoluteOutputDir = resolve(projectRoot, outputDir);

const sourcePreviewConfigs = [
  {
    source: 'CPSC',
    previewJson: 'outputs/llm-classifier/input-preview/cpsc/cpsc-input-preview.json',
    preferredTerms: ['umax', 'bistro', 'golf cart', 'golf car', 'utility vehicle']
  },
  {
    source: 'FDA',
    previewJson: 'outputs/llm-classifier/input-preview/fda-food/fda-food-input-preview.json'
  },
  {
    source: 'FR_RAPPELCONSO',
    previewJson: 'outputs/llm-classifier/input-preview/rappelconso/rappelconso-input-preview.json'
  },
  {
    source: 'CA_RECALLS',
    previewJson: 'outputs/llm-classifier/input-preview/canada/canada-input-preview.json'
  },
  {
    source: 'EU_SAFETY_GATE',
    previewJson: 'outputs/llm-classifier/input-preview/eu-safety-gate/eu-safety-gate-input-preview.json'
  },
  {
    source: 'UK_FSA',
    previewJson: 'outputs/llm-classifier/input-preview/uk-fsa/uk-fsa-input-preview.json'
  },
  {
    source: 'AU_PRODUCT_SAFETY',
    previewJson: 'outputs/llm-classifier/input-preview/australia-product-safety/australia-product-safety-input-preview.json'
  },
  {
    source: 'NZ_PRODUCT_SAFETY',
    previewJson: 'outputs/llm-classifier/input-preview/new-zealand/new-zealand-input-preview.json'
  },
  {
    source: 'HK_CFS',
    previewJson: 'outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-input-preview.json'
  },
  {
    source: 'FSANZ_FOOD_RECALLS',
    previewJson: 'outputs/llm-classifier/input-preview/fsanz/fsanz-input-preview.json'
  }
] as const;

type PreviewRecord = {
  id: string;
  title: string;
  legacyCategory: string;
  genericInput: RecallClassifierInput;
  proposedInput: Record<string, unknown>;
  sampleReasons?: string[];
};

type ProviderRunResult = {
  success: boolean;
  failed: boolean;
  errors: string[];
  evidenceFieldRepairs: Array<{ from: string; to: string }>;
  rawText?: string;
  classification?: RecallClassificationV2;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

type SourceSpecificComparison = {
  recordId: string;
  source: string;
  title: string;
  legacyCategory: string;
  sampleReasons: string[];
  provider: RecallClassifierProviderName;
  model: string;
  generic: ProviderRunResult;
  sourceSpecific: ProviderRunResult;
  comparison: {
    sameProductFamily: boolean | null;
    sameProductType: boolean | null;
    sameHazardType: boolean | null;
    sameRecallDomain: boolean | null;
    sameNeedsReview: boolean | null;
    confidenceDelta: number | null;
    sourceSpecificInputTokenDelta: number;
  };
};

type DryRunPayload = {
  generatedAt: string;
  provider: RecallClassifierProviderName;
  model: string;
  promptVersion: typeof RECALL_CLASSIFIER_PROMPT_VERSION;
  sampleCount: number;
  sources: string[];
  success: {
    generic: number;
    sourceSpecific: number;
  };
  failed: {
    generic: number;
    sourceSpecific: number;
  };
  changedClassifications: number;
  lowerNeedsReviewWithSourceSpecific: number;
  costEstimate: {
    totalInputTokens: number;
    totalOutputTokens: number;
    inputUsdPer1M: number | null;
    outputUsdPer1M: number | null;
    sampleCostUsd: number | null;
  };
  results: SourceSpecificComparison[];
};

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes'].includes(getLocalEnvValue(name).toLowerCase());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function pathFor(relativePath: string): string {
  return resolve(projectRoot, relativePath);
}

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(pathFor(relativePath), 'utf8'));
}

function selectRecord(records: PreviewRecord[], preferredTerms: readonly string[] = []): PreviewRecord {
  if (!records.length) {
    throw new Error('Preview has no records.');
  }

  const preferred = records.find((record) => {
    const text = normalize([
      record.id,
      record.title,
      record.legacyCategory,
      JSON.stringify(record.genericInput),
      JSON.stringify(record.proposedInput)
    ].join(' '));
    return preferredTerms.some((term) => text.includes(normalize(term)));
  });

  return preferred ?? records[0];
}

async function loadSample(): Promise<PreviewRecord[]> {
  const selected: PreviewRecord[] = [];

  for (const config of sourcePreviewConfigs) {
    if (!existsSync(pathFor(config.previewJson))) {
      throw new Error(`${config.previewJson} is missing. Run npm run preview:all-classifier-inputs first.`);
    }

    const payload = await readJson(config.previewJson) as {
      source?: string;
      records?: PreviewRecord[];
    };
    if (payload.source !== config.source) {
      throw new Error(`${config.previewJson} source mismatch: expected ${config.source}, found ${payload.source}.`);
    }

    selected.push(selectRecord(payload.records ?? [], config.preferredTerms ?? []));
  }

  return selected;
}

async function callProviderWithPrompt(prompt: string, settings: RecallClassifierProviderSettings): Promise<{ rawText: string; provider: RecallClassifierProviderName; model: string }> {
  if (!settings.liveAvailable) {
    throw new Error(settings.missingReason ?? `${settings.provider} provider is not available.`);
  }

  if (settings.provider === 'mock') {
    throw new Error('Source-specific dry run requires a live provider. Set RECALL_CLASSIFIER_PROVIDER=gemini.');
  }

  if (settings.provider === 'gemini') {
    const key = getLocalEnvValue('GEMINI_API_KEY');
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini classifier request failed with HTTP ${response.status}.`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
    if (!rawText) {
      throw new Error('Gemini classifier returned no text.');
    }
    return { rawText, provider: 'gemini', model: settings.model };
  }

  const key = getLocalEnvValue('OPENAI_API_KEY');
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: settings.model,
      input: prompt,
      temperature: 0,
      max_output_tokens: 900
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI classifier request failed with HTTP ${response.status}.`);
  }

  const data = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const rawText =
    data.output_text?.trim() ||
    data.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? '').join('').trim() ||
    '';
  if (!rawText) {
    throw new Error('OpenAI classifier returned no text.');
  }
  return { rawText, provider: 'openai', model: settings.model };
}

function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /HTTP (429|500|502|503|504)|timeout|temporarily|rate/i.test(message);
}

async function callProviderWithRetry(prompt: string, settings: RecallClassifierProviderSettings): Promise<{ rawText: string; provider: RecallClassifierProviderName; model: string }> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await callProviderWithPrompt(prompt, settings);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryableProviderError(error)) {
        throw error;
      }
      await sleep(750 * attempt * attempt);
    }
  }

  throw lastError;
}

async function classifyPrompt(prompt: string, settings: RecallClassifierProviderSettings): Promise<ProviderRunResult> {
  const estimatedInputTokens = estimateTokensFromText(prompt);
  try {
    const providerResult = await callProviderWithRetry(prompt, settings);
    const estimatedOutputTokens = estimateTokensFromText(providerResult.rawText);
    const repaired = repairClassifierEvidenceFields(providerResult.rawText);
    const validation = parseStrictClassifierJson(repaired.rawText);

    return {
      success: validation.ok,
      failed: !validation.ok,
      errors: validation.errors,
      evidenceFieldRepairs: repaired.repairs,
      rawText: providerResult.rawText,
      classification: validation.classification,
      estimatedInputTokens,
      estimatedOutputTokens
    };
  } catch (error) {
    return {
      success: false,
      failed: true,
      errors: [error instanceof Error ? error.message : String(error)],
      evidenceFieldRepairs: [],
      estimatedInputTokens,
      estimatedOutputTokens: 0
    };
  }
}

function confidenceDelta(generic?: RecallClassificationV2, sourceSpecific?: RecallClassificationV2): number | null {
  if (!generic || !sourceSpecific) {
    return null;
  }
  return Number((sourceSpecific.confidence - generic.confidence).toFixed(3));
}

function compare(generic: ProviderRunResult, sourceSpecific: ProviderRunResult): SourceSpecificComparison['comparison'] {
  const left = generic.classification;
  const right = sourceSpecific.classification;
  return {
    sameProductFamily: left && right ? left.productFamily === right.productFamily : null,
    sameProductType: left && right ? left.productType === right.productType : null,
    sameHazardType: left && right ? left.hazardType === right.hazardType : null,
    sameRecallDomain: left && right ? left.recallDomain === right.recallDomain : null,
    sameNeedsReview: left && right ? left.needsReview === right.needsReview : null,
    confidenceDelta: confidenceDelta(left, right),
    sourceSpecificInputTokenDelta: sourceSpecific.estimatedInputTokens - generic.estimatedInputTokens
  };
}

function changed(result: SourceSpecificComparison): boolean {
  return result.comparison.sameProductFamily === false ||
    result.comparison.sameProductType === false ||
    result.comparison.sameHazardType === false ||
    result.comparison.sameRecallDomain === false;
}

function costEstimate(results: SourceSpecificComparison[], settings: RecallClassifierProviderSettings): DryRunPayload['costEstimate'] {
  const totalInputTokens = results.reduce((total, result) => total + result.generic.estimatedInputTokens + result.sourceSpecific.estimatedInputTokens, 0);
  const totalOutputTokens = results.reduce((total, result) => total + result.generic.estimatedOutputTokens + result.sourceSpecific.estimatedOutputTokens, 0);
  const sampleCostUsd =
    typeof settings.inputUsdPer1M === 'number' && typeof settings.outputUsdPer1M === 'number'
      ? Number((((totalInputTokens / 1_000_000) * settings.inputUsdPer1M) + ((totalOutputTokens / 1_000_000) * settings.outputUsdPer1M)).toFixed(6))
      : null;

  return {
    totalInputTokens,
    totalOutputTokens,
    inputUsdPer1M: settings.inputUsdPer1M ?? null,
    outputUsdPer1M: settings.outputUsdPer1M ?? null,
    sampleCostUsd
  };
}

function markdownReport(payload: DryRunPayload): string {
  const repairRows = payload.results
    .filter((result) => result.sourceSpecific.evidenceFieldRepairs.length > 0)
    .map((result) => `- ${result.source} ${result.recordId}: ${result.sourceSpecific.evidenceFieldRepairs.map((repair) => `${repair.from} -> ${repair.to}`).join(', ')}`);
  const rows = payload.results.map((result) => [
    `| ${result.source} | ${result.recordId} | ${result.generic.classification?.productFamily ?? 'failed'} / ${result.generic.classification?.hazardType ?? 'failed'} | ${result.sourceSpecific.classification?.productFamily ?? 'failed'} / ${result.sourceSpecific.classification?.hazardType ?? 'failed'} | ${changed(result) ? 'changed' : 'same'} | ${result.comparison.confidenceDelta ?? 'n/a'} |`
  ].join('\n'));

  return [
    '# Source-Specific Classifier Dry Run',
    '',
    `Generated: ${payload.generatedAt}`,
    `Provider: ${payload.provider}`,
    `Model: ${payload.model}`,
    `Prompt version: ${payload.promptVersion}`,
    `Sample count: ${payload.sampleCount}`,
    `Generic successes: ${payload.success.generic}`,
    `Source-specific successes: ${payload.success.sourceSpecific}`,
    `Changed classifications: ${payload.changedClassifications}`,
    `Lower needsReview with source-specific: ${payload.lowerNeedsReviewWithSourceSpecific}`,
    '',
    'This dry run compares the existing generic classifier input with the source-specific proposed input preview for the same records. It writes ignored local output only and does not modify canonical data.',
    '',
    '## Result Matrix',
    '',
    '| Source | Record | Generic family/hazard | Source-specific family/hazard | Change | Confidence delta |',
    '| --- | --- | --- | --- | --- | ---: |',
    ...rows,
    '',
    '## Evidence Field Alias Repairs',
    '',
    repairRows.length ? repairRows.join('\n') : '- None',
    '',
    '## Cost Estimate',
    '',
    '```json',
    JSON.stringify(payload.costEstimate, null, 2),
    '```'
  ].join('\n');
}

async function writeOutputs(payload: DryRunPayload): Promise<void> {
  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(resolve(absoluteOutputDir, 'source-specific-dry-run-results.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'source-specific-dry-run-report.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'source-specific-dry-run-changes.json'), `${JSON.stringify(payload.results.filter(changed), null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'source-specific-dry-run-failures.json'), `${JSON.stringify(payload.results.filter((result) => result.generic.failed || result.sourceSpecific.failed), null, 2)}\n`, 'utf8');
}

async function run(): Promise<void> {
  await loadLocalEnv();
  const settings = getProviderSettingsFromEnv();
  const sample = await loadSample();
  const results: SourceSpecificComparison[] = [];

  if (settings.provider === 'mock') {
    throw new Error('Set RECALL_CLASSIFIER_PROVIDER=gemini for source-specific dry run.');
  }

  for (const record of sample) {
    const genericPrompt = buildRecallClassifierPrompt(record.genericInput, settings.model);
    const sourceSpecificPrompt = buildRecallClassifierPromptFromInput(
      record.proposedInput,
      settings.model,
      'Source-specific recall input'
    );
    const generic = await classifyPrompt(genericPrompt, settings);
    const sourceSpecific = await classifyPrompt(sourceSpecificPrompt, settings);

    results.push({
      recordId: record.id,
      source: record.genericInput.source,
      title: record.title,
      legacyCategory: record.legacyCategory,
      sampleReasons: record.sampleReasons ?? [],
      provider: settings.provider,
      model: settings.model,
      generic,
      sourceSpecific,
      comparison: compare(generic, sourceSpecific)
    });
  }

  const payload: DryRunPayload = {
    generatedAt: new Date().toISOString(),
    provider: settings.provider,
    model: settings.model,
    promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION,
    sampleCount: results.length,
    sources: results.map((result) => result.source),
    success: {
      generic: results.filter((result) => result.generic.success).length,
      sourceSpecific: results.filter((result) => result.sourceSpecific.success).length
    },
    failed: {
      generic: results.filter((result) => result.generic.failed).length,
      sourceSpecific: results.filter((result) => result.sourceSpecific.failed).length
    },
    changedClassifications: results.filter(changed).length,
    lowerNeedsReviewWithSourceSpecific: results.filter((result) => result.generic.classification?.needsReview && result.sourceSpecific.classification?.needsReview === false).length,
    costEstimate: costEstimate(results, settings),
    results
  };

  if (!envFlag('RECALL_CLASSIFIER_NO_WRITE')) {
    await writeOutputs(payload);
  }

  console.log(JSON.stringify({
    provider: payload.provider,
    model: payload.model,
    promptVersion: payload.promptVersion,
    sampleCount: payload.sampleCount,
    sources: payload.sources,
    success: payload.success,
    failed: payload.failed,
    changedClassifications: payload.changedClassifications,
    lowerNeedsReviewWithSourceSpecific: payload.lowerNeedsReviewWithSourceSpecific,
    costEstimate: payload.costEstimate,
    outputDir,
    wroteOutputs: !envFlag('RECALL_CLASSIFIER_NO_WRITE')
  }, null, 2));

  if (payload.failed.generic > 0 || payload.failed.sourceSpecific > 0) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
