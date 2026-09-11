# Pending — wanted, blocked on a dependency

**Not** [`rejected-experiments.md`](rejected-experiments.md). Everything here is
something we WANT and have decided to build the day the blocker lifts. Each
entry names the exact API that unlocks it, so the check is mechanical.

**Re-check this file on every `@expo/ui` / Expo SDK bump.** If an entry's API
appears, the work is small and pre-approved in principle — build it.

---

## Apple's scroll-edge fade behind the welcome footer — blocked on `@expo/ui`

**What we want.** The iOS welcome screen's pinned CTA block should carry iOS 26's
**scroll-edge effect**: content dissolving progressively as it passes under the
footer, exactly as Apple's own onboarding sheets do (the Family Sharing sheet in
Settings is the reference — the row behind the footer fades out rather than
meeting a hard edge). Juan asked for this explicitly on 2026-08-02 and likes it;
it is on the list, not off it.

**Why it isn't built.** No API. Verified on `@expo/ui` **57.0.7** by grepping
BOTH the JS build and the bundled native Swift sources for `scrollEdgeEffect`
and `safeAreaInset` — zero hits in either. **Re-checked 2026-08-05 against the
published 57.0.9 tarball (`npm pack`, no install needed): still zero hits.**
Without
`safeAreaInset` the footer cannot live inside the SwiftUI tree, and without
`scrollEdgeEffectStyle` the system fade cannot be requested.

**What was tried, and what it measured.** A real `glassEffect` material was
built behind the footer (Topper's `LayoutProvider` pattern: concrete measured
size on the Host — `absoluteFill` renders short — plus `ignoreSafeArea="all"`,
because a bottom-anchored Host is handed the home-indicator inset and floats the
material ~17pt high). It works, and it is the wrong thing: `glassEffect` is a
**uniform** material, Apple's is **progressive**. At rest, with content cleared
of the footer, it renders a flat `(25,25,25)` slab with a `(62,64,64)` hairline
on top — i.e. the same grey band already rejected on Sound Shaper's collapsed
banner, and the same lesson as `rejected-experiments.md`: glass over a flat dark
background has nothing to refract. Reverted.

**What unlocks it (in preference order).**

1. `@expo/ui` exposing **`scrollEdgeEffectStyle`** and/or **`safeAreaInset`** —
   then this is a few lines on `WelcomeScreen.ios.tsx` with zero maintenance.
   This is the version worth shipping.
2. Failing that, the effect belongs to the SCROLL VIEW, and RN's scroll view is
   a real `UIScrollView` — Apple documents **`UIScrollView.bottomEdgeEffect`**
   (iOS 26). A small native module could switch on the genuine system effect on
   the real scroll view: native, no imitation, follows the OS. UNVERIFIED — the
   doc page exists but its type/styles/availability were never read properly;
   read them before costing this. It would be the repo's first custom native
   module (only config plugins exist today), so it needs a prebuild + rebuild
   and a version guard, and it lands in the shared screen, so Topper and Sound
   Shaper inherit it.

**Do NOT fake it.** Stacking blur layers under gradient masks to approximate the
ramp (would need `expo-blur` + `MaskedView`, neither installed) is an RN
imitation of a system effect on a surface where the real one exists, and it
needs re-tuning every time iOS changes the effect. Explicitly ruled out by Juan
("I don't want any SLOP") — if the real API isn't there, ship nothing.

**Where the code goes.** `packages/mobile-ui/src/WelcomeScreen.ios.tsx`; the
footer is already an overlay-ready structure and its measured geometry matches
Apple's template, so only the fade is missing.

---

## `ContentUnavailableView`'s actions slot — blocked on `@expo/ui`

**Mostly SHIPPED — one slot still missing.** Topper's iOS empty states
(`EmptyState.ios.tsx`) now render as the real SwiftUI `ContentUnavailableView`.
The emoji question that used to block this was decided: each state names an SF
Symbol instead (🗑️ → `trash`, 🎉 → `checkmark.circle`, …), and Android keeps
its emoji.

**What is still missing.** The wrapper's props are `title`, `systemImage` and
`description` — full stop (checked on **57.0.7**, and re-checked against
published **57.0.9** on 2026-08-05 — unchanged:
`node_modules/@expo/ui/build/swift-ui/ContentUnavailableView/index.d.ts`, and
none of the three starter showcases pass children). SwiftUI's own
`ContentUnavailableView` takes an `actions` ViewBuilder; the wrapper does not
surface it. So the states that carry a CTA — "Try again" on the error states,
"Add an item" on an owner's empty top — put their `Button` in a `VStack`
BESIDE the view rather than inside its actions slot. It looks right and the
button is a real SwiftUI control; it is simply not slotted in, so the view
cannot own its spacing or its layout at other Dynamic Type sizes.

**What it costs today, measured.** Sitting beside the view instead of inside it
means the CTA's gap is the view's own trailing inset PLUS whatever the `VStack`
adds — the two stack rather than one replacing the other. Band-scanned on
iPhone 17 / iOS 26.5, description-ink to button-edge: **37.0pt with the VStack
at 0**, which is the floor we cannot reach below, against the view's own
largest internal gap of **23.7pt** (icon→title; title→description is 7.7). The
`VStack` spacing is therefore now **0** — anything above it read as detached,
and at the 20 it shipped with the gap was 57.0pt, 2.4× the widest rhythm Apple
uses inside the view. Juan spotted that by eye before it was measured.

