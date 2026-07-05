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
    totalEuSafetyGateRecords?: number;
    toyCaseIncluded?: boolean;
    electronicsCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    childcareCaseIncluded?: boolean;
    chemicalOrCosmeticCaseIncluded?: boolean;
    barcodeCaseIncluded?: boolean;
    modelCaseIncluded?: boolean;
    onlineSaleCaseIncluded?: boolean;
    imageBackedCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/eu-safety-gate/eu-safety-gate-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/eu-safety-gate/eu-safety-gate-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/eu-safety-gate/eu-safety-gate-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local EU Safety Gate classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalEuSafetyGateRecords?: number;
    toyCaseIncluded?: boolean;
    electronicsCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    childcareCaseIncluded?: boolean;
    chemicalOrCosmeticCaseIncluded?: boolean;
    barcodeCaseIncluded?: boolean;
    modelCaseIncluded?: boolean;
    onlineSaleCaseIncluded?: boolean;
    imageBackedCaseIncluded?: boolean;
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

  assert(preview.source === 'EU_SAFETY_GATE', 'Preview output source must be EU_SAFETY_GATE.', blockers);
  assert(typeof preview.totalEuSafetyGateRecords === 'number' && preview.totalEuSafetyGateRecords === 100, 'Preview output must report 100 EU Safety Gate records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.toyCaseIncluded === true, 'Preview output must include a toy case when present.', blockers);
  assert(preview.electronicsCaseIncluded === true, 'Preview output must include an electronics/electrical case when present.', blockers);
  assert(preview.vehicleCaseIncluded === true, 'Preview output must include a vehicle or machinery case when present.', blockers);
  assert(preview.chemicalOrCosmeticCaseIncluded === true, 'Preview output must include a chemical/cosmetic case when present.', blockers);
  assert(preview.barcodeCaseIncluded === true, 'Preview output must include barcode evidence when present.', blockers);
  assert(preview.modelCaseIncluded === true, 'Preview output must include model/type evidence when present.', blockers);
  assert(preview.onlineSaleCaseIncluded === true, 'Preview output must include online sale evidence when present.', blockers);
  assert(preview.imageBackedCaseIncluded === true, 'Preview output must include an image-backed case when present.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'EU_SAFETY_GATE', 'Every proposed input must keep EU_SAFETY_GATE source.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'European Union', 'Every proposed input must keep European Union market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.officialSource === 'Safety Gate', 'Every proposed input must keep Safety Gate official source hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceApi === 'EU Safety Gate notification API', 'Every proposed input must keep EU Safety Gate API hint.', blockers);
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
    totalEuSafetyGateRecords: preview.totalEuSafetyGateRecords,
    toyCaseIncluded: preview.toyCaseIncluded,
    electronicsCaseIncluded: preview.electronicsCaseIncluded,
    vehicleCaseIncluded: preview.vehicleCaseIncluded,
    childcareCaseIncluded: preview.childcareCaseIncluded,
    chemicalOrCosmeticCaseIncluded: preview.chemicalOrCosmeticCaseIncluded,
    barcodeCaseIncluded: preview.barcodeCaseIncluded,
    modelCaseIncluded: preview.modelCaseIncluded,
    onlineSaleCaseIncluded: preview.onlineSaleCaseIncluded,
    imageBackedCaseIncluded: preview.imageBackedCaseIncluded,
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
    'scripts/preview-eu-safety-gate-classifier-input.ts',
    'scripts/audit-eu-safety-gate-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/eu-safety-gate-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-eu-safety-gate-classifier-input.ts') ? readText('scripts/preview-eu-safety-gate-classifier-input.ts') : '';
  const audit = exists('scripts/audit-eu-safety-gate-classifier-input-preview.ts') ? readText('scripts/audit-eu-safety-gate-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/eu-safety-gate-classifier-input-preview.md') ? readText('docs/eu-safety-gate-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:eu-safety-gate-classifier-input']?.includes('preview-eu-safety-gate-classifier-input.ts') ?? false, 'package.json is missing preview:eu-safety-gate-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:eu-safety-gate-classifier-input-preview']?.includes('audit-eu-safety-gate-classifier-input-preview.ts') ?? false, 'package.json is missing audit:eu-safety-gate-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildEuSafetyGateClassifierInputPreview'), 'Preview must include buildEuSafetyGateClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'EU_SAFETY_GATE'"), 'Preview must include EU_SAFETY_GATE source id.', blockers);
  assert(preview.includes("market: 'European Union'"), 'Preview must include European Union market hint.', blockers);
  assert(preview.includes("officialSource: 'Safety Gate'"), 'Preview must include Safety Gate official source hint.', blockers);
  assert(preview.includes("sourceApi: 'EU Safety Gate notification API'"), 'Preview must include EU Safety Gate API hint.', blockers);
  assert(preview.includes("domainHint: 'consumer-product'"), 'Preview must include consumer-product domain hint.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('EU_SAFETY_GATE_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support EU_SAFETY_GATE_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('sourceProductCategory') && preview.includes('notificationType'), 'Preview must include official Safety Gate source category/type fields.', blockers);
  assert(preview.includes('notifyingCountry') && preview.includes('countryOfOrigin') && preview.includes('countriesConcerned'), 'Preview must include country evidence.', blockers);
  assert(preview.includes('riskTypes') && preview.includes('riskDescription') && preview.includes('legalProvision'), 'Preview must include Safety Gate risk evidence.', blockers);
  assert(preview.includes('measures') && preview.includes('soldOnline') && preview.includes('identifiers'), 'Preview must include measure, online sale, and identifier evidence.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Review the official Safety Gate alert'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('eu-safety-gate-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('eu-safety-gate-noise-report.json') && preview.includes('eu-safety-gate-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeEuSafetyGate'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/eu-safety-gate/'), 'Docs must document the EU Safety Gate output directory.', blockers);
  assert(docs.includes('sourceProductCategory') && docs.includes('riskTypes') && docs.includes('measures'), 'Docs must explain EU Safety Gate source fields.', blockers);
  assert(docs.includes('Product family, product type, hazard type, audience'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:eu-safety-gate-classifier-input'), 'Dry-run docs must mention preview:eu-safety-gate-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:eu-safety-gate-classifier-input'), 'Phase plan docs must mention preview:eu-safety-gate-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:eu-safety-gate-classifier-input'), 'scripts/README.md must document preview:eu-safety-gate-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/eu-safety-gate'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/eu-safety-gate');
  assert(committedOutputs.length === 0, `Generated EU Safety Gate preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
