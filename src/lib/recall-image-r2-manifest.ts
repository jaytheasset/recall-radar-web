import { readFileSync } from 'node:fs';
import { recallImageCacheFilenamePattern } from './recall-image-cache.ts';

export const recallImageR2ManifestPath = 'data/processed/recall-images-r2.json';

export function readRecallImageR2Manifest(): string[] {
  let json: string;
  try {
    json = readFileSync(recallImageR2ManifestPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = JSON.parse(json) as unknown;
  if (!Array.isArray(files) || !files.every(
    (name): name is string => typeof name === 'string' && recallImageCacheFilenamePattern.test(name)
  )) {
    throw new Error(`Invalid WebP filenames in ${recallImageR2ManifestPath}`);
  }
  return [...new Set(files)];
}
