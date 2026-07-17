# Sound Shaper

Third portfolio app: a social music player + tweaker. Upload your own `.mp3`s,
read their tags, play them, clip the best parts, top other people's songs. Same
mentality as Topper — native UI per platform, shared portfolio Welcome /
Settings / Manage-account screens, full Firebase, no self-hosted backend.

**The build plan is the source of truth:**
[`../../docs/sound-shaper-plan.md`](../../docs/sound-shaper-plan.md) — scope,
data model, phases, and the copyright rule (owner hears the full song, the
public feed plays only the clip preview).

## Status

**P0 — scaffold + auth.** Copied from `expo-starter` (wiring) + Topper's
Firebase/auth shell. Not runnable until the Firebase project exists (see the
three `REPLACE_WITH_*` placeholders in `app.json` + `.firebaserc`, and the two
missing native config files `google-services.json` / `GoogleService-Info.plist`).

Brand is deliberately **deferred to the end** — the launcher icon / splash /
welcome hero currently use **placeholder art borrowed from expo-starter**; the
Welcome hero falls back to the app initial (no `logo` prop yet). Replace with a
real stroke glyph (48-grid, stroke 3.25, sibling to the Topper crown) at the
brand phase.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing native code. `@expo/ui` (Jetpack Compose + SwiftUI) markdown snapshots
live in `../expo-starter/docs/`. The installed TypeScript types under
`node_modules/@expo/ui` are the source of truth when the docs disagree.

## Native projects (CNG)

`android/` and `ios/` are **gitignored prebuild output** — never hand-edit them.
All native config lives in `app.json` + `expo-build-properties`. Regenerate with
`npx expo prebuild --clean`.
