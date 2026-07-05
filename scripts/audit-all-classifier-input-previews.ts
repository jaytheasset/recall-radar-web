// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const finalTaxonomyKeys = ['productFamily', 'productType', 'hazardType', 'audience'] as const;

const sourceConfigs = [
  {
    source: 'CPSC',
    countField: 'totalCpscRecords',
    expectedCount: 301,
    previewCommand: 'preview:cpsc-classifier-input',
    auditCommand: 'audit:cpsc-classifier-input-preview',
    previewScript: 'scripts/preview-cpsc-classifier-input.ts',
    auditScript: 'scripts/audit-cpsc-classifier-input-preview.ts',
    doc: 'docs/cpsc-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/cpsc',
    outputJson: 'outputs/llm-classifier/input-preview/cpsc/cpsc-input-preview.json'
  },
  {
    source: 'FDA',
    countField: 'totalFdaFoodRecords',
    expectedCount: 100,
    previewCommand: 'preview:fda-food-classifier-input',
    auditCommand: 'audit:fda-food-classifier-input-preview',
    previewScript: 'scripts/preview-fda-food-classifier-input.ts',
    auditScript: 'scripts/audit-fda-food-classifier-input-preview.ts',
    doc: 'docs/fda-food-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/fda-food',
    outputJson: 'outputs/llm-classifier/input-preview/fda-food/fda-food-input-preview.json'
  },
  {
    source: 'FR_RAPPELCONSO',
    countField: 'totalRappelConsoRecords',
    expectedCount: 100,
    previewCommand: 'preview:rappelconso-classifier-input',
    auditCommand: 'audit:rappelconso-classifier-input-preview',
    previewScript: 'scripts/preview-rappelconso-classifier-input.ts',
    auditScript: 'scripts/audit-rappelconso-classifier-input-preview.ts',
    doc: 'docs/rappelconso-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/rappelconso',
    outputJson: 'outputs/llm-classifier/input-preview/rappelconso/rappelconso-input-preview.json'
  },
  {
    source: 'CA_RECALLS',
    countField: 'totalCanadaRecords',
    expectedCount: 100,
    previewCommand: 'preview:canada-classifier-input',
    auditCommand: 'audit:canada-classifier-input-preview',
    previewScript: 'scripts/preview-canada-classifier-input.ts',
    auditScript: 'scripts/audit-canada-classifier-input-preview.ts',
    doc: 'docs/canada-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/canada',
    outputJson: 'outputs/llm-classifier/input-preview/canada/canada-input-preview.json'
  },
  {
    source: 'EU_SAFETY_GATE',
    countField: 'totalEuSafetyGateRecords',
    expectedCount: 100,
    previewCommand: 'preview:eu-safety-gate-classifier-input',
    auditCommand: 'audit:eu-safety-gate-classifier-input-preview',
    previewScript: 'scripts/preview-eu-safety-gate-classifier-input.ts',
    auditScript: 'scripts/audit-eu-safety-gate-classifier-input-preview.ts',
    doc: 'docs/eu-safety-gate-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/eu-safety-gate',
    outputJson: 'outputs/llm-classifier/input-preview/eu-safety-gate/eu-safety-gate-input-preview.json'
  },
  {
    source: 'UK_FSA',
    countField: 'totalUkFsaRecords',
    expectedCount: 100,
    previewCommand: 'preview:uk-fsa-classifier-input',
    auditCommand: 'audit:uk-fsa-classifier-input-preview',
    previewScript: 'scripts/preview-uk-fsa-classifier-input.ts',
    auditScript: 'scripts/audit-uk-fsa-classifier-input-preview.ts',
    doc: 'docs/uk-fsa-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/uk-fsa',
    outputJson: 'outputs/llm-classifier/input-preview/uk-fsa/uk-fsa-input-preview.json'
  },
  {
    source: 'AU_PRODUCT_SAFETY',
    countField: 'totalAustraliaProductSafetyRecords',
    expectedCount: 100,
    previewCommand: 'preview:australia-product-safety-classifier-input',
    auditCommand: 'audit:australia-product-safety-classifier-input-preview',
    previewScript: 'scripts/preview-australia-product-safety-classifier-input.ts',
    auditScript: 'scripts/audit-australia-product-safety-classifier-input-preview.ts',
    doc: 'docs/australia-product-safety-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/australia-product-safety',
    outputJson: 'outputs/llm-classifier/input-preview/australia-product-safety/australia-product-safety-input-preview.json'
  },
  {
    source: 'NZ_PRODUCT_SAFETY',
    countField: 'totalNewZealandRecords',
    expectedCount: 100,
    previewCommand: 'preview:new-zealand-classifier-input',
    auditCommand: 'audit:new-zealand-classifier-input-preview',
    previewScript: 'scripts/preview-new-zealand-classifier-input.ts',
    auditScript: 'scripts/audit-new-zealand-classifier-input-preview.ts',
    doc: 'docs/new-zealand-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/new-zealand',
    outputJson: 'outputs/llm-classifier/input-preview/new-zealand/new-zealand-input-preview.json'
  },
  {
    source: 'HK_CFS',
    countField: 'totalHongKongCfsRecords',
    expectedCount: 100,
    previewCommand: 'preview:hong-kong-cfs-classifier-input',
    auditCommand: 'audit:hong-kong-cfs-classifier-input-preview',
    previewScript: 'scripts/preview-hong-kong-cfs-classifier-input.ts',
    auditScript: 'scripts/audit-hong-kong-cfs-classifier-input-preview.ts',
    doc: 'docs/hong-kong-cfs-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/hong-kong-cfs',
    outputJson: 'outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-input-preview.json'
  },
  {
    source: 'FSANZ_FOOD_RECALLS',
    countField: 'totalFsanzRecords',
    expectedCount: 100,
    previewCommand: 'preview:fsanz-classifier-input',
    auditCommand: 'audit:fsanz-classifier-input-preview',
    previewScript: 'scripts/preview-fsanz-classifier-input.ts',
    auditScript: 'scripts/audit-fsanz-classifier-input-preview.ts',
    doc: 'docs/fsanz-classifier-input-preview.md',
    outputDir: 'outputs/llm-classifier/input-preview/fsanz',
    outputJson: 'outputs/llm-classifier/input-preview/fsanz/fsanz-input-preview.json'
  }
] as const;