Since 2026-08-16 the sibling button no longer hand-rolls its modifiers: it takes
`actionButtonModifiersIos` from `@portfolio/mobile-ui`, the same stack
`ActionButtonIos` applies, so the CTA cannot drift from the portfolio's button
while it waits. Only the `Host` differs (one cannot nest inside another).

**What unlocks it.** `ContentUnavailableViewProps` gaining `children` or an
`actions` prop. On the day it lands: move the button inside, delete the
wrapping `VStack` (and `CTA_SPACING`) from `EmptyState.ios.tsx`, and the gap
becomes Apple's rather than a floor we are stuck above. Small change, one
file.

---

## A grouped list's empty section-header slot — blocked on `@expo/ui`

**What we want.** The See All people sheet (`(app)/people.tsx`) has no section
header — the sheet's own bar carries its title — but an inset-grouped `List`
reserves room above its first section for one anyway. Measured against the
Settings sheet from identical anchors (iPhone 17 / iOS 26.5): title ink 93.33
there / 93.67 here, first content **146.0** there (its "General" header) against
**167.0** here (the card). Settings spends that band on a word; ours is empty.

**Why it isn't closed.** No API reaches it on 57, all measured:

| attempt                                       | result                                    |
| --------------------------------------------- | ----------------------------------------- |
| `listSectionMargins({edges:'top', length:0})` | no-op, card unmoved at 167.0              |
| `listSectionSpacing(0)` and `('compact')`     | no-op, 167.0                              |
| `Section` with a zero-height header view      | 160.0 — SwiftUI clamps the minimum        |
| `padding({top: -21})`                         | lands 146.0 — and was REVERTED, see below |

**Why the negative padding was pulled**, since it "worked": `padding` moves the
FRAME, not the content. The reserved slot stays in the scroll range, so the list
gains 21pt of empty travel above its first row — the scroll indicator starts
before the content and you can drag through nothing. Juan spotted it within a
day. A visible band beats a scroller that lies about what it holds.

**What SHIPPED instead**, since the band was still too much by eye: `marginTop:
-EMPTY_HEADER_SLOT` on the RN wrapper AROUND the Host. Same 146.0, and no
phantom range — moving the hosting VIEW makes UIKit recompute its content inset
with it, where moving the SwiftUI frame inside it did not. Verified stable at
XXXL Dynamic Type (the empty slot has no text to grow by, so it stays 21 while
Settings' real header grows). It is still a compensation, not a removal —
`contentMargins` is what deletes the slot.

**What unlocks it.** `contentMargins` — the same modifier the search-list entry
below is waiting on, which insets CONTENT while leaving the frame alone. Grep
`node_modules/@expo/ui/build/swift-ui/modifiers/index.d.ts`; absent on 57.0.7.
On the day it lands: `contentMargins` top = 0 on that List, and
`SKELETON_TOP_MATCH` in the same file drops by 21.

---

## Explore's SEARCH lists scrolling under the glass bar — blocked on `@expo/ui`

**It is the SEARCH chrome, not the `Host`.** Worth knowing before you generalise
this entry. While the See All people list was built as a pushed screen (it
shipped as a form sheet instead — `(app)/people.tsx`), it ran the same SwiftUI
`List` in the same `Host` under a plain nav bar and had **none** of these
symptoms: rows scrolled under the bar, the glass refracted them, and a **large
title collapsed** normally. Sim-verified 2026-08-12, iPhone 17 / iOS 26.5. So
this entry is specifically about a `Host` under `headerSearchBarOptions`; don't
cite it to justify an inline title or a compensating inset anywhere else.

**What we want.** In Explore's search states — Recently Searched and the results
list — content should pass UNDER the search field and dissolve into it, the way
Contacts, Music and the App Store all behave, and the way Explore's own BROWSE
grid already behaves one keystroke away. Juan flagged it on 2026-08-12: the
header reads as a **solid slab** in search mode and as liquid glass in browse
mode, on the same screen.

**Why it happens.** Browse is a real RN scroll view, so react-native-screens
gives it `contentInsetAdjustmentBehavior="automatic"` under
`headerTransparent: true` — the content extends to the top of the screen and is
only INSET, so it scrolls under the bar and the glass has something to refract.
The search lists are a SwiftUI `List` inside a `Host`, and **`Host` applies the
safe area as FRAME padding**, not as a content inset: the list's frame starts
below the bar, so nothing can ever pass under it. The bar then has nothing but
flat page background to sample, which is exactly what a solid slab looks like.
Sim-verified 2026-08-12 on iPhone 17 / iOS 26.5, browse vs search side by side.

**What was tried, and what it measured.** `ignoreSafeArea="all"` on the `Host`
gives the list the full frame, and the glass immediately becomes real — the
section header and a Follow pill visibly ghost through the bar. It is also
unusable on its own: the safe area is now zero, so the list's RESTING position
puts its first row under the status bar. There is no way to put the inset back:
the whole point is to inset the CONTENT while the frame stays full-bleed, and
`padding` on the `List` moves the frame (verified — the resting position moves
but the clip moves with it). Reverted.

**What unlocks it.** `@expo/ui` exposing **`safeAreaPadding`** or
**`contentMargins`** as SwiftUI modifiers — grep
`node_modules/@expo/ui/build/swift-ui/modifiers/index.d.ts`; neither exists on
**57.0.7** (`scrollEdgeEffectStyle` and `safeAreaInset` are absent too, which is
the same gap the welcome-footer entry above is blocked on — one API landing
likely unblocks both). On the day it lands: `ignoreSafeArea="all"` on both
Hosts, then `safeAreaPadding`/`contentMargins` top = the header height, and
`listTopInset` in `ListSectionIos.tsx` collapses into it.

**Do NOT work around it** by hardcoding a header height into a spacer row.
expo-router does not publicly export `useHeaderHeight` (it is vendored at
`expo-router/build/react-navigation/elements`, a private path), so the number
would have to be a guessed constant per focus state — and the Explore layout
already carries a comment saying the screen takes its top inset from
`contentInsetAdjustmentBehavior`, **never** from a hardcoded header height.
Until the API exists the flat bar stays; it is correct in every other respect.

---

## Two SEPARATE bar-button capsules — blocked on `react-native-screens`

**What we want.** Profile's two trailing bar glyphs (`plus` → New Top,
`person.crop.circle` → Account) rendered as **two independent Liquid Glass
capsules**, which is what Apple does with an unrelated pair. Photos is the
reference and was band-scanned on iPhone 17 / iOS 26.5: its `⋯` and account
buttons are two **43.0 × 43.0** circles whose ink centres sit **59.67pt** apart,
i.e. 16.67pt of clear background between the capsule edges. Juan picked this
arrangement on 2026-08-13 after noticing WhatsApp separates its own bar buttons.

