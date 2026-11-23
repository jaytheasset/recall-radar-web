import { defineConfig } from 'astro/config';
import { existsSync, readdirSync } from 'node:fs';
import { recallImageCacheDirectory } from './src/lib/recall-image-cache.ts';

const cachedWebpFiles = existsSync(recallImageCacheDirectory)
  ? readdirSync(recallImageCacheDirectory).filter((name) => /^[\da-f]{32}\.webp$/.test(name))
  : [];

export default defineConfig({
  site: 'https://www.recall-radar.app',
  server: {
    host: '127.0.0.1',
    port: 5179
  },
  devToolbar: {
    enabled: false
  },
  vite: {
    define: {
      __RECALL_IMAGE_CACHE_FILES__: JSON.stringify(cachedWebpFiles)
    }
  }
});
