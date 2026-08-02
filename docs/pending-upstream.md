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
and `safeAreaInset` — zero hits in either. (Latest published at the time was
57.0.8, a patch, which will not add a modifier family.) Without
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
