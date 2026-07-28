#!/usr/bin/env node
/**
 * Mints a Firebase custom auth token so a dev build can sign in as a real
 * account without going through Google / Apple — the simulator has no Google
 * account, and typing credentials into it is not something we want to do.
 *
 * The token is written to `.env.local` as EXPO_PUBLIC_DEV_AUTH_TOKEN, which
 * Expo inlines into the dev bundle; `DevSignIn` (dev builds only) hands it to
 * `signInWithCustomToken`. The token expires in an hour, but the Firebase
 * session it creates persists like any other, so one mint is usually enough.
 *
 * Needs a service-account key (Firebase console → Project settings → Service
 * accounts → Generate new private key). Keep it OUTSIDE the repo.
 *
 *   node scripts/dev-token.mjs [uid]
 *
 *   FIREBASE_SERVICE_ACCOUNT   path to the key JSON
 *                              (default ~/.config/firebase/sound-shaper-admin.json)
 */
import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// juanesvillamendoza@gmail.com — the only account in the `sound-shaper` project.
const DEFAULT_UID = 'EDQKXQvQOkd29G0O4rDe3Okw4jX2';
const ENV_KEY = 'EXPO_PUBLIC_DEV_AUTH_TOKEN';
const AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const uid = process.argv[2] ?? DEFAULT_UID;
const keyPath =
  process.env.FIREBASE_SERVICE_ACCOUNT ??
  join(homedir(), '.config', 'firebase', 'sound-shaper-admin.json');

if (!existsSync(keyPath)) {
  console.error(`No service-account key at ${keyPath}.

Firebase console → Project settings → Service accounts → Generate new private
key, then save it there (or point FIREBASE_SERVICE_ACCOUNT at it).`);
  process.exit(1);
}

const account = JSON.parse(readFileSync(keyPath, 'utf8'));
const encode = value =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const issuedAt = Math.floor(Date.now() / 1000);

const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
  aud: AUDIENCE,
  exp: issuedAt + 3600,
  iat: issuedAt,
  iss: account.client_email,
  sub: account.client_email,
  uid,
})}`;

const token = `${body}.${createSign('RSA-SHA256')
  .update(body)
  .sign(account.private_key)
  .toString('base64url')}`;

// Rewrite only our key; anything else already in .env.local survives.
const envPath = join(appRoot, '.env.local');
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const kept = existing
  .split('\n')
  .filter(line => line.trim() && !line.startsWith(`${ENV_KEY}=`));

writeFileSync(envPath, [...kept, `${ENV_KEY}=${token}`].join('\n') + '\n');

console.log(`Minted a custom token for ${uid} → .env.local

Restart Metro with a clear cache so the new value is inlined:
  npx expo start --clear --port 8082`);
