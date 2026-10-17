# House standards

The rules every surface of Sound Shaper is held to. They were written for a
portfolio of three apps (Topper, Sound Shaper and Booker) that shared one UI
kit — the kit that is `src/ui`, `src/core` and `src/trophies` here — so the
reasoning still names the other two apps where that is where a rule was
learned. Read those as the record of how a rule was found; the rule is this
app's.

Paths in the text predate the move: `packages/mobile-ui` is `src/ui`,
`packages/core` is `src/core`, `packages/trophies` is `src/trophies`,
`packages/widget-bridge` is `modules/widget-bridge`, `apps/sound-shaper/` is
the repository root, and `services/media-worker` is `media-worker/`.

## Platform

**BOTH PLATFORMS ARE DONE AND SETTLED (2026-09-11).** Android was frozen from
July 2026 to 2026-08-29, then brought to its iOS twin's native-feel level across
Phase B's four stages; every app of the time is through all four. The active
workstream is now [`docs/phase-c-release.md`](docs/phase-c-release.md) — the
release gates — not either platform's feel.

iOS remains the REFERENCE for the result — what a surface should end up being —
never for the means, which stay Material 3 / Compose. **Neither side is frozen
now**, so a change to one is a change that owes the other a look.

The standing target is the **Galaxy A54 (SM-A546E, Android 16 / API 36, adb
`RZCWA02YXTB`, density 450 → dp = px / 2.8125)**.

**"Written, but UNVERIFIED" is not an acceptable state.** Anything you touch on
Android is walked on the device before you call it done.

**WHAT THE FREEZE LEFT BEHIND IS THE REAL HAZARD, and it outlives the freeze.**
For a year almost every Android divergence was explained by "Android is frozen",
which is a statement about the SCHEDULE wearing the clothes of a design
decision. Sweeping those out on 2026-08-29 turned up three kinds underneath, and
only the first was a real reason:

- a genuine platform idiom (Material groups legal with About; account lives in
  Settings; a Compose row has one size) — the freeze was decoration on an
  argument that stood on its own;
- an OPEN GAP nobody had revisited (Android still shows the comment-nudge card,
  still has a comment edit flow, still says the wrong words for a failed search,
  still misses an empty-state subtitle);
- a decision built on an EXPIRED BLOCKER — the brand tile was flat because
  `react-native-svg`'s `FeGaussianBlur` "no-ops on Android", which had not been
  true for some time, and a welcome row carried the row below it's metaphor
  because "Android is frozen".

So: **a reason that names a schedule, a version, or a tool's limitation is a
claim with an expiry date.** Re-test it before you design around it — one render
on the device is cheaper than a year of inherited workaround. And never write a
new one: say what the platform argument IS, or say plainly that it is an open
gap.

**Features and flows still need an explicit ask.** Phase B was about closing the
native-feel gap and re-checking what shipped blind — feel first — and it stayed
out of what the apps DO. That is still Juan's call, and the sweep deliberately
made the remaining behaviour divergences loud rather than quiet so he can make
it. Phase C narrows the licence further: everything in it is a submission
blocker, so a change that is neither a gate nor asked for does not belong in
it.

## Orientation is UNLOCKED, and landscape is knowingly unfinished

Every app sets `expo.orientation: "default"`, so the device rotates them.
It was `"portrait"` for three days (2026-09-08 → 09-11) and Juan reversed it:
**a person is allowed to turn their phone, and an app that refuses is worse
than one that looks rough for a moment.** Landscape responsiveness is real
future work rather than a decision against it, and leaving the app rotatable is
what keeps that visible instead of quietly closed off.

So: **do not "fix" a landscape layout by re-locking the orientation.** Fix the
layout, or leave it rough and say so. This is native config — it lands at the
next `prebuild`, and an installed dev client keeps its old behaviour until
rebuilt.

## Native projects & versioning

- **CNG:** `apps/*/android` and `apps/*/ios` are **gitignored prebuild output** —
  never hand-edit them; all native config lives in each app's `app.json` +
  config plugins (`expo-build-properties` for gradle/plist knobs). Regenerate
  with `npx expo prebuild --clean`, which wipes `android/local.properties` —
  **nothing restores it**, and builds work anyway because `~/.zshrc` exports
  `ANDROID_HOME`, which Gradle falls back to. A shell without that env var
  fails with `SDK location not found`; see
  [`docs/dev-workflow.md`](docs/dev-workflow.md).
- **Versioning:** no release tags. Each app's version = `expo.version` in its
  `app.json` (surfaced in-app at Settings → About via `expo-application`);
  Android `versionCode` is EAS-remote-managed (`autoIncrement`) — never edit it.
  Release builds are EAS cloud builds with EAS-managed keystores.
- **Patched dependencies live in `patches/<package>/`**, a plain mirror of that
  package's file tree copied over `node_modules` by `scripts/apply-patches.mjs`
  from the root `postinstall`. So it survives `npm ci` (postinstall runs) and
  `prebuild --clean` (pods compile out of `node_modules`, which is already
  patched). **patch-package is deliberately NOT used** — it refuses to diff
  `react-native-audio-api` at all, because the package ships macCatalyst
  xcframework symlinks and `--include`/`--exclude` do not get around it.
  - Each overlay pins the version it was written against in `patch.json`, and
    the script **exits non-zero on any other version**, so a bump cannot
    silently drop patched files onto a package whose surroundings moved. Fix by
    re-verifying against the new version — following that overlay's
    `README.md`, which states what it changed and how it was measured — then
    updating `patch.json`. If upstream has fixed the thing, **delete the
    overlay** rather than rebasing it.
  - A patched C++ file compiles into the pod (iOS) or the `.so` (Android), so
    changing one needs a **native rebuild** — a Metro reload proves nothing.
  - Today: `react-native-audio-api` 0.13.2 carries FOUR files across TWO
    subjects. The first two are
    different halves of one feature. Its voice-grade WSOLA time-stretcher is
    replaced by a phase vocoder so Sound Shaper's Preserve Pitch is usable on
    music — **that file is `common/cpp/`, i.e. SHARED, and has always been
    compiled into Android too; nobody should ever "port" it.** What was
    Android-only was the stream underneath it: `AudioPlayer.cpp` opened an
    exclusive MMAP stream in `PerformanceMode::LowLatency`, a **2.0 ms**
    callback deadline the vocoder cannot land its FFT inside, so every rate
    ≠ 1× crackled on a Galaxy A54. It now opens a playback-shaped stream
    (`Shared` + `None`, 26.7 ms). **iOS never had the bug because it never
    asks** — nothing in `ios/` calls `setPreferredIOBufferDuration`, so
    AVAudioSession keeps its ~23 ms playback default. The measurements and the
    retirement conditions are in
    [`docs/pending-upstream.md`](docs/pending-upstream.md) and the overlay's own
    README — which also record that **nothing is being filed upstream, on
    purpose**.
  - The second subject is one defect in two languages: the now-playing
    artwork could not be CLEARED. `PlaybackNotification.mm` and
    `PlaybackNotification.kt` both MERGE a publish over the last one and hold
    the cover in a field that outlives the track, so a sound with no artwork
    inherited the previous sound's on the island, the Lock Screen and the shade
    — and no value a caller could send removed it, short of a `hide()` that on
    Android releases the MediaSession and zeroes the control bitmask. An empty
    `artwork` value now means REMOVE, and a generation counter stops a late
    load landing on a session that has moved on. **A REASON THAT NAMES AN
    OMITTED KEY IS A GUESS ABOUT MERGE SEMANTICS** — a now-playing publish is a
    PATCH, not a PUT, on both platforms, so absence never means "clear it".
- **iOS builds need two standing workarounds**, both of which survive
  `prebuild --clean` because they live in tracked config rather than in `ios/`.
  The first is wired in every app's `app.json`; the second in every app's
  `package.json` — don't drop either:
  - `plugins/with-ios-swiftui-link-fix.js` — `import SwiftUI` emits an implicit
    `-framework SwiftUICore` autolink that Xcode 26.6's `SwiftUICore.tbd`
    rejects ("not an allowed client"). The plugin injects
    `-Xfrontend -disable-autolink-framework -Xfrontend SwiftUICore` into the
    Podfile's `post_install` for every Swift target; SwiftUI re-exports
    SwiftUICore, so symbols still resolve. Without it, iOS won't link at all.
  - **Source-build the ONE drifted pod, don't turn precompiled modules off.**
    The monorepo has SDK 57 version drift — `expo` is 57.0.8 while
    `expo-modules-core` is 57.0.7 — and Expo's precompiled xcframeworks only
    work when versions agree. Mismatched ones abort in dyld at launch
    (`__abort_with_payload`, "Symbol not found" in an Expo module's framework,
    "Expected in: ExpoModulesCore"). Today exactly one pod drifts: the shipped
    `ExpoImage` xcframework calls a symbol `ExpoModulesCore` 57.0.7 no longer
    exports. So **every app** carries
    `expo.autolinking.apple.buildFromSource: ["ExpoImage"]` in its
    `package.json` and keep precompiled modules **on** — which is what keeps
    `RNFBFirestore` compiling, since React's modular headers stop resolving
    under Firebase's static frameworks when precompiled modules go off
    globally. No app turns precompiled modules off wholesale.
    Sound Shaper used to set it too (plus `buildReactNativeFromSource`), which
    compiled React Native itself — ~45 min per clean build against ~15 — and
    was dropped 2026-07-30 once Topper's narrower fix was proven. **Don't
    reintroduce it.** When a new dyld abort appears, add THAT module to
    `buildFromSource`; detect the mismatch statically with `nm -u` on the
    module's binary vs `nm -gU` on `ExpoModulesCore`, on both the `ios-arm64`
    and `ios-arm64_x86_64-simulator` slices.

## Native primitive first

**The platform's own component is the default** — Compose / Material 3 on
Android, SwiftUI (`@expo/ui`) on iOS. Authored RN is the exception and must
earn its place with an in-code comment naming the native component that was
rejected and what specifically failed (as
`expo-ui-searchbar-vs-textfield` does: SearchBar's IME is dead on 57, so a
Material `TextField` pill replaced it). **"It matches the rest of this screen"
is not a reason** — that is precisely how a screen drifts away from the OS as a
unit.

