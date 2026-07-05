// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function readText(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readText(relativePath));
}

function gitOutput(args: string[]): string[] {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8'
  })
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
const pagePath = 'src/pages/dev/taxonomy-v2-results-preview.astro';
const docsPath = 'docs/taxonomy-v2-results-preview.md';
const outputPath = 'outputs/llm-classifier/full-source-specific-preview/full-source-specific-classifier-results.json';
const dbPreviewPath = 'outputs/llm-classifier/db-write-preview/classification-db-write-preview-summary.json';
const homepage = readText('src/pages/index.astro');
const page = existsSync(resolve(projectRoot, pagePath)) ? readText(pagePath) : '';
const docs = existsSync(resolve(projectRoot, docsPath)) ? readText(docsPath) : '';
const outputExists = existsSync(resolve(projectRoot, outputPath));
const dbPreviewExists = existsSync(resolve(projectRoot, dbPreviewPath));
const classifierOutput = outputExists ? (readJson(outputPath) as Record<string, unknown>) : {};
const dbPreview = dbPreviewExists ? (readJson(dbPreviewPath) as Record<string, unknown>) : {};
const trackedOutputs = gitOutput(['ls-files', 'outputs/llm-classifier']);
const dataChanges = gitOutput(['diff', '--name-only', '--', 'data/raw', 'data/processed']);

assert(existsSync(resolve(projectRoot, pagePath)), `${pagePath} is missing.`, blockers);
assert(existsSync(resolve(projectRoot, docsPath)), `${docsPath} is missing.`, blockers);
assert(outputExists, `${outputPath} is missing.`, blockers);
assert(dbPreviewExists, `${dbPreviewPath} is missing.`, blockers);
assert(!homepage.includes('/dev/taxonomy-v2-results-preview'), 'Results preview must not be linked from homepage.', blockers);
assert(/Development Preview/i.test(page), 'Results preview page must include Development Preview wording.', blockers);
assert(/Not canonical data/i.test(page), 'Results preview page must clearly say results are not canonical data.', blockers);
assert(/noindex/i.test(page), 'Results preview page must include noindex metadata.', blockers);
assert(/nofollow/i.test(page), 'Results preview page must include nofollow metadata.', blockers);
assert(/taxonomy-results-data/i.test(page), 'Results preview page must embed review data for client filters.', blockers);
assert(/Product family/i.test(page), 'Results preview page must include product family filtering.', blockers);
assert(/Hazard/i.test(page), 'Results preview page must include hazard filtering.', blockers);
assert(/Review state/i.test(page), 'Results preview page must include review-state filtering.', blockers);
assert(/does not write canonical recall data/i.test(docs), 'Docs must state canonical recall data is not changed.', blockers);
assert(/does not write database rows/i.test(docs), 'Docs must state database rows are not written.', blockers);
assert(trackedOutputs.length === 0, `Generated LLM outputs must remain untracked: ${trackedOutputs.join(', ')}`, blockers);
assert(dataChanges.length === 0, `Canonical data files changed: ${dataChanges.join(', ')}`, blockers);

if (outputExists) {
  assert(classifierOutput.promptVersion === 'recall-classifier-v2', 'Classifier output must use recall-classifier-v2.', blockers);
  assert(classifierOutput.provider === 'gemini', 'Classifier output must use Gemini provider.', blockers);
  assert(classifierOutput.totalRecords === 1201, 'Classifier output must cover 1201 records.', blockers);
  assert(classifierOutput.success === 1201, 'Classifier output must have 1201 successes.', blockers);
  assert(classifierOutput.failed === 0, 'Classifier output must have zero failures.', blockers);
  assert(Array.isArray(classifierOutput.results), 'Classifier output must include results array.', blockers);
  assert(
    (classifierOutput.results as unknown[] | undefined)?.length === 1201,
    'Classifier output results array must contain 1201 records.',
    blockers
  );
}

if (dbPreviewExists) {
  const counts = (dbPreview.counts ?? {}) as Record<string, unknown>;
  assert(dbPreview.dbWrites === false, 'DB preview must not write database rows.', blockers);
  assert(dbPreview.canonicalDataWrites === false, 'DB preview must not write canonical data.', blockers);
  assert(counts.classificationRows === 1201, 'DB preview must prepare 1201 classification rows.', blockers);
  assert(counts.failed === 0, 'DB preview must have zero failed rows.', blockers);
}

const result = {
  passed: blockers.length === 0,
  checked: {
    pagePath,
    docsPath,
    outputPath,
    dbPreviewPath,
    promptVersion: classifierOutput.promptVersion,
    totalRecords: classifierOutput.totalRecords,
    success: classifierOutput.success,
    failed: classifierOutput.failed
  },
  blockers,
  warnings
};

console.log(JSON.stringify(result, null, 2));

if (blockers.length) {
  process.exitCode = 1;
}
