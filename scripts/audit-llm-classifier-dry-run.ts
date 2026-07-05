import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECALL_TAXONOMY_VERSION } from '../src/data/recall-taxonomy-v2.ts';
import { RECALL_CLASSIFIER_PROMPT_VERSION } from './llm-recall-classifier-prompt.ts';
import { validateClassificationOutput } from './validate-recall-classification-output.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

type DryRunAuditResult = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  dryRunOutput?: {
    provider?: string;
    model?: string;
    sampleCount?: number;
    success?: number;
    failed?: number;
    needsReview?: number;
    validClassifications: number;
    invalidClassifications: number;
  };
};

async function exists(relativePath: string): Promise<boolean> {
  try {
    await readFile(resolve(projectRoot, relativePath), 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath: string): Promise<string> {
  return readFile(resolve(projectRoot, relativePath), 'utf8');
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function scanForCommittedSecretLikeValues(files: Array<[string, string]>): string[] {
  const secretPatterns = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /AIza[0-9A-Za-z_-]{20,}/g
  ];
  const findings: string[] = [];

  for (const [file, text] of files) {
    for (const pattern of secretPatterns) {
      const matches = text.match(pattern) ?? [];
      for (const match of matches) {
        findings.push(`${file} contains secret-like token ${match.slice(0, 8)}...`);
      }
    }
  }

  return findings;
}

function scanForUnsafeOutputLanguage(text: string, label: string): string[] {
  const banned = [
    ['safe', 'to', 'use'],
    ['not', 'recalled'],
    ['definitely', 'affected'],
    ['confirmed', 'affected'],
    ['fully', 'verified', 'safe'],
    ['official', 'guarantee'],
    ['complete', 'global', 'coverage'],
    ['all', 'worldwide', 'recalls'],
    ['complete', 'source', 'coverage']
  ].map((parts) => parts.join(' '));

  return banned
    .filter((phrase) => text.toLowerCase().includes(phrase))
    .map((phrase) => `${label} contains unsupported safety or coverage phrase: ${phrase}`);
}

async function auditDryRunOutput(blockers: string[], warnings: string[]): Promise<DryRunAuditResult['dryRunOutput']> {
  if (!(await exists('outputs/llm-classifier/dry-run-results.json'))) {
    warnings.push('No local dry-run output found under outputs/llm-classifier yet.');
    return undefined;
  }

  const payload = JSON.parse(await readText('outputs/llm-classifier/dry-run-results.json')) as {
    provider?: string;
    model?: string;
    promptVersion?: string;
    sampleCount?: number;
    success?: number;
    failed?: number;
    needsReview?: number;
    results?: Array<{ classification?: unknown; success?: boolean; failed?: boolean; errors?: string[] }>;
  };
  const results = Array.isArray(payload.results) ? payload.results : [];
  let validClassifications = 0;
  let invalidClassifications = 0;

  assert(payload.promptVersion === RECALL_CLASSIFIER_PROMPT_VERSION, `Dry-run output promptVersion must be ${RECALL_CLASSIFIER_PROMPT_VERSION}.`, blockers);
  assert(typeof payload.sampleCount === 'number' && payload.sampleCount > 0, 'Dry-run output must include a positive sampleCount.', blockers);
  assert(results.length === payload.sampleCount, 'Dry-run output results length must match sampleCount.', blockers);
  assert(payload.failed === 0, 'Dry-run output must have zero failed classifications for audit pass.', blockers);

  for (const result of results) {
    if (!result.classification) {
      invalidClassifications += 1;
      continue;
    }
    const validation = validateClassificationOutput(result.classification);
    if (validation.ok) {
      validClassifications += 1;
    } else {
      invalidClassifications += 1;
      blockers.push(`Invalid classification output: ${validation.errors.join(' ')}`);
    }
  }

  const rawOutput = await readText('outputs/llm-classifier/dry-run-results.json');
  blockers.push(...scanForUnsafeOutputLanguage(rawOutput, 'dry-run-results.json'));

  return {
    provider: payload.provider,
    model: payload.model,
    sampleCount: payload.sampleCount,
    success: payload.success,
    failed: payload.failed,
    needsReview: payload.needsReview,
    validClassifications,
    invalidClassifications
  };
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredFiles = [
    'scripts/build-recall-classifier-input.ts',
    'scripts/llm-recall-classifier-prompt.ts',
    'scripts/llm-recall-classifier-provider.ts',
    'scripts/validate-recall-classification-output.ts',
    'scripts/select-recall-classifier-dry-run-sample.ts',
    'scripts/classify-recalls-taxonomy-v2-dry-run.ts',
    'scripts/audit-llm-classifier-dry-run.ts',
    'docs/llm-recall-classifier-dry-run.md'
  ];

  for (const file of requiredFiles) {
    assert(await exists(file), `${file} is missing.`, blockers);
  }

  const files = await Promise.all(
    requiredFiles
      .filter((file) => !file.endsWith('docs/llm-recall-classifier-dry-run.md') || true)
      .map(async (file) => [file, await readText(file)] as [string, string])
  );
  const packageJson = JSON.parse(await readText('package.json')) as { scripts?: Record<string, string> };
  const gitignore = await readText('.gitignore');
  const promptText = files.find(([file]) => file.endsWith('llm-recall-classifier-prompt.ts'))?.[1] ?? '';
  const providerText = files.find(([file]) => file.endsWith('llm-recall-classifier-provider.ts'))?.[1] ?? '';
  const dryRunText = files.find(([file]) => file.endsWith('classify-recalls-taxonomy-v2-dry-run.ts'))?.[1] ?? '';
  const sampleText = files.find(([file]) => file.endsWith('select-recall-classifier-dry-run-sample.ts'))?.[1] ?? '';

  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);
  assert(packageJson.scripts?.['classify:recalls:taxonomy-v2:dry-run']?.includes('classify-recalls-taxonomy-v2-dry-run.ts') ?? false, 'package.json is missing classify:recalls:taxonomy-v2:dry-run.', blockers);
  assert(packageJson.scripts?.['audit:llm-classifier-dry-run']?.includes('audit-llm-classifier-dry-run.ts') ?? false, 'package.json is missing audit:llm-classifier-dry-run.', blockers);
  assert(promptText.includes(RECALL_TAXONOMY_VERSION), 'Prompt must use the taxonomy v2 version constant.', blockers);
  assert(promptText.includes('recall-classifier-v2'), 'Prompt must use recall-classifier-v2.', blockers);
  assert(promptText.includes('Return strict JSON only'), 'Prompt must require strict JSON only.', blockers);
  assert(promptText.includes('Never assert product safety status'), 'Prompt must block safety claims.', blockers);
  assert(promptText.includes('Parser fields and source categories are evidence only'), 'Prompt must say parser/source fields are evidence only.', blockers);
  assert(promptText.includes('Do not classify a medical/health record as baby-kids only because'), 'Prompt must guard medical/health records from baby-kids false positives.', blockers);
  assert(promptText.includes('confidence is below 0.75'), 'Prompt must define the confidence review threshold.', blockers);
  assert(providerText.includes("provider === 'gemini'") && providerText.includes("provider === 'openai'") && providerText.includes("provider === 'mock'"), 'Provider abstraction must support mock, gemini, and openai modes.', blockers);
  assert(providerText.includes('GEMINI_API_KEY') && providerText.includes('OPENAI_API_KEY'), 'Live providers must be gated by env keys.', blockers);
  assert(providerText.includes('RECALL_CLASSIFIER_INPUT_USD_PER_1M') && providerText.includes('RECALL_CLASSIFIER_OUTPUT_USD_PER_1M'), 'Provider settings must support token pricing env variables.', blockers);
  assert(sampleText.includes('yamaha') && sampleText.includes('bistro') && sampleText.includes('utility vehicle'), 'Sample selection must force the Yamaha/UMAX/Bistro vehicle edge case when present.', blockers);
  assert(
    dryRunText.includes('RECALL_CLASSIFIER_NO_WRITE') && (dryRunText.includes('outputs/llm-classifier') || providerText.includes('outputs/llm-classifier')),
    'Dry-run script must write only to ignored classifier outputs and support no-write mode.',
    blockers
  );

  const secretFindings = scanForCommittedSecretLikeValues(files);
  blockers.push(...secretFindings);

  const dryRunOutput = await auditDryRunOutput(blockers, warnings);
  const result: DryRunAuditResult = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    dryRunOutput
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
