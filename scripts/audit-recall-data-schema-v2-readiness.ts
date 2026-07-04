import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const currentSources = [
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS',
  'FSANZ_FOOD_RECALLS'
] as const;

type AuditResult = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  checkedFiles: string[];
};

async function readText(relativePath: string): Promise<string> {
  return readFile(resolve(projectRoot, relativePath), 'utf8');
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await readText(relativePath);
    return true;
  } catch {
    return false;
  }
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function extractTypeBlock(text: string, typeName: string): string {
  const marker = `export type ${typeName} = {`;
  const start = text.indexOf(marker);
  if (start === -1) {
    return '';
  }

  const end = text.indexOf('\n};', start);
  return end === -1 ? text.slice(start) : text.slice(start, end + 4);
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedFiles = [
    'docs/recall-data-schema-v2.md',
    'docs/recall-db-schema-v2.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'src/data/recall-data-schema-v2.ts'
  ];

  for (const file of checkedFiles) {
    assert(await exists(file), `${file} is missing.`, blockers);
  }

  const schemaDoc = await readText('docs/recall-data-schema-v2.md');
  const dbDoc = await readText('docs/recall-db-schema-v2.md');
  const phase44Doc = await readText('docs/phase-44-per-source-llm-classification-plan.md');
  const schemaTypes = await readText('src/data/recall-data-schema-v2.ts');
  const packageJson = JSON.parse(await readText('package.json')) as { scripts?: Record<string, string> };
  const normalizedRecallV2 = extractTypeBlock(schemaTypes, 'NormalizedRecallV2');

  assert(schemaTypes.includes("RECALL_DATA_SCHEMA_VERSION = 'recall-data-schema-v2'"), 'Schema version constant is missing.', blockers);
  assert(normalizedRecallV2.includes('classification: RecallClassificationV2;'), 'NormalizedRecallV2 must require classification.', blockers);
  assert(!/\n\s*category\s*:/.test(normalizedRecallV2), 'NormalizedRecallV2 must not require old category.', blockers);
  assert(!/\n\s*legacyCategory\s*:/.test(normalizedRecallV2), 'legacyCategory must not be required.', blockers);
  assert(/legacyCategory\?:/.test(normalizedRecallV2), 'legacyCategory should be optional/deprecated when present.', blockers);
  assert(normalizedRecallV2.includes('schemaVersion: typeof RECALL_DATA_SCHEMA_VERSION;'), 'NormalizedRecallV2 must require schemaVersion.', blockers);
  assert(normalizedRecallV2.includes('raw: unknown;'), 'NormalizedRecallV2 must require raw.', blockers);

  assert(schemaDoc.includes('deprecated') && schemaDoc.includes('not a long-term compatibility requirement'), 'Schema doc must mark old category as deprecated, not permanent.', blockers);
  assert(schemaDoc.includes('Future canonical records require a `classification` object'), 'Schema doc must require classification for future records.', blockers);
  assert(schemaDoc.includes('data/processed/recalls-v2.json'), 'Schema doc must document future recalls-v2.json migration target.', blockers);
  assert(schemaDoc.includes('confidence >= 0.75'), 'Schema doc must include the initial migration confidence gate.', blockers);
  assert(schemaDoc.includes('category routes are derived from `productFamily`'), 'Schema doc must state category routes derive from productFamily.', blockers);
  assert(schemaDoc.includes('hazard filters are derived from `hazardType`'), 'Schema doc must state hazard filters derive from hazardType.', blockers);

  assert(dbDoc.includes('classification jsonb not null'), 'DB schema doc must include JSONB classification.', blockers);
  assert(dbDoc.includes('product_family text'), 'DB schema doc must include product_family indexing plan.', blockers);
  assert(dbDoc.includes('hazard_type text'), 'DB schema doc must include hazard_type indexing plan.', blockers);
  assert(dbDoc.includes('recalls_classification_gin_idx'), 'DB schema doc must include GIN classification index plan.', blockers);

  for (const source of currentSources) {
    assert(phase44Doc.includes(`\`${source}\``), `Phase 44 plan must include ${source}.`, blockers);
  }
  assert(phase44Doc.includes('outputs/llm-classifier/per-source/'), 'Phase 44 plan must write to ignored per-source outputs.', blockers);
  assert(phase44Doc.includes('Do not write `data/processed/recalls-v2.json` in Phase 44.'), 'Phase 44 plan must not modify canonical data.', blockers);
  assert(phase44Doc.includes('Gemini 2.5 Flash-Lite') || phase44Doc.includes('cheapest suitable Gemini'), 'Phase 44 plan must prefer Gemini low-cost model.', blockers);
  assert(phase44Doc.includes('up to 1000'), 'Phase 44 plan must document the planned 1000-record cap.', blockers);

  assert(
    packageJson.scripts?.['audit:recall-data-schema-v2-readiness']?.includes('audit-recall-data-schema-v2-readiness.ts') ?? false,
    'package.json is missing audit:recall-data-schema-v2-readiness.',
    blockers
  );

  if (!schemaDoc.includes('Current Legacy Category Inventory')) {
    warnings.push('Schema doc does not have an explicit legacy category inventory heading.');
  }

  const result: AuditResult = {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checkedFiles
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