**Why it isn't built.** `headerRight` is ONE bar button item. RNScreens takes
the view it returns and hands UIKit a single custom-view `UIBarButtonItem`, so
iOS 26 draws exactly one glass capsule around whatever is inside — the count of
Hosts in there is irrelevant. Verified on device: two `SwiftUIHost`s side by
side still render one 110.67 × 44.0 pill.

Note this **contradicts** what `HeaderGlyphButton.ios.tsx` used to claim ("two
separate hosts render two capsules"). That line was never measured; it is wrong.

**What unlocks it.** RNScreens exposing **multiple right bar button items** —
UIKit's own `navigationItem.rightBarButtonItems` (plural). Grep
`node_modules/react-native-screens/ios` for `rightBarButtonItems`; only the
singular `rightBarButtonItem` is set today, and expo-router surfaces no plural
prop either. On the day it lands: `HeaderGlyphGroupIos` returns one item per
glyph and the row's `CAPSULE_GAP` becomes UIKit's own spacing.

**What we did instead, and it is not a fake.** The _reachability_ half of the
problem was the real defect and it is fixed independently of the container: each
glyph now carries a 43pt `frame` + `contentShape`.

The SPACING, though, has to come from a merged pill and not from this entry's
numbers — copying Photos' 59.67 centre-to-centre into a single pill puts 16.67pt
of pill where Apple has page background, and it reads as a hole (caught on sight
2026-08-13). Apple's merged-pill invariant is the ink-EDGE gap: Calendar's three
grouped glyphs sit at a constant 35.66 / 35.33 while their centre distances drift
(57.83 / 54.33) with each glyph's width. Ours is measured at 36.0. If this entry
ever unblocks and the pair splits into two capsules, the gap goes back UP to
16.67 between capsule edges — the two numbers are not interchangeable.

**Do NOT fake the split** by drawing our own `glassEffect` capsules inside the
system one. `glassEffect` exists on 57.0.7 and would render glass nested in
glass, and hand-drawing native bar chrome is the specific mistake `AGENTS.md`
records for the iOS edit sheets. One honest pill beats two imitation capsules.

---

## A bar overflow's PULL-DOWN MENU — blocked on `react-native-screens`

**What we want.** Recently Deleted's `⋯` opening a **pull-down menu anchored to
its own glyph**, which is iOS 26's idiom for a bar overflow — Files' own
Recently Deleted, Photos' album `⋯`, Mail's mailbox `⋯` all do exactly this.
Ours raises an `ActionSheetIOS` instead: a sheet that slides up from the bottom
of the screen with its own Cancel row, which is the pre-iOS-14 idiom and belongs
to a choice that has no control to hang off.

**Why it isn't built.** It WAS built, on 2026-08-19, and reverted the same hour.
`@expo/ui`'s `Menu` works — it renders the real system menu, with a red
`role="destructive"` row — but inside a `headerRight` it presents at the wrong
anchor: the popover comes up **centred on the bar**, covering the sheet's title,
instead of dropping below it. Measured on iPhone 17 / iOS 26.5: the menu's box
ran 90.00 → 148.00 while the title's ink sits at 103.00 → 117.67, so it covered
the title outright. Dropping `matchContents` on the hosting `SwiftUIHost` (the
obvious suspect, since a host that resizes to its children gives UIKit a moving
anchor) changed nothing — the placement is identical with and without it.

The cause is the same one the entry above records: `headerRight` is ONE
custom-view `UIBarButtonItem`, and a SwiftUI `Menu` inside a bridged host has no
`UIBarButtonItem` to anchor its presentation to.

**What unlocks it.** RNScreens exposing UIKit's own `UIBarButtonItem(menu:)` —
the API that makes a bar button present a `UIMenu` natively, with correct
anchoring for free. Grep `node_modules/react-native-screens/ios` for
`UIBarButtonItem(` and for `menu`; today it only ever builds items from a title,
an image or a custom view. Alternatively, `@expo/ui` gaining a way to present a
`Menu` from a host that is itself a bar item.

**Do NOT ship the menu as it renders today.** A menu that covers the sheet's own
title is worse than the action sheet it replaces; the idiom is right and the
placement is not, and only one of those is visible to a person using it.

---

## The editor sheets' PROMINENT ✓ bar item — blocked on `react-native-screens`

**What we want.** The trailing ✓ of the editors' commit-modal pair rendered the
way iOS 26 renders it in New Contact / New Event: the bar item's OWN capsule
filled with the app accent while the form can commit (UIKit's prominent bar
item), grey while it cannot. Band-scanned on iPhone 17 / iOS 26.5: a 44 × 44
filled circle, ~18pt white checkmark, in the bar's trailing slot.

**Why it isn't built.** RNScreens hands a `headerRight` custom view exactly one
system-drawn glass capsule and exposes no prominent/filled styling for it. Both
reachable approximations were built and rejected:

| attempt                           | result                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 36pt filled disc inside the glass | a blue disc floating in a lighter glass ring — a nesting artifact, plainest in dark (Juan rejected on sight) |
| fill the full 44 content          | UIKit grows its capsule around content: stretched 51 × 43.7 pill (measured)                                  |

**What SHIPPED instead.** `SheetCommitGlyphIos` tints the GLYPH — `primary`
enabled, muted disabled — on the system's own glass, the same grammar as the
leading ✕. State lives in colour; the glass stays real.

**What unlocks it.** RNScreens exposing UIKit's prominent bar-button styling
(or `rightBarButtonItems` with style control — see the two-capsule entry
above, same underlying gap). On the day it lands: `SheetCommitGlyphIos`
becomes a styled bar item and the fill returns as Apple draws it.

## The play/pause SYMBOL REPLACE transition — blocked on `@expo/ui`

**What we want.** Apple's transport does not hard-swap `play.fill` for
`pause.fill`; it MORPHS them, which is `.contentTransition(.symbolEffect(.replace))`
in SwiftUI. It is the single cheapest piece of life a now-playing screen has,
it is what Music, Podcasts and Control Center all do, and it costs nothing —
the symbol is already an `Image` in `TransportGlyphs.ios`.

**Why it isn't built.** On `@expo/ui` 57 neither half of the API is reachable:

| symbol to grep for  | what 57 exposes                                                                        |
| ------------------- | -------------------------------------------------------------------------------------- |
| `contentTransition` | `'numericText' \| 'identity' \| 'opacity' \| 'interpolate'`                            |
| `symbolEffect`      | appear/bounce/breathe/disappear/drawOn/drawOff/pulse/rotate/scale/variableColor/wiggle |

`.replace` appears in neither list — `contentTransition` has no
`symbolEffect` case, and `symbolEffect`'s union has no `replace` member (it
carries only the indefinite and discrete effects, none of which is a
content swap).

