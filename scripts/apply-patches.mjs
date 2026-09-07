#!/usr/bin/env node
/**
 * Applies the vendored overlays in patches/ onto node_modules.
 *
 * Each patches/<package>/ directory mirrors that package's file tree; every
 * file in it is copied over the installed copy. A patch.json beside the tree
 * pins the package version the overlay was written against — on any other
 * version this script FAILS the install rather than silently overwriting
 * files whose surroundings may have changed. Bumping the package therefore
 * forces a re-read of the overlay (see patches/<package>/README.md for what
 * each one does and how to re-verify it).
 *
 * patch-package was tried first and cannot be used here: react-native-audio-api
 * ships macCatalyst xcframework symlinks inside the package, and patch-package
 * refuses to diff a tree containing symlinks (--include/--exclude do not help).
 *
 * Runs from the root postinstall, so it survives npm ci; pods compile straight
 * out of node_modules, so it survives npx expo prebuild --clean.
 */
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const patchesDir = join(root, 'patches');

if (!existsSync(patchesDir)) {
  process.exit(0);
}

// A directory starting with `@` is an npm scope, not a package: recurse one
// level so patches/@expo/ui overlays node_modules/@expo/ui.
const packageNames = [];
for (const entry of readdirSync(patchesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith('@')) {
    for (const child of readdirSync(join(patchesDir, entry.name), {
      withFileTypes: true,
    })) {
      if (child.isDirectory()) packageNames.push(`${entry.name}/${child.name}`);
    }
  } else {
    packageNames.push(entry.name);
  }
}

for (const name of packageNames) {
  const pkg = { name };
  const overlayDir = join(patchesDir, pkg.name);
  const installedDir = join(root, 'node_modules', pkg.name);

  const manifestPath = join(overlayDir, 'patch.json');
  if (!existsSync(manifestPath)) {
    console.error(`patches/${pkg.name}: missing patch.json (expected {"version": "..."})`);
    process.exit(1);
  }
  const { version: expected } = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!existsSync(installedDir)) {
    console.warn(`patches/${pkg.name}: package not installed, skipping`);
    continue;
  }
  const installed = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8')).version;
  if (installed !== expected) {
    console.error(
      `patches/${pkg.name}: overlay was written against ${expected} but ${installed} is installed.\n` +
        `Re-verify the overlay against the new version (patches/${pkg.name}/README.md), then update patch.json.`,
    );
    process.exit(1);
  }

  for (const entry of readdirSync(overlayDir)) {
    if (entry === 'patch.json' || entry === 'README.md') continue;
    cpSync(join(overlayDir, entry), join(installedDir, entry), { recursive: true });
  }
  console.log(`patched ${pkg.name}@${installed}`);
}
