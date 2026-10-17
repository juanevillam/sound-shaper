# Release — what the first submission needs

Sound Shaper ships first on iOS, then Android, published under Grostify LLC's
Apple Developer membership (team `PHLR7X3FGN`).

| gate | what                                                                 | state                                                                                    |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | privacy policy, support and account-deletion pages                   | 🟡 written; live only once juanevillam.com is deployed (after the audits, before submit) |
| 2a   | Sign in with Apple                                                   | ✅ 2026-10-16, verified on device                                                        |
| 2b   | media deleted with its sound, its cover and its account (the Worker) | ✅ 2026-09-12, E2E                                                                       |
| 2d   | trophy totals server-side (`increment`, boundaries, one-time adopt)  | ✅ 2026-10-16, verified in Firestore                                                     |
| 2e   | iOS submit profile in `eas.json`                                     | ✅ `ascAppId` 6823850995 + `appleTeamId` PHLR7X3FGN                                      |
| 2f   | the SDK 57 drift survives a Release build                            | ✅ EAS production `.ipa` (build 2): zero unresolved imports                              |
| 2g   | the intermittent SIGSEGV                                             | ✅ root cause found and fixed (`NowPlayingBridge`'s publish queue)                       |
| 2h   | account deletion end to end, Apple provider                          | ✅ 2026-10-16 — Auth, Firestore, Cloudinary, Apple revocation                            |
| 2i   | console hardening before the repo is public                          | 🟡 preset ✅; API-key restrictions, rules, secret scanning left                          |
| 3    | the engineering quality audit                                        | ⬜ after 2e and 2f, incl. `npm audit` (below)                                            |
| 4    | submit                                                               | ⬜                                                                                       |

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
- **GitHub**: secret scanning and push protection on. The local net is the
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

## 3 — `npm audit` is advisory in CI until this is cleared

`npm audit --omit=dev --audit-level=high` reports high advisories, all
transitive through Expo, React Native and Firebase (2026-10-16: `@grpc/grpc-js`,
`node-forge`, `@xmldom/xmldom`, `braces`, `nanoid` and others). The CI step runs
with `continue-on-error` so the build stays meaningful. Resolve it in the
quality audit — by Expo/Firebase bumps or `overrides`, re-verifying every
`patches/` pin and the `ExpoImage` drift check afterwards — then make the step
blocking again.

The lockfile is written by **npm 10 on Linux** (`node:22`, what CI runs).
npm 11 on macOS leaves out `@emnapi/*`, the peers of the wasm-only
`@napi-rs/wasm-runtime`, and `npm ci` on Linux then refuses the lock. After a
dependency change, regenerate it in a `node:22` container with
`npm install --package-lock-only`.

## App Store Connect

Created 2026-10-16 under Grostify LLC: Apple ID **6823850995**, SKU
`sound-shaper-ios`, bundle `com.juanevillam.soundshaper`. The store NAME is
**Sound Shaper: Shape Your Music** (30 characters, the limit) because plain
"Sound Shaper" is taken on the App Store; the Home Screen name stays "Sound
Shaper". "EQ" and "speed" belong in the subtitle and keywords, which carry
search weight too.
