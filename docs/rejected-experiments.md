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

Note the boundary: this killed **uniform `glassEffect` as chrome**. Apple's
**progressive scroll-edge fade** on the welcome footer is a different effect and
is NOT rejected — it is wanted and blocked on a missing API, tracked in
[`pending-upstream.md`](pending-upstream.md).

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

Not a bug: RNScreens cannot drive large-title collapse or the scroll-edge
effect from a SwiftUI scroller, and 57.0.7 lacks `searchable` — a native
`List` home would trade away the system large title, the transparent bar AND
native search. The home stays an authored RN grouped list under real UIKit
chrome, pixel-measured against the List showcase (see
`HomeShowcaseList.tsx` header and `docs/dev-workflow.md` → harness).
