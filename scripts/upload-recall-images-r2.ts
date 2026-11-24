import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  recallImageCacheDirectory,
  recallImageCacheFilenamePattern,
  recallImageCachePublicPath
} from '../src/lib/recall-image-cache.ts';
import { readRecallImageR2Manifest } from '../src/lib/recall-image-r2-manifest.ts';

const accountId = 'fbe2e81c0b3820a97b5875e7ecafb991';
const bucket = 'recall-radar-images';
const keyPrefix = recallImageCachePublicPath.slice(1);
const verified = new Set(readRecallImageR2Manifest());
const directory = await readdir(recallImageCacheDirectory, { withFileTypes: true });
const pending = directory
  .filter((entry) => entry.isFile() && recallImageCacheFilenamePattern.test(entry.name) && !verified.has(entry.name))
  .map((entry) => entry.name)
  .sort();
console.log(`${pending.length} WebP files pending for ${bucket}/${keyPrefix}`);
if (process.argv.includes('--plan') || !pending.length) process.exit(0);

const accessKeyId = process.env.RECALL_RADAR_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.RECALL_RADAR_R2_SECRET_ACCESS_KEY;
if (!accessKeyId || !secretAccessKey) throw new Error('The Recall Radar R2 credentials are required.');
const r2 = new S3Client({
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  maxAttempts: 4
});

async function copyImage(name: string): Promise<boolean> {
  const body = await readFile(join(recallImageCacheDirectory, name));
  const object = { Bucket: bucket, Key: `${keyPrefix}${name}` };
  try {
    await r2.send(new PutObjectCommand({
      ...object,
      Body: body,
      ContentType: 'image/webp',
      IfNoneMatch: '*'
    }), { abortSignal: AbortSignal.timeout(60000) });
    return true;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'PreconditionFailed') throw error;
    const existing = await r2.send(new HeadObjectCommand(object), { abortSignal: AbortSignal.timeout(30000) });
    if (existing.ContentLength !== body.length || existing.ContentType !== 'image/webp') {
      throw new Error('An existing R2 object has a different size or content type.');
    }
    return false;
  }
}

let uploaded = 0;
let existing = 0;
const failures: string[] = [];
let next = 0;
async function copyNext() {
  while (next < pending.length) {
    const name = pending[next++];
    try {
      if (await copyImage(name)) uploaded++;
      else existing++;
    } catch (error) {
      failures.push(`${name}: ${String(error)}`);
    }
    const finished = uploaded + existing + failures.length;
    if (finished % 250 === 0) console.log(`${finished}/${pending.length} processed`);
  }
}

try {
  if (await copyImage(pending[0])) uploaded++;
  else existing++;
  next = 1;
  await Promise.all(Array.from({ length: 12 }, copyNext));
  console.log(`Uploaded ${uploaded}, already present ${existing}, failed ${failures.length}.`);
  if (failures.length) {
    throw new Error(`R2 upload incomplete. Re-running preserves previously uploaded files.\n${failures.slice(0, 12).join('\n')}`);
  }
} finally {
  r2.destroy();
}
