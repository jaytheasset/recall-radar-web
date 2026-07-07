// @ts-nocheck
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, RecallSource } from '../src/data/recall-types.ts';
import type { RecallClassificationV2 } from '../src/data/recall-taxonomy-v2.ts';
import {
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_DOMAIN_VALUES
} from '../src/data/recall-taxonomy-v2.ts';
import { estimateTokensFromText, readProcessedRecalls } from './build-recall-classifier-input.ts';
import { buildSourceSpecificClassifierInput, type SourceSpecificClassifierInput } from './build-source-specific-classifier-input.ts';
import { loadLocalEnv, getLocalEnvValue } from './load-local-env.ts';
import { buildRecallClassifierPromptFromInput, RECALL_CLASSIFIER_PROMPT_VERSION } from './llm-recall-classifier-prompt.ts';
import {
  getProviderSettingsFromEnv,
  type RecallClassifierProviderName,
  type RecallClassifierProviderSettings
} from './llm-recall-classifier-provider.ts';
import { repairClassifierEvidenceFields } from './repair-classifier-output.ts';
import { parseStrictClassifierJson } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processEnv = (process as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const outputDir =
  processEnv.SOURCE_SPECIFIC_FULL_CLASSIFIER_OUTPUT_DIR ||
  'outputs/llm-classifier/full-source-specific-preview';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const resultsPath = resolve(absoluteOutputDir, 'full-source-specific-classifier-results.json');

type ClassificationPreviewResult = {
  recordId: string;
  source: RecallSource;
  title: string;
  sourceUrl: string;
  recallDate: string;
  provider: RecallClassifierProviderName;
  model: string;
  success: boolean;
  failed: boolean;
  errors: string[];
  evidenceFieldRepairs: Array<{ from: string; to: string }>;
  enumRepairs: Array<{ field: string; from: string; to: string }>;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCharacters: number;
  classification?: RecallClassificationV2;
  rawTextForReview?: string;
  qualityFlags: string[];
};

type ClassificationPreviewPayload = {
  generatedAt: string;
  provider: RecallClassifierProviderName;
  model: string;
  promptVersion: typeof RECALL_CLASSIFIER_PROMPT_VERSION;
  inputMode: 'source-specific';
  totalRecords: number;
  selectedRecords: number;
  completedRecords: number;
  success: number;
  failed: number;
  needsReview: number;
  lowConfidence: number;
  unknownProductFamily: number;
  unknownProductType: number;
  unknownHazardType: number;
  sourceCounts: Record<string, number>;
  sourceSuccess: Record<string, number>;
  sourceFailures: Record<string, number>;
  sourceNeedsReview: Record<string, number>;
  qualityFlagCounts: Record<string, number>;
  familyDistribution: Record<string, number>;
  hazardDistribution: Record<string, number>;
  costEstimate: {
    totalInputTokens: number;
    totalOutputTokens: number;
    inputUsdPer1M: number | null;
    outputUsdPer1M: number | null;
    estimatedCostUsd: number | null;
  };
  results: ClassificationPreviewResult[];
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(getLocalEnvValue(name), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, raw));
}

function envFlag(name: string, fallback = false): boolean {
  const raw = getLocalEnvValue(name).toLowerCase();
  if (!raw) {
    return fallback;
  }
  return ['1', 'true', 'yes'].includes(raw);
}

function envList(name: string): string[] {
  return getLocalEnvValue(name)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function allowedOrAlias(value: unknown, allowed: readonly string[], aliases: Record<string, string>): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (allowed.includes(value)) {
    return value;
  }

  const key = normalize(value);
  return aliases[key] ?? aliases[key.replace(/\s+/g, '-')];
}

