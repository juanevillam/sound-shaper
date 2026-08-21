# Sound Shaper

Third portfolio app: a **PERSONAL** music player + tweaker — zero social
features, by design (2026-07-18): every upload is for the uploader alone, which
keeps the copyright surface at zero. Upload your own `.mp3`s, read their tags,
play them, shape the sound. Same engineering mentality as Topper — native UI
per platform, shared portfolio Welcome / Settings / Manage-account screens,
full Firebase (Spark), no self-hosted backend.

**No tabs, no playlists.** Home is the single root screen: a 2-column grid of
SONG tiles (cover art + title/artist) plus an Add-song tile — you upload a
song and it's just there (flat library at `users/{uid}/songs`, newest first;
playlists were dropped 2026-07-19). The player is NOT a route: a bottom banner
that expands in place (PlayerSheet). There is NO Explore and NO profile
screen. Don't reintroduce social affordances (visibility toggles, feeds,
follows) or playlists — simplicity is the point.

**Where Settings and Account live (iOS, 2026-08-20).** Home's bar carries TWO
trailing glyphs in one merged Liquid Glass pill — Account, then Settings — and
both present as full-height native FORM SHEETS, with Trophies stacking over
Account. That is the portfolio-wide placement, matching Topper and
expo-ui-starter; the route table and the reasoning are in `lib/sheetRoutes.ts`
(`IOS_SHEET_SCREENS`). Account is the identity surface here, the way the
Profile header is in Topper — a personal app has no profile tab for it to hang
off. ANDROID IS UNCHANGED: there these are ordinary pushed Material screens and
Trophies stays a row in Settings.

**EVERYTHING A PERSON READS SAYS "SOUND", AND SO DOES THE CODE** (2026-08-21).
The copy was already all "sound"; the app underneath still said "song"
everywhere — keys, types, components, stores, services, params. It is renamed
(`SoundTile`, `useSoundsStore`, `soundId`, `soundEdit.*`), because a library
that takes any MP3 holds ringtones and voice memos as readily as tracks, and
calling those "songs" makes a claim about the product nobody wants to make.

**One string deliberately still says `songs`:** the Firestore subcollection in
`services/firebase/collections.ts`. Nobody reads a wire path, and renaming it
would migrate every existing document and re-point both `firestore.rules` and
the account-deletion sweep — the sweep that once silently deleted nothing
because of a wrong-but-legal path. `soundId` was safe to rename because it is
only ever a path PARAMETER, never a stored field.

**Cover art is the person's to choose** (2026-08-21). It came from the file's
ID3 tag and nowhere else, so a sound without one showed a permanent placeholder
— wrong for a library that takes any MP3. `expo-image-picker` (native: needs a
prebuild) plus `hooks/useCoverPicker` give the editor a real picker, in Topper's
two-step deferred shape: picking is cheap and reversible, the upload waits for
save, so cancelling never orphans a Cloudinary asset this app has no signed call
to delete. Replacing a cover DOES orphan the old one — the same accepted gap
deleting a sound has.

The disc presses now, so its caption became an ACTION inside the press target in
the accent ("Add Artwork" / "Change Artwork"), which is exactly Topper's
arrangement. It had been a muted `Button` in `SheetFormMediaIos`'s own slot, and
that — not taste — is why it read at a different size and colour than Topper's
"Change Photo".

**The Android half of the picker is written and UNVERIFIED.** It typechecks and
it mirrors iOS, but nothing Android is installed — see the root AGENTS.md.
Re-check it on device when Android resumes.

**THE ARTWORK WASH IS AT FULL STRENGTH, AND THE GLYPHS ARE PROTECTED
SEPARATELY** (2026-08-21). The blurred cover used to be drawn at 0.62 opacity,
which mixed 38% of the page colour into every wash — subtle by design, but that
mix was also the only thing keeping the bar glyphs legible, since a dark cover
could never pull the top band very dark. Only the first of those was wanted.

The cover carries its own colour now (opacity 1) and the gradient's mid-range
was pulled back so the colour survives further down. Readability is guaranteed
by two things instead:

- **A scrim ramp held flat across the bar row, and only there.** The gradient's
  offsets are in the OVERSCANNED box, not the screen — screen y maps to
  `(OVERSCAN + y) / (OVERSCAN * 2 + screenH)`, so 0.211 is the screen's top and
  0.281 is just under the bar. A ramp that starts decaying at the top edge has
  already lost two thirds of itself by the glyphs' own centre; measured at
  1.34:1 before that was corrected. Holding it flat costs the wash almost
  nothing, because the cover is an opaque layer ABOVE this one starting at
  y 119 — between the bar and there, the wash shows only in two 16pt gutters.
