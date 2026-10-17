# Release — what the first submission needs

Sound Shaper ships first on iOS, then Android, published under Grostify LLC's
Apple Developer membership (team `PHLR7X3FGN`).

| gate | what                                                                 | state                                                                   |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | privacy policy, support and account-deletion pages                   | ✅ live on juanevillam.com                                              |
| 2a   | Sign in with Apple                                                   | ✅ 2026-10-16, verified on device                                       |
| 2b   | media deleted with its sound, its cover and its account (the Worker) | ✅ 2026-09-12, E2E                                                      |
| 2d   | trophy totals server-side (`increment`, boundaries, one-time adopt)  | ✅ 2026-10-16, verified in Firestore                                    |
| 2e   | iOS submit profile in `eas.json`                                     | 🟡 `appleTeamId` set; `ascAppId` waits on the App Store Connect record  |
| 2f   | the SDK 57 drift survives a Release build                            | 🟡 local Release proven (`dyld_info`, zero unresolved); EAS `.ipa` next |
| 2g   | the intermittent SIGSEGV                                             | ✅ root cause found and fixed (`NowPlayingBridge`'s publish queue)      |
| 2h   | account deletion end to end, Apple provider                          | ✅ 2026-10-16 — Auth, Firestore, Cloudinary, Apple revocation           |
| 2i   | console hardening before the repo is public                          | ⬜ API-key restrictions, the unsigned preset, secret scanning           |
| 3    | the engineering quality audit                                        | ⬜ after 2e and 2f, incl. `npm audit` (below)                           |
| 4    | submit                                                               | ⬜                                                                      |

## 2i — console hardening

- **Cloudinary** `sound_shaper_unsigned`: anyone holding the preset name can
  upload into the account. Pin it to the `sound-shaper/` root, restrict
  formats (mp3 and images) and cap the file size. Never add an incoming
  transformation: the preset carries audio too, and `q_auto` on a `video`
  resource re-encodes it.
- **Firebase API keys**: restrict the iOS key by bundle id and the Android key
  by package + the EAS release keystore's SHA-1, to the Firebase APIs only.
- **`firestore.rules`**: deploy and confirm the live rules equal the repo's.
- **GitHub**: secret scanning and push protection on. The local net is the
  gitleaks pre-commit hook (`brew install gitleaks`).

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
