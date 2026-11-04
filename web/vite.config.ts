import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web app imports the iOS app's platform-free modules straight from the
// repo's `src/` (docs/web.md), and `react-native-audio-api` — which copies the
// browser's Web Audio API — resolves to the browser's own classes.
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// ONE VERSION LINE: the web says the app's own version (app.json), which is
// what Settings → About names on a phone.
const appVersion = (
  JSON.parse(readFileSync(at('../app.json'), 'utf8')) as {
    expo: { version: string };
  }
).expo.version;

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    alias: {
      '@app': at('../src'),
      // The shared modules' own imports (`@/i18n` in lib/player.ts).
      '@': at('../src'),
      'react-native-audio-api': at('./src/shims/audio-api.ts'),
    },
  },
  server: {
    // The shared modules live one level up.
    fs: { allow: [at('..')] },
  },
});
