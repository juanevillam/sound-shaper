# @expo/ui overlay — deterministic ModalBottomSheet content insets (Android)

One file: `android/src/main/java/expo/modules/ui/ModalBottomSheetView.kt`.
It passes `contentWindowInsets = { WindowInsets(0, 0, 0, 0) }` to Material3's
`ModalBottomSheet` (plus the import), and nothing else. Kotlin compiles into
the `ExpoUI` module, so changing this needs a **native rebuild** — a Metro
reload proves nothing.

## What it fixes

Material3 1.5.0-alpha17's default is `contentWindowInsets =
{ BottomSheetDefaults.modalWindowInsets }` — `safeDrawing.only(Top + Bottom)`,
applied as `windowInsetsPadding` on the content column inside the sheet's
Surface. `@expo/ui` 57.0.7 forwards no override and exposes no prop or
modifier that can reach it (`consumeWindowInsets` is not in its modifier
registry, and the sheet `modifier` prop lands on the Surface below nothing).

Measured on the Galaxy A54 (SM-A546E, Android 16, 3-button nav, 48dp bar),
Topper comments sheet, dark: on FIRST render the pinned composer's send disc
bottom sat 70.04dp above the navigation bar top (48 of M3 inset + 14 of app
padding + 8 disc lift); after ONE keyboard open/close the same disc sat
22.40dp above it — the M3 inset padding collapses to 0 after an IME cycle in
the dialog window and never comes back. Every Compose sheet in the portfolio
was therefore 48dp too tall-footed on first render and "settled" only after
the keyboard had been up once.

The JS side already owns the deterministic answer:
`composeSheetBottomPadding(insets.bottom)` (packages/mobile-ui/sheetMetrics)
pads the content end from the WINDOW edge. With M3's unstable contribution
zeroed, first render equals settled render on every sheet.

## The Android twin of the iOS precompiled trap

SDK 57 resolves Android expo modules from PREBUILT AARs too
(`expo-module.config.json` → `android.publication`, a local maven repo), so
this overlay **never compiles** unless the app forces the module from source:

    "expo": { "autolinking": { "android": { "buildFromSource": ["expo-ui"] } } }

in that app's `package.json` (the regex matches the gradle project name,
`expo-ui`). Topper carries it; add it to any other app that adopts the
overlay. The tell that it is missing: a gradle build with zero
`Task :expo-ui:*` lines while the sheet keeps its old inset behaviour.

## How to re-verify after a bump

1. `node scripts/apply-patches.mjs` must pass (bump `patch.json` only after
   re-reading the new `ModalBottomSheetView.kt` and re-applying the change).
2. Rebuild Topper Android, open a top's comments sheet COLD, and band-scan the
   composer: its hairline and send disc must sit at the same y on the first
   frame as after one keyboard open/close (Δ = 0, was Δ = 48dp).

## Retirement

Upstream fix = `@expo/ui` exposing `contentWindowInsets` (or any window-inset
control) on `ModalBottomSheet`. On every `@expo/ui` bump, grep the new
`ModalBottomSheetView.kt` for `contentWindowInsets` — if it appears, DELETE
this overlay and set the insets from JS instead. Tracked in
`docs/pending-upstream.md`. Nothing is being filed upstream, matching the
audio-api overlay's standing decision.
