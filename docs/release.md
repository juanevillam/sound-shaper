# Release — what the first submission needs

Sound Shaper ships first on iOS, then Android, published under Grostify LLC's
Apple Developer membership (team `PHLR7X3FGN`).

| gate | what                                                                 | state                                                                      |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | privacy policy, support and account-deletion pages                   | ✅ 2026-10-17 — live at juanevillam.com (site v1.0.0), all three languages |
| 2a   | Sign in with Apple                                                   | ✅ 2026-10-16, verified on device                                          |
| 2b   | media deleted with its sound, its cover and its account (the Worker) | ✅ 2026-09-12, E2E                                                         |
| 2d   | trophy totals server-side (`increment`, boundaries, one-time adopt)  | ✅ 2026-10-16, verified in Firestore                                       |
| 2e   | iOS submit profile in `eas.json`                                     | ✅ `ascAppId` 6823850995 + `appleTeamId` PHLR7X3FGN                        |
| 2f   | the SDK 57 drift survives a Release build                            | ✅ EAS production `.ipa` (build 2): zero unresolved imports                |
| 2g   | the intermittent SIGSEGV                                             | ✅ root cause found and fixed (`NowPlayingBridge`'s publish queue)         |
| 2h   | account deletion end to end, Apple and Google providers              | ✅ Apple 2026-10-16; Google 2026-10-17 (Release build, see below)          |
| 2i   | console hardening before the repo is public                          | ✅ 2026-10-17 for iOS; the Android key waits for the first Android build   |
| 3    | the engineering quality audit                                        | ✅ 2026-10-17 — all five audits, fixes landed (below)                      |
| 4    | submit                                                               | ⬜                                                                         |

## 2h — the Google delete (2026-10-17)

Juan deleted his main Google account from a Release build on his iPhone (he
re-uploads his library once the app is live). Checked over REST afterwards:
the Auth user is gone, and Firestore holds only the one live Apple account's
documents — no orphan under any other uid. Cloudinary's `sound-shaper/` still
lists four folders named for uids that no longer exist (this one plus earlier
test accounts), all **empty**: the Worker deletes every asset under the
prefix, and Cloudinary never removes a folder on its own. An empty folder
holds no content, only a random id. The stop-on-media-failure path (airplane
mode before confirming) was not exercised, and the CDN purge was not probed
on this delete — the deleted URLs were not captured first.

## 2i — console hardening

- ✅ **DONE 2026-10-16** — allowed formats `mp3,jpg,jpeg,png,webp,heic,heif,gif`,
  Folder empty, no transformation; verified on device by uploading an mp3 with
  embedded art, replacing its cover from the photo library, and deleting it.
  **Cloudinary** `sound_shaper_unsigned`: anyone holding the preset name can
  upload into the account. Restrict its allowed formats (mp3 and images) and
  cap the file size. **Leave its Folder EMPTY**: the app sends
  `sound-shaper/{uid}` as the `folder` param, the Worker deletes only inside
  that prefix, and a preset that pins its own folder may win over the param —
  which is how Topper's assets once landed outside any `{uid}`. Empty is the
  configuration proven end to end. Never add an incoming transformation
  either: the preset carries audio too, and `q_auto` on a `video` resource
  re-encodes it.
- ✅ **Firebase API keys, DONE 2026-10-16 for iOS and the browser key.** The
  iOS key is restricted to the bundle `com.juanevillam.soundshaper` (sign-in,
  upload and playback verified on device after it took effect); the browser
  key, which neither app ships, to `sound-shaper.firebaseapp.com/*` and
  `sound-shaper.web.app/*`, Firebase's own domains. Both keep the API list
  Firebase set. **Left: the Android key**, by package plus the SHA-1 of the EAS
  release keystore (and the debug one while the A54 runs dev builds) — at the
  first Android build, not before, or the Android app stops signing in.
- ✅ **`firestore.rules`, DEPLOYED 2026-10-16**: `users/{uid}` is owner-only
  (it was readable by any signed-in account). Before the deploy the live
  ruleset differed from the repo by one comment only; after it, the live
  source (read back through the Firebase Rules API) is byte-identical to
  `firestore.rules`. Deploy with
  `firebase deploy --only firestore:rules --project sound-shaper`.
- ✅ **GitHub, DONE 2026-10-17** (Juan, by hand): secret scanning and push
  protection on; Dependabot and malware alerts on, Dependabot security UPDATES
  off (a bump breaks the `patches/` pins); private vulnerability reporting on;
  CodeQL default (JS/TS) on; a `main` ruleset blocks deletion and force-pushes
  and requires signed commits. A full-history gitleaks scan (788 commits) is
  clean; its one allowlisted hit is the Firebase Android client key in
  `google-services.json`, public by design and restricted at the first Android
  build (above). The local net is the
  gitleaks pre-commit hook (`brew install gitleaks`).

## 2f — CLOSED 2026-10-16 on the EAS build

The first EAS production build (id `556ed58c…`, build number 2, commit
`bb18f4e`) passed the same check on the real `.ipa`: 14 binaries (the app,
12 frameworks, the widget), **zero unresolved imports**. Also verified on
that artifact: signed `iPhone Distribution: Grostify LLC (PHLR7X3FGN)` with
App Store profiles for the app and the widget, entitlements carrying Sign in
with Apple and `group.com.grostify.soundshaper`, `get-task-allow` false — and
the build log shows `apply-patches` running on EAS's `npm ci` (`patched
@expo/ui@57.0.7`, `patched react-native-audio-api@0.13.2`), so the phase
vocoder and the now-playing fixes ship. EAS logs are brotli-compressed:
`zlib.brotliDecompressSync` in Node reads them.

## 2f — how the drift was checked

`expo` 57.0.8 runs against `expo-modules-core` 57.0.7, worked around by
source-building the one pod that breaks (`buildFromSource: ["ExpoImage"]` in
`package.json`). A mismatch shows up as a dyld abort at launch, so the check is
every dynamic import against the exports of the framework it names:
`xcrun dyld_info -imports` on the binary, each embedded framework and the
widget extension, against `xcrun dyld_info -exports` of each framework —
following `[re-export]` entries (ffmpeg's `libavcodec` re-exports
`libavutil`). Run it on the EAS `.ipa` once one exists.

## 3 — the audits, run 2026-10-17

All five audit commands (`docs/audit-playbook.md`) ran in order on this repo
after the extraction — craft (iOS, then Android), data, cache, the parity
closing pass, quality — each report-first, with the fixes Juan approved
landed on `main`. What they left, deliberately:

- **Not taken (Juan's calls, recorded):** Firebase App Check, signed uploads
  through the Worker, authenticated Cloudinary delivery, a Worker rate limit,
  field validation in `firestore.rules`, and iOS's second delete-account
  confirm (Android asks once).
- **Cloudinary, checked in the console 2026-10-17:** "Resource list" is
  already restricted (Settings → Security → Restricted image types, beside
  Fetched URL and Sprite). A preset has NO max-file-size setting, so the
  only size cap is the free plan's own — 10 MB per image, 100 MB per
  video/audio file — which is what bounds an abuser of the unsigned preset.
- **Firebase Auth: only Apple and Google are enabled** (Juan, 2026-10-17).
- **Juan, outside the code:** App Privacy in App Store
  Connect filled from `docs/store-listing.md`. (The Worker change — memoised
  signing keys and the CDN purge on every delete — was DEPLOYED 2026-10-17,
  version `eb189dc8`, and probed failing closed: 405 / 401 / 401 / 404.)
- **Android, at its own release:** a device walk of every Android change since
  2026-09-11 (none has run on the A54 since the extraction), the Android API
  key restriction, and the Play Data safety form.

## 3 — `npm audit`: cleared to the floor, blocking at critical (2026-10-17)

`npm audit --omit=dev` was 1 critical and 39 high, all transitive through
Expo, React Native and Firebase, and all of it NODE TOOLING — the Expo CLI,
Metro, config plugins, the Firebase JS SDK's grpc — none compiled into the
app. `overrides` in `package.json` moved every one that has a fixed release
within its own major (`shell-quote`, `nanoid`, `js-yaml`, `brace-expansion`,
`@xmldom/xmldom` 0.8 and 0.9, `@grpc/grpc-js`, `compression`, `postcss`,
`source-map-js`, `browserslist`) without moving Expo, React Native or Firebase,
so the `patches/` pins and the `ExpoImage` drift workaround stand; `npm ci`,
both overlays, typecheck, the tests and a Metro export were re-run after.
That leaves 0 critical, and highs with NO fix to move to:

- `node-forge` (≤1.4.0, the latest) — `@expo/cli`'s code signing;
- `braces` (≤3.0.3, the latest) — Metro's file map, through `micromatch`;
- `image-size` 1.x — Metro 0.84; the fix is 2.x, a major under Metro;
- `@xmldom/xmldom` 0.7 — `@bacons/xcode`'s plist parser for the widget target,
  run at prebuild over the project's own files; 0.8 is a major.

CI blocks at `--audit-level=critical` and still prints the full advisory
report. Re-run this at every Expo SDK bump: drop any override the new SDK
already satisfies, and raise the gate to `high` the day it can pass.

The lockfile is written by **npm 10 on Linux** (`node:22`, what CI runs).
npm 11 on macOS leaves out `@emnapi/*`, the peers of the wasm-only
`@napi-rs/wasm-runtime`, and `npm ci` on Linux then refuses the lock. After a
dependency change, regenerate it in a `node:22` container with
`npm install --package-lock-only`.

## Grostify's role

Agreed between Juan and Grostify (Abraham), verbally, 2026-10-17: the app is
Juan's; Grostify LLC only publishes it on its Apple membership, sees no data
and is paid nothing; Juan answers every complaint and every contact; Grostify
transfers the app (App Store "App Transfer") whenever Juan asks. The legal
pages say the same in public — Grostify named as the publisher that only
distributes the app — and that line must stay on every page.

## App Store Connect

Created 2026-10-16 under Grostify LLC: Apple ID **6823850995**, SKU
`sound-shaper-ios`, bundle `com.juanevillam.soundshaper`. The store NAME is
**Sound Shaper: Shape Your Music** (30 characters, the limit) because plain
"Sound Shaper" is taken on the App Store; the Home Screen name stays "Sound
Shaper". "EQ" and "speed" belong in the subtitle and keywords, which carry
search weight too.

## Versions and tags

One version line for both stores: `expo.version` in `app.json` (`1.0.0` for the
first submission). The build number (iOS) and `versionCode` (Android) are
EAS-remote-managed — never edit them.

- **A tag per version, at submit.** When a build goes to review (`eas submit`),
  tag the exact commit it was built from: `v1.0.0`. TestFlight and internal
  builds get no tag.
- **A GitHub Release once a store approves it**, from that tag. Its first line
  names the store(s) it shipped to (`App Store`, `Google Play`, or both); the
  notes follow (`/release-notes`; the store's own text from `/store-notes`).
- **Each store ships the versions it wants and skips the rest.** A fix for one
  platform is the next version, sent to that store only. Android's first
  release is NOT a second "1.0.0": it is the next version, sent to both
  stores. No per-platform tags.
