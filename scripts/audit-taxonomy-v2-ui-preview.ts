// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAZARD_TYPE_VALUES, PRODUCT_FAMILY_VALUES } from '../src/data/recall-taxonomy-v2.ts';
import {
  getProductFamilyLabel,
  getTaxonomyV2CategoryHref,
  missingTaxonomyV2DisplayLabels
} from '../src/lib/taxonomy-v2-display.ts';
import { taxonomyV2MenuPreview, taxonomyV2PreviewRecords } from '../src/lib/taxonomy-v2-preview-data.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function readText(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function changedFilesUnder(paths: string[]): string[] {
  const output = execFileSync('git', ['diff', '--name-only', '--', ...paths], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

const blockers: string[] = [];
const warnings: string[] = [];
const displayPath = 'src/lib/taxonomy-v2-display.ts';
const previewPath = 'src/pages/dev/taxonomy-v2-preview.astro';
const docsPath = 'docs/taxonomy-v2-ui-preview.md';
const homepage = readText('src/pages/index.astro');
const previewPage = existsSync(resolve(projectRoot, previewPath)) ? readText(previewPath) : '';
const previewDocs = existsSync(resolve(projectRoot, docsPath)) ? readText(docsPath) : '';
const labels = missingTaxonomyV2DisplayLabels();
const dataChanges = changedFilesUnder(['data/raw', 'data/processed']);
const llmOutputChanges = changedFilesUnder(['outputs/llm-classifier']);
const approvedPublicLabels = [
  'Food & Grocery',
  'Baby & Kids',
  'Electronics & Batteries',
  'Home Appliances',
  'Furniture & Household',
  'Vehicles & Mobility',
  'Sports & Outdoor',
  'Clothing & Accessories',
  'Tools & Equipment',
  'Health & Personal Care',
  'Chemicals & Cleaning',
  'Pet Products',
  'Industrial & Workplace',
  'Other',
  'Need Review'
];
const approvedPublicFamilies = [
  'food-grocery',
  'baby-kids',
  'electronics-batteries',
  'home-appliances',
  'furniture-household',
  'vehicles-mobility',
  'sports-outdoor',
  'clothing-accessories',
  'tools-equipment',
  'health-personal-care',
  'chemicals-cleaning',
  'pet-products',
  'industrial-workplace',
  'other',
  'unknown'
];

assert(existsSync(resolve(projectRoot, displayPath)), `${displayPath} is missing.`, blockers);
assert(existsSync(resolve(projectRoot, previewPath)), `${previewPath} is missing.`, blockers);
assert(existsSync(resolve(projectRoot, docsPath)), `${docsPath} is missing.`, blockers);
assert(!homepage.includes('/dev/taxonomy-v2-preview'), 'Preview route must not be linked from homepage.', blockers);
assert(/Development Preview/i.test(previewPage), 'Preview page must include Development Preview wording.', blockers);
assert(/Taxonomy V2 UI Structure/i.test(previewPage), 'Preview page must identify the Taxonomy V2 UI Structure.', blockers);
assert(/noindex/i.test(previewPage), 'Preview page must include noindex metadata.', blockers);
assert(/nofollow/i.test(previewPage), 'Preview page must include nofollow metadata.', blockers);
assert(/Legacy Category Replacement Map/i.test(previewPage), 'Preview page must include a legacy replacement map.', blockers);
assert(
  previewDocs.toLowerCase().includes('legacy replacement map'),
  'Preview docs must include a legacy replacement map.',
  blockers
);
assert(
  /not be public by default/i.test(previewPage),
  'Preview page must explain classifier internals should not be public by default.',
  blockers
);
assert(/secondary issue tags/i.test(previewPage), 'Preview page must frame hazard types as secondary issue tags.', blockers);
assert(/not primary public browsing categories/i.test(previewDocs), 'Preview docs must say hazard types are not primary browsing categories.', blockers);
assert(dataChanges.length === 0, `Canonical data files changed: ${dataChanges.join(', ')}`, blockers);
assert(llmOutputChanges.length === 0, `Generated LLM output files changed: ${llmOutputChanges.join(', ')}`, blockers);

for (const [labelGroup, missing] of Object.entries(labels)) {
  assert(missing.length === 0, `${labelGroup} display labels missing: ${missing.join(', ')}`, blockers);
}

const yamaha = taxonomyV2PreviewRecords.find((record) => record.id === 'sample-yamaha-umax-bistro');
assert(
  yamaha?.expectedClassification.productFamily === 'vehicles-mobility' &&
    yamaha?.familyLabel === 'Vehicles & Mobility',
  'Yamaha/Bistro sample must appear under Vehicles & Mobility.',
  blockers
);

const allergen = taxonomyV2PreviewRecords.find((record) => record.id === 'sample-undeclared-milk-cookie');
assert(
  allergen?.expectedClassification.productFamily === 'food-grocery' &&
    allergen?.expectedClassification.hazardType === 'allergen' &&
    allergen?.familyLabel === 'Food & Grocery' &&
    allergen?.hazardTypeLabel === 'Allergen',
  'Undeclared milk sample must appear under Food & Grocery + Allergen.',
  blockers
);

const salmonella = taxonomyV2PreviewRecords.find((record) => record.id === 'sample-salmonella-nut-butter');
assert(
  salmonella?.expectedClassification.productFamily === 'food-grocery' &&
    salmonella?.expectedClassification.hazardType === 'contamination-pathogen' &&
    salmonella?.hazardTypeLabel === 'Pathogen contamination',
  'Salmonella sample must appear under Food & Grocery + Pathogen contamination.',
  blockers
);

for (const family of PRODUCT_FAMILY_VALUES) {
  assert(
    taxonomyV2MenuPreview.some((item) => item.productFamily === family),
    `Preview menu data must include productFamily ${family}.`,
    blockers
  );
}

const actualPublicLabels = taxonomyV2MenuPreview.map((item) => item.label);
const actualPublicFamilies = taxonomyV2MenuPreview.map((item) => item.productFamily);
assert(
  JSON.stringify(actualPublicLabels) === JSON.stringify(approvedPublicLabels),
  `Approved public labels/order mismatch. Expected ${approvedPublicLabels.join(' | ')} but got ${actualPublicLabels.join(' | ')}.`,
  blockers
);
assert(
  JSON.stringify(actualPublicFamilies) === JSON.stringify(approvedPublicFamilies),
  `Approved public family order mismatch. Expected ${approvedPublicFamilies.join(' | ')} but got ${actualPublicFamilies.join(' | ')}.`,
  blockers
);
assert(getProductFamilyLabel('unknown') === 'Need Review', 'unknown must display as Need Review.', blockers);
assert(getTaxonomyV2CategoryHref('unknown') === '/recalls/need-review', 'unknown future route must be /recalls/need-review.', blockers);
assert(!previewPage.includes('Needs Review'), 'Preview page must not show Needs Review.', blockers);
assert(!previewDocs.includes('Needs Review'), 'Preview docs must not show Needs Review.', blockers);

const conflictingCopy = [
  /more categories/i,
  /only\s+6/i,
  /6\+/i,
  /six\s+public/i,
  /too many categories/i,
  /hazard filters? by family/i,
  /hazard filters? should appear as chips/i
];
for (const pattern of conflictingCopy) {
  assert(!pattern.test(previewPage), `Preview page contains conflicting copy: ${pattern}`, blockers);
  assert(!pattern.test(previewDocs), `Preview docs contain conflicting copy: ${pattern}`, blockers);
}

const result = {
  passed: blockers.length === 0,
  checked: {
    displayPath,
    previewPath,
    docsPath,
    previewRecordCount: taxonomyV2PreviewRecords.length,
    productFamilyLabels: PRODUCT_FAMILY_VALUES.length,
    hazardTypeLabels: HAZARD_TYPE_VALUES.length,
    approvedPublicLabels
  },
  blockers,
  warnings
};

console.log(JSON.stringify(result, null, 2));

if (blockers.length) {
  process.exitCode = 1;
}