function repairClassificationEnums(rawText: string): { rawText: string; repairs: Array<{ field: string; from: string; to: string }> } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { rawText, repairs: [] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { rawText, repairs: [] };
  }

  const output = parsed as Record<string, unknown>;
  const repairs: Array<{ field: string; from: string; to: string }> = [];
  const aliases = {
    productFamily: {
      'children': 'baby-kids',
      'childrens-products': 'baby-kids',
      'kids': 'baby-kids',
      'consumer-product': 'other',
      'consumer-products': 'other',
      'general-consumer-product': 'other',
      'pool-water-sports': 'sports-outdoor',
      'lighters': 'other',
      'lighter': 'other',
      'electrical-appliances': 'electronics-batteries',
      'electronics': 'electronics-batteries',
      'vehicles': 'vehicles-mobility',
      'food': 'food-grocery',
      'household': 'furniture-household'
    },
    productType: {
      'children-clothing': 'child-clothing',
      'childrens-clothing': 'child-clothing',
      'children-s-clothing': 'child-clothing',
      'children-sleepwear': 'child-clothing',
      'child-sleepwear': 'child-clothing',
      'sleepwear': 'child-clothing',
      'pajamas': 'child-clothing',
      'pyjamas': 'child-clothing',
      'pajama-pants': 'child-clothing',
      'children-s-hat': 'child-clothing',
      'childrens-hat': 'child-clothing',
      'hat': 'clothing-accessory-other',
      'clothing-accessory': 'clothing-accessory-other',
      'fancy-dress-costume': 'clothing',
      'costume': 'clothing',
      'clogs': 'footwear',
      'shoe': 'footwear',
      'shoes': 'footwear',
      'smoke-alarm': 'electronics-other',
      'smoke-detector': 'electronics-other',
      'carbon-monoxide-alarm': 'electronics-other',
      'carbon-monoxide-detector': 'electronics-other',
      'night-light': 'lighting',
      'lamp': 'lighting',
      'mobile-phone': 'electronics-other',
      'cell-phone': 'electronics-other',
      'cellphone': 'electronics-other',
      'feature-phone': 'electronics-other',
      'phone': 'electronics-other',
      'headset': 'electronics-other',
      'headsets': 'electronics-other',
      'hearing-defender': 'electronics-other',
      'hearing-defenders': 'electronics-other',
      'hearing-protection': 'electronics-other',
      'waxing-kit': 'personal-care-product',
      'waxing-kits': 'personal-care-product',
      'wax-warmer': 'personal-care-product',
      'washing-machine': 'laundry-appliance',
      'washer': 'laundry-appliance',
      'spa-drain-cover': 'pool-water-sports',
      'spa-drain-covers': 'pool-water-sports',
      'drain-cover': 'pool-water-sports',
      'drain-covers': 'pool-water-sports',
      'storage-holder': 'electronic-accessory',
      'usb-power-supply': 'electronic-accessory',
      'novelty-lighter': 'other',
      'lighter': 'other',
      'diving-regulator': 'pool-water-sports',
      'scuba-regulator': 'pool-water-sports',
      'regulator-second-stage': 'pool-water-sports',
      'diving-equipment': 'pool-water-sports',
      'scuba-equipment': 'pool-water-sports',
      'vacuum-cleaner': 'home-appliance-other',
      'vacuum': 'home-appliance-other',
      'off-road-motorcycle': 'atv-off-road',
      'off-road-motorcycles': 'atv-off-road',
      'off-road-vehicle': 'atv-off-road',
      'off-road-vehicles': 'atv-off-road',
      'motorcycle': 'vehicles-other',
      'motorcycles': 'vehicles-other',
      'electric-appliance': 'appliance-electrical',
      'electrical-appliance': 'appliance-electrical',
      'electrical-appliances': 'appliance-electrical',
      'food-product': 'food-other',
      'food-products': 'food-other',
      'seafood': 'meat-seafood',
      'medical-device': 'medical-device-consumer',
      'tools-equipment-other': 'tools-other',
      'food-grocery': 'unknown',
      'baby-kids': 'unknown',
      'electronics-batteries': 'unknown',
      'home-appliances': 'unknown',
      'furniture-household': 'unknown',
      'vehicles-mobility': 'unknown',
      'sports-outdoor': 'unknown',
      'clothing-accessories': 'unknown',
      'tools-equipment': 'unknown',
      'health-personal-care': 'unknown',
      'chemicals-cleaning': 'unknown',
      'pet-products': 'unknown',
      'industrial-workplace': 'unknown'
    },
    hazardType: {
      'overheating': 'battery-overheat',
      'battery-overheating': 'battery-overheat',
      'ingestion': 'choking',
      'magnet-ingestion': 'choking',
      'button-battery-ingestion': 'choking',
      'button-battery-overheat': 'choking',
      'internal-burn': 'burn',
      'internal-burns': 'burn',
      'internal-injury': 'injury',
      'electric-shock-risk': 'electric-shock',
      'chemical': 'contamination-chemical',
      'pathogen': 'contamination-pathogen',
      'tip-over': 'entrapment',
      'tipover': 'entrapment'
    },
    recallDomain: {
      'consumer': 'consumer-product',
      'consumer-products': 'consumer-product',
      'medical': 'medical-health',
      'health': 'medical-health',
      'vehicles': 'vehicle',
      'industrial': 'workplace-industrial'
    }
  } as const;

  for (const [field, allowed, fieldAliases] of [
    ['productFamily', PRODUCT_FAMILY_VALUES, aliases.productFamily],
    ['productType', PRODUCT_TYPE_VALUES, aliases.productType],
    ['hazardType', HAZARD_TYPE_VALUES, aliases.hazardType],
    ['recallDomain', RECALL_DOMAIN_VALUES, aliases.recallDomain]
  ] as const) {
    const current = output[field];
    const repaired = allowedOrAlias(current, allowed, fieldAliases);
    if (typeof current === 'string' && repaired && repaired !== current) {
      output[field] = repaired;
      repairs.push({ field, from: current, to: repaired });
    }
  }

  return {
    rawText: JSON.stringify(output),
    repairs
  };
}

