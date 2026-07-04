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
    totalFsanzRecords?: number;
    allergenCaseIncluded?: boolean;
    contaminationCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/fsanz/fsanz-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/fsanz/fsanz-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/fsanz/fsanz-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local FSANZ classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalFsanzRecords?: number;
    allergenCaseIncluded?: boolean;
    contaminationCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: { source?: string; sourceHints?: { domainHint?: string; expectedProductFamilyHint?: string } };
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

  assert(preview.source === 'FSANZ_FOOD_RECALLS', 'Preview output source must be FSANZ_FOOD_RECALLS.', blockers);
  assert(typeof preview.totalFsanzRecords === 'number' && preview.totalFsanzRecords === 100, 'Preview output must report 100 FSANZ records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.allergenCaseIncluded === true, 'Preview output must include an allergen case when present.', blockers);
  assert(preview.contaminationCaseIncluded === true, 'Preview output must include a contamination case when present.', blockers);
  assert(preview.foreignMatterCaseIncluded === true, 'Preview output must include a foreign matter case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'FSANZ_FOOD_RECALLS', 'Every proposed input must keep FSANZ source.', blockers);
    assert(record.proposedInput?.sourceHints?.domainHint === 'food', 'Every proposed input must keep FSANZ food domain hint.', blockers);
    assert(record.proposedInput?.sourceHints?.expectedProductFamilyHint === 'food-grocery', 'Every proposed input must keep food-grocery family hint.', blockers);
    assert(Boolean(record.tokenComparison), 'Every preview record must include tokenComparison.', blockers);
    assert(Boolean(record.noise), 'Every preview record must include noise findings.', blockers);
  }

  return {
    sampleCount: preview.sampleCount,
    totalFsanzRecords: preview.totalFsanzRecords,
    allergenCaseIncluded: preview.allergenCaseIncluded,
    contaminationCaseIncluded: preview.contaminationCaseIncluded,
    foreignMatterCaseIncluded: preview.foreignMatterCaseIncluded,
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
    'scripts/preview-fsanz-classifier-input.ts',
    'scripts/audit-fsanz-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/fsanz-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-fsanz-classifier-input.ts') ? readText('scripts/preview-fsanz-classifier-input.ts') : '';
  const audit = exists('scripts/audit-fsanz-classifier-input-preview.ts') ? readText('scripts/audit-fsanz-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/fsanz-classifier-input-preview.md') ? readText('docs/fsanz-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:fsanz-classifier-input']?.includes('preview-fsanz-classifier-input.ts') ?? false, 'package.json is missing preview:fsanz-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:fsanz-classifier-input-preview']?.includes('audit-fsanz-classifier-input-preview.ts') ?? false, 'package.json is missing audit:fsanz-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildFsanzClassifierInputPreview'), 'Preview must include buildFsanzClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'FSANZ_FOOD_RECALLS'"), 'Preview must include FSANZ source id.', blockers);
  assert(preview.includes("domainHint: 'food'"), 'Preview must include FSANZ food domain hint.', blockers);
  assert(preview.includes("expectedProductFamilyHint: 'food-grocery'"), 'Preview must include food-grocery expected family hint.', blockers);
  assert(preview.includes('FSANZ_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support FSANZ_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('allergen') && preview.includes('undeclared') && preview.includes('milk'), 'Preview must include allergen sampling terms.', blockers);
  assert(preview.includes('contamination') && preview.includes('salmonella') && preview.includes('listeria') && preview.includes('e coli'), 'Preview must include pathogen/contamination sampling terms.', blockers);
  assert(preview.includes('foreign matter') && preview.includes('glass') && preview.includes('metal') && preview.includes('plastic'), 'Preview must include foreign matter sampling terms.', blockers);
  assert(preview.includes('date marking') && preview.includes('best before') && preview.includes('use by') && preview.includes('expiry'), 'Preview must include date marking sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official FSANZ recall notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('fsanz-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('fsanz-noise-report.json') && preview.includes('fsanz-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeFsanzFoodRecallRecords'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('data/processed/recalls.json'), 'Preview should use readProcessedRecalls instead of writing canonical data paths.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/fsanz/'), 'Docs must document the FSANZ output directory.', blockers);
  assert(docs.includes('allergen') && docs.includes('pathogen') && docs.includes('foreign matter'), 'Docs must explain FSANZ food hazard distinctions.', blockers);
  assert(docs.includes('non-allergen'), 'Docs must mention non-allergen FSANZ cases.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:fsanz-classifier-input'), 'Dry-run docs must mention preview:fsanz-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:fsanz-classifier-input'), 'Phase plan docs must mention preview:fsanz-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:fsanz-classifier-input'), 'scripts/README.md must document preview:fsanz-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/fsanz'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/fsanz');
  assert(committedOutputs.length === 0, `Generated FSANZ preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