`contentTransition('interpolate')` on one `Image` whose `systemName` changes is
the nearest reachable thing and is NOT a substitute: interpolate morphs between
two renderings of the SAME symbol, and these are two different symbols with
different path counts.

**What SHIPPED instead.** Two `Image`s behind a conditional — React unmounts
one and mounts the other, so the glyph changes on a frame with no transition.
Correct, just inert.

**What unlocks it.** `@expo/ui` adding `'symbolEffect'` to `contentTransition`'s
union (or a `replace` member on `SymbolEffect`). On the day it lands:
`TransportGlyphs.ios` gains a single `PlayPauseGlyph` holding ONE `Image` whose
`systemName` is driven by `playing`, carrying the modifier — the two-component
split exists only because the swap is inert today.

---

## A BUFFERED-AHEAD track on the player's scrubber — blocked on `react-native-audio-api`

**What we want.** Sound Shaper's scrubber should show how much of the sound has
actually arrived, the way YouTube Music and every streaming player draw a paler
fill ahead of the playhead. It is the one honest answer to "why is the thumb not
moving" on a slow connection, and this app streams from a CDN, so the question
is real.

**It matters because playback here IS chunked**, which surprised nobody more
than the audit that checked it. `react-native-audio-api`'s `<Audio>` hands the
raw URL to native and streams by HTTP byte range whenever two conditions hold —
the build includes FFmpeg (`disableFFmpeg` defaults to false and this app does
not override it) and the origin advertises ranges. Cloudinary does: probed
2026-08-21, `accept-ranges: bytes`, and a `Range: bytes=0-0` returns `206`. When
either condition fails the library silently falls back to
`response.arrayBuffer()` — the WHOLE file into memory before the first note —
so this is also the thing that would tell us the fallback had kicked in.

