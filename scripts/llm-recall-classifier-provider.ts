import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECALL_TAXONOMY_VERSION,
  type RecallClassificationV2
} from '../src/data/recall-taxonomy-v2.ts';
import type { RecallClassifierInput } from './build-recall-classifier-input.ts';
import { getLocalEnvValue } from './load-local-env.ts';
import { buildRecallClassifierPrompt, RECALL_CLASSIFIER_PROMPT_VERSION } from './llm-recall-classifier-prompt.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export type RecallClassifierProviderName = 'mock' | 'gemini' | 'openai';

export type RecallClassifierProviderSettings = {
  provider: RecallClassifierProviderName;
  model: string;
  limit: number;
  sampleStrategy: string;
  outputDir: string;
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  liveAvailable: boolean;
  missingReason?: string;
};

export type ProviderClassificationResult = {
  provider: RecallClassifierProviderName;
  model: string;
  rawText: string;
  mocked: boolean;
};

type FixtureRecord = {
  id: string;
  expectedClassification: RecallClassificationV2;
};

function envNumber(name: string): number | undefined {
  const raw = getLocalEnvValue(name);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function providerFromEnv(value: string | undefined): RecallClassifierProviderName {
  return value === 'gemini' || value === 'openai' || value === 'mock' ? value : 'mock';
}

export function getProviderSettingsFromEnv(): RecallClassifierProviderSettings {
  const provider = providerFromEnv(getLocalEnvValue('RECALL_CLASSIFIER_PROVIDER'));
  const defaultModel =
    provider === 'gemini' ? 'gemini-2.5-flash-lite' : provider === 'openai' ? 'gpt-4.1-mini' : 'mock-deterministic-v1';
  const model = getLocalEnvValue('RECALL_CLASSIFIER_MODEL').trim() || defaultModel;
  const limit = Math.max(1, Math.min(500, Number(getLocalEnvValue('RECALL_CLASSIFIER_LIMIT') || 100) || 100));
  const outputDir = getLocalEnvValue('RECALL_CLASSIFIER_OUTPUT_DIR').trim() || 'outputs/llm-classifier';

  if (provider === 'gemini' && !getLocalEnvValue('GEMINI_API_KEY')) {
    return {
      provider,
      model,
      limit,
      sampleStrategy: getLocalEnvValue('RECALL_CLASSIFIER_SAMPLE_STRATEGY') || 'balanced',
      outputDir,
      inputUsdPer1M: envNumber('RECALL_CLASSIFIER_INPUT_USD_PER_1M'),
      outputUsdPer1M: envNumber('RECALL_CLASSIFIER_OUTPUT_USD_PER_1M'),
      liveAvailable: false,
      missingReason: 'GEMINI_API_KEY is not set.'
    };
  }

  if (provider === 'openai' && !getLocalEnvValue('OPENAI_API_KEY')) {
    return {
      provider,
      model,
      limit,
      sampleStrategy: getLocalEnvValue('RECALL_CLASSIFIER_SAMPLE_STRATEGY') || 'balanced',
      outputDir,
      inputUsdPer1M: envNumber('RECALL_CLASSIFIER_INPUT_USD_PER_1M'),
      outputUsdPer1M: envNumber('RECALL_CLASSIFIER_OUTPUT_USD_PER_1M'),
      liveAvailable: false,
      missingReason: 'OPENAI_API_KEY is not set.'
    };
  }

  return {
    provider,
    model,
    limit,
    sampleStrategy: getLocalEnvValue('RECALL_CLASSIFIER_SAMPLE_STRATEGY') || 'balanced',
    outputDir,
    inputUsdPer1M: envNumber('RECALL_CLASSIFIER_INPUT_USD_PER_1M'),
    outputUsdPer1M: envNumber('RECALL_CLASSIFIER_OUTPUT_USD_PER_1M'),
    liveAvailable: true
  };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function evidence(...fields: RecallClassificationV2['evidenceFields']): RecallClassificationV2['evidenceFields'] {
  return [...new Set(fields)];
}

function classification(
  _input: RecallClassifierInput,
  partial: Omit<RecallClassificationV2, 'taxonomyVersion' | 'method' | 'model' | 'promptVersion'>
): RecallClassificationV2 {
  return {
    taxonomyVersion: RECALL_TAXONOMY_VERSION,
    method: 'rule',
    model: 'mock-deterministic-v1',
    promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION,
    ...partial
  };
}

async function fixtureClassifications(): Promise<Map<string, RecallClassificationV2>> {
  const fixturePath = resolve(projectRoot, 'data/samples/recall-taxonomy-v2-examples.json');
  const fixtures = JSON.parse(await readFile(fixturePath, 'utf8')) as FixtureRecord[];
  return new Map(
    fixtures.map((fixture) => [
      fixture.id,
      {
        ...fixture.expectedClassification,
        method: 'rule',
        model: 'mock-fixture',
        promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION
      }
    ])
  );
}

async function classifyWithMock(input: RecallClassifierInput): Promise<ProviderClassificationResult> {
  const fixtures = await fixtureClassifications();
  const fixture = fixtures.get(input.id);
  if (fixture) {
    return {
      provider: 'mock',
      model: 'mock-fixture',
      rawText: JSON.stringify(fixture),
      mocked: true
    };
  }

  const text = normalize(
    [
      input.source,
      input.title,
      input.legacyCategory,
      input.rawSourceCategory,
      input.hazard,
      input.remedy,
      input.description,
      ...input.productNames,
      ...input.brandNames,
      ...input.identifiers
    ].join(' ')
  );
  const foodSource = ['FDA', 'UK_FSA', 'HK_CFS', 'FSANZ_FOOD_RECALLS'].includes(input.source);
  const foodLike = foodSource || hasAny(text, ['food', 'cookie', 'cookies', 'milk', 'salmonella', 'listeria', 'e coli', 'allergen', 'undeclared', 'pistachio', 'oyster']);

  let output: RecallClassificationV2 | undefined;

  if (hasAny(text, ['yamaha', 'umax', 'golf car', 'golf cart', 'utility vehicle'])) {
    output = classification(input, {
      productFamily: 'vehicles-mobility',
      productType: hasAny(text, ['golf car', 'golf cart', 'umax']) ? 'golf-cart-utility-vehicle' : 'vehicles-other',
      hazardType: hasAny(text, ['crash', 'collision']) ? 'crash' : 'injury',
      hazardTags: hasAny(text, ['crash', 'collision']) ? ['crash'] : ['injury'],
      recallDomain: 'consumer-product',
      audience: ['vehicle-users'],
      confidence: 0.88,
      needsReview: false,
      reason: 'Mock rule: Yamaha golf car or utility vehicle text indicates a vehicle and mobility product recall.',
      evidenceFields: evidence('title', 'productNames', 'hazard', 'description')
    });
  } else if (foodLike) {
    const hazardType = hasAny(text, ['salmonella', 'listeria', 'e coli', 'microbial'])
      ? 'contamination-pathogen'
      : hasAny(text, ['glass', 'metal', 'plastic fragment', 'foreign'])
        ? 'foreign-matter'
        : hasAny(text, ['ethylene oxide', 'mercury', 'chemical'])
          ? 'contamination-chemical'
          : hasAny(text, ['undeclared', 'allergen', 'milk', 'egg', 'peanut', 'wheat', 'sesame', 'pistachio'])
            ? 'allergen'
            : 'unknown';
    output = classification(input, {
      productFamily: 'food-grocery',
      productType: hasAny(text, ['cookie', 'cookies', 'bakery', 'bread', 'muffin']) ? 'snacks-bakery' : hasAny(text, ['milk', 'cheese', 'cream']) ? 'dairy' : hasAny(text, ['drink', 'beverage', 'water']) ? 'beverage' : 'packaged-food',
      hazardType,
      hazardTags: hazardType === 'unknown' ? [] : [hazardType],
      recallDomain: 'food',
      audience: hazardType === 'allergen' ? ['allergy-sensitive-consumers'] : ['general'],
      confidence: hazardType === 'unknown' ? 0.56 : 0.84,
      needsReview: hazardType === 'unknown',
      reason: 'Mock rule: food-source or food-like terms indicate a food and grocery recall.',
      evidenceFields: evidence('source', 'title', 'productNames', 'hazard', 'description')
    });
  } else if (hasAny(text, ['toy', 'child', 'children', 'infant', 'baby', 'nursery', 'stroller', 'pram'])) {
    output = classification(input, {
      productFamily: 'baby-kids',
      productType: hasAny(text, ['toy']) ? 'toy' : hasAny(text, ['stroller', 'pram']) ? 'stroller-pram' : 'baby-kids-other',
      hazardType: hasAny(text, ['choking', 'small part']) ? 'choking' : hasAny(text, ['suffocation']) ? 'suffocation' : 'injury',
      hazardTags: hasAny(text, ['choking', 'small part']) ? ['choking'] : ['injury'],
      recallDomain: 'consumer-product',
      audience: hasAny(text, ['infant', 'baby']) ? ['infants'] : ['children'],
      confidence: 0.82,
      needsReview: false,
      reason: 'Mock rule: child, baby, or toy terms indicate a baby and kids recall.',
      evidenceFields: evidence('title', 'productNames', 'hazard', 'description')
    });
  } else if (hasAny(text, ['battery', 'batteries', 'charger', 'power bank', 'lithium', 'electrical', 'electronics'])) {
    output = classification(input, {
      productFamily: 'electronics-batteries',
      productType: hasAny(text, ['power bank']) ? 'power-bank' : hasAny(text, ['charger']) ? 'charger' : hasAny(text, ['battery', 'batteries']) ? 'battery' : 'electronics-other',
      hazardType: hasAny(text, ['overheat', 'overheating', 'lithium']) ? 'battery-overheat' : hasAny(text, ['fire']) ? 'fire' : hasAny(text, ['shock']) ? 'electric-shock' : 'injury',
      hazardTags: hasAny(text, ['fire']) ? ['fire'] : hasAny(text, ['overheat', 'overheating']) ? ['overheating'] : [],
      recallDomain: 'consumer-product',
      audience: ['general'],
      confidence: 0.8,
      needsReview: false,
      reason: 'Mock rule: battery, charger, or electronics terms indicate an electronics and batteries recall.',
      evidenceFields: evidence('title', 'productNames', 'hazard', 'description')
    });
  } else if (hasAny(text, ['dresser', 'furniture', 'table', 'chair', 'tip over', 'tip-over'])) {
    output = classification(input, {
      productFamily: 'furniture-household',
      productType: 'furniture',
      hazardType: hasAny(text, ['entrapment']) ? 'entrapment' : hasAny(text, ['fall']) ? 'fall' : 'injury',
      hazardTags: hasAny(text, ['tip over', 'tip-over']) ? ['tip-over'] : [],
      recallDomain: 'consumer-product',
      audience: hasAny(text, ['children', 'child']) ? ['children'] : ['general'],
      confidence: 0.78,
      needsReview: false,
      reason: 'Mock rule: furniture terms indicate a furniture and household recall.',
      evidenceFields: evidence('title', 'productNames', 'hazard', 'description')
    });
  } else if (hasAny(text, ['cleaning', 'cleaner', 'detergent', 'pesticide', 'chemical'])) {
    output = classification(input, {
      productFamily: 'chemicals-cleaning',
      productType: hasAny(text, ['detergent']) ? 'detergent' : hasAny(text, ['pesticide']) ? 'pesticide' : hasAny(text, ['clean']) ? 'cleaning-product' : 'chemical-product',
      hazardType: 'chemical-exposure',
      hazardTags: ['chemical exposure'],
      recallDomain: 'chemical',
      audience: ['general'],
      confidence: 0.78,
      needsReview: false,
      reason: 'Mock rule: cleaning or chemical terms indicate a chemical and cleaning recall.',
      evidenceFields: evidence('title', 'productNames', 'rawSourceCategory', 'hazard')
    });
  }

  const fallback =
    output ??
    classification(input, {
      productFamily: 'unknown',
      productType: 'unknown',
      hazardType: 'unknown',
      hazardTags: [],
      recallDomain: 'unknown',
      audience: ['unknown'],
      confidence: 0.25,
      needsReview: true,
      reason: 'Mock rule: insufficient deterministic evidence for taxonomy v2 classification.',
      evidenceFields: evidence('title', 'productNames', 'hazard')
    });

  return {
    provider: 'mock',
    model: fallback.model ?? 'mock-deterministic-v1',
    rawText: JSON.stringify(fallback),
    mocked: true
  };
}

async function classifyWithGemini(input: RecallClassifierInput, settings: RecallClassifierProviderSettings): Promise<ProviderClassificationResult> {
  const key = getLocalEnvValue('GEMINI_API_KEY');
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const prompt = buildRecallClassifierPrompt(input, settings.model);
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

  return {
    provider: 'gemini',
    model: settings.model,
    rawText,
    mocked: false
  };
}

async function classifyWithOpenAi(input: RecallClassifierInput, settings: RecallClassifierProviderSettings): Promise<ProviderClassificationResult> {
  const key = getLocalEnvValue('OPENAI_API_KEY');
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const prompt = buildRecallClassifierPrompt(input, settings.model);
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
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  const rawText =
    data.output_text?.trim() ||
    data.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? '').join('').trim() ||
    '';
  if (!rawText) {
    throw new Error('OpenAI classifier returned no text.');
  }

  return {
    provider: 'openai',
    model: settings.model,
    rawText,
    mocked: false
  };
}

export async function classifyWithProvider(
  input: RecallClassifierInput,
  settings: RecallClassifierProviderSettings
): Promise<ProviderClassificationResult> {
  if (settings.provider === 'mock') {
    return classifyWithMock(input);
  }

  if (!settings.liveAvailable) {
    throw new Error(settings.missingReason ?? `${settings.provider} provider is not available.`);
  }

  return settings.provider === 'gemini'
    ? classifyWithGemini(input, settings)
    : classifyWithOpenAi(input, settings);
}
