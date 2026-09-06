import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Keep date/visual characterizations reproducible on Fedora and the developer host.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'jsdom',
  },
});