async function callProviderWithPrompt(prompt: string, settings: RecallClassifierProviderSettings): Promise<string> {
  if (!settings.liveAvailable) {
    throw new Error(settings.missingReason ?? `${settings.provider} provider is not available.`);
  }
  if (settings.provider === 'mock') {
    throw new Error('Full source-specific preview requires a live provider. Set RECALL_CLASSIFIER_PROVIDER=gemini.');
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
    return rawText;
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
  return rawText;
}

async function callWithRetry(prompt: string, settings: RecallClassifierProviderSettings): Promise<string> {
  const attempts = envInt('SOURCE_SPECIFIC_FULL_CLASSIFIER_RETRIES', 5, 1, 8);
  let lastError = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callProviderWithPrompt(prompt, settings);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) {
        await sleep(750 * attempt * attempt);
      }
    }
  }

  throw new Error(lastError || 'Classifier request failed.');
}

function textForQuality(record: NormalizedRecall, input: SourceSpecificClassifierInput): string {
  return normalize([
    record.source,
    record.title,
    record.category,
    record.hazard,
    record.reason,
    record.description,
    input.sourceCategory,
    input.productDescription,
    input.hazardText,
    input.riskText,
    input.reasonText,
    input.problemText,
    input.defectText,
    input.actionText,
    input.remedyText,
    ...input.productNames,
    ...input.brandNames,
    ...input.identifiers
  ].filter(Boolean).join(' '));
}

function qualityFlags(record: NormalizedRecall, input: SourceSpecificClassifierInput, classification?: RecallClassificationV2, errors: string[] = []): string[] {
  const flags: string[] = [];
  const text = textForQuality(record, input);

  if (errors.length) {
    flags.push('classifier-output-error');
  }
  if (!classification) {
    return flags;
  }
  if (classification.needsReview) {
    flags.push('needs-review');
  }
  if (classification.confidence < 0.55) {
    flags.push('low-confidence');
  }
  if (classification.productFamily === 'unknown') {
    flags.push('unknown-product-family');
  }
  if (classification.productType === 'unknown') {
    flags.push('unknown-product-type');
  }
  if (classification.hazardType === 'unknown') {
    flags.push('unknown-hazard-type');
  }

  const foodSources = ['FDA', 'UK_FSA', 'HK_CFS', 'FSANZ_FOOD_RECALLS'];
  if (foodSources.includes(record.source) && classification.productFamily !== 'food-grocery') {
    flags.push('food-source-non-food-family');
  }
  if (foodSources.includes(record.source) && classification.recallDomain !== 'food') {
    flags.push('food-source-non-food-domain');
  }
  if (/yamaha|umax|golf cart|golf car|utility vehicle/.test(text) && classification.productFamily !== 'vehicles-mobility') {
    flags.push('vehicle-evidence-non-vehicle-family');
  }
  if (/medical device|health product recall|diagnostic|assay|hospital|syringe|catheter|implant|resuscitation/.test(text) && classification.recallDomain !== 'medical-health') {
    flags.push('medical-evidence-non-medical-domain');
  }
  if (/toy|child|children|infant|baby|stroller|pram|crib|nursery/.test(text) && classification.productFamily === 'food-grocery' && !foodSources.includes(record.source)) {
    flags.push('baby-kids-evidence-food-family');
  }

  return [...new Set(flags)];
}

