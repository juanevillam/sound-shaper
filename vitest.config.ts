import { defineConfig } from 'vitest/config';

// Unit tests only — this app has no Firestore rules suite of its own (its
// rules live with the shared deployment Topper's `test:rules` covers).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
