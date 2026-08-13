# Rejected experiments — built (or proven), then killed. Do not retry blind.

Each entry: what was tried, why it died, what shipped instead. If a future
task proposes one of these, the answer is "already run, here's the verdict" —
link this file instead of rebuilding. (Some verdicts also live as in-code
comments; this is the one-stop list.)

## Liquid Glass on Sound Shaper's header buttons + collapsed banner — REJECTED 2026-07-28

Built, sim-verified, and rejected on taste ("experimental learning"), fully
reverted. Tried: a `glass` prop on `RippleIconButton.ios.tsx` rendering a
`glassEffect(… interactive, circle)` Host disc behind the glyph (gear,
chevron, overflow), and the collapsed now-playing banner's fill replaced by a
bottom-anchored glass bar. Two durable lessons:

1. **Topper's "glass header buttons" are not authored anywhere** — they are
   plain SF Symbol images in a native `Stack` header, and **UIKit applies the
   glass itself** on iOS 26. A `headerShown: false` screen with a hand-rolled
   header row gets nothing for free; don't read Topper's code expecting a
   glass call.
2. **Glass needs content behind it to refract** — over Sound Shaper's pure
   black home it renders as nothing/black.

Note the boundary: this killed **uniform `glassEffect` as chrome**. Two
neighbouring things are NOT rejected and have been shipped or are wanted:

- Apple's **progressive scroll-edge fade** on the welcome footer — a different
  effect, wanted, blocked on a missing API, tracked in
  [`pending-upstream.md`](pending-upstream.md).
- The **`.glass` / `.glassProminent` BUTTON STYLES** (`buttonStyle`, iOS 26,
  present in `@expo/ui` 57.0.7). A stock control style is not a material used as
  chrome: the system sizes it, tints it and gives it its own press and disabled
  states. Shipped on Topper's iOS reaction row 2026-08-05 after all three stock
  styles were screenshotted side by side in both appearances — see
  `ReactionRow.ios.tsx`. The "nothing to refract over flat black" lesson still
  applies to judging one: verify it on screen against the actual background
  rather than assuming either way.

## Shared-element image morph in Topper (home thumbnail → detail) — INFEASIBLE, 2026-06

Two independent blockers: reanimated 4.3.1 ships shared transitions
**compiled out** (feature-flag false in JS and the native binary; needs a
static-flag override + full rebuild), and the source thumbnail lives inside
an `@expo/ui` Compose Host, which bridges only SIZE to Yoga — its on-screen
position is unmeasurable, so even a manual FLIP can't start from it.
Shipped instead: destination "hero" emphasis (detail thumbnail springs
0.8 → 1 on entry). Recorded also in the Topper detail-screen code.

## RN `RefreshControl` and `@expo/ui PullToRefreshBox` for Topper's pull-to-refresh — BOTH UNUSABLE

`RefreshControl` (SwipeRefreshLayout) has no custom-indicator hook, so it
can't show the M3 Expressive `ContainedLoadingIndicator`. `PullToRefreshBox`
detects the pull via Compose nested-scroll events that never cross the RN
bridge, so it can't host an RN FlashList. Shipped instead:
`apps/topper/src/components/ui/PullToRefresh.tsx` — Reanimated +
gesture-handler wrapper, indicator in a 48dp fixed Host; tuning numbers in
that file.

## Brand-mark glow — DROPPED (see AGENTS.md "Brand")

Could not render identically on both platforms — react-native-svg's
`FeGaussianBlur` no-ops on Android. The mark is flat; don't reintroduce.

## `SearchBar` / `DockedSearchBar` as real inputs — IME DEAD on SDK 57

The keyboard never opens. Material `TextField` pill replaces it where a
working input is needed (Topper Explore). Details + the always-mounted
`TrailingIcon` gotcha: `docs/expo-ui-customizations.md` → Keyboard section.

## SwiftUI `List` as the expo-ui-starter home catalogue — REJECTED 2026-08-01, design-level

⚠️ **The reason recorded here was WRONG and has been disproven — 2026-08-06.**
This entry used to read "RNScreens cannot drive large-title collapse or the
scroll-edge effect from a SwiftUI scroller". It can. Probed on Topper's Home
tab (iPhone 17 / iOS 26.5): a `List` inside a `Host`, standing in for the RN
`FlashList`, took the large title's content inset, **collapsed "Topper" into
the inline bar on scroll**, kept the scroll-edge blur — and additionally
triggered iOS 26's tab-bar minimize, which the RN list never does. That makes
three places the same false claim was written down (this entry, the Home
layout, the Explore layout); the other two were already corrected as
stale-bundle false negatives. **Do not re-cite it. Re-probe instead.**