async function classifyRecord(record: NormalizedRecall, settings: RecallClassifierProviderSettings): Promise<ClassificationPreviewResult> {
  const input = buildSourceSpecificClassifierInput(record);
  const prompt = buildRecallClassifierPromptFromInput(input, settings.model, 'Source-specific recall input');
  const estimatedInputTokens = estimateTokensFromText(prompt);
  const inputCharacters = prompt.length;

  try {
    const rawText = await callWithRetry(prompt, settings);
    const estimatedOutputTokens = estimateTokensFromText(rawText);
    const repairedEvidence = repairClassifierEvidenceFields(rawText);
    const repairedEnums = repairClassificationEnums(repairedEvidence.rawText);
    const validation = parseStrictClassifierJson(repairedEnums.rawText);
    const flags = qualityFlags(record, input, validation.classification, validation.errors);

    return {
      recordId: record.id,
      source: record.source,
      title: record.title,
      sourceUrl: record.sourceUrl,
      recallDate: record.recallDate,
      provider: settings.provider,
      model: settings.model,
      success: validation.ok,
      failed: !validation.ok,
      errors: validation.errors,
      evidenceFieldRepairs: repairedEvidence.repairs,
      enumRepairs: repairedEnums.repairs,
      estimatedInputTokens,
      estimatedOutputTokens,
      inputCharacters,
      classification: validation.classification,
      rawTextForReview: validation.ok ? undefined : rawText.slice(0, 2000),
      qualityFlags: flags
    };
  } catch (error) {
    const errors = [error instanceof Error ? error.message : String(error)];
    return {
      recordId: record.id,
      source: record.source,
      title: record.title,
      sourceUrl: record.sourceUrl,
      recallDate: record.recallDate,
      provider: settings.provider,
      model: settings.model,
      success: false,
      failed: true,
      errors,
      evidenceFieldRepairs: [],
      enumRepairs: [],
      estimatedInputTokens,
      estimatedOutputTokens: 0,
      inputCharacters,
      qualityFlags: qualityFlags(record, input, undefined, errors)
    };
  }
}

function increment(counts: Record<string, number>, key: string | undefined): void {
  const safeKey = key || 'unknown';
  counts[safeKey] = (counts[safeKey] ?? 0) + 1;
}

function costEstimate(results: ClassificationPreviewResult[], settings: RecallClassifierProviderSettings): ClassificationPreviewPayload['costEstimate'] {
  const totalInputTokens = results.reduce((total, result) => total + result.estimatedInputTokens, 0);
  const totalOutputTokens = results.reduce((total, result) => total + result.estimatedOutputTokens, 0);
  const estimatedCostUsd =
    typeof settings.inputUsdPer1M === 'number' && typeof settings.outputUsdPer1M === 'number'
      ? Number((((totalInputTokens / 1_000_000) * settings.inputUsdPer1M) + ((totalOutputTokens / 1_000_000) * settings.outputUsdPer1M)).toFixed(6))
      : null;

  return {
    totalInputTokens,
    totalOutputTokens,
    inputUsdPer1M: settings.inputUsdPer1M ?? null,
    outputUsdPer1M: settings.outputUsdPer1M ?? null,
    estimatedCostUsd
  };
}

function sourceCounts(records: NormalizedRecall[]): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    increment(counts, record.source);
    return counts;
  }, {});
}