**Why it isn't built.** No accessor. `react-native-audio-api` 0.13.2 exports a
`TimeRanges` interface from `Audio/types` (`length`, `start(i)`, `end(i)` —
HTML5's shape exactly) and then never surfaces one:
`AudioComponentContextType` carries `currentTime`, `duration`, `playbackState`,
`ready`, `volume`, `muted` and the transport methods, and no `buffered`. Nothing
in `AudioTagHandle` returns one either. The type is declared and orphaned.

**What unlocks it.** A `buffered: TimeRanges` on `useAudioTagContext()`'s value
(or on `AudioTagHandle`). On the day it lands, `PlayerScrubberLive` reads it
beside `position` — it already owns the only subscription to the playhead — and
the iOS scrubber draws the range under SwiftUI's `Slider` as a second track.

**A second, smaller thing on the same package.** Every remote load runs
`detectHttpByteRanges` first — a `HEAD`, or a `Range: bytes=0-0` GET where HEAD
is blocked — before it can decide to stream. It is not cached, so the probe is
re-paid for the same host on every track, and it sits directly in front of
time-to-first-sound. The app-side half is already fixed: restarting the loaded
sound now seeks instead of remounting the element (`restartLoaded` in
`store/player.ts`), which is what made "previous" pay for a fresh probe on a
track that was already playing. The rest needs a per-origin memo inside the
library.

---

## Preserve Pitch that doesn't sound grainy — PATCHED LOCALLY 2026-08-22, nothing filed upstream

**Where this stands.** Sound Shaper's Preserve Pitch is usable at any speed on
music now, via `patches/react-native-audio-api/` (see its README): the
library's `WsolaTimeStretcher` internals are replaced with a phase vocoder —
vendored [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch),
MIT — behind the class's unchanged public surface. **Device-verified on a real
iPhone the same day**, across several tracks, several presets and the whole
0.5–1.5× range — the listening test is what actually closes this, the numbers
below only found it.

**ANDROID NEEDED A SECOND, UNRELATED FIX, AND THE SHAPE OF THE MISTAKE IS THE
LESSON** (2026-09-11). The stretcher above is `common/cpp/` — shared — so it had
been compiled into Android the whole time, and the entry above saying only
"device-verified on an iPhone" made it look iOS-only. It was not; three checks
proved it in minutes (signalsmith symbols in the installed APK's `.so`,
`-O3 -DHAVE_ARM_NEON_INTRINSICS=1` in `compile_commands.json`, and a live 37.9 %
→ 41.4 % CPU step when Preserve Pitch is toggled). Android still crackled, and
the cause was the **stream**, not the DSP: `AudioPlayer.cpp` opened an exclusive
MMAP stream in `PerformanceMode::LowLatency` — a **2.0 ms** callback deadline on
a Galaxy A54's 96-frame burst, scheduled on a Cortex-A55 little core. A phase
vocoder cannot land its FFT there. **iOS is clean with the identical C++ only
because it never asks**: nothing in `ios/` calls `setPreferredIOBufferDuration`,
so AVAudioSession keeps its ~23 ms playback default. The library overrode the
buffer on one platform and overrode it toward hard real time. Now `Shared` +
`None` → 26.7 ms; 38.2 % → 19.4 % CPU at 1.5×, and Juan signed it off by ear.

Two things worth not re-deriving. **The preemption rate did not change** (46.2/s
before and after) — the deadline was the defect, so pinning to a big core or
raising priority would have chased the symptom. And **a debug build lies about
DSP cost**: it put the vocoder at ~3.5 points of a core because the thread was
already saturated by unoptimized everything-else; a release build put it at ~29.
Cost DSP work on release builds only. The two workarounds retired with it: `keepPitch` defaults
to **on** again, and the shape summary's pitch chip inverted back to
"pitch off". Checked before patching: 0.13.3 and the 2026-08-22 nightly both
still carry the identical stretcher.

**NOTHING IS BEING FILED UPSTREAM, AND THAT IS A DECISION, NOT AN OMISSION**
(Juan, 2026-08-22). An issue was drafted and deleted unfiled: the patch already
solves our problem, and carrying a report — answering maintainers, re-running
repros against their branches — is work this repo is not taking on. So this
entry stays only as the RECORD: why the patch exists, what was measured, and
when it can go. Do not re-draft it; if a future session wants the argument,
everything needed is below.

**What was established, so nobody re-litigates it.** The library time-stretches
with its own WSOLA (`common/cpp/audioapi/dsp/WsolaTimeStretcher.h`, 0.13.2:
`OLA_WINDOW_MS = 20`, `SEARCH_INTERVAL_MS = 30`, `SEARCH_DECIMATION = 12`),
selected by `chooseFillMode()` in `AudioFileSourceNode.cpp` — `Passthrough` at
rate 1×, `Resample` (varispeed, clean) with preservation off, `Wsola` otherwise.
The graininess is **inherent to WSOLA at this quality bar, not a tuning miss** —
measured offline by compiling the stretcher unmodified into a standalone
harness fed exactly the way the node feeds it. A 2 kHz click train (32 clicks):
stock at 0.5× plays **69** clicks (every one doubled, 10.6 ms mean timing
error, echo floor −27 dB), at 2× plays **16** (every other one dropped). A full
sweep — windows 20/40/60 ms × search 15/30/50 ms × decimation 4/12 — made every
variant equal or worse; larger windows double MORE transients. The
"music-grade values" idea from the original entry is therefore dead, and option
1 (better algorithm) was the only real path. The phase-vocoder replacement
measures 32/32 clicks at both rates, ≤0.02 ms timing error, echo floor
−65/−77 dB, ~1% of a core per mono stream, at the cost of 120 ms of
transition latency vs WSOLA's ~30 (irrelevant during continuous playback).

**On a version bump** `scripts/apply-patches.mjs` fails the install until the
overlay is re-verified — and since nobody upstream has been told, assume the
WSOLA is still there and check: diff the new version's
`WsolaTimeStretcher.{h,cpp}` against 0.13.2's. If it has grown a music-grade
path on its own, the right move is deleting `patches/react-native-audio-api/`,
not rebasing it.

---

## A now-playing artwork that can be CLEARED — PATCHED LOCALLY 2026-09-11, nothing filed upstream

**Where this stands.** Sound Shaper publishes `artwork: ''` for a cover-less
sound and the system's own art-less placeholder appears, on the Dynamic Island,
the Lock Screen, Control Center and Android's media card. Before the patch that
publish was an omission, and an omission changed nothing.

**What we wanted.** A cover-less sound shows the PLATFORM's placeholder — what
Music and Podcasts show, and what this app already showed for a sound that had
never had a cover. The two cover-less cases disagreed: a sound that never had
artwork was drawn correctly, and a sound reached by passing THROUGH one that had
artwork wore the other one's cover under its own title. Reported on device
2026-09-11.

**Why it wasn't reachable.** A now-playing publish is a PATCH, not a PUT, on
both platforms, and neither exposes a removal.

- iOS `PlaybackNotification.mm` → `updateNowPlayingInfo:` copies the center's
  existing dictionary and writes only the keys the payload carries, so
  `MPMediaItemPropertyArtwork` survives; `_currentInfo[@"artwork"]` and
  `self.artworkUrl` survive with it, and `updateArtworkIfNeeded:` opens with
  `if (!artworkUrl) return;`.
- Android `PlaybackNotification.kt` → the decoded cover lives in an
  `artwork: Bitmap?` field, and `updateInternal`'s tail re-stamps it onto a
  metadata builder that is otherwise rebuilt from scratch each publish.

Omitting the key, `""` and `null` all leave every one of those in place. The
one thing that does clear is `hide()`, and on Android `hide()` releases the
`MediaSessionCompat` and zeroes the `controls` bitmask — so calling it between
tracks re-posts the notification with `actions=0`, the exact failure
`NowPlayingBridge.tsx` documents from `dumpsys media_session`. There was no
supported way to do this.

**A SECOND staleness path, found doing the first and able to mask it.** The
artwork load is a blocking network read with no cancellation — iOS never
cancelled, and Android's `interrupt()` does not abort a socket read — so
skipping tracks quickly leaves several in flight and the LAST to COMPLETE wins
the slot, which need not be the one playing. Without a session token the
outgoing track's late load would have stamped its cover back over the cleared
one, and the clear would have looked broken. Both halves are in the patch; a
generation counter is bumped by every new load, every clear and `hide`.

**A THIRD thing was found in the same block and fixed with it, Android only.**
Upstream interrupted the load thread and started a fresh network read on EVERY
publish — and a player publishes on every pause, every rate change and every
scrub. iOS has always had the guard (`updateArtworkIfNeeded:` returns early on
an unchanged url whose image is in place); Android now does too, and a cover
that fails to load falls back to the system placeholder rather than to the
previous track's.

**Verified on the Galaxy A54** (2026-09-11) through
`adb shell dumpsys media_session`, whose `metadata: size=` counts the keys the
session carries — 5 with a cover, 4 without. Covered → `size=5`; skip to a
cover-less sound → `size=4` and a shade card with no inherited artwork and the
transport intact (`actions=310`); skip on → `size=5` again; four skips fired
back to back settle on the sound the app is actually playing. The full table is
in the overlay's README.

**On a version bump** `scripts/apply-patches.mjs` fails the install until the
overlay is re-verified. Check for BOTH halves upstream — a removal for
`artwork`, and a cancellation or session token on the load. Both present:
delete the two `PlaybackNotification` files from the overlay. One present:
rebase the other, since `NowPlayingBridge.tsx` depends on the pair. Everything
else in those two files is upstream's, so a rebase is a re-apply of the blocks
marked `PATCH:`.

**Nothing is being filed upstream**, on the same standing call as the two
changes above (2026-08-22) rather than because this one is unfileable — it is a
plain defect and would be a clean report.

---

## Inline links that are the PLATFORM'S OWN — blocked on `@expo/ui` (both sides)

**What we want.** The welcome screen's tappable runs of prose — the author
credit and the two legal pages — drawn by each platform's own text engine
instead of by React Native. Today all three go through `TextLink`
(`@portfolio/mobile-ui`), which is RN on BOTH platforms. iOS's author credit is
the one exception and IS native: a SwiftUI `Link`, because it is a standalone
word rather than a run inside a sentence.

**Why it isn't built — and it is a DIFFERENT blocker per platform.**

**iOS is blocked on interception, not on rendering.** SwiftUI can already draw
this: `@expo/ui` 57 exposes `markdownEnabled` on `Text` (SwiftUI
`LocalizedStringKey`), so `[Privacy Policy](url)` renders as a real tappable
link, correctly tinted, wrapping mid-phrase like any other text. The problem is
what happens on tap: a markdown link fires SwiftUI's `openURL` environment
action, which hands the URL to **Safari and leaves the app**. Every welcome
route deliberately opens these in an in-app `SFSafariViewController` sheet
(`WebBrowser.openBrowserAsync`) so that reading a policy never drops someone out
of the sign-in flow. Overriding that needs
`.environment(\.openURL, OpenURLAction { ... })`, and `@expo/ui`'s `environment`
modifier accepts only `editMode`, `colorScheme`, `locale` and `timeZone`.

**Android is blocked on rendering.** Compose's own primitive for a link inside a
sentence is an `AnnotatedString` carrying a `LinkAnnotation` (`withLink`), which
`@expo/ui` does not surface — `TextSpanRecord` has no press handler and no link
field. The only reachable Compose approximation is a `TextButton` beside the
prose, and that was BUILT, MEASURED AND REMOVED on 2026-08-29: its ripple is
Material's 10% state layer, which at link size measured a peak delta of 18/255
in light and 25/255 in dark on a Galaxy A54 — present, spec-correct and
imperceptible against the 82/255 an RN fade gets. `clickable` offers only
`indication: boolean`, so it cannot be strengthened. It also carried
`ButtonDefaults.MinHeight`, which inflated the credit row and had to be fought
with an `offset`.

**What unlocks it.**

1. **iOS** — an `openURL` key on `@expo/ui`'s `environment` modifier (grep
   `EnvironmentConfig` in `swift-ui/modifiers/environment.d.ts`; today it is a
   four-member union). With it, `LegalFooter.ios.tsx` becomes one
   `markdownEnabled` `Text` whose links still open the in-app sheet.
