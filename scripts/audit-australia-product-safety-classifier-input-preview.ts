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
    totalAustraliaProductSafetyRecords?: number;
    babyKidsCaseIncluded?: boolean;
    electronicsBatteryCaseIncluded?: boolean;
    householdCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    toolsMachineryCaseIncluded?: boolean;
    chemicalsCaseIncluded?: boolean;
    identifierCaseIncluded?: boolean;
    imageBackedCaseIncluded?: boolean;
    marketplaceCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/australia-product-safety/australia-product-safety-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/australia-product-safety/australia-product-safety-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/australia-product-safety/australia-product-safety-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local Australia Product Safety classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalAustraliaProductSafetyRecords?: number;
    babyKidsCaseIncluded?: boolean;
    electronicsBatteryCaseIncluded?: boolean;
    householdCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    toolsMachineryCaseIncluded?: boolean;
    chemicalsCaseIncluded?: boolean;
    identifierCaseIncluded?: boolean;
    imageBackedCaseIncluded?: boolean;
    marketplaceCaseIncluded?: boolean;
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

  assert(preview.source === 'AU_PRODUCT_SAFETY', 'Preview output source must be AU_PRODUCT_SAFETY.', blockers);
  assert(typeof preview.totalAustraliaProductSafetyRecords === 'number' && preview.totalAustraliaProductSafetyRecords === 100, 'Preview output must report 100 Australia Product Safety records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.babyKidsCaseIncluded === true, 'Preview output must include a baby/kids or toy case when present.', blockers);
  assert(preview.electronicsBatteryCaseIncluded === true, 'Preview output must include an electronics/battery case when present.', blockers);
  assert(preview.householdCaseIncluded === true, 'Preview output must include a household case when present.', blockers);
  assert(preview.vehicleCaseIncluded === true, 'Preview output must include a vehicle/accessory case when present.', blockers);
  assert(preview.identifierCaseIncluded === true, 'Preview output must include identifier evidence when present.', blockers);
  assert(preview.imageBackedCaseIncluded === true, 'Preview output must include an image-backed case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'AU_PRODUCT_SAFETY', 'Every proposed input must keep AU_PRODUCT_SAFETY source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'Australia', 'Every proposed input must keep Australia market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.officialSource === 'Product Safety Australia', 'Every proposed input must keep Product Safety Australia official source hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceApi === 'Product Safety Australia recalls listing/detail pages', 'Every proposed input must keep Australia source access hint.', blockers);
    assert(record.proposedInput?.sourceHints?.domainHint === 'consumer-product', 'Every proposed input must keep consumer-product domain hint.', blockers);
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
    totalAustraliaProductSafetyRecords: preview.totalAustraliaProductSafetyRecords,
    babyKidsCaseIncluded: preview.babyKidsCaseIncluded,
    electronicsBatteryCaseIncluded: preview.electronicsBatteryCaseIncluded,
    householdCaseIncluded: preview.householdCaseIncluded,
    vehicleCaseIncluded: preview.vehicleCaseIncluded,
    toolsMachineryCaseIncluded: preview.toolsMachineryCaseIncluded,
    chemicalsCaseIncluded: preview.chemicalsCaseIncluded,
    identifierCaseIncluded: preview.identifierCaseIncluded,
    imageBackedCaseIncluded: preview.imageBackedCaseIncluded,
    marketplaceCaseIncluded: preview.marketplaceCaseIncluded,
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
    'scripts/preview-australia-product-safety-classifier-input.ts',
    'scripts/audit-australia-product-safety-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/australia-product-safety-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-australia-product-safety-classifier-input.ts') ? readText('scripts/preview-australia-product-safety-classifier-input.ts') : '';
  const audit = exists('scripts/audit-australia-product-safety-classifier-input-preview.ts') ? readText('scripts/audit-australia-product-safety-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/australia-product-safety-classifier-input-preview.md') ? readText('docs/australia-product-safety-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:australia-product-safety-classifier-input']?.includes('preview-australia-product-safety-classifier-input.ts') ?? false, 'package.json is missing preview:australia-product-safety-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:australia-product-safety-classifier-input-preview']?.includes('audit-australia-product-safety-classifier-input-preview.ts') ?? false, 'package.json is missing audit:australia-product-safety-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildAustraliaProductSafetyClassifierInputPreview'), 'Preview must include buildAustraliaProductSafetyClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'AU_PRODUCT_SAFETY'"), 'Preview must include AU_PRODUCT_SAFETY source id.', blockers);
  assert(preview.includes("market: 'Australia'"), 'Preview must include Australia market hint.', blockers);
  assert(preview.includes("officialSource: 'Product Safety Australia'"), 'Preview must include Product Safety Australia official source hint.', blockers);
  assert(preview.includes("sourceApi: 'Product Safety Australia recalls listing/detail pages'"), 'Preview must include Australia source access hint.', blockers);
  assert(preview.includes("domainHint: 'consumer-product'"), 'Preview must include consumer-product domain hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('AUSTRALIA_PRODUCT_SAFETY_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support AUSTRALIA_PRODUCT_SAFETY_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('sourceCategories') && preview.includes('sourcePrimaryCategory'), 'Preview must include Australia source category fields.', blockers);
  assert(preview.includes('productDescription') && preview.includes('supplierName') && preview.includes('brandText'), 'Preview must include Australia product, supplier, and brand fields.', blockers);
  assert(preview.includes('defectText') && preview.includes('hazardText') && preview.includes('actionText'), 'Preview must include Australia defect, hazard, and action fields.', blockers);
  assert(preview.includes('traderText') && preview.includes('saleDateText') && preview.includes('soldWhereText'), 'Preview must include sale/distribution evidence.', blockers);
  assert(preview.includes('manufacturerCountry') && preview.includes('identifiers'), 'Preview must include manufacturer country and identifier evidence.', blockers);
  assert(preview.includes('baby') && preview.includes('button battery') && preview.includes('vehicle'), 'Preview must include baby/button-battery/vehicle sampling terms.', blockers);
  assert(preview.includes('model') && preview.includes('sku') && preview.includes('batch') && preview.includes('barcode'), 'Preview must include identifier sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official Product Safety Australia notice'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('australia-product-safety-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('australia-product-safety-noise-report.json') && preview.includes('australia-product-safety-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeAustraliaProductSafety'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/australia-product-safety/'), 'Docs must document the Australia Product Safety output directory.', blockers);
  assert(docs.includes('defectText') && docs.includes('hazardText') && docs.includes('actionText'), 'Docs must explain Australia source fields.', blockers);
  assert(docs.includes('Final public taxonomy values remain LLM-owned'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:australia-product-safety-classifier-input'), 'Dry-run docs must mention preview:australia-product-safety-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:australia-product-safety-classifier-input'), 'Phase plan docs must mention preview:australia-product-safety-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:australia-product-safety-classifier-input'), 'scripts/README.md must document preview:australia-product-safety-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/australia-product-safety'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/australia-product-safety');
  assert(committedOutputs.length === 0, `Generated Australia Product Safety preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
