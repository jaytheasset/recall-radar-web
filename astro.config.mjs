import { defineConfig } from 'astro/config';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import {
  recallImageCacheDirectory,
  recallImageCacheFilenamePattern,
  recallImageCachePublicPath
} from './src/lib/recall-image-cache.ts';
import { readRecallImageR2Manifest } from './src/lib/recall-image-r2-manifest.ts';

const cachedWebpFiles = existsSync(recallImageCacheDirectory)
  ? readdirSync(recallImageCacheDirectory).filter((name) => recallImageCacheFilenamePattern.test(name))
  : [];
const r2WebpFiles = readRecallImageR2Manifest();

export default defineConfig({
  site: 'https://www.recall-radar.app',
  integrations: [{
    name: 'recall-images-r2',
    hooks: {
      'astro:build:done': ({ dir }) => {
        for (const name of r2WebpFiles) {
          const image = new URL(`.${recallImageCachePublicPath}${name}`, dir);
          if (existsSync(image)) unlinkSync(image);
        }
      }
    }
  }],
  server: {
    host: '127.0.0.1',
    port: 5179
  },
  devToolbar: {
    enabled: false
  },
  vite: {
    define: {
      __RECALL_IMAGE_CACHE_FILES__: JSON.stringify(cachedWebpFiles),
      __RECALL_IMAGE_R2_FILES__: JSON.stringify(r2WebpFiles)
    }
  }
});
