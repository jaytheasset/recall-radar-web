import { createHash } from 'node:crypto';

export const recallImageCacheDirectory = 'public/recall-images/cache';
export const recallImageCachePublicPath = '/recall-images/cache/';
export const recallImageCacheFilenamePattern = /^[\da-f]{32}\.webp$/;
export const recallImageR2Origin = 'https://images.recall-radar.app';
export const savedRecallImageUrls = new Map([
  ['https://www.cpsc.gov/s3fs-public/Soff-road.png', '/recall-images/cpsc-26575.webp']
]);

export function recallImageCacheFilename(url: string): string {
  return `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.webp`;
}