function selectRecords(records: NormalizedRecall[]): NormalizedRecall[] {
  const sourceFilter = new Set(envList('SOURCE_SPECIFIC_FULL_CLASSIFIER_SOURCES'));
  const filtered = sourceFilter.size
    ? records.filter((record) => sourceFilter.has(record.source))
    : records;
  const perSourceLimit = envInt('SOURCE_SPECIFIC_FULL_CLASSIFIER_LIMIT_PER_SOURCE', 0, 0, records.length);

  if (perSourceLimit > 0) {
    const sourceOrder = sourceFilter.size ? [...sourceFilter] : [...new Set(filtered.map((record) => record.source))];
    return sourceOrder.flatMap((source) => filtered.filter((record) => record.source === source).slice(0, perSourceLimit));
  }

  const limit = envInt('SOURCE_SPECIFIC_FULL_CLASSIFIER_LIMIT', filtered.length, 1, filtered.length);
  return filtered.slice(0, limit);
}

function buildPayload(records: NormalizedRecall[], selectedRecords: number, results: ClassificationPreviewResult[], settings: RecallClassifierProviderSettings): ClassificationPreviewPayload {
  const sourceSuccess: Record<string, number> = {};
  const sourceFailures: Record<string, number> = {};
  const sourceNeedsReview: Record<string, number> = {};
  const qualityFlagCounts: Record<string, number> = {};
  const familyDistribution: Record<string, number> = {};
  const hazardDistribution: Record<string, number> = {};

  for (const result of results) {
    if (result.success) {
      increment(sourceSuccess, result.source);
    }
    if (result.failed) {
      increment(sourceFailures, result.source);
    }
    if (result.classification?.needsReview) {
      increment(sourceNeedsReview, result.source);
    }
    increment(familyDistribution, result.classification?.productFamily);
    increment(hazardDistribution, result.classification?.hazardType);
    for (const flag of result.qualityFlags) {
      increment(qualityFlagCounts, flag);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    provider: settings.provider,
    model: settings.model,
    promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION,
    inputMode: 'source-specific',
    totalRecords: records.length,
    selectedRecords,
    completedRecords: results.length,
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => result.failed).length,
    needsReview: results.filter((result) => result.classification?.needsReview).length,
    lowConfidence: results.filter((result) => (result.classification?.confidence ?? 1) < 0.55).length,
    unknownProductFamily: results.filter((result) => result.classification?.productFamily === 'unknown').length,
    unknownProductType: results.filter((result) => result.classification?.productType === 'unknown').length,
    unknownHazardType: results.filter((result) => result.classification?.hazardType === 'unknown').length,
    sourceCounts: sourceCounts(records),
    sourceSuccess,
    sourceFailures,
    sourceNeedsReview,
    qualityFlagCounts,
    familyDistribution,
    hazardDistribution,
    costEstimate: costEstimate(results, settings),
    results
  };
}

function markdownReport(payload: ClassificationPreviewPayload): string {
  const reviewCandidates = payload.results
    .filter((result) => result.failed || result.qualityFlags.length > 0)
    .slice(0, 80)
    .map((result) => `- ${result.source} ${result.recordId}: ${result.classification?.productFamily ?? 'failed'} / ${result.classification?.productType ?? 'failed'} / ${result.classification?.hazardType ?? 'failed'} (${result.qualityFlags.join(', ') || 'no flags'})`);

  return [
    '# Full Source-Specific Taxonomy V2 Classification Preview',
    '',
    `Generated: ${payload.generatedAt}`,
    `Provider: ${payload.provider}`,
    `Model: ${payload.model}`,
    `Prompt version: ${payload.promptVersion}`,
    `Completed records: ${payload.completedRecords} / ${payload.selectedRecords}`,
    `Success: ${payload.success}`,
    `Failed: ${payload.failed}`,
    `Needs review: ${payload.needsReview}`,
    `Low confidence: ${payload.lowConfidence}`,
    '',
    'This is an ignored local preview only. It does not write Taxonomy V2 values to canonical data, a database, or runtime UI.',
    '',
    '## Source Counts',
    '',
    '```json',
    JSON.stringify(payload.sourceCounts, null, 2),
    '```',
    '',
    '## Quality Flag Counts',
    '',
    '```json',
    JSON.stringify(payload.qualityFlagCounts, null, 2),
    '```',
    '',
    '## Family Distribution',
    '',
    '```json',
    JSON.stringify(payload.familyDistribution, null, 2),
    '```',
    '',
    '## Hazard Distribution',
    '',
    '```json',
    JSON.stringify(payload.hazardDistribution, null, 2),
    '```',
    '',
    '## Review Candidates',
    '',
    reviewCandidates.length ? reviewCandidates.join('\n') : '- None',
    '',
    '## Cost Estimate',
    '',
    '```json',
    JSON.stringify(payload.costEstimate, null, 2),
    '```'
  ].join('\n');
}

