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
    totalHongKongCfsRecords?: number;
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
  const previewPath = 'outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local Hong Kong CFS classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalHongKongCfsRecords?: number;
    allergenCaseIncluded?: boolean;
    contaminationCaseIncluded?: boolean;
    foreignMatterCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: {
        source?: string;
        sourceHints?: {
          market?: string;
          officialSource?: string;
          sourceApi?: string;
          domainHint?: string;
          expectedProductFamilyHint?: string;
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

  assert(preview.source === 'HK_CFS', 'Preview output source must be HK_CFS.', blockers);
  assert(typeof preview.totalHongKongCfsRecords === 'number' && preview.totalHongKongCfsRecords === 100, 'Preview output must report 100 Hong Kong CFS records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.allergenCaseIncluded === true, 'Preview output must include an allergen or undeclared allergen case when present.', blockers);
  assert(preview.contaminationCaseIncluded === true, 'Preview output must include a contamination case when present.', blockers);
  assert(preview.foreignMatterCaseIncluded === true, 'Preview output must include a foreign matter case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'HK_CFS', 'Every proposed input must keep Hong Kong CFS source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'Hong Kong', 'Every proposed input must keep Hong Kong market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.officialSource === 'Centre for Food Safety', 'Every proposed input must keep Hong Kong CFS official source hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceApi === 'Hong Kong CFS food alerts XML/detail pages', 'Every proposed input must keep Hong Kong CFS source access hint.', blockers);
    assert(record.proposedInput?.sourceHints?.domainHint === 'food', 'Every proposed input must keep food domain hint.', blockers);
    assert(record.proposedInput?.sourceHints?.expectedProductFamilyHint === 'food-grocery', 'Every proposed input must keep food-grocery expected family hint.', blockers);
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
    totalHongKongCfsRecords: preview.totalHongKongCfsRecords,
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
    'scripts/preview-hong-kong-cfs-classifier-input.ts',
    'scripts/audit-hong-kong-cfs-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/hong-kong-cfs-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-hong-kong-cfs-classifier-input.ts') ? readText('scripts/preview-hong-kong-cfs-classifier-input.ts') : '';
  const audit = exists('scripts/audit-hong-kong-cfs-classifier-input-preview.ts') ? readText('scripts/audit-hong-kong-cfs-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/hong-kong-cfs-classifier-input-preview.md') ? readText('docs/hong-kong-cfs-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:hong-kong-cfs-classifier-input']?.includes('preview-hong-kong-cfs-classifier-input.ts') ?? false, 'package.json is missing preview:hong-kong-cfs-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:hong-kong-cfs-classifier-input-preview']?.includes('audit-hong-kong-cfs-classifier-input-preview.ts') ?? false, 'package.json is missing audit:hong-kong-cfs-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildHongKongCfsClassifierInputPreview'), 'Preview must include buildHongKongCfsClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'HK_CFS'"), 'Preview must include Hong Kong CFS source id.', blockers);
  assert(preview.includes("market: 'Hong Kong'"), 'Preview must include Hong Kong market hint.', blockers);
  assert(preview.includes("officialSource: 'Centre for Food Safety'"), 'Preview must include Hong Kong CFS official source hint.', blockers);
  assert(preview.includes("sourceApi: 'Hong Kong CFS food alerts XML/detail pages'"), 'Preview must include Hong Kong CFS source access hint.', blockers);
  assert(preview.includes("domainHint: 'food'"), 'Preview must include Hong Kong food domain hint.', blockers);
  assert(preview.includes("expectedProductFamilyHint: 'food-grocery'"), 'Preview must include food-grocery expected family hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('HONG_KONG_CFS_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support HONG_KONG_CFS_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('productDescription') && preview.includes('riskText') && preview.includes('actionText'), 'Preview must include Hong Kong CFS product, risk, and action fields.', blockers);
  assert(preview.includes('origin') && preview.includes('importer') && preview.includes('retailer'), 'Preview must include origin/importer/retailer fields when useful.', blockers);
  assert(preview.includes('packSize') && preview.includes('batch') && preview.includes('bestBefore') && preview.includes('useBy'), 'Preview must include pack, batch, and date identifier fields.', blockers);
  assert(preview.includes('allergen') && preview.includes('undeclared') && preview.includes('salmonella'), 'Preview must include allergen and contamination sampling terms.', blockers);
  assert(preview.includes('foreign matter') && preview.includes('glass') && preview.includes('plastic'), 'Preview must include foreign matter sampling terms.', blockers);
  assert(preview.includes('importer') && preview.includes('retailer') && preview.includes('barcode'), 'Preview must include importer/retailer and identifier sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('importer/contact text dominates input'), 'Preview must flag importer/contact text domination.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official Centre for Food Safety notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('hong-kong-cfs-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('hong-kong-cfs-noise-report.json') && preview.includes('hong-kong-cfs-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeHongKongCfsRecords'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('data/processed/recalls.json'), 'Preview should use readProcessedRecalls instead of writing canonical data paths.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/hong-kong-cfs/'), 'Docs must document the Hong Kong CFS output directory.', blockers);
  assert(docs.includes('riskText') && docs.includes('importer') && docs.includes('retailer'), 'Docs must explain Hong Kong CFS source fields.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:hong-kong-cfs-classifier-input'), 'Dry-run docs must mention preview:hong-kong-cfs-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:hong-kong-cfs-classifier-input'), 'Phase plan docs must mention preview:hong-kong-cfs-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:hong-kong-cfs-classifier-input'), 'scripts/README.md must document preview:hong-kong-cfs-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/hong-kong-cfs'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/hong-kong-cfs');
  assert(committedOutputs.length === 0, `Generated Hong Kong CFS preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
