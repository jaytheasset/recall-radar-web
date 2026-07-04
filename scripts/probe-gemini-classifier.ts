import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecallClassifierInput } from './build-recall-classifier-input.ts';
import {
  estimateClassifierInput,
  estimateTokensFromText
} from './build-recall-classifier-input.ts';
import {
  getLocalEnvValue,
  hasLocalEnvValue,
  loadLocalEnv
} from './load-local-env.ts';
import { buildRecallClassifierPrompt } from './llm-recall-classifier-prompt.ts';
import { parseStrictClassifierJson } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultGeminiModel = 'gemini-2.5-flash-lite';

const artificialRecallInput: RecallClassifierInput = {
  id: 'probe-artificial-undeclared-milk-cookies',
  source: 'FDA',
  title: 'Allergy alert for undeclared milk in chocolate cookies',
  productNames: ['Chocolate cookies'],
  brandNames: ['Artificial Probe Brand'],
  legacyCategory: 'food-allergy',
  rawSourceCategory: 'Food allergy alert',
  hazard: 'Undeclared milk allergen',
  remedy: 'Consumers with milk allergies should review the official recall notice.',
  description: 'Artificial connectivity probe for a chocolate cookie recall involving undeclared milk.',
  sourceUrl: 'https://example.test/artificial-gemini-probe',
  recallDate: '2026-01-01',
  identifiers: ['artificial-probe']
};

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes'].includes(getLocalEnvValue(name).toLowerCase());
}

async function writeProbeOutput(value: unknown): Promise<void> {
  if (!envFlag('RECALL_CLASSIFIER_WRITE_PROBE_OUTPUT')) {
    return;
  }

  const outputDir = resolve(projectRoot, 'outputs/llm-classifier/probe');
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, 'gemini-probe.json'), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runProbe(): Promise<void> {
  await loadLocalEnv();

  const key = getLocalEnvValue('GEMINI_API_KEY');
  const model = getLocalEnvValue('RECALL_CLASSIFIER_MODEL').trim() || defaultGeminiModel;
  if (!hasLocalEnvValue('GEMINI_API_KEY')) {
    console.log(JSON.stringify({
      model,
      requestSent: false,
      skipped: true,
      reason: 'GEMINI_API_KEY is not set. Copy .env.example to .env.local or set GEMINI_API_KEY in your shell, then rerun npm run probe:gemini-classifier.'
    }, null, 2));
    return;
  }

  const prompt = buildRecallClassifierPrompt(artificialRecallInput, model);
  const requestEstimate = estimateClassifierInput(artificialRecallInput, prompt);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  let rawText = '';
  let parsedJson = false;
  let validClassification = false;
  let errorMessage = '';

  try {
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
      throw new Error(`Gemini probe failed with HTTP ${response.status}.`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
    if (!rawText) {
      throw new Error('Gemini probe returned no text.');
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const validation = rawText ? parseStrictClassifierJson(rawText) : { ok: false, errors: ['No response text.'] };
  parsedJson = rawText ? !validation.errors.some((error) => error.startsWith('Invalid strict JSON:')) : false;
  validClassification = validation.ok;

  const result = {
    model,
    requestSent: true,
    parsedJson,
    validClassification,
    productFamily: validation.classification?.productFamily ?? null,
    productType: validation.classification?.productType ?? null,
    hazardType: validation.classification?.hazardType ?? null,
    recallDomain: validation.classification?.recallDomain ?? null,
    confidence: validation.classification?.confidence ?? null,
    needsReview: validation.classification?.needsReview ?? null,
    estimatedInputTokens: requestEstimate.estimatedInputTokens,
    estimatedOutputTokens: rawText ? estimateTokensFromText(rawText) : 0,
    expectedBroadClassification: {
      productFamily: 'food-grocery',
      hazardType: 'allergen',
      recallDomain: 'food'
    },
    errors: [
      ...validation.errors,
      ...(errorMessage ? [errorMessage] : [])
    ]
  };

  await writeProbeOutput(result);
  console.log(JSON.stringify(result, null, 2));

  if (!validClassification) {
    process.exitCode = 1;
  }
}

runProbe().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