2. **Android** — a press handler or link field on `TextSpanRecord` (grep
   `TextSpanStyleBase` / `TextSpanRecord` in
   `jetpack-compose/Text/index.d.ts`). With it, both Android links become one
   Compose `Text` with `LinkAnnotation` spans, the RN fallback goes away, and
   the credit stops needing its own `Host`.

**Until then RN is the CORRECT answer here, not a shortcut**, and that is worth
stating because it looks like a violation of native-primitive-first. It is the
rule's own fallback: on Android the native control cannot render this at all,
and on iOS it can render it only by breaking a deliberate UX decision. The
consolation is that one RN component gives both platforms identical behaviour,
which is what the three links have today.

---

## A carousel PEEK item's rounded corner — blocked on `@expo/ui`

**What we want.** Every item in the Carousel showcases rounded at M3's
`shapes.extraLarge` (28dp) — including the squeezed peek strips, not only the
focused item.

**Why it matters here.** iOS has no sharp-cornered coloured container anywhere
in this app because Apple's radii are respected there, and Material has its own
shape scale that simply was not being applied on the Android side (Juan,
2026-09-02). The docs examples draw each slide as a bare `background(color)`
with no clip, so every item rendered as a hard square.

**What IS fixed.** Clipping the item's own `Box` — `clip(carouselItemShape)`
before `background(...)` — rounds it correctly. Measured on a Galaxy A54: the
focused hero item's corner inset eases 23.5dp → 0.0dp over ~25dp, which is the
28dp radius drawing, and `HorizontalUncontainedCarousel`'s items are rounded on
all four corners because uncontained items keep their full width.

