import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web app imports the iOS app's platform-free modules straight from the
// repo's `src/` (docs/web.md), and `react-native-audio-api` — which copies the
// browser's Web Audio API — resolves to the browser's own classes.
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': at('../src'),
      'react-native-audio-api': at('./src/shims/audio-api.ts'),
    },
  },
  server: {
    // The shared modules live one level up.
    fs: { allow: [at('..')] },
  },
});