- **The bar glyphs stand on `GlassSurfaceIos` discs**, the same floating
  material the rest of the app uses. Glass alone is NOT sufficient and was
  tried: over a near-black cover in light mode its floor only reached
  (36,36,37), i.e. 1.35:1.

Worst cases measured on iPhone 17 / iOS 26.5, both far above the 3:1 a UI glyph
needs: light mode over a near-black cover, glyph (1,1,1) on a (190,190,191)
disc — **11.24:1**; dark mode over a bright cover, glyph (253,253,253) on a
(69,69,69) disc — **9.43:1**.

**Do not solve this with a scrim floor alone.** It was costed: a pure-black
cover in light mode needs ~0.37 of page colour across the whole top to clear
3:1, which flattens the wash for exactly the covers it should be strongest on.

**SHEET SIZES ARE MEASURED, not defaulted** (2026-08-21). The three player
sheets shared one note — "a large sheet is the iOS idiom for an editor anyway" —
which is a default, while Topper's two editors were content-measured. Audited on
iPhone 17 / iOS 26.5 and each now states its own reason in `IOS_FORM_SHEETS`:

- `shaper` **[1]** — a PRIMARY surface, like Settings and Account. It scrolls at
  any size, and [1] also drops the fractional-detent dimming (below the large
  detent iOS renders the sheet's SwiftUI in the inactive appearance, so its
  sliders and picker value were desaturated).