**What isn't, and why.** `HorizontalMultiBrowseCarousel` and
`HorizontalCenteredHeroCarousel` MASK their items down as they scroll, and our
clip lives INSIDE that mask — so a peek item shows a slice taken from the middle
of the rounded box, where there are no corners. Measured: a peek strip 39.8dp
wide with **0.0dp corner inset at every row**, fully sharp, against a source box
clipped at 28. Compose solves this with `Modifier.maskClip(shape)`, which
shapes the carousel's MASK rather than the content; `@expo/ui` **57.0.7**
exposes no such modifier, and neither carousel takes an item-shape prop
(`CarouselCommonConfig` is `itemSpacing`, `contentPadding`, `flingBehavior`,
`userScrollEnabled`, `modifiers`, `children`).

**What unlocks it.** A `maskClip` modifier, or an item-shape prop on the
carousels. Grep for either mechanically:

```bash
grep -rn "maskClip" node_modules/@expo/ui/build/jetpack-compose/modifiers/index.d.ts
grep -n "shape" node_modules/@expo/ui/build/jetpack-compose/Carousel/index.d.ts
```

Non-empty = swap `clip(carouselItemShape)` for the mask version in the three
files under `apps/expo-ui-starter/src/components/showcase/android/carousel/`.

---

## A `SearchBar`'s KEYBOARD — blocked on `@expo/ui`

**What we want.** Tapping either search-bar showcase to open the soft keyboard,
so the demo can actually be typed into.

**Why it matters here.** It cannot. Tapping focuses the field — the caret shows
and key events land — but the IME never opens and the bar never expands, so both
showcases are inert. **Re-verified on 57.0.7** (Galaxy A54, 2026-09-02) rather
than trusted: `adb shell dumpsys input_method | grep mInputShown` reads `false`
after tapping the `SearchBar`, and `true` after tapping the `TextField` showcase
one route away. Same probe, opposite answers — so the window is fine and the
component is not.

**Why it isn't built.** `SearchBar` and `DockedSearchBar` are the only
components built on Compose's `TextFieldState` API, whose IME request dies under
the RN-hosted window; the legacy `value`/`onValueChange` fields (`TextField`,
`BasicTextField`) open the keyboard fine in the same `Host`. There is no escape
hatch: `SearchBarProps` on 57.0.7 is `onSearch`, `modifiers`, `children` — no
ref, no `autoFocus`, no focus prop — and none of the 44 exported modifiers
touches focus (`clickable`, `selectable`, `toggleable`, `semantics` … no
`focusRequester`).

**What unlocks it.** A focus/ref API on `SearchBar`, or the underlying IME fix.
Grep for either mechanically:

```bash
grep -nE "ref|autoFocus|focus" node_modules/@expo/ui/build/jetpack-compose/SearchBar/index.d.ts
grep -n "focusRequester" node_modules/@expo/ui/build/jetpack-compose/modifiers/index.d.ts
```

Non-empty = drop the KNOWN UPSTREAM GAP banners in
`showcase/android/search-bar/` and `showcase/android/docked-search-bar/`.

**Nothing is being filed upstream, on purpose** (Juan, 2026-09-02) — this entry
is the record. The app itself is unaffected: `SearchField` in
`@portfolio/mobile-ui` is a Material `TextField` pill precisely because of this,
and its keyboard works. Only the showcases are stuck, because demonstrating the
real component is their job.

---

## A `SearchBar` / `DockedSearchBar` CONTAINER COLOUR — blocked on `@expo/ui`

**What we want.** Both search-bar showcases in expo-ui-starter — `SearchBar`
and `DockedSearchBar` — to sit on the same fill as the text-field showcases
beside them.

**Why it matters here.** They do not match today: measured on a Galaxy A54 in
dark, both docked search bars render **#4D4D52** against the **#24262D** the
`basic-text-field` demos land on. #4D4D52 is raw `surfaceContainerHigh` — the
One UI slab this repo has already repaired everywhere it could reach (the
inline `DateTimePicker`, the hand-decorated `BasicTextField`s and the alert
dialogs all take a stated colour for exactly this reason). The search bars are
the one place left that still shows it.

