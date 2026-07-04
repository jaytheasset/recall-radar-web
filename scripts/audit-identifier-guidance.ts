import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const activeSources = [
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

const requiredIdentifierTypes = [
  'barcode',
  'gtin',
  'upc',
  'ean',
  'model-number',
  'lot-code',
  'batch-code',
  'expiry-date',
  'use-by-date',
  'best-before-date',
  'certification-number',
  'recall-number',
  'alert-number'
] as const;

const bannedConsumerClaims = [
  'every recall has a barcode',
  'barcode is required',
  'no barcode means no recall'
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

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function hasAny(text: string, terms: readonly string[]): boolean {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function hasAll(text: string, terms: readonly string[]): boolean {
  const normalized = normalize(text);
  return terms.every((term) => normalized.includes(term.toLowerCase()));
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedFiles = [
    'src/lib/identifier-guidance.ts',
    'src/lib/recall-search.ts',
    'src/lib/recall-detail-view.ts',
    'src/lib/source-landing-pages.ts',
    'src/components/SourceLandingPage.astro',
    'src/pages/index.astro',
    'src/pages/checker.astro',
    'src/pages/watchlist.astro',
    'src/pages/recalls/[slug].astro',
    'src/pages/baby-product-recalls.astro',
    'src/pages/battery-recalls.astro',
    'src/pages/food-allergy-recalls.astro',
    'src/pages/household-product-recalls.astro',
    'src/data/recall-data-schema-v2.ts',
    'docs/recall-data-schema-v2.md',
    'docs/recall-taxonomy-v2.md',
    'docs/llm-recall-classifier-contract.md',
    'docs/phase-44-per-source-llm-classification-plan.md',
    'package.json'
  ];

  const texts = new Map<string, string>();
  for (const file of checkedFiles) {
    texts.set(file, await readText(file));
  }

  const helper = texts.get('src/lib/identifier-guidance.ts') ?? '';
  const recallSearch = texts.get('src/lib/recall-search.ts') ?? '';
  const detailView = texts.get('src/lib/recall-detail-view.ts') ?? '';
  const detailPage = texts.get('src/pages/recalls/[slug].astro') ?? '';
  const checkerPage = texts.get('src/pages/checker.astro') ?? '';
  const watchlistPage = texts.get('src/pages/watchlist.astro') ?? '';
  const sourceLanding = texts.get('src/lib/source-landing-pages.ts') ?? '';
  const sourceComponent = texts.get('src/components/SourceLandingPage.astro') ?? '';
  const schemaTypes = texts.get('src/data/recall-data-schema-v2.ts') ?? '';
  const schemaDoc = texts.get('docs/recall-data-schema-v2.md') ?? '';
  const classifierContract = texts.get('docs/llm-recall-classifier-contract.md') ?? '';
  const phase44Plan = texts.get('docs/phase-44-per-source-llm-classification-plan.md') ?? '';
  const packageJson = JSON.parse(texts.get('package.json') ?? '{}') as { scripts?: Record<string, string> };

  for (const exportName of [
    'getGeneralIdentifierGuidance',
    'getSourceIdentifierGuidance',
    'getIdentifierSearchHint',
    'getNoResultIdentifierHint',
    'getDetailVerificationIdentifierHint'
  ]) {
    assert(helper.includes(`export function ${exportName}`), `identifier-guidance.ts must export ${exportName}.`, blockers);
  }

  for (const source of activeSources) {
    assert(helper.includes(`${source}:`), `Missing source-specific identifier guidance for ${source}.`, blockers);
  }

  assert(helper.includes('Not every recall notice includes a barcode'), 'General guidance must say barcode is not universal.', blockers);
  assert(helper.includes('Identifier names vary by source'), 'No-result guidance must say identifier names vary by source.', blockers);
  assert(
    hasAll(helper, ['model', 'lot', 'batch', 'date mark', 'pack size', 'certification number', 'recall number']),
    'General/no-result guidance must mention alternate identifier types.',
    blockers
  );
  assert(!hasAny(helper, ['complete identifier coverage', 'all identifiers are available']), 'Guidance must not claim complete identifier coverage.', blockers);

  assert(recallSearch.includes("identifier: 'Matched by identifier text'"), 'Search match reason should use generic identifier wording.', blockers);
  assert(recallSearch.includes('getSourceIdentifierGuidance'), 'Search result identifier hints must use the shared helper.', blockers);
  assert(checkerPage.includes('getNoResultIdentifierHint'), 'Checker no-result copy must use shared identifier guidance.', blockers);
  assert(watchlistPage.includes('getNoResultIdentifierHint'), 'Watchlist no-result copy must use shared identifier guidance.', blockers);
  assert(sourceLanding.includes('getNoResultIdentifierHint'), 'Source landing no-result copy must use shared identifier guidance.', blockers);
  assert(sourceComponent.includes('getSourceIdentifierGuidance'), 'Source landing pages must show source-specific guidance.', blockers);

  for (const categoryPage of [
    'src/pages/baby-product-recalls.astro',
    'src/pages/battery-recalls.astro',
    'src/pages/food-allergy-recalls.astro',
    'src/pages/household-product-recalls.astro'
  ]) {
    assert(
      texts.get(categoryPage)?.includes('getNoResultIdentifierHint') ?? false,
      `${categoryPage} must use shared no-result identifier guidance.`,
      blockers
    );
  }

  assert(detailView.includes('getDetailVerificationIdentifierHint'), 'Detail view must include source-aware identifier verification guidance.', blockers);
  assert(detailPage.includes('identifierVerificationHint'), 'Detail page must render identifier verification guidance.', blockers);
  assert(
    helper.includes('Product details vary by source'),
    'Detail verification guidance must mention source variability.',
    blockers
  );

  assert(schemaTypes.includes('export type RecallIdentifierTypeV2'), 'Schema types must define RecallIdentifierTypeV2.', blockers);
  assert(schemaTypes.includes('type: RecallIdentifierTypeV2'), 'RecallIdentifierV2 must use typed identifier values.', blockers);
  assert(schemaTypes.includes('confidence?: number'), 'RecallIdentifierV2 must include optional confidence.', blockers);
  assert(schemaTypes.includes('display?: boolean'), 'RecallIdentifierV2 must include optional display flag.', blockers);

  for (const type of requiredIdentifierTypes) {
    assert(schemaTypes.includes(`'${type}'`), `RecallIdentifierTypeV2 is missing ${type}.`, blockers);
    assert(schemaDoc.includes(`\`${type}\``), `Schema doc is missing ${type}.`, blockers);
  }

  assert(schemaDoc.includes('Barcode is optional'), 'Schema doc must say barcode is optional.', blockers);
  assert(schemaDoc.includes('typed array'), 'Schema doc must describe identifiers as a typed array.', blockers);
  assert(schemaDoc.includes('Search should eventually rank exact `identifiers.value` matches strongly'), 'Schema doc must mention exact identifier search ranking.', blockers);
  assert(classifierContract.includes('Barcode is optional'), 'Classifier contract must say barcode is optional.', blockers);
  assert(phase44Plan.includes('Do not assume barcode exists'), 'Phase 44 plan must tell Gemini phase not to assume barcode exists.', blockers);

  assert(
    packageJson.scripts?.['audit:identifier-guidance']?.includes('audit-identifier-guidance.ts') ?? false,
    'package.json is missing audit:identifier-guidance.',
    blockers
  );

  const consumerFacingText = [
    helper,
    texts.get('src/pages/index.astro') ?? '',
    checkerPage,
    watchlistPage,
    detailPage,
    sourceLanding,
    sourceComponent,
    texts.get('src/pages/baby-product-recalls.astro') ?? '',
    texts.get('src/pages/battery-recalls.astro') ?? '',
    texts.get('src/pages/food-allergy-recalls.astro') ?? '',
    texts.get('src/pages/household-product-recalls.astro') ?? ''
  ].join('\n');

  for (const phrase of bannedConsumerClaims) {
    assert(!normalize(consumerFacingText).includes(phrase), `Consumer-facing copy includes banned claim: ${phrase}.`, blockers);
  }

  if (!checkerPage.includes('IDENTIFIER_SEARCH_PLACEHOLDER')) {
    warnings.push('Checker page does not use the shared identifier search placeholder constant.');
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
