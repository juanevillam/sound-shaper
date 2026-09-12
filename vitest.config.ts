import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));

// Unit tests only — this app has no Firestore rules suite of its own (its
// rules live with the shared deployment Topper's `test:rules` covers).
export default defineConfig({
  resolve: {
    // The app's own `@/` alias, so a test can reach anything under `src`
    // rather than only the files that happen to import nothing.
    alias: { '@': resolve(here, 'src') },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
