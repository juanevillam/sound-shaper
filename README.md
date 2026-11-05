# Sound Shaper

A personal music player with a sound you can shape. Add your own `.mp3`s,
play them, shape them with a five-band EQ, playback speed from 0.75× to 1.25×
with the pitch kept or set free, and
the Next Room and Echo effects, and clip the parts worth replaying. Your
library is yours alone: there is no social layer, and nothing you upload is
shared with or shown to anyone else.

On iPhone it is an Expo (SDK 57) and React Native app with native SwiftUI
through `@expo/ui`; on the web it is a React and Vite app in `web/`, playing
through the Web Audio API with the same shaping. Both share one account on
Firebase (Auth + Firestore) and Cloudinary.

- **App Store:** [apps.apple.com/app/id6823850995](https://apps.apple.com/app/id6823850995), published by Grostify LLC
- **Web:** [soundshaper.juanevillam.com](https://soundshaper.juanevillam.com)
- **Support:** [juanevillam.com/sound-shaper/support](https://juanevillam.com/sound-shaper/support)
- **Privacy policy:** [juanevillam.com/sound-shaper/privacy-policy](https://juanevillam.com/sound-shaper/privacy-policy)

## Layout

| path            | what it is                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/app`       | expo-router routes                                                                                                           |
| `src/ui`        | the UI kit — welcome, settings and account screens, sheets, buttons, skeletons, the snackbar                                 |
| `src/core`      | theme, i18n plumbing, the store primitives                                                                                   |
| `src/trophies`  | the trophy engine and its banner                                                                                             |
| `modules/`      | local Expo modules: `widget-bridge` (the widget's App Group snapshot), `audio-session` (other-audio check, backup exclusion) |
| `targets/`      | the iOS widget extension (`@bacons/apple-targets`)                                                                           |
| `patches/`      | source overlays on two dependencies, applied by `postinstall` — see below                                                    |
| `plugins/`      | config plugins for the iOS build: the SwiftUI link fix and the UIScene lifecycle iOS 26+ requires                            |
| `web/`          | the web app at soundshaper.juanevillam.com — React, Vite, Web Audio; see [`docs/web.md`](docs/web.md)                        |
| `media-worker/` | the Cloudflare Worker that lets the app delete its own Cloudinary uploads (it holds the API secret)                          |

`src/ui`, `src/core` and `src/trophies` began life as shared packages in a
portfolio monorepo and moved here, history included, when Sound Shaper became
its own repository; their comments still mention the sibling apps they were
measured against.

## Develop

```sh
npm install            # postinstall applies patches/
node scripts/apply-patches.mjs   # …unless npm runs with ignore-scripts
npx husky              # installs the git hooks, which ignore-scripts also skips
npx expo run:ios
cd web && npm ci && npm run dev   # the web app
```

`ios/` is prebuild output and gitignored; all native config is
`app.json` plus config plugins. Firebase's client config files
(`GoogleService-Info.plist`, and the web's `web/src/firebaseConfig.ts`) are committed — they
identify the project and are public by design; access is enforced by
`firestore.rules`.

## The audio graph is partly patched

Playback runs through `react-native-audio-api`, and its time-stretcher — the
path behind **Preserve Pitch** at any speed other than 1× — is replaced by a
phase vocoder (vendored Signalsmith Stretch) via
[`patches/react-native-audio-api/`](patches/react-native-audio-api/README.md).
The library's own stretcher was voice-grade and audibly granular on music.

`scripts/apply-patches.mjs` refuses to run against any other version of a
patched package, so a dependency bump fails the install until its overlay is
re-verified. Any change to that C++ needs a native rebuild — it compiles into
the pod, so a Metro reload keeps running the old stretcher.

## Standards

[`AGENTS.md`](AGENTS.md) is the product and engineering record: what each
surface is and why, what was measured, what was tried and rejected. The house
rules it applies — native primitive first, monochrome, Apple's voice,
skeletons that share geometry — are in [`docs/standards.md`](docs/standards.md).

## License

All rights reserved — see [`LICENSE`](LICENSE). The source is public to read;
it is not licensed for reuse or redistribution. Vendored third-party code keeps
its own license.
