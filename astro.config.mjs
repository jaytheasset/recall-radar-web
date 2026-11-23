import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.recall-radar.app',
  server: {
    host: '127.0.0.1',
    port: 5179
  },
  devToolbar: {
    enabled: false
  }
});