This was learned the expensive way. Topper's iOS edit sheets were built out of
RN views — a `Pressable` styled as a pill for delete, `TextInput`s painted to
look like fields — while the **Android** twins of the same sheets were already
100% Compose. The iOS "delete" pill was, unwittingly, Material's
`OutlinedButton` redrawn by hand and shipped on iOS. Beside the real control in
expo-ui-starter's Button showcase, the imitation was obvious.

Two corollaries:

- **Standardised means each platform uses ITS OWN kit**, never that iOS is made
  to look like Android (or vice versa). The two twins should feel like siblings,
  not clones.
- **Native containers, not just native controls.** A destructive action at the
  bottom of an iOS editor is a `Section` row in a grouped `Form` (Contacts'
  "Delete Contact"), not a button floating in a stack — and it is full width
  because the form makes it so, never because someone forced a frame onto it.

Known exceptions, so nobody "fixes" them: RN's `Switch` already IS a `UISwitch`
on iOS, and `GoogleSignInButton` is hand-built on purpose (Google's brand
guidelines dictate that button).

The running ledger of which iOS surfaces were converted, which stayed RN and why,
and the SwiftUI gotchas found doing it, lives in
[`docs/component-matrix.md`](docs/component-matrix.md) → "Native-first inventory".
Read it before declaring a surface impossible: several things recorded there as
blocked have since shipped (a hosted avatar inside a native `List` row, swipe
actions, `List.ForEach` reorder, a context menu with a real preview).

### TINT WHAT CARRIES MEANING; EVERYTHING ELSE TAKES THE INK

Monochrome is the house style on iOS — Juan's, and the portfolio's. It is NOT a
ban on the accent: an accent that carries information stays, and stripping it
would break the affordance it was doing.

**MONOCHROME IS NOT COLOURLESS, AND AN ACTION MUST READ AS AN ACTION** (Juan,
2026-08-22, after a grey swipe action shipped). This is the rule that outranks
the rest of this section, because getting it wrong costs USABILITY rather than
taste: a control whose colour has been taken away has to still say "you can do
this", and on iOS **grey is the vocabulary of DISABLED**. If a monochrome
treatment leaves a control looking switched-off, inert, or like a label, the
treatment is wrong and the colour goes back — whatever this section says about
inheritance.

The test is one question asked in BOTH appearances: _would someone know this is
tappable, and that it is available?_ Three ways a monochrome pass fails it, all
found on device today: the fill goes so light the label disappears into it
(prominent button, swipe action), the fill lands on a grey that iOS spends
elsewhere on disabled controls (swipe action), or the tint was the only thing
making a glyph read as a control rather than as text.

**THREE BUCKETS, and only the first is this rule's business.** INK is the
default — anything decorative or inherited. The ACCENT is Apple's own tint,
kept only where it carries information (the list below). PLATFORM SEMANTICS are
neither: destructive red, a switch's green, the podium's gold/silver/bronze, the
trophy tiers. Those are the OS's vocabulary or the product's, they are never
`primary`, and monochrome does not touch them.

**The accent STAYS where the colour IS the information:**

- a TEXT button — untinted, a text button stops reading as a button at all
  (`ListSectionIos`, the snackbar's action, a media slot's "Change Artwork")
- STATE with no other indicator — `PersonListRowIos` is literally
  `tint(following ? muted : primary)`
- SELECTION — a tab bar's active tab, clip-framing's trim frame
- a SWIPE ACTION and a BORDERED button — not because the hue means anything, but
  because both derive their label from the tint and the monochrome alternatives
  read as disabled (see the opening principle)
- destructive red, and a form's menu-picker VALUE (that one is Apple's own:
  Settings tints Language and Appearance itself)
- SEMANTIC palettes that are not the accent at all — podium gold/silver/bronze,
  trophy tiers

**It GOES where it was inherited or decorative** — a control tinted because the
system tints it by default, saying nothing. Sound Shaper's expanded player was
the worst case and the one that made the rule visible: a SwiftUI `Slider`'s
fill, a `Menu`'s label, card icons, all blue because that is the default, none
of it meaning anything.

**The tell for a redundant tint is a second indicator carrying the same fact.**
The home tile marked the playing sound BOTH with an equalizer badge over the
artwork and with a tinted title; the badge is white hairlines on a scrim
precisely because a brand-coloured badge "reads like a sticker", and a
brand-coloured title was that same instinct one line down. The trophies ring was
the same shape of miss — a gauge's information is its ARC and the number written
inside it, and Apple colours Activity rings only because there are THREE and
colour is what tells them apart.

**IT IS A BRAND RULE, AND IT CROSSES TO ANDROID** (Juan, 2026-08-29, reversing
what this paragraph said for the eight days it was written down). It used to
read "IT IS A PLATFORM RULE, NOT A REPAINT", and scoped every monochrome change
to `Platform.OS === 'ios'` or an `.ios.tsx` on the grounds that Android keeps
its accent. That was never the reason it was iOS-only — **Android was FROZEN**,
so iOS was simply the only side anyone could change. Phase B unfroze it, and
the monochrome neutrals are how `juanevillam` brands his apps rather than a
statement about what an Apple surface looks like. Both platforms take it.

**WHAT CROSSES IS THE RULE, NOT THE VERDICT.** The three buckets above are
unchanged and they still decide every site: INK by default, the ACCENT where
the colour IS the information, PLATFORM SEMANTICS untouched. Applied to
Android, the third bucket is doing more work than it does on iOS, because
Material spends the accent on things Apple does not — a progress indicator, an
active list item, a `Switch`'s track (which is why `switchOn` maps to `primary`
there and must keep doing so). Those are Material's vocabulary in exactly the
sense destructive red is Apple's, and monochrome has no claim on them. What it
DOES claim is the same thing it claimed on iOS: colour a control was given
because the framework tints it by default, saying nothing.

The welcome CTA is the worked example (2026-08-29). Material fills a `Button`
with the accent because that is the default, so the FILLED variant took
`containerColor: onSurface` / `contentColor: background`. The OUTLINED variant
kept the accent for the same reason `actionButtonModifiersIos` does — it
derives both its wash and its label from the tint, and the monochrome version
reads as disabled. The feature icons, the author credit and the legal links
kept it too, being state and text buttons. **The opening principle still
outranks everything here**, and it is the one to check on Android first: grey
is the vocabulary of disabled on BOTH platforms.

One mechanical difference worth not re-deriving: **Material DOES invert a
filled button's label for you.** `contentColor` is a real role on the
container, so Android has no counterpart to SwiftUI's `labelColor` trap. A bare
`AppIcon` is the exception — it does not inherit the container's content colour
the way `Text` does, so map its `tint` explicitly.

**No carve-out remains**: every surface in the portfolio is a product surface.
Only a purely demonstrative screen (a catalogue whose accent IS the
`tint` API being shown) would be exempt, and none exists.

Audited across all three apps on 2026-08-21: Topper needed NOTHING (its home,
profile, top-detail and explore were already monochrome but for selection and
the podium), the shared package needed one change (the trophies ring), and
Sound Shaper's player needed the rest.

**RE-AUDITED 2026-08-22, and the first pass had read the CODE rather than the
SCREEN.** Six accent sites were taken, and DEVICE VERIFICATION HANDED TWO BACK —
which is the part worth remembering, because both readings were defensible on
paper and only one survived being looked at.

Four went and stayed: the Shape sheet's `Toggle` (blue only because
`SheetFormBodyIos` tints the whole Form, and now green — see below), Topper's
reaction capsules, the FILLED variant of `ActionButtonIos` (with the empty-state
action and the Welcome capsule), the trophy overlay's platinum glow, and two
Form-level tints that reached no control at all.

Two came back, both for the same reason — they read as DISABLED: the two
non-destructive swipe actions, and `ActionButtonIos`'s BORDERED variant. The
opening principle is what they cost, and the mechanics are under it.

What never moved is what the rule already named — menu-picker values, text
buttons, Follow state, the tab bar's active tab, clip handles, destructive red,
the podium and tier palettes, and the `checkmark.circle.fill` verification seal,
which is a convention rather than an accent.

**TWO MECHANICAL TRAPS COME WITH GOING MONOCHROME, and both are invisible while
the colour is blue.**

- **A FILLED CONTROL DOES NOT INVERT ITS OWN LABEL.** SwiftUI draws a
  `borderedProminent` / `glassProminent` label WHITE whatever the tint is, so an
  `onSurface` fill is white-on-white in dark. Measured on device: the selected
  reaction capsule's count vanished. Pair every monochrome fill with
  `foregroundStyle(colors.background)` — `onSurface`'s inverse in both
  appearances — so the label follows the FILL rather than the colour scheme.
  `actionButtonModifiersIos` takes it as `labelColor`.
- **A SWIPE ACTION IS THE SAME TRAP WITHOUT THE ESCAPE HATCH, so it KEEPS THE
  ACCENT.** Its glyph and word are drawn WHITE whatever the tint, and unlike a
  prominent button it IGNORES `foregroundStyle` — both were tried on device, and
  `onSurface` shipped an empty white capsule in dark. The fill therefore has to
  be dark enough for white ink in BOTH appearances, which `onSurface` is not;
  and the greys that ARE (systemGray was tried and rejected on sight) read as
  DISABLED on a control that is anything but. Photos gives Recover the accent in
  its own Recently Deleted. That is where this lands.
- **A SWITCH IS NOT MONOCHROME'S TO TAKE, and two attempts proved it before the
  rule did.** Its knob is white and fixed, so `onSurface` is a solid white blob
  in dark, and a mid grey (`onSurfaceMuted`) reads as neither state in either
  appearance — Juan rejected that one on sight. Green is the answer, as
  `colors.switchOn`, because green-means-on is a PLATFORM SEMANTIC in the same
  class as destructive red, not brand colour this rule has any claim over: it is
  what Apple draws in Settings, and what RN's own `Switch` — a real `UISwitch` —
  shows without being told. Only a SwiftUI `Toggle` has to be told, because it
  takes the ambient accent and our Forms tint theirs `primary` for the
  menu-picker values.

### Press feedback is split by CONTAINER, not by component

Three treatments, and which one applies is decided by what a thing sits IN:

- **Tiles and cards SQUASH** — `SquashPressable` (`@portfolio/mobile-ui`), one
  spring for the whole portfolio (`PRESS_SCALE` 0.96, damping 22 / mass 0.4 /
  stiffness 360). Never hand-roll a scale.
