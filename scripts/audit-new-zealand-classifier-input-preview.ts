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
    totalNewZealandRecords?: number;
    babyKidsCaseIncluded?: boolean;
    electronicsBatteryCaseIncluded?: boolean;
    householdCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/new-zealand/new-zealand-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/new-zealand/new-zealand-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/new-zealand/new-zealand-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local New Zealand classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalNewZealandRecords?: number;
    babyKidsCaseIncluded?: boolean;
    electronicsBatteryCaseIncluded?: boolean;
    householdCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: { source?: string; sourceHints?: { domainHint?: string } };
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

  assert(preview.source === 'NZ_PRODUCT_SAFETY', 'Preview output source must be NZ_PRODUCT_SAFETY.', blockers);
  assert(typeof preview.totalNewZealandRecords === 'number' && preview.totalNewZealandRecords === 100, 'Preview output must report 100 New Zealand records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.babyKidsCaseIncluded === true, 'Preview output must include a baby/kids or toy case when present.', blockers);
  assert(preview.electronicsBatteryCaseIncluded === true, 'Preview output must include an electronics/battery case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'NZ_PRODUCT_SAFETY', 'Every proposed input must keep New Zealand source.', blockers);
    assert(record.proposedInput?.sourceHints?.domainHint === 'consumer-product', 'Every proposed input must keep consumer-product domain hint.', blockers);
    assert(Boolean(record.tokenComparison), 'Every preview record must include tokenComparison.', blockers);
    assert(Boolean(record.noise), 'Every preview record must include noise findings.', blockers);
  }

  return {
    sampleCount: preview.sampleCount,
    totalNewZealandRecords: preview.totalNewZealandRecords,
    babyKidsCaseIncluded: preview.babyKidsCaseIncluded,
    electronicsBatteryCaseIncluded: preview.electronicsBatteryCaseIncluded,
    householdCaseIncluded: preview.householdCaseIncluded,
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
    'scripts/preview-new-zealand-classifier-input.ts',
    'scripts/audit-new-zealand-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/new-zealand-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-new-zealand-classifier-input.ts') ? readText('scripts/preview-new-zealand-classifier-input.ts') : '';
  const audit = exists('scripts/audit-new-zealand-classifier-input-preview.ts') ? readText('scripts/audit-new-zealand-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/new-zealand-classifier-input-preview.md') ? readText('docs/new-zealand-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:new-zealand-classifier-input']?.includes('preview-new-zealand-classifier-input.ts') ?? false, 'package.json is missing preview:new-zealand-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:new-zealand-classifier-input-preview']?.includes('audit-new-zealand-classifier-input-preview.ts') ?? false, 'package.json is missing audit:new-zealand-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildNewZealandClassifierInputPreview'), 'Preview must include buildNewZealandClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'NZ_PRODUCT_SAFETY'"), 'Preview must include New Zealand source id.', blockers);
  assert(preview.includes("domainHint: 'consumer-product'"), 'Preview must include New Zealand consumer-product domain hint.', blockers);
  assert(preview.includes('NEW_ZEALAND_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support NEW_ZEALAND_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('productIdentifiers') && preview.includes('supplierName') && preview.includes('responsibleAgency'), 'Preview must include New Zealand source fields.', blockers);
  assert(preview.includes('toy') && preview.includes('baby') && preview.includes('battery'), 'Preview must include baby/toy and battery sampling terms.', blockers);
  assert(preview.includes('furniture') && preview.includes('appliance') && preview.includes('general-consumer-product'), 'Preview must include household and ambiguous category sampling terms.', blockers);
  assert(preview.includes('model') && preview.includes('sku') && preview.includes('serial') && preview.includes('barcode'), 'Preview must include identifier sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('supplier/contact text dominates input'), 'Preview must flag supplier/contact text domination.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official Product Safety New Zealand notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('new-zealand-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('new-zealand-noise-report.json') && preview.includes('new-zealand-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeNewZealandProductSafetyRecords'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('data/processed/recalls.json'), 'Preview should use readProcessedRecalls instead of writing canonical data paths.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/new-zealand/'), 'Docs must document the New Zealand output directory.', blockers);
  assert(docs.includes('productIdentifiers') && docs.includes('supplierName'), 'Docs must explain New Zealand source fields.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:new-zealand-classifier-input'), 'Dry-run docs must mention preview:new-zealand-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:new-zealand-classifier-input'), 'Phase plan docs must mention preview:new-zealand-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:new-zealand-classifier-input'), 'scripts/README.md must document preview:new-zealand-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/new-zealand'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/new-zealand');
  assert(committedOutputs.length === 0, `Generated New Zealand preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
