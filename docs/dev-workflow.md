# Working in this repo — workflow traps & verification recipes

Institutional knowledge that used to live only in one Claude account's memory.
Any agent (or human) working here hits these; read before the first commit and
before trusting any on-device verification.

## Git

- **Commit directly on `main`.** No feature branches — solo-author repo,
  stated preference (2026-07-17). Commit in logical conventional-commit
  chunks; don't push unless asked.
- **Commits are SSH-signed and WILL HANG in a non-interactive shell** if the
  agent's ssh-agent has no identity: `commit.gpgsign=true`, `gpg.format=ssh`,
  passphrase-protected `~/.ssh/id_ed25519`. The hang looks like a timeout
  after lint-staged finishes — it is the passphrase prompt, not the hook.
  Check `ssh-add -l` first; if empty, the human runs
  `ssh-add ~/.ssh/id_ed25519` once. **Never fall back to `--no-gpg-sign`.**
  Local `git log --show-signature` misleadingly reports "No signature" — the
  signature IS embedded (`git cat-file commit HEAD | grep "SSH SIGNATURE"`);
  GitHub verifies fine.
- Pre-commit hook = lint-staged (eslint + prettier), ~10s.

## Metro — never trust a plain reload

Metro can serve a **stale bundle** after rapid edits (touch + `/reload` does
NOT fix it), and it has three nastier variants. The standing rule: after
several quick edits, verify a SPECIFIC new string/element actually rendered
(screenshot) before concluding a change works.

- **Reset recipe:** kill everything on 8081
  (`lsof -tiTCP:8081 | xargs kill -9`; `pkill -9 -f "expo start"`), then
  `cd apps/<app> && npx expo start --clear`, then Android: `adb reverse
tcp:8081 tcp:8081` + force-stop + deep-link relaunch; iOS sim: terminate +
  relaunch (reaches localhost directly).
- **Cross-app bundle collision (monorepo-specific):** all apps use port 8081,
  so launching app B while app A's Metro runs makes **B silently load A's
  bundle** — window focus shows B's package, the screen shows A's UI, nothing
  errors. Before trusting any screenshot, ask Metro who it serves:
  `curl -s localhost:8081/ -H "expo-platform: android" | python3 -c
"import json,sys;c=json.load(sys.stdin)['extra']['expoClient'];print(c['name'])"`.
  Never run two apps' Metros at once.
- **New `.ios.tsx`/`.android.tsx` files are not picked up live** — Metro keeps
  resolving the old non-platform file across reloads. Full
  `expo start --clear` restart required.