- **Inline rows and text actions FADE** — `PRESSED_OPACITY` (same package).
- **Anything inside a NATIVE container takes the platform's own feedback** — a
  SwiftUI `List` row highlights itself; do not override it with a fade to
  "match" an RN row elsewhere. Two person rows on the same screen legitimately
  press differently when one is a native list row and the other is not.

`PRESSED_OPACITY` was declared in **seven** files at three different values
(0.5 / 0.6 / 0.7) before this was written down, so the same gesture on two rows
of one screen dimmed by different amounts. It is one exported constant now;
`BRAND_PRESSED_OPACITY` is the deliberate second value, for large filled brand
buttons only.

### Waiting has two shapes, and the wait's LENGTH does not pick between them

Before adding any loading state, decide which of Apple's progress controls it
is. There are three, and the rule is not "how long":

| control                       | stands for                                                                |
| ----------------------------- | ------------------------------------------------------------------------- |
| a bone (`SkeletonBone`)       | content whose SHAPE IS ALREADY KNOWN, on a screen the person NAVIGATED TO |
| a spinner (`ProgressViewIos`) | WORK THE PERSON STARTED, or content whose shape cannot be predicted       |
| a determinate bar or `Gauge`  | a known fraction of a known whole                                         |

A bone is a PROMISE about what is arriving. Home's feed, Explore's browse grid,
a top's items, Recently Deleted, the people sheets, a profile — each of those is
a layout that is genuinely going to land, and standing it early is the whole
point. Keeping the bone there is the default, and the count of them is not by
itself a smell: nine of Topper's eleven iOS loading surfaces are bones and every
one of them is right.

**A bone that cannot keep its promise is the defect.** Explore's SEARCH results
are a mix of person rows and top rows in a proportion and a count nothing knows
until the query answers, so its bone set stood four people and a header and then
handed over one top. It was also the only one that fired per REFINEMENT rather
than per screen. That is the spinner's case on both counts, and Apple's own
search surfaces (Music, App Store, Maps) show a spinner mid-query for exactly
those reasons.

**Work the person STARTED never takes a bone, and must not take nothing.** There
is no shape to promise — the screen is already drawn and something is happening
to it. The usual failure here is silence rather than the wrong control: the iOS
delete-account flow fired from its second alert and ran re-auth, a media sweep, a
Firestore sweep, a token revoke and the Auth delete against a screen that looked
idle and stayed fully usable. Which of two shapes it takes depends on one
question — **can the person keep using the surface while it runs?**

- **Yes** (a save, a follow, an upload): the spinner takes the control's OWN
  slot — `SheetFormIos`'s commit glyph is the term. Nothing moves, the control
  keeps its height, its alignment and its ink. Pass `ink` when the spinner sits
  somewhere its container's `tint` is wrong for.
- **No** (an irreversible task that tears its own screen down): `ProgressOverlayIos`
  — a scrim that eats every touch, with the spinner over it.

**A "disabled" container is not blocking, and believing it is has already
shipped once here.** The delete row was first built as a spinner-in-slot with
`disabled(true)` on the `Form`, and Juan rejected it on sight as weird — which it
was, but the deeper problem was that it did not do the job it appeared to do.
`disabled` on a SwiftUI container propagates to that container's ROWS and to
nothing else: a form sheet's ✕ and its swipe-to-dismiss grabber are UIKit chrome
presented ABOVE the screen's content, so both stayed live while the account was
being deleted. **Anything rendered inside the screen has the same blind spot** —
so an overlay must be paired with taking those affordances off the ROUTE
(`gestureEnabled`, `sheetGrabberVisible`, `headerRight`), and the grabber goes
rather than staying as decoration for a gesture that no longer works.

**Where the confirmation itself should go busy, check the platform first.**
Android's delete dialog is Compose, we own it, and it holds its own busy state.
iOS's is `Alert.alert` → `UIAlertController`, which has no progress API and
dismisses the instant the destructive action is tapped. That is why the blocking
lives on the screen on iOS and in the dialog on Android: same job, each in its
own language, and neither is the other's shape drawn by hand.

**Both are verified the same way**, by the first-frame rule below: fire the
trigger, burst-screenshot with no interaction, band-scan every frame. Then
actually try to defeat it — tap a row behind the scrim, swipe the sheet down. A
screenshot proves the spinner; only the gesture proves the block. The scrim
measured a true 40% dim in both appearances (dark: card fill 44 → 26, sheet
ground 28 → 17, separators 58 → 37).

Two things not to re-derive. `ProgressViewIos` **states its box** rather than
taking `matchContents` — a circular `ProgressView` has a fixed intrinsic size
(20 × 20), so there is nothing to discover and no async answer on the layout
path. And it **centres itself in whatever box it gets**, the same contract
`EmptyState` has, because both are things `StateWrap` hands a full screen frame
to; stood without that it renders in the top-left corner.

### A skeleton stands the real thing's GEOMETRY OBJECTS, not a copy of its numbers

The recurring defect in this repo, found twice in one day: a skeleton is
hand-built from measurements of the component it replaces, the component then
changes, and the bones stay where it used to be. Measured at 11.3pt (Explore's
search skeleton after the list gained a top inset) and 8pt (Home's
"People You Follow" bone taking a rail subtraction for a header with no rail
under it).

So: **share the style objects, don't copy the values.** Explore's browse grid
and its skeleton both import `browseLayoutIos.ts`; a section header and its bone
both come from `SectionIos.tsx` and take the same `railBelow` flag. Where a bone
genuinely cannot share (a native `List` has no RN styles to borrow), the shared
term still has to be — `listTopInset` is imported by both the real list and its
skeleton. Verify with a band-scan of both states, not by eye.

