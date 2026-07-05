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
    totalRappelConsoRecords?: number;
    foodCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    babyKidsCaseIncluded?: boolean;
    electronicsCaseIncluded?: boolean;
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
  const previewPath = 'outputs/llm-classifier/input-preview/rappelconso/rappelconso-input-preview.json';
  const comparisonPath = 'outputs/llm-classifier/input-preview/rappelconso/rappelconso-token-comparison.json';
  const noisePath = 'outputs/llm-classifier/input-preview/rappelconso/rappelconso-noise-report.json';

  if (!exists(previewPath)) {
    warnings.push('No local RappelConso classifier input preview output found yet.');
    return undefined;
  }

  const preview = JSON.parse(readText(previewPath)) as {
    source?: string;
    sampleCount?: number;
    totalRappelConsoRecords?: number;
    foodCaseIncluded?: boolean;
    vehicleCaseIncluded?: boolean;
    babyKidsCaseIncluded?: boolean;
    electronicsCaseIncluded?: boolean;
    identifierCaseIncluded?: boolean;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: {
        source?: string;
        sourceLanguage?: string;
        sourceHints?: {
          market?: string;
          sourceLanguage?: string;
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

  assert(preview.source === 'FR_RAPPELCONSO', 'Preview output source must be FR_RAPPELCONSO.', blockers);
  assert(typeof preview.totalRappelConsoRecords === 'number' && preview.totalRappelConsoRecords === 100, 'Preview output must report 100 RappelConso records.', blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, 'Preview output must include a positive sample count.', blockers);
  assert(preview.foodCaseIncluded === true, 'Preview output must include a food/RappelConso alimentation case when present.', blockers);
  assert(preview.vehicleCaseIncluded === true, 'Preview output must include a vehicle/mobility case when present.', blockers);
  assert(preview.identifierCaseIncluded === true, 'Preview output must include at least one identifier-rich case.', blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, 'Preview output records length must match sampleCount.', blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), 'Every preview record must include genericInput.', blockers);
    assert(Boolean(record.proposedInput), 'Every preview record must include proposedInput.', blockers);
    assert(record.proposedInput?.source === 'FR_RAPPELCONSO', 'Every proposed input must keep RappelConso source.', blockers);
    assert(record.proposedInput?.sourceLanguage === 'fr', 'Every proposed input must keep French sourceLanguage.', blockers);
    assert(record.proposedInput?.sourceHints?.market === 'France', 'Every proposed input must keep France market hint.', blockers);
    assert(record.proposedInput?.sourceHints?.sourceLanguage === 'fr', 'Every proposed input must keep French language hint.', blockers);
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
    totalRappelConsoRecords: preview.totalRappelConsoRecords,
    foodCaseIncluded: preview.foodCaseIncluded,
    vehicleCaseIncluded: preview.vehicleCaseIncluded,
    babyKidsCaseIncluded: preview.babyKidsCaseIncluded,
    electronicsCaseIncluded: preview.electronicsCaseIncluded,
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
    'scripts/preview-rappelconso-classifier-input.ts',
    'scripts/audit-rappelconso-classifier-input-preview.ts',
    'scripts/build-recall-classifier-input.ts',
    'docs/rappelconso-classifier-input-preview.md',
    'docs/llm-recall-classifier-dry-run.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'scripts/README.md',
    'package.json',
    '.gitignore'
  ];

  for (const file of checkedFiles) {
    assert(exists(file), `${file} is missing.`, blockers);
  }

  const preview = exists('scripts/preview-rappelconso-classifier-input.ts') ? readText('scripts/preview-rappelconso-classifier-input.ts') : '';
  const audit = exists('scripts/audit-rappelconso-classifier-input-preview.ts') ? readText('scripts/audit-rappelconso-classifier-input-preview.ts') : '';
  const packageJson = exists('package.json') ? JSON.parse(readText('package.json')) as { scripts?: Record<string, string> } : { scripts: {} };
  const gitignore = exists('.gitignore') ? readText('.gitignore') : '';
  const docs = exists('docs/rappelconso-classifier-input-preview.md') ? readText('docs/rappelconso-classifier-input-preview.md') : '';
  const dryRunDocs = exists('docs/llm-recall-classifier-dry-run.md') ? readText('docs/llm-recall-classifier-dry-run.md') : '';
  const phasePlanDocs = exists('docs/phase-44-per-source-llm-classification-plan.md') ? readText('docs/phase-44-per-source-llm-classification-plan.md') : '';
  const scriptsReadme = exists('scripts/README.md') ? readText('scripts/README.md') : '';

  assert(packageJson.scripts?.['preview:rappelconso-classifier-input']?.includes('preview-rappelconso-classifier-input.ts') ?? false, 'package.json is missing preview:rappelconso-classifier-input.', blockers);
  assert(packageJson.scripts?.['audit:rappelconso-classifier-input-preview']?.includes('audit-rappelconso-classifier-input-preview.ts') ?? false, 'package.json is missing audit:rappelconso-classifier-input-preview.', blockers);
  assert(gitignore.includes('outputs/llm-classifier/'), '.gitignore must ignore outputs/llm-classifier/.', blockers);

  assert(preview.includes('buildRecallClassifierInput'), 'Preview must build the current generic classifier input.', blockers);
  assert(preview.includes('buildRappelConsoClassifierInputPreview'), 'Preview must include buildRappelConsoClassifierInputPreview.', blockers);
  assert(preview.includes("source: 'FR_RAPPELCONSO'"), 'Preview must include RappelConso source id.', blockers);
  assert(preview.includes("market: 'France'"), 'Preview must include France market hint.', blockers);
  assert(preview.includes("sourceLanguage: 'fr'"), 'Preview must include French source language.', blockers);
  assert(preview.includes("classificationOwner: 'llm'"), 'Preview must mark final classification owner as LLM.', blockers);
  assert(preview.includes('RAPPELCONSO_CLASSIFIER_INPUT_PREVIEW_LIMIT'), 'Preview must support RAPPELCONSO_CLASSIFIER_INPUT_PREVIEW_LIMIT.', blockers);
  assert(preview.includes('sourceCategory') && preview.includes('sourceSubcategory') && preview.includes('sourceRecallNature'), 'Preview must include official RappelConso source fields.', blockers);
  assert(preview.includes('riskText') && preview.includes('reasonText') && preview.includes('actionText'), 'Preview must include RappelConso risk/reason/action evidence.', blockers);
  assert(preview.includes('productIdentificationText') && preview.includes('identifiers'), 'Preview must include RappelConso product identification evidence.', blockers);
  assert(preview.includes('alimentation') && preview.includes('automobiles') && preview.includes('bebes') && preview.includes('appareils electriques'), 'Preview must include RappelConso sampling terms.', blockers);
  assert(preview.includes('genericEstimatedTokens') && preview.includes('proposedEstimatedTokens'), 'Preview must compare generic vs proposed token estimates.', blockers);
  assert(preview.includes('raw HTML leakage') || preview.includes('hasHtmlLeakage'), 'Preview must check raw HTML leakage.', blockers);
  assert(preview.includes('fallbackStrings') && preview.includes('Reason not listed'), 'Preview must exclude obvious generated fallback strings.', blockers);
  assert(preview.includes('rappelconso-input-preview.md'), 'Preview must write a markdown report.', blockers);
  assert(preview.includes('rappelconso-noise-report.json') && preview.includes('rappelconso-token-comparison.json'), 'Preview must write noise and token comparison outputs.', blockers);
  assert(!preview.includes('classifyWithProvider'), 'Preview must not call the LLM provider.', blockers);
  assert(!preview.includes('GEMINI_API_KEY') && !preview.includes('OPENAI_API_KEY'), 'Preview must not read LLM API keys.', blockers);
  assert(!/\bfetch\s*\(/.test(preview), 'Preview must not call network fetch.', blockers);
  assert(!preview.includes('mergeProcessedRecalls'), 'Preview must not merge canonical data.', blockers);
  assert(!preview.includes('writeNormalized') && !preview.includes('normalizeRappelConso'), 'Preview must not normalize or write source data.', blockers);
  assert(!preview.includes('productFamily:') && !preview.includes('productType:') && !preview.includes('hazardType:') && !preview.includes('audience:'), 'Preview must not fill final taxonomy fields.', blockers);

  assert(docs.includes('outputs/llm-classifier/input-preview/rappelconso/'), 'Docs must document the RappelConso output directory.', blockers);
  assert(docs.includes('sourceCategory') && docs.includes('sourceSubcategory') && docs.includes('sourceRecallNature'), 'Docs must explain RappelConso source fields.', blockers);
  assert(docs.includes('Product family, product type, hazard type, audience'), 'Docs must say final taxonomy is not parser-owned.', blockers);
  assert(docs.includes('Do not commit'), 'Docs must say generated preview outputs are not committed.', blockers);
  assert(dryRunDocs.includes('preview:rappelconso-classifier-input'), 'Dry-run docs must mention preview:rappelconso-classifier-input.', blockers);
  assert(phasePlanDocs.includes('preview:rappelconso-classifier-input'), 'Phase plan docs must mention preview:rappelconso-classifier-input.', blockers);
  assert(scriptsReadme.includes('preview:rappelconso-classifier-input'), 'scripts/README.md must document preview:rappelconso-classifier-input.', blockers);
  assert(audit.includes('gitLsFiles') && audit.includes('outputs/llm-classifier/input-preview/rappelconso'), 'Audit must check committed generated outputs.', blockers);

  const committedOutputs = gitLsFiles('outputs/llm-classifier/input-preview/rappelconso');
  assert(committedOutputs.length === 0, `Generated RappelConso preview outputs must not be committed: ${committedOutputs.join(', ')}`, blockers);

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
