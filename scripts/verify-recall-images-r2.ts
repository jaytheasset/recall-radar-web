import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  recallImageCacheDirectory,
  recallImageCacheFilenamePattern,
  recallImageCachePublicPath,
  recallImageR2Origin
} from '../src/lib/recall-image-cache.ts';
import {
  readRecallImageR2Manifest,
  recallImageR2ManifestPath
} from '../src/lib/recall-image-r2-manifest.ts';

async function verifyImage(name: string): Promise<void> {
  const local = await readFile(join(recallImageCacheDirectory, name));
  const url = `${recallImageR2Origin}${recallImageCachePublicPath}${name}`;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (response.status !== 200 || contentType !== 'image/webp') {
    await response.body?.cancel();
    throw new Error(`Expected HTTP 200 image/webp, got HTTP ${response.status} ${contentType ?? ''}`);
  }
  const remote = Buffer.from(await response.arrayBuffer());
  if (!remote.equals(local)) throw new Error('The remote and local bytes differ');
}

const directoryEntries = await readdir(recallImageCacheDirectory, { withFileTypes: true });
const localFiles = directoryEntries
  .filter((entry) => entry.isFile() && recallImageCacheFilenamePattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();
if (!localFiles.length) throw new Error('No cached WebP files to verify');

const verified = new Set(readRecallImageR2Manifest());
const checkAll = process.argv.includes('--all');
const pending = localFiles.filter((file) => checkAll || !verified.has(file));
if (!pending.length) {
  console.log(`All ${localFiles.length} local WebP files are already listed in the R2 manifest.`);
} else {
  console.log(`Checking ${pending.length} WebP files at ${recallImageR2Origin}`);
  await verifyImage(pending[0]).catch((error: unknown) => {
    throw new Error(`Could not verify ${pending[0]}`, { cause: error });
  });
  let nextIndex = 1;
  const failures: string[] = [];
  const checkNext = async () => {
    while (nextIndex < pending.length) {
      const name = pending[nextIndex++];
      try {
        await verifyImage(name);
      } catch (error) {
        failures.push(`${name}: ${String(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, checkNext));
  if (failures.length) {
    throw new Error(`${failures.length} R2 WebP checks failed.\n${failures.slice(0, 12).join('\n')}`);
  }
  for (const name of pending) verified.add(name);
  const temporaryPath = `${recallImageR2ManifestPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify([...verified].sort(), null, 2)}\n`, { flag: 'wx' });
    await rename(temporaryPath, recallImageR2ManifestPath);
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  console.log(`Verified ${pending.length} files. R2 manifest now contains ${verified.size} files.`);
}
