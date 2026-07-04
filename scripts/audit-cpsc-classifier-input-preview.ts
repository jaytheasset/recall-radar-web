// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

type AuditResult = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  checkedFiles: string[];
  outputSummary?: {
    sampleCount?: number;
    totalCpscRecords?: number;
    yamahaBistroIncluded?: boolean;
    averageGenericTokens?: number;
    averageProposedTokens?: number;
    averageReductionPercent?: number;
  };
};

function pathFor(relativePath: string): string {
  return resolve(projectRoot, relativePath);
}

function exists(relativePath: string): boolean {
  return existsSync(pathFor(relativePath));
}

function readText(relativePath: string): string {
  return readFileSync(pathFor(relativePath), 'utf8');
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function gitLsFiles(pathspec: string): string[] {
  const output = execFileSync('git', ['ls-files', pathspec], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFilesUnder(paths: string[]): string[] {
  const output = execFileSync('git', ['diff', '--name-only', '--', ...paths], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function outputSummary(blockers: string[], warnings: string[]): AuditResult['outputSummary'] {
  const previewPath = 'outputs/llm-classifier/input-preview/cpsc/cpsc-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/cpsc/cpsc-token-comparison.json';

  if (!exists(previewPath)) {
    warnings.push('No local CPSC classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalCpscRecords?: number;
    yamahaBistroIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: unknown;
      tokenComparison?: unknown;
      noise?: unknown;
    }>;
  };
  const comparison = exists(comparisonPath)
    ? JSON.parse(readText(comparisonPath)) as {
        averageGenericTokens?: number;
        averageProposedTokens?: number;
        averageReductionPercent?: number;
      }
    : {};

  assert(preview.source === 'CPSC', 'Preview output source must be CPSC.', blockers);
  assert(typeof preview.totalCpscRecords === 'number' && preview.totalCpscRecords === 301, 'Preview output must report 301 CPSC records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.yamahaBistroIncluded === true, 'Preview output must include the Yamaha/Bistro review case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(Boolean(record.tokenComparison), 'Every preview record must include tokenComparison.', blockers);
    assert(Boolean(record.noise), 'Every preview record must include noise findings.', blockers);
  }

  return {
    sampleCount: preview.sampleCount,
    totalCpscRecords: preview.totalCpscRecords,
    yamahaBistroIncluded: preview.yamahaBistroIncluded,
    averageGenericTokens: comparison.averageGenericTokens,
    averageProposedTokens: comparison.averageProposedTokens,
    averageReductionPercent: comparison.averageReductionPercent
  };
}

function runAudit(): void {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedFiles = [
    'scripts/preview-cpsc-classifier-input.ts',
    'scripts/audit-cpsc-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/cpsc-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-cpsc-classifier-input.ts') ? readText('scripts/preview-cpsc-classifier-input.ts') : '';
  const audit = exists('scripts/audit-cpsc-classifier-input-preview.ts') ? readText('scripts/audit-cpsc-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/cpsc-classifier-input-preview.md') ? readText('docs/cpsc-classifier-input-preview.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:cpsc-classifier-input']?.includes('preview-cpsc-classifier-input.ts') ?? false, 'package.json is missing preview:cpsc-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:cpsc-classifier-input-preview']?.includes('audit-cpsc-classifier-input-preview.ts') ?? false, 'package.json is missing audit:cpsc-classifier-input-preview.', blockers);
  assert(packageJson.scripts?.['audit:source-aware-identifiers']?.includes('audit:identifier-guidance') ?? false, 'package.json is missing audit:source-aware-identifiers alias.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildCpscClassifierInputPreview'), 'Preview must include buildCpscClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'CPSC'") && preview.includes("domainHint: 'consumer-product'"), 'Preview must include CPSC source hints.', blockers);
  assert(preview.includes('CPSC_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support CPSC_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('yamaha') && preview.includes('umax') && preview.includes('bistro'), 'Preview must include Yamaha/UMAX/Bistro sampling logic.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official CPSC notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('cpsc-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('cpsc-noise-report.json') && preview.includes('cpsc-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeCpscRecords'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('data/processed/recalls.json'), 'Preview should use readProcessedRecalls instead of writing canonical data paths.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/cpsc/'), 'Docs must document the CPSC output directory.', blockers);
  assert(docs.includes('Yamaha') && docs.includes('Bistro'), 'Docs must explain how to inspect Yamaha/Bistro.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(scriptsReadme.includes('preview:cpsc-classifier-input'), 'scripts/README.md must document preview:cpsc-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/cpsc'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/cpsc');
  assert(committedOutputs.length === 0, `Generated CPSC preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

  const dataChanges = changedFilesUnder(['data/raw', 'data/processed']);
  assert(dataChanges.length === 0, `Data files changed unexpectedly: ${dataChanges.join(', ')}`, blockers);

  const result: AuditResult = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checkedFiles,
    outputSummary: outputSummary(blockers, warnings)
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length) {
    process.exitCode = 1;
  }
}

runAudit();
