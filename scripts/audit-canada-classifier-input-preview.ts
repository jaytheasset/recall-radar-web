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
    totalCanadaRecords?: number;
    ipexCaseIncluded?: boolean;
    affectedProductTableCaseIncluded?: boolean;
    healthProductCaseIncluded?: boolean;
    averageGenericTokens?: number;
    averageProposedTokens?: number;
    averageReductionPercent?: number;
    noisyRecords?: number;
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
  const previewPath = 'outputs/llm-classifier/input-preview/canada/canada-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/canada/canada-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/canada/canada-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local Canada classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalCanadaRecords?: number;
    ipexCaseIncluded?: boolean;
    affectedProductTableCaseIncluded?: boolean;
    healthProductCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: {
        source?: string;
        sourceHints?: {
          market?: string;
          classificationOwner?: string;
        };
        affectedProducts?: unknown[];
        productFamily?: unknown;
        productType?: unknown;
        hazardType?: unknown;
        audience?: unknown;
      };
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
  const noise = exists(noisePath)
    ? JSON.parse(readText(noisePath)) as { noisyRecords?: number }
    : {};

  assert(preview.source === 'CA_RECALLS', 'Preview output source must be CA_RECALLS.', blockers);
  assert(typeof preview.totalCanadaRecords === 'number' && preview.totalCanadaRecords === 100, 'Preview output must report 100 Canada records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.ipexCaseIncluded === true, 'Preview output must include the IPEX affected-products table case when present.', blockers);
  assert(preview.affectedProductTableCaseIncluded === true, 'Preview output must include at least one affected-products table case.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'CA_RECALLS', 'Every proposed input must keep Canada source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'Canada', 'Every proposed input must keep Canada market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.classificationOwner === 'llm', 'Every proposed input must mark classificationOwner as llm.', blockers);
    assert(!('productFamily' in (record.proposedInput ?? {})), 'Proposed input must not include productFamily.', blockers);
    assert(!('productType' in (record.proposedInput ?? {})), 'Proposed input must not include productType.', blockers);
    assert(!('hazardType' in (record.proposedInput ?? {})), 'Proposed input must not include hazardType.', blockers);
    assert(!('audience' in (record.proposedInput ?? {})), 'Proposed input must not include audience.', blockers);
    assert(Boolean(record.tokenComparison), 'Every preview record must include tokenComparison.', blockers);
    assert(Boolean(record.noise), 'Every preview record must include noise findings.', blockers);
  }

  return {
    sampleCount: preview.sampleCount,
    totalCanadaRecords: preview.totalCanadaRecords,
    ipexCaseIncluded: preview.ipexCaseIncluded,
    affectedProductTableCaseIncluded: preview.affectedProductTableCaseIncluded,
    healthProductCaseIncluded: preview.healthProductCaseIncluded,
    averageGenericTokens: comparison.averageGenericTokens,
    averageProposedTokens: comparison.averageProposedTokens,
    averageReductionPercent: comparison.averageReductionPercent,
    noisyRecords: noise.noisyRecords
  };
}

function runAudit(): void {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedFiles = [
    'scripts/preview-canada-classifier-input.ts',
    'scripts/audit-canada-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/canada-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-canada-classifier-input.ts') ? readText('scripts/preview-canada-classifier-input.ts') : '';
  const audit = exists('scripts/audit-canada-classifier-input-preview.ts') ? readText('scripts/audit-canada-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/canada-classifier-input-preview.md') ? readText('docs/canada-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:canada-classifier-input']?.includes('preview-canada-classifier-input.ts') ?? false, 'package.json is missing preview:canada-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:canada-classifier-input-preview']?.includes('audit-canada-classifier-input-preview.ts') ?? false, 'package.json is missing audit:canada-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildCanadaClassifierInputPreview'), 'Preview must include buildCanadaClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'CA_RECALLS'"), 'Preview must include Canada source id.', blockers);
  assert(preview.includes("market: 'Canada'"), 'Preview must include Canada market hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('CANADA_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support CANADA_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('affectedProducts') && preview.includes('partNumber') && preview.includes('upc'), 'Preview must include Canada affected-products table evidence.', blockers);
  assert(preview.includes('sourceRecallType') && preview.includes('sourceCategory') && preview.includes('sourceRecallClass'), 'Preview must include official Canada source fields.', blockers);
  assert(preview.includes('ipex') && preview.includes('health product recall'), 'Preview must include IPEX and health/medical sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official Government of Canada notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('canada-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('canada-noise-report.json') && preview.includes('canada-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeCanada'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/canada/'), 'Docs must document the Canada output directory.', blockers);
  assert(docs.includes('sourceCategory') && docs.includes('sourceRecallType'), 'Docs must explain Canada source fields.', blockers);
  assert(docs.includes('Product family, product type, hazard type, audience'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:canada-classifier-input'), 'Dry-run docs must mention preview:canada-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:canada-classifier-input'), 'Phase plan docs must mention preview:canada-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:canada-classifier-input'), 'scripts/README.md must document preview:canada-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/canada'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/canada');
  assert(committedOutputs.length === 0, `Generated Canada preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

  const dataChanges = changedFilesUnder(['data/raw', 'data/processed']);
  if (dataChanges.length > 0) {
    warnings.push(`Data files are already modified in the working tree: ${dataChanges.join(', ')}`);
  }

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
