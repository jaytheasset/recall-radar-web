// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const expectedSources = [
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS',
  'FSANZ_FOOD_RECALLS'
];

function pathFor(relativePath: string): string {
  return resolve(projectRoot, relativePath);
}

function exists(relativePath: string): boolean {
  return existsSync(pathFor(relativePath));
}

function readText(relativePath: string): string {
  return readFileSync(pathFor(relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readText(relativePath));
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function gitOutput(args: string[]): string[] {
  const output = execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function runAudit(): void {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedFiles = [
    'scripts/classify-source-specific-taxonomy-v2-dry-run.ts',
    'scripts/audit-source-specific-classifier-dry-run.ts',
    'scripts/llm-recall-classifier-prompt.ts',
    'docs/source-specific-classifier-dry-run.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const script = exists('scripts/classify-source-specific-taxonomy-v2-dry-run.ts')
    ? readText('scripts/classify-source-specific-taxonomy-v2-dry-run.ts')
    : '';
  const packageJson = exists('package.json') ? readJson('package.json') as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';

  assert(packageJson.scripts?.['classify:recalls:taxonomy-v2:source-specific-dry-run']?.includes('classify-source-specific-taxonomy-v2-dry-run.ts') ?? false, 'package.json is missing classify:recalls:taxonomy-v2:source-specific-dry-run.', blockers);
  assert(packageJson.scripts?.['audit:source-specific-classifier-dry-run']?.includes('audit-source-specific-classifier-dry-run.ts') ?? false, 'package.json is missing audit:source-specific-classifier-dry-run.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);
  assert(script.includes('buildRecallClassifierPromptFromInput'), 'Source-specific dry run must use the source-specific prompt builder.', blockers);
  assert(script.includes('genericInput') && script.includes('proposedInput'), 'Source-specific dry run must compare genericInput and proposedInput.', blockers);
  assert(script.includes('source-specific-dry-run'), 'Source-specific dry run must write to an ignored source-specific output directory.', blockers);
  assert(!script.includes('writeNormalized') && !script.includes('mergeProcessedRecalls'), 'Source-specific dry run must not write normalized/canonical data.', blockers);
  assert(!/\bfetch\s*\([^)]*(?:cpsc|fda|recall|safety|foodstandards|productsafety|rappel|canada)/i.test(script), 'Source-specific dry run must not fetch source data.', blockers);

  const outputPath = 'outputs/llm-classifier/source-specific-dry-run/source-specific-dry-run-results.json';
  if (!exists(outputPath)) {
    warnings.push('No local source-specific dry-run output found yet.');
  } else {
    const output = readJson(outputPath) as {
      provider?: string;
      model?: string;
      sampleCount?: number;
      sources?: string[];
      success?: { generic?: number; sourceSpecific?: number };
      failed?: { generic?: number; sourceSpecific?: number };
      results?: Array<{
        source?: string;
        generic?: { success?: boolean; classification?: unknown };
        sourceSpecific?: { success?: boolean; classification?: unknown };
      }>;
    };
    assert(output.provider === 'gemini' || output.provider === 'openai', 'Output provider must be a live provider.', blockers);
    assert(output.sampleCount === expectedSources.length, `Output sampleCount must be ${expectedSources.length}.`, blockers);
    assert(Array.isArray(output.sources) && expectedSources.every((source) => output.sources?.includes(source)), 'Output must include all expected sources.', blockers);
    assert(output.success?.generic === expectedSources.length, 'All generic classifications must succeed.', blockers);
    assert(output.success?.sourceSpecific === expectedSources.length, 'All source-specific classifications must succeed.', blockers);
    assert(output.failed?.generic === 0, 'Generic failures must be zero.', blockers);
    assert(output.failed?.sourceSpecific === 0, 'Source-specific failures must be zero.', blockers);
    assert(Array.isArray(output.results) && output.results.length === expectedSources.length, 'Output results length must match expected sources.', blockers);
    for (const result of output.results ?? []) {
      assert(Boolean(result.generic?.classification), `${result.source} missing generic classification.`, blockers);
      assert(Boolean(result.sourceSpecific?.classification), `${result.source} missing source-specific classification.`, blockers);
    }
  }

  const trackedOutputs = gitOutput(['ls-files', 'outputs/llm-classifier/source-specific-dry-run']);
  assert(trackedOutputs.length === 0, `Generated source-specific dry-run outputs must not be committed: ${trackedOutputs.join(', ')}`, blockers);

  const dataChanges = gitOutput(['diff', '--name-only', '--', 'data/raw', 'data/processed']);
  assert(dataChanges.length === 0, `Data files changed unexpectedly: ${dataChanges.join(', ')}`, blockers);

  const result = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checkedFiles,
    expectedSources,
    trackedOutputs,
    dataChanges
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

runAudit();