**Why it isn't built.** No API, and the modifier escape hatch does not work.
`DockedSearchBarProps` on **57.0.7** declares exactly three fields —
`onQueryChange`, `modifiers`, `children` — with no colours slot, while Compose's
`DockedSearchBar` takes `colors: SearchBarColors` natively. Passing
`modifiers={[clip(Shapes.Circle), background(fill)]}` was built and MEASURED: the
bar still rendered #4D4D52, because the composable paints its own `Surface` from
`SearchBarDefaults.colors()` OVER whatever the outer node draws. The dead
modifiers were removed rather than left in place implying they do something.

**What unlocks it.** A `colors` prop on `DockedSearchBar` (and on `SearchBar`,
which has the same shape). Grep for it mechanically:

```bash
grep -n "colors" node_modules/@expo/ui/build/jetpack-compose/DockedSearchBar/index.d.ts
grep -n "colors" node_modules/@expo/ui/build/jetpack-compose/SearchBar/index.d.ts
```

Non-empty = pass `{ containerColor: useSurfaceContainerHighest() }` from the
files under `showcase/android/docked-search-bar/` and `showcase/android/search-bar/`.

**Note on the sibling.** The app's own Android search field does not use
`SearchBar` at all — its IME is dead on 57, so `SearchField` in
`@portfolio/mobile-ui` is a Material `TextField` pill, which is themeable. Only
the SHOWCASES are stuck, because their job is to demonstrate the real component.

---

## A Compose `RadioButton`'s SELECTED colour — blocked on `@expo/ui`

**What we want.** The selected dot in the Language / Appearance radio dialogs to
be the app's accent, which on a wallpaper-derived palette is not the same value
the native Material scheme hands a Compose control.

**Why it matters here.** Samsung One UI returns the SAME `primary` in both
schemes — measured `#387AFF` in dark and in light on a Galaxy A54 — where M3
gives a dark scheme the lighter tone 80. `schemePrimary` in `@portfolio/core`
repairs that for everything the app paints itself (measured `#B1C5FF`), and every
Compose control that accepts a colour has been pointed at it: `TextButton` via
`colors.contentColor`, `OutlinedTextField` via its focused indicator / label /
cursor, `AlertDialog` via `colors.containerColor`. The radio dot is the one that
cannot be, so it renders the raw `#4979F6` beside labels at `#B1C5FF` — the only
untuned accent left in the app.

**Why it isn't built.** No API. `RadioButtonProps` on `@expo/ui` **57.0.7**
declares exactly three fields — `selected`, `onClick`, `modifiers` — and there is
no tint among the modifiers either (checked the full export list: `background`,
`border`, `alpha`, `blur`, `clip` … no colour that reaches a control's own
drawing). Compose's `RadioButton` takes `colors: RadioButtonColors` natively; it
is simply not surfaced.

**What unlocks it.** A `colors` prop on `RadioButton`, the same shape the other
controls already have. Grep for it mechanically:

```bash
grep -n "colors" node_modules/@expo/ui/src/jetpack-compose/RadioButton/index.tsx
```

Non-empty = build it: pass `{ selectedColor: colors.primary }` from
`RadioOptionsDialog` in `packages/mobile-ui/src/SettingsScreen.tsx`.

**The thing NOT to do meanwhile.** `Host` takes a `seedColor`, and seeding the
scheme WOULD regenerate a correct M3 ramp — including a proper dark tone-80
primary — fixing this natively. It also throws away One UI's own surface values
and regenerates all of them from one hue, which is a different theme, not a fix
for one dot. The portfolio rides the platform palette (see AGENTS.md); a seed is
a decision to stop doing that.

---

## A header icon button's RIPPLE COLOUR — blocked on `@expo/ui`

**What we want.** A header action that presses like the navigator's own back
arrow, which LIGHTENS the bar by 21.5 L\*.

**What we have.** Compose's ripple, which DARKENS it by about 2. Everything else
about these buttons now matches the native arrow — the leading one to the decimal
(39.82dp at x 27.91, y 61.69), the trailing ones within 0.4dp, on M3's 48dp pitch
and 40dp end inset, with a target wider than the native arrow's.

**Why it isn't built.** The ripple colour is not exposed. `colors.contentColor`
on `IconButton` reaches the CONTENT and not the indication — measured -2.19 L\*
with it and without it, i.e. no change at all.

**What unlocks it.** A ripple/indication colour on the Compose controls. Grep:

```bash
grep -rn "RippleConfiguration\|LocalIndication\|rippleColor" \
  node_modules/@expo/ui/android/src/main/java/expo/modules/ui/
```

**The escape hatch, REJECTED 2026-08-29.** An RN `Pressable` with
`android_ripple` would give the colour outright. Juan's call, asked and answered:
the header actions stay Compose `IconButton`s — "I want them icons to be as
native as possible, no rn pressables." That is the rule this repo already has, a
native control beating an authored one that matches a screenshot, and the icons
are Android XML vector drawables `Image` cannot render anyway, so the swap would
have dragged the whole icon set with it. Re-open only if `@expo/ui` exposes the
ripple.

**Solved along the way, and NOT to be re-litigated:** ripple size and placement.
The fix was to stop sizing the `Host` and let the `IconButton` size itself inside
a `Box` that states the 48dp slot — the full account, with the two wrong turns
that preceded it, is on `HeaderIconButton`.
