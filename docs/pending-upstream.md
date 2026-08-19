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