function pathFor(relativePath: string): string {
  return resolve(projectRoot, relativePath);
}

function exists(relativePath: string): boolean {
  return existsSync(pathFor(relativePath));
}

function readText(relativePath: string): string {
  return readFileSync(pathFor(relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readText(relativePath));
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function gitOutput(args: string[]): string[] {
  const output = execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function runNodeScript(command: string, script: string): { command: string; passed: boolean; output: string } {
  try {
    const output = execFileSync(process.execPath, ['--experimental-strip-types', script], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { command, passed: true, output };
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      command,
      passed: false,
      output: [
        failure.stdout?.toString('utf8') ?? '',
        failure.stderr?.toString('utf8') ?? '',
        failure.message ?? ''
      ].join('\n').trim()
    };
  }
}

function packageScripts(): Record<string, string> {
  const packageJson = readJson('package.json') as { scripts?: Record<string, string> };
  return packageJson.scripts ?? {};
}

function canonicalCounts(): Record<string, number> {
  const canonical = readJson('data/processed/recalls.json') as { records?: Array<{ source?: string }> };
  const counts: Record<string, number> = {};
  for (const record of canonical.records ?? []) {
    if (record.source) {
      counts[record.source] = (counts[record.source] ?? 0) + 1;
    }
  }
  counts.total = canonical.records?.length ?? 0;
  return counts;
}

function auditPreviewScript(config: typeof sourceConfigs[number], scripts: Record<string, string>, blockers: string[]): void {
  assert(Boolean(scripts[config.previewCommand]), `package.json missing ${config.previewCommand}.`, blockers);
  assert(Boolean(scripts[config.auditCommand]), `package.json missing ${config.auditCommand}.`, blockers);
  assert(exists(config.previewScript), `${config.previewScript} is missing.`, blockers);
  assert(exists(config.auditScript), `${config.auditScript} is missing.`, blockers);
  assert(exists(config.doc), `${config.doc} is missing.`, blockers);

  const previewText = exists(config.previewScript) ? readText(config.previewScript) : '';
  assert(previewText.includes('buildRecallClassifierInput'), `${config.previewScript} must compare against generic input.`, blockers);
  assert(previewText.includes("classificationOwner: 'llm'"), `${config.previewScript} must mark sourceHints.classificationOwner as llm.`, blockers);
  assert(!previewText.includes('classifyWithProvider'), `${config.previewScript} must not call an LLM provider.`, blockers);
  assert(!previewText.includes('GEMINI_API_KEY') && !previewText.includes('OPENAI_API_KEY'), `${config.previewScript} must not read provider API keys.`, blockers);
  assert(!/\bfetch\s*\(/.test(previewText), `${config.previewScript} must not call fetch.`, blockers);
  assert(!previewText.includes('mergeProcessedRecalls'), `${config.previewScript} must not merge canonical data.`, blockers);
  assert(!previewText.includes('writeNormalized'), `${config.previewScript} must not write normalized source data.`, blockers);
  for (const key of finalTaxonomyKeys) {
    assert(!previewText.includes(`${key}:`), `${config.previewScript} must not fill final taxonomy field ${key}.`, blockers);
  }

  const docText = exists(config.doc) ? readText(config.doc) : '';
  assert(docText.includes(config.outputDir), `${config.doc} must document ${config.outputDir}.`, blockers);
  assert(/do not commit/i.test(docText), `${config.doc} must say generated outputs are not committed.`, blockers);
}

function auditPreviewOutput(config: typeof sourceConfigs[number], blockers: string[], warnings: string[]) {
  if (!exists(config.outputJson)) {
    blockers.push(`${config.outputJson} is missing. Run npm run ${config.previewCommand} first.`);
    return undefined;
  }

  const preview = readJson(config.outputJson) as {
    source?: string;
    sampleCount?: number;
    records?: Array<{
      genericInput?: unknown;
      proposedInput?: Record<string, unknown> & {
        source?: string;
        sourceHints?: {
          source?: string;
          classificationOwner?: string;
        };
      };
      tokenComparison?: unknown;
      noise?: unknown;
    }>;
    [key: string]: unknown;
  };

  assert(preview.source === config.source, `${config.outputJson} source must be ${config.source}.`, blockers);
  assert(preview[config.countField] === config.expectedCount, `${config.outputJson} ${config.countField} must be ${config.expectedCount}.`, blockers);
  assert(typeof preview.sampleCount === 'number' && preview.sampleCount > 0, `${config.outputJson} must include a positive sampleCount.`, blockers);
  assert(Array.isArray(preview.records) && preview.records.length === preview.sampleCount, `${config.outputJson} records length must match sampleCount.`, blockers);

  for (const record of preview.records ?? []) {
    assert(Boolean(record.genericInput), `${config.source} preview record missing genericInput.`, blockers);
    assert(Boolean(record.proposedInput), `${config.source} preview record missing proposedInput.`, blockers);
    assert(record.proposedInput?.source === config.source, `${config.source} proposedInput source mismatch.`, blockers);
    assert(record.proposedInput?.sourceHints?.source === config.source, `${config.source} sourceHints.source mismatch.`, blockers);
    assert(record.proposedInput?.sourceHints?.classificationOwner === 'llm', `${config.source} sourceHints.classificationOwner must be llm.`, blockers);
    for (const key of finalTaxonomyKeys) {
      assert(!(key in (record.proposedInput ?? {})), `${config.source} proposedInput must not include ${key}.`, blockers);
    }
    assert(Boolean(record.tokenComparison), `${config.source} preview record missing tokenComparison.`, blockers);
    assert(Boolean(record.noise), `${config.source} preview record missing noise.`, blockers);
  }

  const missingNoise = (preview.records ?? []).filter((record) => !record.noise).length;
  if (missingNoise > 0) {
    warnings.push(`${config.source} has ${missingNoise} records without noise metadata.`);
  }

  return {
    source: config.source,
    total: preview[config.countField],
    sampleCount: preview.sampleCount,
    outputJson: config.outputJson
  };
}

function runAudit(): void {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const scripts = packageScripts();
  const counts = canonicalCounts();

  assert(counts.total === 1201, `Canonical total must remain 1201, found ${counts.total}.`, blockers);

  for (const config of sourceConfigs) {
    auditPreviewScript(config, scripts, blockers);
    assert(counts[config.source] === config.expectedCount, `Canonical ${config.source} count must be ${config.expectedCount}, found ${counts[config.source] ?? 0}.`, blockers);
  }

  const individualAudits = sourceConfigs.map((config) => runNodeScript(config.auditCommand, config.auditScript));
  for (const audit of individualAudits) {
    assert(audit.passed, `npm run ${audit.command} failed.\n${audit.output}`, blockers);
  }

  const sourceSummaries = sourceConfigs
    .map((config) => auditPreviewOutput(config, blockers, warnings))
    .filter(Boolean);

  const trackedOutputs = gitOutput(['ls-files', 'outputs/llm-classifier/input-preview']);
  assert(trackedOutputs.length === 0, `Generated classifier preview outputs must not be committed: ${trackedOutputs.join(', ')}`, blockers);

  const dataChanges = gitOutput(['diff', '--name-only', '--', 'data/raw', 'data/processed']);
  assert(dataChanges.length === 0, `Data files changed unexpectedly: ${dataChanges.join(', ')}`, blockers);

  const result = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checkedSources: sourceConfigs.map((config) => config.source),
    canonicalCounts: counts,
    sourceSummaries,
    individualAudits: individualAudits.map(({ command, passed }) => ({ command, passed })),
    trackedOutputs,
    dataChanges
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

runAudit();