**A COMPONENT THAT KEEPS ITS NUMBERS PRIVATE FORCES THE COPY**, which is how
Android keeps losing this while iOS wins it: on 2026-08-28 the home rail's
skeleton had the iOS width and radius IMPORTED and Android's `158 / 8 / 18 /
144` written out as literals under a comment reading "Mirrors TopRailTile", and
Explore's person card lived INSIDE the route file so its avatar and width could
not be imported at all. Export the box (`RAIL_TILE_BOX`), or move the component
out of the route — a term nobody can import is a copy you have already decided
to make.

**BAND-SCAN AT THE THING'S CENTRE, NOT AT ITS EDGE.** A column dropped a few dp
inside a rounded container crosses the CORNER, so the card reads short and the
gap reads long — measured 68.27dp for a 72dp row, with the missing 4 apparently
in the gap, until the same scan at the horizontal centre returned 72.18 / 12.00
/ 84.00 exactly. The numbers still sum correctly, which is what makes it
convincing. Same rule for a horizontal scan: take it through the vertical
middle.

**A bone matches at BOTH ENDS.** Matching where content starts is half the job:
the See All sheet's list reserves the home-indicator clearance by shortening its
Host, its bone lived in a `StateWrap` that knew nothing about that, and so the
bones ran to the screen's edge where the real rows stop short — a band of sheet
colour that appeared on hand-off, at the bottom of a screen whose top matched to
0.00pt. Measure the last row as well as the first.

**A bone for a CONTROL stands the control, not its glyphs.** The same trace-the-
ink rule that is right for a text bar is wrong for anything tappable: a row's
Follow was traced to its ink exactly (42 × 13, measured) and read as a third line
of text beside a 44pt avatar. A borderless button draws no frame to measure, so
size it between the ink and the footprint — anchored to the ink's own edge and
centre, with the plain radius. The opposite error is in the same file's history:
that bone stood 64 × 28 with a pill radius, tracing a filled capsule the control
had stopped being.

**A bone's ANIMATION is not the bone's to choose.** Every placeholder block in
every app is `SkeletonBone` from `@portfolio/mobile-ui`; an app supplies only the
content-shaped bones built from it. Both apps carried a byte-identical copy of
the atom, which is how they both carried the same wrong animation for months.

The animation is a **diagonal sweep driven by ONE app-wide clock**, with each
bone's phase taken from where it sits on screen — so bones light at different
moments by construction. What it replaced was a per-bone opacity pulse, and its
two defects are the ones to avoid re-introducing: every bone shared one phase, so
the whole screen throbbed as a single object; and animating opacity on the FILL
changes the block's contrast, so the page brightens and dims instead of something
moving across it.

**When a bone cannot share the CONTAINER, fix the CONTAINER — do not change the
bone's language.** Trash's bone imported `GROUPED_ROW`, so every row pitch,
separator and artwork box was the real list's, and it still stood 31pt too high
(card top 148 loading vs 179 settled, measured in dark). The reflex was to
render the real `List` under `redacted('placeholder')` instead, which fixed the
geometry and broke something worse: it gave that sheet a STATIC grey placeholder
while the twenty-odd bones everywhere else — Blocked Users included, one row up
in the same account stack — sweep. One app, one placeholder language; a surface
that waits on Firestore takes the sweep, whatever container it is in.

The container was the whole bug, and the answer already existed 30 lines away.
`PeopleSheetList` had hit it first: a bone in a `ScrollView` with
`contentInsetAdjustmentBehavior="automatic"` asks UIKit for its top inset, a
native `List` does not, and on hardware that answer can arrive a frame late and
drop the bones as the sheet presents. A `never` scroller at the family's
`SHEET_BONE_TOP` is the fix. Check for a sibling that already stands the same
control before inventing anything.

Where the real component is native and only PART of it waits, bone that part in
place rather than standing a parallel card: the account sheet keeps its labels
(static strings, so the row heights are settled on the first frame) and bones
only the values; trophies keeps its titles and bones the icon.

**One bridged `RNHostView` per native row or header is the ceiling.** Two per
trophy row plus two in a `Section` header blew the layout apart — titles clipped
off the leading edge, the icon slot gone, the header collapsed to a stub. A
block that needs several bones therefore goes in as ONE host holding the whole
RN sub-layout, which is how the trophies progress summary is boned. That host
has to be positioned by hand against the native original: measured off the live
header, content box 338 wide at a 32pt inset, bar 180.33 → 184.33, card top
194.33 — and the line box SOLVED backwards (22 put the bar 1.67 low, so 20.33).

**NEVER `matchContents` INSIDE A NATIVE ROW, SHEET OR HEADER — reserve the box
in SwiftUI instead.** Its contract is that the host "will UPDATE its size in the
React Native view tree to match the children's size", i.e. after the fact, so
the surface lays out once without that size and again when it lands. That is a
shift on the exact frame the content mounts, and it shows only _sometimes_,
because the measurement usually resolves same-frame — which is why it survives a
band-scan of the settled state and gets caught by eye instead. `RNHostView`
takes no modifiers, but at its DEFAULT it uses the size of the parent SwiftUI
view: wrap it in a `VStack` carrying `frame({ width, height })` and let it fill.
Swept across every iOS row and sheet (person rows, explore results, trash
artwork, the trophy icon and summary, the account sheet's values, the shared
settings avatar). Third time this family has been bitten by an async answer on
the layout path, after `StateWrap`'s content inset and the sheet bone offset —
hence `SHEET_BONE_TOP`. The ban is total.

**MEASURE THE FIRST FRAME, NOT THE SETTLED ONE — AND NEVER TOUCH THE SCREEN
FIRST.** This is the verification rule the async-answer family needs, and it was
learned by shipping the bug twice in one session.

A layout that resolves a frame late looks perfect once anything has moved:
scrolling, tapping or focusing makes UIKit recompute and the wrong offset
vanishes. So a band-scan taken "after opening the sheet" proves nothing if a
gesture happened in between — the gesture IS the thing that hides it. The
Blocked sheet opened with its first rows UNDER the sheet's own header (59.00
below the sheet's top edge against the family's 84.00), corrected itself on the
first flick, and was measured as CORRECT because the measurement came after a
scroll. It was then "fixed" with a `defaultScrollAnchorForRole` that did
nothing, and the wrong fix passed review for the same reason the bug did.

So: fire the trigger, then take a BURST of consecutive screenshots with no
interaction at all, and band-scan every one of them. Eight frames that all read
84.00 is a pass; one that reads anything else is the bug. `xcrun simctl io …
screenshot` in a tight loop is fast enough — the frames land ~0.3s apart, well
inside the window.

The corresponding FIX belongs one frame later too: `useSheetLanded` waits for
`transitionEnd` AND then a double `requestAnimationFrame`, because the animation
ending is not the same instant as the final layout pass. A timer threshold is
not an acceptable substitute (200ms failed, 400 passed — a race to sit next to,
not a fix); the render loop is.

**Apple's own answer is no animation at all** — `.redacted(reason: .placeholder)`
is a real first-party skeleton and it is static, which is what App Store, Music
and News all show. The sweep is Facebook's, and it is PRODUCT-CATEGORY vernacular
rather than either platform's idiom, so it does not make iOS wear Android's
clothes. It earns its place only because these apps wait on a network, where a
static block reads as frozen. Reduce-motion drops the sweep and lands back on
Apple's answer exactly.

`redacted` IS reachable — @expo/ui 57 exposes the modifier — and it was reached
for, on a native `List`, and **rejected in the shipping code**. One app, one
placeholder language: a static grey card in the account sheet made it the odd
one out against roughly twenty sweeping bones, Blocked Users among them, one row
up in the same stack. It also blanks a row's LABEL along with its value, which
changes `LabeledContent`'s stacking and costs the settled row height the bones
were protecting. So a native container is not a reason to switch languages —
bridge the bone in and fix the CONTAINER, as the trash paragraph above
describes. `FormDisclosureRowIos` carries the full argument.

## Voice — every string is written the way Apple writes strings

**All user-facing copy in every app, on BOTH platforms, follows Apple's style**
(Apple Style Guide + HIG). Android is deliberately included: the two twins must
say the _same words_, so the terminology is Apple's on Android too. This applies
to new strings AND to edits of existing ones — never author a string in another
voice and plan to "align it later".

Copy lives **only** in `apps/*/src/i18n/translations.ts` (plus `apps/web`'s
`src/i18n/ui.ts`). There are no hardcoded user-facing strings anywhere else —
keep it that way, and this rule has exactly one place to be applied.

**Capitalization (English only).** Title case for anything that is a _label_:
buttons, menu items, alert titles, screen titles, section headers, form field
labels, empty-state titles, tab names. Sentence case for anything that is a
_sentence_: alert bodies, subtitles, hints, placeholders, status/snackbar
messages. Spanish and Chinese never use title case — sentence case throughout.

**Wording rules:**

- No "Please", no "Sorry", no exclamation marks, no blame. `Please try again.`
  → `Try again.`
- Contractions are Apple's default: `Couldn't load…`, `can't be undone`,
  `You'll need to…`. Prefer `Couldn't X. Try again.` over `Could not X.`
- Say "person"/"someone", not "user", in copy shown _to_ a person.
- Spell out `and` — `Terms and Conditions`, never `Terms & Conditions`.
- Error titles name the failure (`Couldn't Load Your Tops`), the body says what
  to do (`Check your connection and try again.`).

**Terminology — these are the Apple terms; use them everywhere:**

| Concept              | en                               | es                              | zh                  |
| -------------------- | -------------------------------- | ------------------------------- | ------------------- |
| Theme setting        | Appearance                       | Apariencia                      | 外观                |
| Follow-system option | Automatic                        | Automático                      | 自动                |
| Settings             | Settings                         | **Ajustes** (not Configuración) | 设置                |
| Soft-delete area     | **Recently Deleted** (not Trash) | Eliminados recientemente        | 最近删除            |
| Restore from it      | Recover                          | Recuperar                       | 恢复                |
| Hard delete          | Delete Permanently               | Eliminar permanentemente        | 永久删除            |
| Email                | Email                            | Correo electrónico              | 电子邮件            |
| Save                 | Save                             | Guardar                         | **存储** (not 保存) |
| Tap                  | Tap                              | Toca                            | 轻点                |
| Cover art            | Artwork                          | Ilustración                     | 插图                |
| List entry           | item                             | **elemento** (not ítem)         | 条目                |
| A row's second line  | Subtitle                         | Subtítulo                       | 副标题              |
| A book's picture     | Cover                            | Portada                         | 封面                |
| Passages kept        | Highlights                       | Resaltados                      | 高亮                |
| Table of contents    | Contents                         | Contenido                       | 目录                |
| One-line summary     | In One Sentence                  | En una frase                    | 一句话概括          |

Chinese also takes **full-width punctuation** (`，。：？` and `“”`), never ASCII
commas or colons.

**A LABEL FOLLOWS ITS OBJECT, NOT ITS APP — the two apps are SUPPOSED to differ
here.** Asked whether Sound Shaper's "Title / Subtitle / Artwork" should be
standardised against Topper's "Name / Photo" (2026-08-21), the answer is no, and
the reason is that Apple's own words differ by what is being named:

- **Artwork** for a picture that stands for a recording (Music, Podcasts,
  Books); **Photo** for a picture of a thing (Contacts, Photos). The table row
  above already decided this one.
- **Title** for media metadata (Music's info inspector is Title / Artist /
  Album); **Name** for a generic thing, which is what a top and a top item are.

Standardising them would break the voice rule to satisfy an internal-consistency
rule, and the voice rule wins: these apps must sound like the platform, not like
each other.

**THE CODE ALREADY AGREES WHERE IT COUNTS, and that is the half worth
enforcing.** All three primary text fields are `name` — a top's, a top item's
and a sound's — and Sound Shaper's editor key is `soundEdit.name.label` exactly
as Topper's is `topEdit.name.label`. Only the rendered WORD differs, which is
the correct shape. The one genuine divergence left is the picture's field pair
(`imageUrl`/`imagePublicId` against `artUrl`/`artPublicId`), and it stays:
renaming a Firestore field migrates every document, the same rule that keeps the
`songs` subcollection and the `artist` field, and no shared code reads both.

**"SUBTITLE" IS APPLE'S WORD, NOT A HOUSE ONE.** `UITableViewCell.CellStyle`
`.subtitle` — and `UIListContentConfiguration.subtitleCell()` — is a title with
a second line under it, which is precisely this. It replaced "Artist" in Sound
Shaper because a library that takes any MP3 holds ringtones and voice memos, and
it is the only option that names the SLOT and so claims nothing about what goes
in it.

**"Created by" was proposed and rejected** (2026-08-21) for wanting to be
generic and being the opposite: "Artist" claims musicianship, "Created by"
claims AUTHORSHIP, and nobody created the ringtone they downloaded. It is also a
sentence fragment where Apple's field labels are nouns. "Credit" and "Artist or
Creator" are the noun forms if the credit reading is ever wanted again; both are
worse.

**One deliberate carve-out**; every other string in the portfolio takes the
voice:

- Product nouns the apps own — Topper's "top", Sound Shaper's "shape" and
  "clip" — stay. Apple voice governs _how_ they're phrased, not what the
  features are called.

## Shared across all apps

- The **Welcome**, **Settings** and **Manage-account** screens come from
  `@portfolio/mobile-ui` (`WelcomeScreen` / `SettingsScreen` /
  `ManageAccountScreen`) and must stay **consistent across apps** — adapt them
  via props, never fork a per-app copy. An app without a given feature omits
  that prop (Sound Shaper has no social module, so it passes no `privacy`
  section and no username row).
- Theme is the **platform-default palette** (wallpaper-derived Material You on
  Android) — no per-app brand seed; all portfolio apps share one theme.

#### AN OEM PALETTE MAY COLLAPSE ROLES THAT M3 DIFFERENTIATES — NEVER ASSUME TWO TOKENS DIFFER

Taking the platform's palette means taking whatever the OEM ships, and Samsung
One UI returns **identical values** for two pairs that the M3 spec separates and
every AOSP/Pixel palette honours. Measured live on the A54 through
`getMaterialColors`, in BOTH schemes:

|                                        | dark      | light     |
| -------------------------------------- | --------- | --------- |
| `onSurface` == `onSurfaceVariant`      | `#FCFCFF` | `#010102` |
| `surfaceContainer` == `surfaceVariant` | `#3A3A3D` | `#E4E4E7` |

The cost was total and invisible to every static gate: Topper had **no text
hierarchy anywhere** (six primary/muted pairs measured pixel-identical) and **no
visible placeholder or skeleton on any card**, since `InitialArt`'s box and
`SkeletonBone`'s fill both resolve to `surfaceVariant`. A bone inside a card
measured a channel delta of 18 against it, and 0 at the sweep's trough.

`materialToAppColors` now DERIVES both roles when the palette fails to separate
them and passes them through untouched when it does, so a Pixel keeps exactly
what it had. Two rules came out of it, and they generalise past these two
tokens:

- **Compare before you trust.** Any two roles the app leans on to express a
  difference need an equality check, because "the spec says they differ" is not
  a fact about the device in your hand.
- **Pick a replacement by MEASUREMENT, not by name.** Samsung's container ladder
  is **not monotonic** — in dark `surfaceContainerHighest` (#23262E) is DARKER
  than `surfaceContainer` (#3A3A3D) — so the highest-sounding token is the wrong
  one. And measure against EVERY ground the thing sits on: the first pass
  maximised distance from the card alone, chose `surfaceDim`, and made the box
  vanish on the page instead. `bestSeparated` maximises the worst case.

### EVERY HOME BAR CARRIES ONE GLYPH, AND IT IS THE GEAR

A home screen is the first thing anyone sees and it has to read as calm. Two bar
glyphs do not — Sound Shaper's home opened on Account beside Settings and read
as busy where every other app opened on one gear, which is the whole reason
`HeaderSettingsButton` now exists in every app and `HomeBarGlyphsIos` does
not.

So the bar is fixed and the question is only WHERE THE ACCOUNT ENTRY GOES. That
is decided by what class of app it is, never by growing the bar:

| app class | example              | the account entry                              |
| --------- | -------------------- | ---------------------------------------------- |
| social    | Topper               | the Profile tab, where the identity already is |
| personal  | Sound Shaper, Booker | Settings' own IDENTITY BANNER (see below)      |

`SettingsAccountSection`'s props stay OPTIONAL: an app with no session (no
account surface at all) is a case the shared screen must keep handling.

**The banner is Apple's, not a row we invented.** `SettingsAccountLink` turns
the shared identity card into the destination — avatar, name, a legend naming
what is behind it, a disclosure chevron — and puts it FIRST in the form, above
General. That is the Apple Account row at the top of Settings, and the identity
card in the App Store's Apple Account sheet, which is the closer twin because it
is the same container. It carries no section header for the same reason neither
of Apple's does: the avatar and the name say what the card is.

**THE BANNER IS APPLE'S SIZE, MEASURED, NOT A SCALED-UP ROW — AND THERE ARE TWO
APPLE BANNERS.** Settings' is a standalone card (art 60 under a `title3`); the
App Store's Apple Account sheet is the first ROW of a stacked card, so it takes
row metrics instead. **The App Store's is the one we copy**, by choice. Art
**55** (the plain profile row's is 40), title **`headline`** — 17 semibold, the
ladder's own name for the face Apple titles a row with — legend `footnote` 13,
which the row already had, and an 8pt art-to-text gap against the plain row's 12.

**Measure it as a RATIO between two screenshots of one device**, never in
absolute pixels: capture ours beside Apple's, and the capture scale cancels.
That is what separated the two banners — the App Store's art is 0.9132 of our
then-60, its name 0.8636 of our then-20 — and a second, independent route
(row height minus padding) agreed on the art to 0.01. Rendered: art 55.00 vs
54.6, card 85.00 vs 84.0, name ink left 95.67 vs 95.5.

**A HEADERLESS FIRST CARD SITS IN THE EMPTY HEADER SLOT** — the same defect as
`trash` (105.00) and the trophies summary. Band-scanned on iPhone 17 / iOS 26.5,
the banner came to rest 101.00 below the sheet's own top edge against the
family's 84.00, and `listSectionMargins({edges: 'top'})` REPLACES the reserved
margin at a 1:1 slope: 14 → 80.00, 18 → 84.00 exactly, in both appearances.

### iOS-only components: `…Ios.tsx`, not `.ios.tsx`

A component with a real Android twin takes the platform suffix
(`InlineFollowButton.tsx` + `.ios.tsx`). A component that exists **only** on iOS
takes `Ios` in its NAME instead — `ListSectionIos`, `SheetFormIos`,
`ActionButtonIos`, `StateWrapIos`. The type checker resolves the base specifier
and never applies `.ios`, so a platform-suffixed file with no twin needs a stub
`.tsx` beside it purely to satisfy `tsc`, and any prop added to the iOS side has
to be added to the stub as well — which is how an iOS-only prop ends up
editing the Android file.

### Before you write a NEW constant or treatment, grep for the one that exists

This is the check that catches the failure the section below describes, one
level down: not a whole screen re-implemented, but a **value or a treatment**
re-derived beside four copies of itself.

**The docs are not the index — the CODE is.** Every outlier this repo has grown
came from reaching for a primitive that was correct in the abstract while an
answer already sat a few files away. The account sheet's placeholder was written
as SwiftUI `redacted` on the strength of one line in this file, while
`PersonListSkeletonIos` had already solved the identical problem — including a
device-only flash it took a real device to find. Its value rows grew their own
`middle` truncation beside four `tail` copies. Its disabled bar glyph got a
hand-painted grey beside five controls that just pass `disabled(true)`. All
three passed review as "documented decisions"; all three were outliers.

So, before adding one: **grep for the thing it is a variant of**, and prefer the
existing answer even when yours is locally better. A screen that shortens text
differently from the screen beside it is worse than either choice made
consistently.

**THE SINGLE-SOURCE TERMS.** Re-deriving any of these is the bug, not a style
preference. When one genuinely has to change, it changes HERE and every caller
follows.

**A TERM ADDED AFTER A SURFACE WAS WRITTEN NEVER RETROFITS ITSELF, AND NOTHING
IN THE TOOLCHAIN WILL TELL YOU.** Sound Shaper's player alone was found holding
three of them on 2026-08-21: it drew a grouped-CARD constant on its cover
instead of `artworkRadius`, it forked `MediaPickerAvatar` rather than sharing
it, and it never took `opticalTextInset` under that cover. All three
typechecked, all three linted, and Juan caught two of the three by eye before
the audit did. So when a term moves into a package, GREP ITS OLD CALLERS —
adding the export is half the job, and the half that gets skipped is the one
that matters:

| term                                          | lives in                            | governs                                                              |
| --------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `SkeletonBone`                                | `@portfolio/mobile-ui`              | every loading placeholder, in every app                              |
| `ProgressViewIos`                             | `@portfolio/mobile-ui`              | the indeterminate spinner — the OTHER half of waiting                |
| `ProgressOverlayIos`                          | `@portfolio/mobile-ui`              | the scrim over work that must not be interrupted                     |
| `confirmDestructiveIos`                       | `@portfolio/mobile-ui`              | EVERY iOS yes/no confirmation — never a `ConfirmationDialog`         |
| `emptyMediaColor`                             | `@portfolio/mobile-ui/InitialArt`   | the material behind ANY art-less box, stepped by container           |
| `LIST_ROW_ONE_LINE` / `_TWO_LINES`            | `@portfolio/mobile-ui/listRowText`  | how any native list row shortens text                                |
| `FormDisclosureRowIos` / `FormValueRowIos`    | `@portfolio/mobile-ui`              | a grouped-form fact and destination row, chevron included            |
| `PRESSED_OPACITY` / `SquashPressable`         | `@portfolio/mobile-ui`              | press feedback, split by container (see above)                       |
| `HeaderGlyphButtonIos` / `…GroupIos`          | `@portfolio/mobile-ui`              | every iOS bar glyph, its 43pt target and its disabled state          |
| `ActionButtonIos`                             | `@portfolio/mobile-ui`              | the one button                                                       |
| `disabled(true)`                              | `@expo/ui`                          | EVERY disabled control — never hand-paint a dimmed colour            |
| `switchOn`                                    | `@portfolio/core`                   | a switch's ON state — a platform semantic, never `primary`           |
| `labelColor`                                  | `@portfolio/mobile-ui`              | a FILLED control's label, which SwiftUI will not invert              |
| `SHEET_CONTENT_TOP` (84)                      | `@portfolio/mobile-ui/sheetMetrics` | where ANY sheet's first content starts, below its OWN top            |
| `SHEET_FIRST_CARD_MARGIN` (18)                | `@portfolio/mobile-ui/sheetMetrics` | how a titled sheet removes its empty header slot — never `marginTop` |
| `GROUPED_ROW` / `GROUPED_ROW_PITCH`           | `@portfolio/mobile-ui/groupedRow`   | a native grouped row's measured geometry                             |
| `DisclosureChevron`                           | `@portfolio/mobile-ui`              | the RN chevron, for rows outside a native list                       |
| `innerRadius`                                 | `@portfolio/mobile-ui/shape`        | a rounded child's corner inside a rounded container                  |
| `artworkRadius`                               | `@portfolio/mobile-ui`              | a PICTURE's corner — a ratio of the picture, not a constant          |
| `GlassSurfaceIos` / `GLASS_FLOOR`             | `@portfolio/mobile-ui`              | the material under EVERY floating glass surface                      |
| `FLOATING_RADIUS` / `_EDGE_GAP` / `_COPY_GAP` | `@portfolio/mobile-ui`              | a floating surface's corner, its 12pt gap, its copy step             |
| `SNACKBAR_BOTTOM_CLEARANCE`                   | `@portfolio/mobile-ui`              | where the toast stands — one place in EVERY app                      |
| `opticalTextInset`                            | `@portfolio/core`                   | the nudge TEXT takes under a rounded shape; shapes do not            |
| `MediaPickerAvatar` / `MEDIA_PICKER_SIZE`     | `@portfolio/mobile-ui`              | an editor sheet's media slot — the box, not the picture              |
| `MINI_PLAYER_HEIGHT` / `NOW_PLAYING_*`        | `@portfolio/mobile-ui`              | the now-playing banner's box, which the toast stands on              |
| `SearchField`                                 | `@portfolio/mobile-ui`              | the Android search pill — a `TextField`, never a `SearchBar`         |
| `DRAG_ACTIVE_SCALE`                           | `@portfolio/mobile-ui`              | how far a dragged tile lifts — pair it with `useReducedMotion()`     |

Two of those rows used to name a Topper file. Both terms MOVED into the package
the day a third surface needed them — `SHEET_CONTENT_TOP` because `SheetFormIos`
lives there, `GROUPED_ROW` because the trophy list does — and Topper kept a
re-export so its own import paths would not churn. That shim is gone: a table
that points at a shim teaches the next session the wrong home, and three files
were importing a grouped row's geometry _from the people skeleton_.
`SHEET_BONE_TOP` survives as `SheetScreenIos`'s alias for `SHEET_CONTENT_TOP`,
because "where a bone stands" and "where content starts" really are one
question, but the definition is the package's.

`DisclosureChevron` made the same move on 2026-08-28, and it is worth reading
for HOW the duplicate was resolved rather than that it existed. Expo UI Starter had
independently drawn the same chevron, and both had measured their way to the
same 7 × 12pt at tertiaryLabel — they disagreed only on the stroke, and the
disagreement was the finding. **A ROTATED RN VIEW CANNOT HIT A STROKE THE WAY A
PATH CAN.** Topper drew the arms as two rotated views, which are rasterised
rectangles that pick up anti-aliasing along each long edge; at 3× the arm's
measurable run quantises to whole pixels, so 1.8 / 1.9 / 1.95 all rendered 8px
(1.89pt) and 2.0 jumped to 10px (2.36pt) — straddling the SF Symbol reference's
9px (2.12pt), which was therefore unreachable. It took the lighter side on
purpose. The starter's was a stroked SVG `Path`, which goes through the kind of
rasteriser an SF Symbol does, and measured 2.12pt exactly in both appearances.

So the shared component is the SVG one and Topper's compromise was RETIRED, not
lifted. **When two apps disagree on a measured value, the older one is not
automatically the reference** — measure both against the platform before
choosing which to keep, because the loser may only be losing to its own
rendering technique. Topper keeps a thin adapter, since the package takes the
muted ink as a prop rather than reading a theme.

**THE THREE FLOATING SURFACES ARE ONE FAMILY.** The snackbar, the trophy unlock
banner and Sound Shaper's now-playing banner all hang over content on Liquid
Glass, and they had drifted to four different answers: the snackbar and Topper's
trophy banner were pure `glassEffect` with nothing behind them, Sound Shaper's
banner had its own tonal floor, and Sound Shaper's trophy banner was not glass at
all but a solid card. The two pure-glass ones were the two with reported
readability problems.

- **The material** is `GlassSurfaceIos` — `variant: 'regular'` over `GLASS_FLOOR`
  (0.25 of `surfaceContainer`). Measured: over a pure-white backdrop in dark, a
  white title clears 4.71:1 unfloored and 5.43:1 at 0.25, and Apple's own
  floating glass over photography (the date pill in Photos' viewer) puts a white
  label on 5.41:1. 0.45 was tried and is over-corrected — it buys contrast Apple
  does not ask for and pays in show-through, which is the whole reason it is
  glass.
- **The floor goes UNDER the material, never over it.** Painted on top it veils
  the specular rim and the refraction while leaving the average fill untouched:
  the banner measured L\* 14.3 against the toast's 14.3 and still looked flatter
  beside it. Averages survive a veil; the look does not.
- **The material is the edge.** No border, no shadow, on any of them. Both were
  tried and both were measured out: an RN shadow can only overshoot a material
  that already darkens the gutter by twice UIKit's whole treatment, and the
  trophy banner's SwiftUI shadow was justified only while its glass had no floor
  (the floor gives it a 6.4 L\* step against a light page on its own).
- **One gap, except where the two edges genuinely differ.** `FLOATING_EDGE_GAP`
  (12) is what the trophy banner stands off the TOP safe area and what the toast
  clears the app's bottom chrome by; before it existed those were 18 and a
  guessed 76, and the toast overlapped the banner by 3.33pt.
  The now-playing banner keeps its OWN bottom gap (8), and the mirror it was
  briefly given is the thing to not re-derive: the top safe area is a 62pt notch
  and status bar, the bottom one a 34pt home indicator, and Apple does not
  mirror them either. Beware the obvious comparison here — Topper's tab bar
  clears the screen edge by 23.04pt and Apple's Photos toolbar by ~29, both LESS
  than the 34pt inset, because terminal chrome may draw inside the safe area and
  let the indicator pass over it. A surface that EXPANDS may not, so its floor is
  the inset and only the gap on top is a choice.
- **The toast BELONGS TO THE SURFACE IT WAS FIRED ON** (2026-08-27). It used
  to follow the topmost outlet and re-parent when a sheet closed under it — a
  flicker-and-jump on every such close, in both apps. It binds at show time
  now and never moves: a `host` toast (the default) dies with its surface,
  committing its undo transaction exactly as unmount always has; `scope:
'app'` is the one exception, for a toast fired as part of CLOSING its
  surface (a save that dismisses the editor), which re-homes to the new top
  with a fresh entrance. `SnackbarProvider` carries the full mechanics.
- **The toast stands in the SAME PLACE in every app.** Deriving it per app from
  that app's own bottom chrome is worse than a shared number, because it puts one
  surface in a different spot in each app for a reason nobody using one app can
  see. `SNACKBAR_BOTTOM_CLEARANCE` is the portfolio's tallest bottom chrome
  clearing itself; a shorter tab bar simply carries more air.

What legitimately still differs is the TYPE RAMP: the trophy is a notification
(13/15/13, three lines) and the now-playing banner is a now-playing bar (17/15).
Both are named iOS steps and both use `onSurfaceMuted` for the supporting line —
the terms are shared, the ramp is not, and stepping the trophy up to 17 makes it
compete with the screen instead of announcing something.

**A SWIPE ACTION IS LABELLED.** Every one, in both apps — `label` +
`systemImage`, never a bare `Image` with the wording hidden in
`accessibilityLabel`. SwiftUI picks side-by-side or icon-over-text from the
row's height on its own.

The rule exists because three surfaces had drifted the other way (comments,
recent searches, Sound Shaper's clips) on a shared and PLAUSIBLE argument:
revealing a worded action slides the row's own content left by the action's full
width, so a short row's text is pushed clean off the leading edge. That is true.
It is also what Apple does — Reminders on iPhone 17 / iOS 26.5, swiped on a row
whose entire content is the two characters "Hi", draws both actions as icon +
label at ~88pt each and pushes the row's text completely away, leaving an empty
pill. The outcome those comments were avoiding is the system's own behaviour, so
the argument never justified dropping the words. (The same notes cited Mail as
glyph-only and put a labelled action at ~110pt; neither survived measurement.)

A glyph alone is a guess — `flag` for Report beside `trash` for Delete told a
reader nothing, and that list is the one with two actions to distinguish.

**M3 SPECIFIES A WEIGHT PER TYPE ROLE, AND A MISSING ONE IS INVISIBLE TO EVERY
GATE.** `ANDROID_VARIANTS` in `createText.tsx` set only `fontSize` and
`lineHeight` for months, so RN fell back to Roboto Regular for all nine roles —
including the three M3 puts in Medium (500): `titleMedium`, `labelLarge`,
`labelMedium`. The cost was that Android had NO weight step between a block's
title and the body under it. It typechecks, it lints, and it survives a
band-scan, because the metrics are identical and only the FACE differs: the
tell is the STEM. Measured on a Galaxy A54 in dark, the "B" of a 16sp
`titleMedium` and the "B" of a 16sp `bodyLarge` both rendered 5px; with the
weight restored the 14sp `labelLarge` renders 6px — a smaller size with a
thicker stem, which is the proof the rung is being drawn. Found 2026-08-29 by
the parity audit; the iOS ladder had carried its `'600'` all along.

**GEOMETRY SCALES WITH ITS BOX; TYPE STEPS UP APPLE'S LADDER.** A corner, a
glyph inside a placeholder, an inset — those are ratios of the thing they sit
in, and `artworkRadius` (0.15) and `emptyMediaPlusStyle` (0.3) are where the two
that exist live. TYPE IS NOT ONE OF THEM. iOS text styles are a fixed named
ladder that Dynamic Type scales as a unit, so deriving a point size from a
container's width ships a size Apple never draws and breaks the moment someone
raises their text size.

The case that forced this: Sound Shaper's grid cover is 178pt against Topper's
124pt rail cover, so the shared 14/12 caption fell from 0.113 of the artwork to
0.079 and read dwarfed. The fix was to STEP — 17/15, which is `body` /
`subheadline`, the pair Apple captions a large artwork cell with — not to scale,
which would have wanted 20/17 and produced a headline. It lands at 0.096 and is
deliberately NOT Topper's 0.113: a smaller tile carries a proportionally larger
caption. 16/14 was rendered and rejected for being off the ladder (16 is
`callout`; 14 is nothing). Check a new pair's LEADING against the real style
too — 17/22 and 15/20 are Apple's, not arithmetic.

**AN ART-LESS BOX TAKES ITS MATERIAL FROM `emptyMediaColor`, AND STATES ONLY
ITS CONTAINER.** One material for every placeholder in the portfolio — an
item's initial, a person's disc, a song's box — because they are one idea; on
iOS that is `surfaceContainer`, the solid systemGray5 the create tiles use.

The one variable is WHERE the box sits, and it matters only in dark: inside a
form sheet every grouped colour steps up one, so a row's fill goes from `card`
(#1C1C1E) to `sheetField` (#2C2C2E) — which is exactly `surfaceContainer`, so
an unstepped box lands on its own row and there is no box at all. Light has no
elevated split (both are #FFFFFF), so nothing steps there.

This is the rule the repo already had and applied in only ONE of the two places
that needed it: `Avatar` carried the step inline, `InitialArt` did not, so a
person's disc was visible on a sheet row while an item's initial beside it was
invisible (found in Recently Deleted). Both now call one function and callers
pass `container="sheet"` instead of a colour.

**A twin that cannot share the COMPONENT still shares the TERMS.**
`TopItemListIos` re-draws this same placeholder in SwiftUI, because a native row
may hold only one bridged `RNHostView` and that budget goes to the artwork. It
had drifted on all three of its values — `surfaceVariant` for the fill,
`onSurfaceMuted` for the ink, `title3` for the letter — so the same box read
darker, dimmer and smaller there than anywhere else. It now takes
`emptyMediaColor`, `onSurface` and `EMPTY_MEDIA_INITIAL_RATIO`. When you must
re-implement a shared component in another technology, import its constants.

**A SHEET'S TOP SPACING IS APPLE'S NUMBER, AND IT IS 84.** Every sheet in this
family puts its first content — a card, or the section label above one — exactly
84.00 below **its own top edge**. That is not a house choice: it is Settings,
band-scanned from identical anchors at 146.0 on a root sheet whose edge is at
62.00. `SHEET_BONE_TOP` is that same 84, which is why a bone placed at it lands
on the live card.

Three ways this gets got wrong, all of which have happened here:

- **Measuring in SCREEN coordinates.** A sheet pushed over another sheet sits
  10pt lower (edge 62.00 → 72.00), so two sheets whose raw numbers agree are in
  fact 10pt apart. Always subtract the sheet's own edge first.
- **Taking the reference from a sheet that has not been fixed yet.** `trash`
  band-scanned at 105.00 because it stands its OWN `List` rather than borrowing
  `PeopleSheetListIos`, and so never took that component's empty-header
  pull-back. The trophies summary was pinned to trash's 105.00 and inherited the
  bug exactly. `blocked-users` looked like the same case and was not — it
  borrows the component, and measured 84.00 all along. Assume nothing here:
  measure the sheet you intend to copy.
- **Assuming a shared component's compensation holds at every DETENT.**
  `SheetFormBodyIos`'s 3.33 residual was solved on Topper's two editors, which
  are `[0.38]` and `[0.62]`, and Topper owns no full-height form sheet — so the
  `[1]` case went unmeasured for as long as it existed. Both of Sound Shaper's
  (`shaper`, `clips`) shipped 87.33, exactly 3.33 low, because at the large
  detent there is no residual to take: the Form wants the flat 21. Measured
  2026-08-22 across every form sheet in the portfolio, and the component now
  takes a `fullHeight` prop stating which presentation it is in. **A constant
  measured under one presentation is evidence about that presentation only.**

Audited on iPhone 17 / iOS 26.5 and now all on the standard — `account` 83.67,
`follow-list` and `people` 84.00, `trophies` 84.00, `blocked-users` 84.00,
`trash` 84.00 (was 105.00), `edit-top` 83.67 (was 101.00), `edit-item` 97.67
(was 115.00 — its hero is an ink inside a transparent row, so it reads as its
section's 83.67 plus the row's own `LIST_ROW_PADDING_VERTICAL`).

Sound Shaper's three re-measured 2026-08-22 on the same device: `shaper` 84.00
and `clips` 84.00 (both were 87.33 — see the detent trap above), `edit-sound`
98.33, which is `edit-item`'s hero shape and matches it to 0.66.

The shared `SettingsScreen` at a plain `[1]` detent, with no `SheetFormBodyIos`
under it, measured on the standard too (2026-08-28, in the since-deleted Expo
UI Starter): first content 83.67 dark / 84.00 light, an 8-frame no-touch burst
reading 83.67 on all eight. The 0.33 between appearances is glyph
rasterisation, not layout — that sheet's first content is a section label's ink.

Three containers, three ways to take the same 21 off, and the lever is decided
by what owns the scroll: a `List` that IS the RNScreens root takes it as
`marginTop` on the hosting RN VIEW (`PeopleSheetListIos`, `trash`); a `Form`
under a native bar takes it the same way on its Host (`SheetFormBodyIos` — the
flat 21 at `[1]`, less a measured 3.33 residual on a fractional detent, where a
Form's first-section inset is not a List's);
a `Section` inside a `Form` you own takes it as `listSectionMargins` (the
trophies summary). Negative padding on the scrolling view itself is a no-op or
worse in all three.

**PULLING THE HOSTING VIEW UP UNDER A TITLED BAR DRAWS THE BAR'S SCROLLED BAND
AT REST** (Booker, 2026-10-10). The `marginTop` lever lands the card on the
number and slides the top of the `List`/`Form` under the sheet's native bar,
which UIKit reads as content scrolled beneath it: the bar paints its hard
scroll-edge band and a separator before anything has moved, and the sheet reads
as having too little room at the top (Juan, on New Highlight). Band-scanned on
iPhone 17 / iOS 27 sim: Edit Book, New Highlight and Contents all carried it,
Settings — on `listSectionMargins` — never did. So a TITLED sheet takes the slot
off its first `Section` as `listSectionMargins({ edges: 'top', length:
SHEET_FIRST_CARD_MARGIN })` (18), never off the Host: `SheetFormBodyIos
fullHeight` does it for every `[1]` editor, and Booker's `contents`, `genres` and
`trash` lists do it by hand. Measured level with Settings on one runtime (88.00
each, eight-frame bursts). **Topper's and Sound Shaper's `marginTop` lists
(`PeopleSheetListIos`, their `trash`) still carry the band** — not re-measured
here, an open gap rather than a decision. The fractional `SheetFormBodyIos` path
keeps its pull-back until someone measures its band.

Two limits worth knowing before you reach for a bone in a native surface: bone
the part that actually WAITS rather than standing a parallel card (the account
sheet keeps its labels, so its row heights are settled on the first frame), and
**one bridged `RNHostView` per native row or header is the ceiling** — a block
needing several bones goes in as ONE host holding the whole RN sub-layout,
positioned by measurement against the native original.

### THE SAME VOCABULARY, SAID IN EACH PLATFORM'S LANGUAGE

A shared surface is not always a shared FILE. Where the two platforms draw a
thing with different controls, the twin is a second component with the same
parts and the same names — and iOS is the REFERENCE for the result.

`SectionIos` / `Section` are the worked example (2026-08-28). Both export
`SectionHeader`, `SectionHeaderSkeleton`, `SectionEmptyLine`,
`SectionErrorLines` and `HEADER_TO_CONTENT`, and both hand the SCREEN exactly
two things: the horizontal inset and the gap above the first header. What
differs is the language — iOS's action is a tinted press, Android's is an M3
text button whose 48dp target sets a 52dp floor the header must reserve; iOS's
supporting lines are `bodySmall` (its grouped-list footer step), Android's are
`bodyMedium` (Material's supporting text).

**THE TWIN THAT ARRIVES SECOND INHERITS THE BUGS THE FIRST ONE ALREADY FIXED,**
which is the reason to write it rather than leave the screens hand-rolling.
Android's Home and Explore had drifted to two rhythms for one statement (8 vs
4pt), had no section-level error line at all — so a failed query rendered the
EMPTY copy and said "nobody to follow" when nobody had been asked — and had a
bare "Nothing here yet." where iOS had long since replaced that dead end with
an invite. Every one of those was a defect iOS had a written note about.

**A MISSING TWIN COSTS MORE THAN A DRIFTED ONE.** When iOS has the frame
component and Android's screens each hand-roll a copy, there is no seam to
notice — just files that each look fine — and **nothing that ever reaches the
iOS frame reaches Android** (Expo UI Starter's fifty Android routes had never
wired the M3 on-scroll app bar, and five of fifty honoured keyboard avoidance).
A shared component is not only less code; it is the only place a fix can LAND
for everyone.

## iOS Home Screen widgets — a SECOND PROCESS, not a second screen

Topper and Sound Shaper each ship one (2026-09-11/12); Booker has none. The plumbing is
`@portfolio/widget-bridge`, the monorepo's first package to ship native code;
each app owns its target under `apps/<app>/targets/widget` via
`@bacons/apple-targets`, which keeps `ios/` gitignored prebuild output like
everything else.

**A WIDGET HOLDS NO FIREBASE, NO SESSION AND NO TRANSLATOR.** It is a separate
binary in a separate sandbox, so everything it draws is written into a shared
App Group container by the app and read back as plain data. Two consequences
that are easy to get wrong and silent when you do:

- **Its COPY rides inside the snapshot.** The extension cannot reach
  `src/i18n/translations.ts`, and a second copy of the strings in the target
  would be a second place for the voice rules to be applied. The app resolves
  them in the person's own language and ships them with the data; the target's
  only English is a gallery fallback for before the app has ever run.
- **EVERY FIELD A READER DECLARES MUST BE ONE THE WIDGET DRAWS.** A snapshot
  decodes whole, so one unread field the writer stops sending fails the entire
  decode — and the only symptom is the empty state the widget would show anyway.
  Both widgets went blank for exactly this (an `updatedAt` nothing read, dropped
  when the writer moved from Swift to TypeScript).

**THE TINTED AND CLEAR HOME SCREENS TREAT A PHOTOGRAPH AS A GLYPH.** In the
accented rendering modes WidgetKit re-colours a widget by masking its content's
ALPHA — right for chrome, catastrophic for artwork, because an opaque cover is
alpha-1 everywhere and renders as a SOLID WHITE BLOCK. Every image takes
`widgetAccentedRenderingMode(.fullColor)` (iOS 18; it returns a View, so it sits
after `.resizable()`). Chrome does NOT opt out — an art-less tile is a fill and a
letter, which is exactly what the treatment is for. None of this is visible in
the default appearance, which is the only one a simulator Home Screen starts in.

**A WIDGET IS A CONTAINER THE APP DOES NOT HAVE.** `emptyMediaColor`'s
systemGray5 measured a channel delta of SIX against a widget's own background —
the art-less box vanished while reading correctly everywhere in the app. Use a
container-RELATIVE fill (`.fill.tertiary`), which separates in light, dark and
tinted without the target guessing any of their values.

**The plugin's documented App Group mirroring did not happen** on
`@bacons/apple-targets` 5.0.0 — the generated extension had no
`CODE_SIGN_ENTITLEMENTS` at all, which reads as "builds fine, container is nil
at runtime, empty state forever". Each target declares the entitlement
explicitly, from `config.ios.entitlements`, so it cannot silently stop.

**THE SIMULATOR RUNS WIDGETS** — gallery, Home Screen, Control Center — and its
ad-hoc signing resolves App Groups with no portal capability at all, so the whole
loop lives there. What it cannot show you is a tinted Home Screen you have not
switched to, which is how the white-block bug reached a device. Signing facts are
in [`docs/ios-dev-workflow.md`](docs/ios-dev-workflow.md).

## Brand (icons, splash, hero mark)

The brand lives at the app's **edges** — launcher icon, splash, and the welcome
hero. Everything _inside_ the app stays platform-native (see the theme rule
above). One family across all apps:

- **Marks** — each app has a stroke-built glyph on a **48-unit grid, stroke
  3.25, round caps/joins, no fill**: Topper = **crown**, Sound Shaper =
  **five-bar equalizer**, Booker = **open book** (two pages dipping into the
  spine, nothing on them — chosen 2026-10-09 after a closed book, bookmarks, a
  pile and a shelf were all turned down; its square outer corners reach further
  from centre than the others', so its splash takes a smaller grid,
  `SPLASH_GRID_OVERRIDES`). **Why it matched less than the other two, measured:**
  size and ink were already equal (415 vs 415 / 393 units²); the difference is
  that the crown and the equalizer are drawn in STRAIGHT runs and Booker's
  pages CURVE. A straight-edged twin was rendered and Juan kept the curve. Same grid and stroke everywhere, so they read as
  siblings. Vector source of
  truth = each app's
  `src/components/ui/BrandMark.tsx`; the PNGs are generated to match it exactly.
- **Palette — the iOS base-icon neutrals.** Two greys, **`#F5F5F5`** and
  **`#222222`**, swapped per appearance: light = `#222222` mark on `#F5F5F5`,
  dark = `#F5F5F5` mark on `#222222`. iOS tinted slot keeps **`#BFBFBF`** on
  `#222222`. Both greys are measured from **Apple's own** iOS 26 base app icon —
  render an empty Icon Composer document with Xcode's `ictool` and the light
  body averages `#F6F6F6`, the dark `#222323`; ours are those rounded to a
  neutral (no hue), and deliberately **never pure `#FFFFFF` / `#000000`**. The
  earlier `#0D0D0D` ground was dropped 2026-07-30 in the iOS-first recolor.
- **The mark is flat; the ground is Apple's.** An earlier glow was dropped
  because it could not render identically on both platforms — **that reason
  EXPIRED and was found stale on 2026-08-29**: `react-native-svg`'s
  `FeGaussianBlur` used to no-op on Android and does not on 15.15.4, which is
  what let the tile become one shared component (below). The glow itself still
  stays dropped, on its own merits rather than on a rendering limit. The icon's
  _ground_ is no longer ours to paint either: **iOS renders it**
  (see Wiring). Everywhere a single colour is required instead — the splash
  background, Android's adaptive-icon background — use the flat midpoint
  (`#F5F5F5` / `#222222`).
- **Wiring — the iOS icon is an Icon Composer `.icon` document, not PNGs.**
  `ios.icon` is a **string** path to `apps/<app>/assets/AppIcon.icon` (Expo SDK
  57 supports this; as an object it would silently warn). iOS renders the
  document, so the shine, the squircle and the **tinted / clear** appearances all
  come from the OS and follow it across releases — that was the whole point of
  choosing this over baking a gradient into PNGs. Xcode's `actool` compiles the
  pre-iOS-26 fallback PNGs from the same document, so old devices are covered.
  - **`scripts/gen-brand-art.py` generates ALL brand art** — the `.icon`
    documents, `icon.png`, both splash glyphs and the Android adaptive set — from
    one set of marks (needs `shapely` + `pillow`; see its docstring). One
    generator on purpose: these are the same mark at three scales, and separate
    pipelines drifted. **Never hand-edit the SVGs in `Assets/`** — they are the
    marks converted **stroke-to-path**, which is mandatory: Icon Composer's
    material renders a layer from its path geometry _filled_ and ignores
    `fill="none"`, so a stroked mark comes out as solid blobs. The generator also
    sets `translucency: {enabled: false}` on the group, without which each shape
    of a multi-shape mark picks up its own translucency and the mark turns to
    mismatched greys.
  - **Three grids, none interchangeable:** icon `914`, splash `800` (small
    enough that the mark clears Android 12's circular splash mask — the
    generator prints the clearance and flags a clip), adaptive `651` (Android's
    safe zone). All of them **bbox-centre** the mark rather than grid-centring
    it: Topper's crown is vertically asymmetric (box centre y=22.75, not 24), so
    grid-centring floats it ~2% high. `BrandMark.tsx` matches with
    `viewBox="0 -1.25 48 48"`.
  - `android.adaptiveIcon.backgroundColor` is `#222222` and Android follows the
    **dark** treatment, flat (its launcher has no light/dark icon split, and
    adaptive icons carry no gloss). `backgroundImage` is a solid tile of the
    same colour — the two must agree, since the image wins. `icon.png` is the
    Android/root fallback, and the **monochrome** layer is what Android 13+
    tints for themed icons.
  - **Store icons:** Play needs a separate flat 512×512 upload — generated to
    `media-masters/store-icons/<app>-play-512.png` (outside every app bundle;
    see that README). The App Store needs no file: Xcode emits the 1024
    marketing icon from the `.icon` document.
  - `expo-splash-screen` is `#F5F5F5` + `splash-icon.png` (dark glyph) with
    `dark` = `#222222` + `splash-icon-dark.png` (light glyph). The splash is a
    **bare mark on a flat ground — no tile**, so there is no icon material to
    match and it needs none. Splash art is sized to fit **Android 12's circular
    mask** — keep the glyph inside the centre ~66%.
- **The one in-app exception:** the welcome hero tile (`BrandTile` in
  `@portfolio/mobile-ui`) is a **brand tile**, _not_ Material You — apps pass
  their glyph via `WelcomeScreen`'s `logo` prop. It **tracks the color scheme
  exactly like the icon**: `#222222` mark on `#F5F5F5` in light, `#F5F5F5` on
  `#222222` in dark. Do not "fix" it to themed colors. The two platforms draw it
  in their own language:
  - **`BrandTile.tsx` reproduces the Home Screen's icon rendering, ON BOTH
    PLATFORMS** —
    a **superellipse** (`|x|ⁿ+|y|ⁿ=1`, **n = 4.5**, fitted against a real iOS 26
    icon's alpha mask; `borderRadius` gives circular corners that disagree with
    every icon beside it), the vertical **shine** (bright lip at the top edge,
    darkening body, softer lip at the bottom), and a **contact shadow**. Both
    the shine's stops and the mask were **measured, not invented**: feed a
    ground colour to Icon Composer's `automatic-gradient` and render it with
    Xcode's `ictool` (see the Measuring section below), then sample the output.
    The shadow is drawn in SVG because RN's `shadow*` props trace the view's
    rectangular bounds, not the squircle.
    **This is a hand-made copy of what iOS does, and it does not update itself.**
    The real icon is rendered by the OS, so when iOS changes its icon material,
    re-measure with `ictool` and retune the constants here — the deliberate
    trade for letting Apple own the real icon. Known delta today: the real
    icon's mark carries a soft drop shadow from the material; ours is flat.
  - **Android used to be a flat rounded rect** with a hairline, on the grounds
    that Android's icons _are_ flat and that the soft treatment could not render
    there anyway. The second half was the load-bearing one and it went stale;
    see the `FeGaussianBlur` note above. Juan asked for the iOS look on Android
    on 2026-08-29, it was rendered verbatim on a Galaxy A54, and everything drew
    — squircle, shine, and a shadow measuring a true gaussian falloff (198 at
    the tile's edge easing to the page's 241 over ~24px in light). The two files
    merged; there is no `.ios` twin any more, and the Android `elevation` went
    with it, since the SVG shadow follows the SQUIRCLE where `elevation` traces
    a rounded RECT.
    **This is the one place the platforms are CLONES rather than siblings, and
    that is correct**: an icon is a brand object, not a platform control — the
    exception the brand rules already carve out for the welcome hero. Everything
    _inside_ the app still speaks its own platform's language.
  - The web favicon is the same tile, fixed dark (a browser tab has no app theme
    to track).

### Changing a brand colour — the runbook

**The palette is not single-sourced.** `#F5F5F5` / `#222222` are hard-coded in
twelve files, in three different notations, and one of them (the icon document's
`automatic-gradient`) is written as `srgb:` floats. A find-and-replace on the
hex **will** miss things. Change all of these together, in order:

1. **`scripts/gen-brand-art.py`** — `GROUND_LIGHT` / `GROUND_DARK` at the top.
   These are the only definitions the generator needs; the `srgb:` value in the
   icon document is derived from `GROUND_LIGHT`, so don't touch it by hand.
2. **`npm run brand-art`** — regenerates every `.icon` document, `icon.png`,
   both splash glyphs, the Android adaptive set and the Play store icons. It
   bootstraps its own venv (`shapely` + `pillow`) and prints the Android-12
   splash clearance; a non-zero clearance means shrink `GRIDS["splash"]`.
   **Never hand-edit any of its outputs.**
3. **Each `apps/*/app.json`** (×3) — `android.adaptiveIcon.backgroundColor` and
   both `expo-splash-screen` `backgroundColor`s (light + `dark`).
4. **Each `apps/*/src/components/ui/BrandMark.tsx`** (×3) — the default `color`.
5. **`packages/mobile-ui/src/BrandTile.tsx`** (one file for both platforms) —
   `TILE_INK`, and `TILE_GRADIENT` **must be RE-MEASURED, not edited by
   hand**: feed the new ground to `automatic-gradient`, render with `ictool`
   (below), and sample the column. The stops are Apple's derivation from that
   specific colour — a hand edit silently stops matching the real icon.
6. **`apps/web/public/favicon.svg`** — the jv tile, fixed dark — and
   **`apps/web/src/components/AppTile.astro`**, a port of `BrandTile`'s dark
   values (`GRADIENT`, `INK`).
7. **This file**, plus `packages/mobile-ui/README.md`, which quote the values.

Verify without building: `xcrun actool <app>/assets/AppIcon.icon --app-icon
AppIcon --compile /tmp/out --platform iphoneos --target-device iphone` compiles
the document with the real Xcode compiler and emits the pre-iOS-26 fallbacks.

### Measuring what iOS actually does

Don't guess Apple's values — render them. Xcode 26 ships `ictool` at
`/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool`.
An `.icon` document is a folder with `icon.json` + `Assets/`; a **layerless** one
renders Apple's own base app icon:

```bash
# icon.json: {"fill":"automatic","groups":[],"supported-platforms":{"circles":["watchOS"],"squares":"shared"}}
ictool Base.icon --export-image --output-file out.png --platform iOS \
  --rendition Dark --width 512 --height 512 --scale 1
```

Renditions: `Default`, `Dark`, `TintedLight`, `TintedDark`, `ClearLight`,
`ClearDark`. `fill` takes `{"solid": …}` or `{"automatic-gradient": …}` (Apple's
own derivation — hand it one base colour and it produces both appearances), and
colours encode as `"srgb:r,g,b,a"` in 0–1, **not** hex. Sample the PNG to get
real numbers.

- The launcher icon reads softer than the splash because it renders ~3× smaller
  (thin strokes on a flat ground). That is **expected and accepted** — stroke
  stays 3.25 everywhere; no optical-size bump.