- `clips` **[1]** — it is a LIST, and every list sheet in the portfolio is [1]
  (Topper's follow-list, people, trash, blocked-users). At 0.6 an empty list left
  361pt — three quarters of the sheet — empty. A size that fits an empty list is
  wrong the moment it fills.
- `edit-sound` **[0.8]** — content-sized. Content is 566pt; 0.9 left 144pt of
  slack, 0.8 leaves the home-indicator clearance and a little air. Re-measure if
  the form gains or loses a row.
- `sound-info`, `trophy-detail` — `fitToContents`, and they must stay RN: a
  native `Form` is a scroll container with no intrinsic height and renders 0pt
  tall under that detent.

**A FULL-HEIGHT LIST SHEET NEEDS A REAL EMPTY STATE.** Clips rendered its empty
branch as a grouped ROW pinned to the top, which was tolerable at 0.6 and plainly
wrong at [1] — a stray row above 600pt of nothing. It takes `EmptyState` inside
`StateWrap` now, REPLACING the form rather than sitting in one; placed inside,
the `Form` wraps it in a section row and it renders as an empty white capsule.
That is Topper's `trash` pattern.

**The player's CONSOLE has a platform twin; everything else about it does not
(iOS, 2026-08-20).** `PlayerSheet` owns what the two platforms genuinely share —
one `progress` shared value and its springs, the drag/skip gesture graph, the
neighbour paging, the collapsed banner, and the ONE artwork element that travels
between the two states. Only the console below the artwork is split:
`PlayerConsole.tsx` is Android's (Material, moved there verbatim) and
`PlayerConsole.ios.tsx` is iOS's. The contract and the geometry both halves
share live in `chrome.ts`.

A full `PlayerSheet.ios.tsx` was the obvious alternative and is the wrong shape:
only SEVEN of that file's 1751 lines were platform branches, so a twin would
copy ~700 lines of frame-verified animation and gesture code that has nothing to
do with either platform's look, and a copy of it rots the moment one side is
touched.

**ANDROID IS NOT BEING VERIFIED, AND THAT IS THE CONSTRAINT THAT MATTERS.**
The root AGENTS.md's July 2026 RELEASE freeze names Topper and Expo UI Starter,
and this app came after it — so a reading of the letter says Sound Shaper's
Android is not release-frozen. That reading is useless in practice and was
briefly acted on here. The working rule (Juan, 2026-08-21) is that the whole
portfolio is iOS-only until iOS is completely done: no Android app is installed,
no Android change is run, and nothing Android can be verified at all.

So Android code may still be EDITED where a feature genuinely spans both twins
— but anything written there ships UNVERIFIED and has to be re-checked when
Android comes back. Do not treat an Android edit as done because it typechecks.

**The iOS console is a designed surface, not Android's with parts swapped.**
What it replaced was a Material now-playing screen — a 64pt filled `primary`
FAB with a 19pt glyph swimming in it, two outlined cards, an accent on
everything, and the whole column top-loaded so 164pt of the screen below it was
dead (band-scanned: content ended at 676 on an 874pt screen). Its four rules are
in the file's header; the ones worth knowing before touching it:

- **ONE CONTENT BOX.** Artwork, title, scrubber, transport and footer all run to
  the same two edges, at the app's own `SCREEN_PADDING` — which is also the
  collapsed banner's inset, so the surface's sides never move as it expands. The
  artwork's size is that box's width, a RULE rather than the bare 0.58 fraction
  it replaced, and its corner is `artworkRadius`'s ratio (the player was that
  term's one unconverted caller, drawing a grouped-CARD constant on a picture).
- **NO ACCENT.** `PlayerBackdrop` tints the ground from the cover and every
  control stays `onSurface` — including the SwiftUI `Slider`, which needs an
  explicit `tint`. Clip-framing is the one exception and is deliberate: the trim
  brackets mark a SELECTION and Save is a filled brand action.
- **A BAR ROW, AND IT IS NOT A GRABBER.** `chevron.down` leading, the overflow
  `Menu` trailing, both at the portfolio's 43pt bar target. Two alternatives were
  built and rejected: a sheet GRABBER (this surface has a bottom sheet's dismiss
  gesture but is not a sheet, and a grabber is UIKit's promise that it is one)
  and hanging the overflow off the TITLE (a "…" that acts on the screen does not
  belong inside the copy naming the song). What must not come back is how the
  ORIGINAL row was built — on `IconButton`'s `matchContents` Host, which moved it
  79pt on a re-render. Every host in the row states its box.
- **THE COVER SHRINKS TO 0.88 WHILE PAUSED**, critically damped, scaled by the
  expand ramp so it exists only on the open console. 0.94 read as a rendering
  wobble, 0.82 opened a gap under the bar row.

Band-scanned on iPhone 17 / iOS 26.5, identical across an 8-frame burst with no
interaction: bar glyph ink 79.00, artwork 119.00 (inset 62 + target 43 + gap
14), footer 766.00 → 827.00, clearance below 47.00 (inset 34 +
`FLOATING_EDGE_GAP` 12). Cover 369.00 wide playing, 324.00 paused, centre held.
A LIVE appearance switch reads the same numbers, which is the proof the
`matchContents` header jump is gone.

**The player's four sheets are on TOPPER'S bar** (2026-08-21). `shaper`,
`clips` and `edit-sound` are `titled` in `IOS_FORM_SHEETS` and state their bar
through `sheetCommitBarOptionsIos` (or, for `clips`, their own slots — it
commits nothing, so its trailing glyph is `plus`, not a ✓). They drew an
authored header above their Form before, which cannot have genuine Liquid Glass
and carried the filled-primary-disc ✓ that Topper already rejected.
`sound-info` stays untitled and stays RN on purpose: a `fitToContents` sheet is
too short for a bar, and a native `Form` renders 0pt tall inside one.

**Home's iOS header is the SYSTEM large title**, not the shared
`CollapsingHeaderBar` (Android still uses that). The one thing it costs is
spelled out in `home.tsx`: the bar EMPTIES while the player is expanded rather
than hiding, because hiding it re-lays-out the screen and drops the player 8.67pt.

**The dev state lab is on** (`src/dev/flags.ts` → `STATE_LAB`). It pins home,
the account sheet and trophies to any of their UI states; the picker is the
shared `StateLab`. While it is on, the real account deletion is REFUSED
(`dev/deleteAccountGuard`) — turn the flag off to delete for real. THERE ARE NO
FIXTURES and none are to be added.

**The build plan is the source of truth:**
[`../../docs/sound-shaper-plan.md`](../../docs/sound-shaper-plan.md) — scope,
data model, phases, and the copyright rule (owner hears the full song, the
public feed plays only the clip preview).

## Status

**Flat-library phase — Android-first.** Auth (Google/Apple), song upload
(document-picker → ID3 parse `src/lib/id3.ts` → `EditSongSheet` →
**Cloudinary** audio as a `video` resource + embedded art → Firestore at
`users/{uid}/songs`), the song-tile home grid, and the expanding PlayerSheet
(audio-api playback through the EQ graph, Shape/Clips pages) are all built and
device-verified. Long-press a tile edits/deletes; tapping plays and opens the
player.

**No Firebase Storage, no Cloud Functions** — both need the Blaze (paid) plan,
and this app stays on Spark (free). Media goes to **Cloudinary** (same cloud
`juanevillam` as Topper, unsigned preset `sound_shaper_unsigned`,
`src/services/cloudinary/`). Consequence: Cloudinary deletion needs a signed
backend call we don't have, so deleting a song/playlist orphans its Cloudinary
assets (a known gap, exactly Topper's pre-Functions state).

Playback runs on **react-native-audio-api** (expo-audio is gone from the
player): a streaming `<Audio>` element routed through a Web-Audio shaping
graph — preamp + 5 biquad EQ bands (`src/lib/audioEngine.ts`,
`src/components/player/AudioEngine.tsx`, shaper settings in
`src/store/shaper.ts`) — with speed presets 0.5–2×, keep-pitch, clips
(personal replay bookmarks), and background playback via the plugin's media
foreground service.

Deliberate gaps, in build order: lock-screen now-playing metadata, and
Cloudinary media on account deletion (the audio and artwork orphan — deleting
them needs a signed backend call this app doesn't have, the same accepted gap as
deleting a single song).

**Account deletion is `hooks/useDeleteAccount` on iOS** — re-auth FIRST, then the
Firestore sweep, then the Apple token revoke, then the Auth user. Android calls
the combined `deleteAccount` and has no re-auth. Its sweep silently deleted no
songs or clips until 2026-08-20 (wrong collection paths that were still legal
paths); the refs now mirror `songs.ts` / `clips.ts` exactly, and any new
subcollection has to be added there or a recreated account inherits it.

Brand is deliberately **deferred to the end** — the launcher icon / splash /
welcome hero currently use **placeholder art borrowed from expo-ui-starter**; the
Welcome hero falls back to the app initial (no `logo` prop yet). Replace with a
real stroke glyph (48-grid, stroke 3.25, sibling to the Topper crown) at the
brand phase.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing native code. `@expo/ui` (Jetpack Compose + SwiftUI) markdown snapshots
live in `../expo-ui-starter/docs/`. The installed TypeScript types under
`node_modules/@expo/ui` are the source of truth when the docs disagree.

## Sign in with Apple is temporarily OFF (free-team dev)

`APPLE_SIGN_IN_ENABLED = false` in `src/app/(welcome)/welcome.tsx` hides the
button on iOS, so the welcome screen offers Google alone. The
`com.apple.developer.applesignin` entitlement needs a PAID Apple Developer
membership, which the free personal team can't sign — a button that can only
fail is worse than no button. The entitlement itself is stripped by
`ios.usesAppleSignIn: false` plus `plugins/with-strip-apple-signin.js`, which
must stay the **FIRST** entry in `app.json`'s `plugins` array (the entitlements
mod registered earliest runs last, so listing it later loses to
`expo-apple-authentication`). Revert all three together once the paid account
lands — App Store policy requires Apple sign-in wherever Google is offered.
Nothing was deleted: `useAppleSignIn.ios.ts`, `services/firebase/appleAuth.ts`
and `AppleSignInButton` stay wired and correct.

## iOS build recipe — same as Topper's, deliberately

`expo-build-properties` carries **only** `ios: { useFrameworks: "static" }`, and
`package.json` carries `expo.autolinking.apple.buildFromSource: ["ExpoImage"]`.
That pair dodges the precompiled-`ExpoModulesCore` ABI drift (source-build just
the one drifted pod) while keeping precompiled modules **on**, which is what
keeps `RNFBFirestore` compiling under `use_frameworks!`.

This app used to also set `usePrecompiledModules: false` +
`buildReactNativeFromSource: true`, which forced React Native itself to compile
from source — roughly 45 min per clean build instead of 15. That was written
before Topper's narrower fix had ever been proven, and was dropped 2026-07-30.
**Don't reintroduce it.** If a launch-time `dyld` abort ever comes back
(`Symbol not found: …_decorateModule…`), the fix is to add the offending module
to `buildFromSource`, not to turn precompiled modules off globally — verify
statically with `nm -u` per module against `nm -gU` on `ExpoModulesCore`, on
both the `ios-arm64` and `ios-arm64_x86_64-simulator` slices.

## Native projects (CNG)

`android/` and `ios/` are **gitignored prebuild output** — never hand-edit them.
All native config lives in `app.json` + `expo-build-properties`. Regenerate with
`npx expo prebuild --clean`.
