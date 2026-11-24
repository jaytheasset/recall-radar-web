import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// https://developers.cloudflare.com/pages/platform/limits/
const maxFiles = 20_000;
const maxFileBytes = 25 * 1024 * 1024;
const dist = resolve(process.cwd(), process.argv[2] ?? 'dist');

if (!existsSync(dist)) {
  console.error('No dist directory found. Run npm run build before auditing the Pages file budget.');
  process.exit(1);
}

const counts = { html: 0, recallImages: 0, astroAssets: 0, other: 0 };
let recallImageBytes = 0;
let largestFile = { path: '', bytes: 0 };

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;

  const absolutePath = join(entry.parentPath, entry.name);
  const path = relative(dist, absolutePath).split(sep).join('/');
  if (path.startsWith('_local-preview/')) continue;

  const { size } = statSync(absolutePath);
  if (size > largestFile.bytes) largestFile = { path, bytes: size };

  if (path.startsWith('recall-images/')) {
    counts.recallImages += 1;
    recallImageBytes += size;
  } else if (path.startsWith('_astro/')) {
    counts.astroAssets += 1;
  } else if (path.endsWith('.html')) {
    counts.html += 1;
  } else {
    counts.other += 1;
  }
}

const totalFiles = Object.values(counts).reduce((total, count) => total + count, 0);
const remainingFiles = maxFiles - totalFiles;
const report = {
  passed: totalFiles > 0 && remainingFiles >= 0 && largestFile.bytes <= maxFileBytes,
  totalFiles,
  remainingFiles,
  counts,
  recallImageBytes,
  largestFile,
  limits: { maxFiles, maxFileBytes }
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
