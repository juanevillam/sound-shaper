import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));

// Unit tests only. `firestore.rules` has no emulator suite yet: it would need
// Java and the Firestore emulator, which CI does not install.
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
