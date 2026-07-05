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
    totalFdaFoodRecords?: number;
    allergenCaseIncluded?: boolean;
    pathogenCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    labelingOrStorageCaseIncluded?: boolean;
    classICaseIncluded?: boolean;
    classIICaseIncluded?: boolean;
    classIIICaseIncluded?: boolean;
    identifierCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/fda-food/fda-food-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/fda-food/fda-food-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/fda-food/fda-food-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local FDA food classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalFdaFoodRecords?: number;
    allergenCaseIncluded?: boolean;
    pathogenCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    labelingOrStorageCaseIncluded?: boolean;
    classICaseIncluded?: boolean;
    classIICaseIncluded?: boolean;
    classIIICaseIncluded?: boolean;
    identifierCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: {
        source?: string;
        sourceHints?: {
          market?: string;
          sourceApi?: string;
          domainHint?: string;
          classificationOwner?: string;
        };
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

  assert(preview.source === 'FDA', 'Preview output source must be FDA.', blockers);
  assert(typeof preview.totalFdaFoodRecords === 'number' && preview.totalFdaFoodRecords === 100, 'Preview output must report 100 FDA food records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.allergenCaseIncluded === true, 'Preview output must include an allergen case when present.', blockers);
  assert(preview.pathogenCaseIncluded === true, 'Preview output must include a pathogen case when present.', blockers);
  assert(preview.foreignMatterCaseIncluded === true, 'Preview output must include a foreign matter case when present.', blockers);
  assert(preview.classICaseIncluded === true, 'Preview output must include a Class I case when present.', blockers);
  assert(preview.classIICaseIncluded === true, 'Preview output must include a Class II case when present.', blockers);
  assert(preview.classIIICaseIncluded === true, 'Preview output must include a Class III case when present.', blockers);
  assert(preview.identifierCaseIncluded === true, 'Preview output must include at least one identifier-rich case.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'FDA', 'Every proposed input must keep FDA source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'United States', 'Every proposed input must keep United States market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceApi === 'openFDA food enforcement', 'Every proposed input must keep openFDA API hint.', blockers);
    assert(record.proposedInput?.sourceHints?.domainHint === 'food', 'Every proposed input must keep food domain hint.', blockers);
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
    totalFdaFoodRecords: preview.totalFdaFoodRecords,
    allergenCaseIncluded: preview.allergenCaseIncluded,
    pathogenCaseIncluded: preview.pathogenCaseIncluded,
    foreignMatterCaseIncluded: preview.foreignMatterCaseIncluded,
    labelingOrStorageCaseIncluded: preview.labelingOrStorageCaseIncluded,
    classICaseIncluded: preview.classICaseIncluded,
    classIICaseIncluded: preview.classIICaseIncluded,
    classIIICaseIncluded: preview.classIIICaseIncluded,
    identifierCaseIncluded: preview.identifierCaseIncluded,
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
    'scripts/preview-fda-food-classifier-input.ts',
    'scripts/audit-fda-food-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/fda-food-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-fda-food-classifier-input.ts') ? readText('scripts/preview-fda-food-classifier-input.ts') : '';
  const audit = exists('scripts/audit-fda-food-classifier-input-preview.ts') ? readText('scripts/audit-fda-food-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/fda-food-classifier-input-preview.md') ? readText('docs/fda-food-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:fda-food-classifier-input']?.includes('preview-fda-food-classifier-input.ts') ?? false, 'package.json is missing preview:fda-food-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:fda-food-classifier-input-preview']?.includes('audit-fda-food-classifier-input-preview.ts') ?? false, 'package.json is missing audit:fda-food-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildFdaFoodClassifierInputPreview'), 'Preview must include buildFdaFoodClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'FDA'"), 'Preview must include FDA source id.', blockers);
  assert(preview.includes("market: 'United States'"), 'Preview must include United States market hint.', blockers);
  assert(preview.includes("sourceApi: 'openFDA food enforcement'"), 'Preview must include openFDA API hint.', blockers);
  assert(preview.includes("domainHint: 'food'"), 'Preview must include food domain hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('FDA_FOOD_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support FDA_FOOD_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('sourceProductType') && preview.includes('sourceClassification') && preview.includes('sourceStatus'), 'Preview must include official FDA source fields.', blockers);
  assert(preview.includes('reasonText') && preview.includes('codeInfo') && preview.includes('distributionText'), 'Preview must include FDA reason, code, and distribution evidence.', blockers);
  assert(preview.includes('recallNumber') && preview.includes('eventId') && preview.includes('identifiers'), 'Preview must include FDA recall/event identifier evidence.', blockers);
  assert(preview.includes('allergen') && preview.includes('salmonella') && preview.includes('foreign') && preview.includes('class i'), 'Preview must include FDA sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('FDA food recall'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('fda-food-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('fda-food-noise-report.json') && preview.includes('fda-food-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeFdaFood'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/fda-food/'), 'Docs must document the FDA food output directory.', blockers);
  assert(docs.includes('sourceProductType') && docs.includes('sourceClassification') && docs.includes('sourceStatus'), 'Docs must explain FDA source fields.', blockers);
  assert(docs.includes('Product family, product type, hazard type, audience'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:fda-food-classifier-input'), 'Dry-run docs must mention preview:fda-food-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:fda-food-classifier-input'), 'Phase plan docs must mention preview:fda-food-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:fda-food-classifier-input'), 'scripts/README.md must document preview:fda-food-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/fda-food'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/fda-food');
  assert(committedOutputs.length === 0, `Generated FDA food preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