async function writeOutputs(payload: ClassificationPreviewPayload): Promise<void> {
  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(resultsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'full-source-specific-classifier-summary.json'), `${JSON.stringify({
    ...payload,
    results: undefined
  }, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'full-source-specific-classifier-quality-report.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'full-source-specific-classifier-review-candidates.json'), `${JSON.stringify(payload.results.filter((result) => result.failed || result.qualityFlags.length > 0), null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'full-source-specific-classifier-failures.json'), `${JSON.stringify(payload.results.filter((result) => result.failed), null, 2)}\n`, 'utf8');
}

async function loadExistingResults(): Promise<ClassificationPreviewResult[]> {
  if (!existsSync(resultsPath) || !envFlag('SOURCE_SPECIFIC_FULL_CLASSIFIER_RESUME', true)) {
    return [];
  }

  const existing = JSON.parse(await readFile(resultsPath, 'utf8')) as Partial<ClassificationPreviewPayload>;
  const results = Array.isArray(existing.results) ? existing.results : [];
  if (envFlag('SOURCE_SPECIFIC_FULL_CLASSIFIER_RETRY_FAILED', false)) {
    return results.filter((result) => result.success);
  }
  return results;
}

async function run(): Promise<void> {
  await loadLocalEnv();
  const settings = getProviderSettingsFromEnv();
  const records = await readProcessedRecalls();
  const concurrency = envInt('SOURCE_SPECIFIC_FULL_CLASSIFIER_CONCURRENCY', 3, 1, 8);
  const writeEvery = envInt('SOURCE_SPECIFIC_FULL_CLASSIFIER_WRITE_EVERY', 25, 1, 100);
  const selected = selectRecords(records);
  const selectedIds = new Set(selected.map((record) => record.id));
  const existingResults = (await loadExistingResults()).filter((result) => selectedIds.has(result.recordId));
  const completedIds = new Set(existingResults.map((result) => result.recordId));
  const results: ClassificationPreviewResult[] = [...existingResults];
  const pending = selected.filter((record) => !completedIds.has(record.id));

  if (settings.provider === 'mock') {
    throw new Error('Set RECALL_CLASSIFIER_PROVIDER=gemini for full source-specific preview.');
  }

  let index = 0;
  let completedSinceWrite = 0;
  let writeQueue = Promise.resolve();

  async function scheduleWrite(): Promise<void> {
    const payload = buildPayload(records, selected.length, results, settings);
    writeQueue = writeQueue.then(() => writeOutputs(payload));
    await writeQueue;
  }

  async function worker(): Promise<void> {
    while (index < pending.length) {
      const record = pending[index];
      index += 1;

      const result = await classifyRecord(record, settings);
      results.push(result);
      completedSinceWrite += 1;

      const completed = results.length;
      if (completed % 25 === 0 || result.failed) {
        console.log(JSON.stringify({
          completed,
          selected: selected.length,
          source: result.source,
          recordId: result.recordId,
          success: result.success,
          flags: result.qualityFlags
        }));
      }

      if (completedSinceWrite >= writeEvery || result.failed) {
        completedSinceWrite = 0;
        await scheduleWrite();
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, () => worker()));
  await scheduleWrite();

  const payload = buildPayload(records, selected.length, results, settings);
  console.log(JSON.stringify({
    provider: payload.provider,
    model: payload.model,
    inputMode: payload.inputMode,
    totalRecords: payload.totalRecords,
    selectedRecords: payload.selectedRecords,
    completedRecords: payload.completedRecords,
    success: payload.success,
    failed: payload.failed,
    needsReview: payload.needsReview,
    lowConfidence: payload.lowConfidence,
    unknownProductFamily: payload.unknownProductFamily,
    unknownProductType: payload.unknownProductType,
    unknownHazardType: payload.unknownHazardType,
    qualityFlagCounts: payload.qualityFlagCounts,
    costEstimate: payload.costEstimate,
    outputDir
  }, null, 2));

  if (payload.failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
