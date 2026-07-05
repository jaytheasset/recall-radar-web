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
    totalUkFsaRecords?: number;
    allergyAlertCaseIncluded?: boolean;
    productRecallInformationNoticeCaseIncluded?: boolean;
    foodAlertForActionCaseIncluded?: boolean;
    allergenCaseIncluded?: boolean;
    pathogenCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    batchOrDateCaseIncluded?: boolean;
    productDetailCaseIncluded?: boolean;
    relatedMediaCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/uk-fsa/uk-fsa-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/uk-fsa/uk-fsa-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/uk-fsa/uk-fsa-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local UK FSA classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalUkFsaRecords?: number;
    allergyAlertCaseIncluded?: boolean;
    productRecallInformationNoticeCaseIncluded?: boolean;
    foodAlertForActionCaseIncluded?: boolean;
    allergenCaseIncluded?: boolean;
    pathogenCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    batchOrDateCaseIncluded?: boolean;
    productDetailCaseIncluded?: boolean;
    relatedMediaCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: {
        source?: string;
        sourceHints?: {
          market?: string;
          officialSource?: string;
          sourceApi?: string;
          domainHint?: string;
          classificationOwner?: string;
        };
        sourceAlertType?: string;
        productDetails?: unknown[];
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

  assert(preview.source === 'UK_FSA', 'Preview output source must be UK_FSA.', blockers);
  assert(typeof preview.totalUkFsaRecords === 'number' && preview.totalUkFsaRecords === 100, 'Preview output must report 100 UK FSA records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.allergyAlertCaseIncluded === true, 'Preview output must include an Allergy Alert case when present.', blockers);
  assert(preview.productRecallInformationNoticeCaseIncluded === true, 'Preview output must include a Product Recall Information Notice case when present.', blockers);
  assert(preview.foodAlertForActionCaseIncluded === true, 'Preview output must include a Food Alert For Action case when present.', blockers);
  assert(preview.allergenCaseIncluded === true, 'Preview output must include an allergen case when present.', blockers);
  assert(preview.pathogenCaseIncluded === true, 'Preview output must include a pathogen case when present.', blockers);
  assert(preview.batchOrDateCaseIncluded === true, 'Preview output must include batch/date evidence when present.', blockers);
  assert(preview.productDetailCaseIncluded === true, 'Preview output must include product detail rows when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'UK_FSA', 'Every proposed input must keep UK_FSA source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'United Kingdom', 'Every proposed input must keep United Kingdom market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.officialSource === 'FSA Food Alerts', 'Every proposed input must keep official FSA source hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceApi === 'UK FSA Food Alerts linked-data API', 'Every proposed input must keep UK FSA API hint.', blockers);
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
    totalUkFsaRecords: preview.totalUkFsaRecords,
    allergyAlertCaseIncluded: preview.allergyAlertCaseIncluded,
    productRecallInformationNoticeCaseIncluded: preview.productRecallInformationNoticeCaseIncluded,
    foodAlertForActionCaseIncluded: preview.foodAlertForActionCaseIncluded,
    allergenCaseIncluded: preview.allergenCaseIncluded,
    pathogenCaseIncluded: preview.pathogenCaseIncluded,
    foreignMatterCaseIncluded: preview.foreignMatterCaseIncluded,
    batchOrDateCaseIncluded: preview.batchOrDateCaseIncluded,
    productDetailCaseIncluded: preview.productDetailCaseIncluded,
    relatedMediaCaseIncluded: preview.relatedMediaCaseIncluded,
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
    'scripts/preview-uk-fsa-classifier-input.ts',
    'scripts/audit-uk-fsa-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/uk-fsa-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-uk-fsa-classifier-input.ts') ? readText('scripts/preview-uk-fsa-classifier-input.ts') : '';
  const audit = exists('scripts/audit-uk-fsa-classifier-input-preview.ts') ? readText('scripts/audit-uk-fsa-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/uk-fsa-classifier-input-preview.md') ? readText('docs/uk-fsa-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:uk-fsa-classifier-input']?.includes('preview-uk-fsa-classifier-input.ts') ?? false, 'package.json is missing preview:uk-fsa-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:uk-fsa-classifier-input-preview']?.includes('audit-uk-fsa-classifier-input-preview.ts') ?? false, 'package.json is missing audit:uk-fsa-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildUkFsaClassifierInputPreview'), 'Preview must include buildUkFsaClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'UK_FSA'"), 'Preview must include UK_FSA source id.', blockers);
  assert(preview.includes("market: 'United Kingdom'"), 'Preview must include United Kingdom market hint.', blockers);
  assert(preview.includes("officialSource: 'FSA Food Alerts'"), 'Preview must include FSA official source hint.', blockers);
  assert(preview.includes("sourceApi: 'UK FSA Food Alerts linked-data API'"), 'Preview must include UK FSA linked-data API hint.', blockers);
  assert(preview.includes("domainHint: 'food'"), 'Preview must include food domain hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('UK_FSA_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support UK_FSA_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('sourceAlertType') && preview.includes('sourceStatus') && preview.includes('alertNotation'), 'Preview must include official UK FSA source fields.', blockers);
  assert(preview.includes('productDetails') && preview.includes('batchOrDateDetails') && preview.includes('packSize'), 'Preview must include UK FSA product detail evidence.', blockers);
  assert(preview.includes('allergenRiskLabels') && preview.includes('pathogenRiskLabels') && preview.includes('hazardCategoryLabels'), 'Preview must include UK FSA risk-label evidence.', blockers);
  assert(preview.includes('Food Alert For Action') && preview.includes('Allergy Alert') && preview.includes('Product Recall Information Notice'), 'Preview must include UK FSA alert-type sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official FSA notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('uk-fsa-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('uk-fsa-noise-report.json') && preview.includes('uk-fsa-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeUkFsa'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/uk-fsa/'), 'Docs must document the UK FSA output directory.', blockers);
  assert(docs.includes('sourceAlertType') && docs.includes('productDetails') && docs.includes('problemText'), 'Docs must explain UK FSA source fields.', blockers);
  assert(docs.includes('Product family, product type, hazard type, audience'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:uk-fsa-classifier-input'), 'Dry-run docs must mention preview:uk-fsa-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:uk-fsa-classifier-input'), 'Phase plan docs must mention preview:uk-fsa-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:uk-fsa-classifier-input'), 'scripts/README.md must document preview:uk-fsa-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/uk-fsa'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/uk-fsa');
  assert(committedOutputs.length === 0, `Generated UK FSA preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