- **DNS down ⇒ manifest hangs while bundles work**: `expo start` calls
  `api.expo.dev` when serving `/`; with DNS failing the client shows "Failed
  to load app" though `/status` is 200. Fix: `npx expo start --offline`. On
  the simulator prefer `127.0.0.1` over `localhost` in deep links.
  (Also: Juan's OpenVPN kills mDNSResponder DNS — `dig` works, `curl`
  doesn't — which additionally breaks `pod install`.)
- `expo prebuild --clean` wipes `android/local.properties` and `expo
run:android` does NOT restore it → `SDK location not found`. Recreate:
  `sdk.dir=/Users/juanevillam/Library/Android/sdk`.

## CocoaPods — "no such module X" is usually a corrupt cache

Seen on Topper (FirebaseSessions → GoogleDataTransport, exit 65): a corrupt
CocoaPods cache extracts an **empty** pod dir, CocoaPods then builds it as a
source-less aggregate target with no clang module. The tell during
`pod install`: `Unable to read the license file 'LICENSE' for the spec …`.
Confirm with `find ios/Pods/<Pod> -name '*.m' | wc -l` → 0. Fix:
`pod cache clean <Pod> --all && rm -rf ios/Pods/<Pod> && pod install`
(with `LANG=en_US.UTF-8`). Check this BEFORE touching module/search-path
build settings — EBM flags and search-path injections were red herrings.
Corrupt DerivedData (`disk I/O error` on build.db) and a stale
`React-Core-prebuilt` extraction are separate cache layers that can mask it;
clear one at a time.

## iOS `formSheet` — a screen pushed on one gets NO back button

Verified on Topper 2026-08-05 (RNScreens / iOS 26.5). Present a screen with
`presentation: 'formSheet'` and then `router.push` another screen from inside
it: the child renders with **no back chevron and no interactive edge-swipe**.
The user is trapped one level inside the sheet with only the grabber, which
dismisses the whole thing.

- Not fixable from JS options: `headerBackVisible: true` **plus**
  `headerBackTitle` were forced on the child and changed nothing. Removing the
  parent's `headerLeft: () => null` / `headerBackVisible: false` also changed
  nothing — those only ever affected the sheet's own root.
- **Reload fully before believing either result.** A layout-file change here
  does NOT hot-reload; the first two runs of this test were measuring a stale
  bundle (see the Metro section above).
- Consequence: a sheet is only safe as a LEAF. If the surface pushes children,
  either give it a nested `Stack` under its own route group, or present the
  children as stacked sheets of their own. expo-ui-starter's Settings sheet
  never hit this because it pushes nothing; Topper's Settings does, and took
  the stacked-sheets route — see `IOS_SHEET_SCREENS` in `lib/sheetRoutes.ts`.

## `headerLargeTitle` needs a TRANSLUCENT bar to collapse

`headerTransparent: true` is not only about the Liquid Glass look — it is what
lets the large title collapse at all. With `headerTransparent: false` RNScreens
insets the content into its own container below the bar, UIKit loses track of
the scroll view, and the large title neither collapses into an inline one nor
stays put: it scrolls away and leaves an EMPTY bar. Silent, and only visible
once the content is long enough to scroll.

Corollary that cost a detour here: a SwiftUI `Form` inside a `Host` collapses
the title perfectly well under a translucent bar, sheet or not. "RNScreens
cannot drive the collapse from a SwiftUI scroller" was written into this repo as
fact and is WRONG for the sheet case — check it before repeating it. What does
hold: a screen that pins its own RN chrome ABOVE its scroller has nothing
adjacent to the bar, so it needs an opaque one (Topper's top detail, and the
Trophies sheet with its progress summary).

## Fast verification recipes

- **Deep-link straight to a screen** instead of tapping through:
  expo-ui-starter → `expouistarter://showcase/ios/<route>`; dev-client cold
  load pinned to Metro → `exp+<slug>://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`.
- **Appearance switch on the sim:** `xcrun simctl ui booted appearance
dark|light` — verify BOTH modes; light-mode-only bugs have shipped-almost
  twice.
- **Android undo-window hazard:** never run slow inspection (uiautomator
  dump) inside a snackbar's undo window — it once committed a real delete.

## Pixel-imitation harness — "measured, not guessed" applies to VERIFICATION

House precedent (`formMetrics.ts`, `BrandTile.ios.tsx`, the ictool workflow):
constants that imitate the OS are measured, never invented. The same applies
to _checking_ them. When authored RN imitates a native surface:

1. Screenshot the REAL surface (the in-app SwiftUI showcase twin, or Apple's
   own app — Settings) and the imitation, **both modes**, same simulator.
2. Band-scan both with the same script (PIL): background/card colors at fixed
   probes, card edges/insets, separator groups (thickness, insets, color),
   row pitch, glyph bands, brightest-pixel text colors. Compare a printed
   table — never memory, never eyeballs.
3. **Same-letter rule:** compare cap heights / weights only on the same
   letter ('F' vs 'F', 'u' vs 'u'; stem width = intensity-sum ÷ peak).
   Whole-word glyph bands lie — ascenders/descenders differ per word.
   Crop and LOOK at what you measured before trusting the numbers.
4. Harness sanity check: if ref and imitation match on every metric including
   known-different ones, the capture grabbed the same screen twice.

Worked example: `HomeShowcaseList.tsx` (expo-ui-starter) — its constants
header documents the measured values and what drifted on the first guess.
