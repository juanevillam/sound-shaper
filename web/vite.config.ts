import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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

/** Every file under `dir`, as a site path. */
const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? filesIn(join(dir, entry.name))
      : [join(dir, entry.name)],
  );

/**
 * THE SERVICE WORKER, stamped per build: `sw.js` at the package root is a
 * template, and this fills in the files to keep offline — everything the
 * build wrote plus `public/` — and a version taken from their names, so a
 * new deploy is a new worker and the old shell is dropped. Build only: the
 * dev server never registers a worker.
 */
const serviceWorker = (): Plugin => ({
  name: 'sound-shaper-sw',
  apply: 'build',
  // After the HTML plugin, or the page itself is not in the bundle yet.
  enforce: 'post',
  generateBundle(_, bundle) {
    const built = Object.keys(bundle).filter(name => !name.endsWith('.map'));
    const publicDir = at('./public');
    const files = [
      ...built,
      ...filesIn(publicDir).map(path => relative(publicDir, path)),
    ]
      // The page is served at `/`; `index.html` would be a redirect.
      .map(name => (name === 'index.html' ? '/' : `/${name}`))
      .sort();
    const version = createHash('sha256')
      .update(files.join('\n'))
      .digest('hex')
      .slice(0, 12);

    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: readFileSync(at('./sw.js'), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(files)),
    });
  },
});

export default defineConfig({
  plugins: [react(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    // The shared modules sit outside this package, so a bare import of theirs
    // would otherwise find the app's own copy — and a second React.
    dedupe: ['react', 'react-dom', 'zustand'],
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