What still stands: 57.0.7 lacks `searchable`, so a native `List` home in the
STARTER would trade away native search, and the starter's home is a catalogue
whose whole point is breadth. Its home stays an authored RN grouped list under
real UIKit chrome, pixel-measured against the List showcase (see
`HomeShowcaseList.tsx` header and `docs/dev-workflow.md` → harness).

The real cost of a native list, and the thing to weigh instead of the myth: one
`Host` has to wrap the WHOLE list (per-row Hosts render blank — see
`expo-ui-customizations.md`), so it gives up FlashList's virtualization.

## Explore's "See All" people as a PUSHED SCREEN — REJECTED 2026-08-12, on feel

Built first, worked, and thrown away — so don't rebuild it from Apple's shelf
grammar alone, which is what argued for it: a "See All" on a shelf header pushes
in the App Store, Music, TV and Photos.

Juan's call, and the reasoning is worth keeping: the overflow behind that header
is a GLANCE at who else is there, not a destination with its own place in the
tab's history. A sheet comes up over Explore, you follow a few people, you flick
it away and the shelf is still underneath; a screen makes the same list a place
you have to leave. It ships as `(app)/people.tsx`, a full-height form sheet.

**What the pushed version proved, and is worth keeping even though it went:**
a SwiftUI `List` in a `Host` under a PLAIN nav bar scrolls under the bar, the
glass refracts it, and a `headerLargeTitle` collapses normally — none of the
symptoms `pending-upstream.md` records for the same Host under Explore's SEARCH
chrome. That entry is specifically about `headerSearchBarOptions`; do not cite it
to justify an inline title or a compensating inset anywhere else.

**The cost the sheet accepts:** RNScreens gives no back button on a `formSheet`
root, so opening a profile from a row dismisses the sheet and pushes from
underneath (the move `follow-list` already makes). Coming back means reopening
See All. Accepted because the primary action there is the inline Follow, which
never leaves the sheet.

## A CARD-LESS list inside the See All sheet — REJECTED 2026-08-13, twice

The instinct is right and worth stating: the sheet IS already a container, so an
`insetGrouped` card inside it is a box in a box, and Apple's own in-sheet lists
(Contacts picker, Add to Playlist) are plain. Built as `listStyle('inset')`.
Rejected in both forms it can take:

- **rows on the sheet's own colour** — in DARK that is the same value as the
  sheet (`#1C1C1E` both), so the list had no surface at all; it read as text and
  hairlines floating on nothing. Light hid this completely (white rows on a
  `#F2F2F7` sheet), which is why it survived a first review.
- **rows on the elevated cell colour** (`sheetField`, `#2C2C2E`) — now visible,
  but a full-bleed slab in a second grey with no edges: neither one surface nor
  two.

There is no coherent middle. Either the rows ARE the sheet, or they are cells —
and cells on iOS have corners and margins. It ships as `insetGrouped`, matching
Settings' sections and Explore's own search results.

## Explore search bar hides while scrolling (`hideWhenScrolling: true`) — REJECTED 2026-08-08, taste + mount bug

The ask: while browsing the grid, the resting search field is chrome in front
of content — tuck it away on scroll (and ideally have it rest at its focused
~76pt position). Built and sim-verified on iPhone 17 / iOS 26.5; Juan rejected
the compress/hide motion outright, and it carries a real defect besides.

What the native option space actually is, measured:

- **The field can NEVER ride at its focused position while unfocused.** 76pt
  is the nav bar's own row; the search field is a `navigationItem` that only
  takes that row during search presentation (`hideNavigationBar: true`). The
  whole space is hidden-or-resting — there is no third state. Full width + top
  row remains a layout UIKit does not offer (leading slot is always reserved).
- `hideWhenScrolling: true` (UIKit's `hidesSearchBarWhenScrolling`, the
  Settings/Mail behaviour) DID work as such: scroll down → field tucks, no
  cancel X (search never activates), iOS 26 floats its own corner search glyph
  as re-entry; pull down → field returns to the aligned rest geometry.
- **The bug that would have shipped:** on this RNS/iOS 26 stack the field also
  MOUNTS tucked, once per cold launch — first visit to the tab has no visible
  search field until one manual pull-down (state then survives tab
  round-trips). No programmatic reveal exists: UIKit gates the reveal on a
  user drag. Tried and failed: `scrollToOffset(0)` (true no-op at rest), an
  animated over-scroll to −120 (clamped, ignored for reveal), and
  `hideNavigationBar: false` (not a factor — same mount state either way).

If this is revisited: fix the mount handshake in react-native-screens first
(or find a shipped RNS release that has), then flip the one flag back. The
tuck behaviour itself needed no other code.
