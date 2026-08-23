# Rejected experiments — built (or proven), then killed. Do not retry blind.

Each entry: what was tried, why it died, what shipped instead. If a future
task proposes one of these, the answer is "already run, here's the verdict" —
link this file instead of rebuilding. (Some verdicts also live as in-code
comments; this is the one-stop list.)

## The credit roll (Star-Wars-style crawl) — REMOVED 2026-08-19, not wanted

Built, iterated on twice, sim-verified, and removed. **Not a failure and not a
taste rejection of the idea** — the second pass looked good. Juan's call was
simply that neither this nor the licences screen below is something these apps
should carry: both were a fun experiment, and nothing else.

What it was: a full-screen modal off Settings → About, unlocked by Topper's
platinum. The app's icon faded in over black and receded, then the roll climbed
a plane tilting away to a vanishing point — every role to one person, an AI
assistance line crediting Claude, a Built With list, and a closing card. It
briefly shipped in expo-ui-starter too, gated on "every showcase visited", and
that half was removed first: a catalogue is not a game.

**The findings worth keeping, if a crawl is ever wanted again:**

- **The plane must rotate about its OWN CENTRE.** `transformOrigin` moves RN's
  rotation origin but leaves the PERSPECTIVE vanishing point at the view's
  centre; with the two disagreeing the projection goes off-axis and every line
  comes out sheared to the right, reading as a bad italic. Left at the centre
  they agree. 34° at a perspective of 640 keeps a line legible for about the
  top two thirds of its travel at phone sizes; 58° squeezes the whole roll into
  a band a few lines tall.
- **Dress it in the platform, not the brand.** The first version used the icon's
  greys (`#F5F5F5`/`#222222`) and invented type sizes — 34pt names at weight 800
  over 22pt uppercase at 0.55 opacity — and Juan called it sloppy on sight, which
  it was. The fix was `IOS_COLORS.dark` (black ground, `label`, `secondaryLabel`)
  and `TEXT_VARIANTS`, the HIG scale this repo already ships. Pinning the DARK
  palette in both appearances is the iOS answer rather than an exception to it:
  Apple's immersive surfaces — video player, Photos viewer, the TV app's own end
  credits — are black whatever the system appearance is.
- **Feather BOTH edges.** A horizon gradient at the top is the obvious half; the
  one that made it read as finished was a short gradient at the BOTTOM, so lines
  emerge instead of appearing fully formed at the screen's edge.
- **Budget the pre-roll in hundreds of ms, not seconds.** The first version spent
  6.2s on three queued beats before anything scrolled. Folding the opening
  sentence into the crawl as its first paragraph — which is also closer to the
  form being quoted — got it to 1.3s.
- **No audio, ever.** A theme is someone else's copyright, and this family
  already learned that playing anything interrupts what the person is listening
  to.

Two things that came out of the work and STAY, because they were right
independently: the single `InfoRow` renderer shared by Settings' About and Legal
cards (they were near-duplicate inline blocks, and Legal silently dropped a
trailing value), and `HeaderCloseButton`'s use across the sheet family.

## An in-app Acknowledgements / open-source licences screen — REMOVED 2026-08-19, deliberate risk call

Built end to end for both Topper and expo-ui-starter, sim-verified, then removed
at Juan's call — the same day, and for the same overall reason, as the credit
roll above: both were an experiment, not a feature these apps want. **Not
rejected on taste or on feasibility — it worked.** The specific call was that
most indie apps ship without one, nobody is likely to raise it, and he will add
it if that ever changes. Recorded here so the next session neither rebuilds it
by reflex nor re-litigates the decision.

What it was: Settings → Legal → Acknowledgements, a native inset-grouped SwiftUI
`List` of every shipped open-source package, each row pushing a sheet with that
package's licence in full. Data came from a committed, generated manifest
(`scripts/gen-licenses.mjs` → `apps/<app>/src/generated/licenses.json`).

**The findings are the part worth keeping.** If this comes back, these do not
need re-deriving:

- **A dependency tree is the WRONG source.** `npm ls --omit=dev --all` answered
  **683** packages for Topper; only **104** reach a device. `expo` declares
  metro, babel, `@expo/cli` and jimp as RUNTIME dependencies, so a tree walk
  cannot tell a bundler from a bundle. Measured: metro, babel and jimp
  contribute ZERO files to the exported bundle; `@expo/cli` contributes exactly
  one (its metro require shim). The right source is the sourcemap of a real
  `expo export --source-maps`, iOS and Android unioned. 683 → 104 for Topper,
  595 → 78 for the starter; 561KB → 84KB and 512KB → 64KB of bundled JSON.
- **The licence split leaves nothing to filter.** Of Topper's 104: MIT 91,
  Apache-2.0 4 (all Firebase), BSD-3 3, ISC 2, BSD-2 1, Unicode-DFS 1,
  MIT-AND-Apache 1, UNKNOWN 1 (`@expo/cli`, no `license` field). Filtering to
  "licences that require attribution" removes exactly ONE package (`tslib`,
  0BSD) — ~99% of the ecosystem is MIT and MIT IS an attribution licence.
  **No copyleft anywhere** in either app (zero GPL/AGPL/LGPL/MPL), which is the
  finding that actually matters.
- **The security argument against publishing the list does not hold**, and this
  was measured rather than asserted. The package names are already recoverable
  from any build: `strings` on the app binary returns the native packages by
  name, `Frameworks/` names the pods outright, and even a release **Hermes**
  bundle leaks module names as string literals (`@react-native-firebase/auth`,
  `@shopify/flash-list`, `zustand`, `expo-audio`, … all pulled out of a real
  `.hbc`). The screen was never what exposed them. What a screen CAN add is
  **versions** — a `name@version` table turns a package list into a ready-made
  CVE lookup, and licences never ask for a version, so if this returns it should
  ship names and licences only.
- **What the licences actually say**, for whenever the risk call gets revisited:
  MIT/ISC make the notice a CONDITION of the grant; BSD-2/BSD-3 name the binary
  case explicitly ("Redistributions in binary form must reproduce the above
  copyright notice…"); Apache-2.0 §4 wants recipients given a copy of the
  licence. The realistic exposure is not a lawsuit — it is a diligence
  checklist (acquisition, enterprise customer, partner review), where "show me
  your OSS attributions" is a standard line.

The UI work that outlived it: `SettingsInfoRow.destination` (the disclosure
chevron that distinguishes an in-app destination from a hand-off to Safari) and
the single `InfoRow` renderer shared by the About and Legal cards both came from
this and stay — Topper's Credits row uses them.

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

## Topper's downvote NUDGE on iOS — REMOVED 2026-08-15, product call

Built TWICE — first as a floating card under the reaction row, then as the ⬇
button's native `popover` — and removed both times. The popover presented
**mis-anchored on first open on device** and went stale across a theme change,
but the deciding reason was product rather than polish: someone with something
to say opens comments themselves, and actively soliciting the comment is noise
(Juan's call). Android keeps its card because Android is frozen for release, so
`TopReactions` still renders it behind `Platform.OS !== 'ios'`.

## A REORDER MODE on Topper's item list — REMOVED 2026-08-15

The native `List` briefly carried an edit-mode toggle in the nav bar (system
minus-buttons, drag handles). Removed: `List.ForEach`'s `onMove` works in the
list's **default** mode, so long-press-and-drag already reorders, and the swipe
actions already carry Edit/Delete — the mode was a bar glyph and a state switch
for something the default gesture does. Each own row shows the
`line.3.horizontal` grabber as a hint, not as a handle-only hit target.

## `role="destructive"` on a swipe action that needs confirming — BROKEN, 2026-08-15

Not a taste call, a correctness one. SwiftUI removes the row the instant a
destructive swipe action is tapped — **before** the confirmation alert runs — so
choosing Cancel left a live item invisible until the next snapshot. Ship
`tint(colors.danger)` instead: identical red, and the row leaves only when the
data actually deletes. Applies to Topper's item list and to the trash list.

## FULL-HEIGHT detents on the Topper editors, to escape the sheet dimming — REJECTED 2026-08-14

Below the large detent iOS keeps the presenting window primary and renders the
sheet's hosted SwiftUI in the **inactive-window appearance**: the tint chain
greys and dynamic grouped fills desaturate. Chased end to end — it is the DETENT
and nothing else (the identical `Form` at `[1]` matches Settings exactly);
`sheetLargestUndimmedDetentIndex` only undims the PRESENTER, and the menu
picker's value colour is UIKit's, out of reach. Both options were shipped side by
side and the **content-sized sheet WITH the OS dimming** was chosen: the dimming
is what iOS does to a non-primary sheet. Do not "fix" the colours by pushing the
detents back to `[1]`.

## An ANIMATED shimmer as the first thing tried for skeletons — inverted, 2026-08-16

Recorded because the instinct is to reach for the wave immediately, and the
honest finding is that **Apple ships a static skeleton**:
`.redacted(reason: .placeholder)` is first-party, is exposed by @expo/ui 57, and
does not animate — App Store, Music and News all show static grey blocks. The
sweep that shipped is Facebook's, and it is product-category vernacular rather
than a platform idiom. It earns its place ONLY because these apps wait on a
network, where a static block reads as frozen; reduce-motion falls back to
Apple's answer. On a surface that is already a SwiftUI `List`, prefer `redacted`.

The pulse it replaced is the thing not to rebuild: a per-bone opacity fade, every
bone sharing one phase, so the screen throbbed as a single object and the page
changed contrast instead of something moving across it.

## THREE EQUAL CARDS in Sound Shaper's expanded-player glass bar — REJECTED 2026-08-21, measured twice

The bar gained a third item (Edit) beside Shape and Clips, and the obvious fix
for the format break is to make all three the same card. It does not fit, and
the arithmetic is not close. Ink on iPhone 17 / iOS 26.5: "Shape" 46.33,
"Flat · 1×" 50.67, "Clips" 35.67, "None" 34.33. Three equal compartments are
123.33pt each, and after 32 of padding, the 31pt icon host and the 12pt gap that
leaves **48.33 of copy — so the DEFAULT shape summary truncates**. Trimming the
padding to 12 and the gap to 10 buys 61.33, which still loses every preset that
is not Flat at 1×.

Worse, the third item has **no live state** to put on the second line — that is
what separates it from Shape ("Flat · 1×") and Clips ("2 saved") — so matching
the format means inventing text or shipping an empty line.

Shipped instead: the cell is sized to what it holds — icon, one word, no summary
— with a divider on both sides, and the two cards keep their summaries.

## The STACKED edit cell (icon over word) in that same bar — REJECTED 2026-08-21, on feel

Built and measured after the row version was called out for breaking the bar's
vertical flow, which it genuinely does: laid out as a row, its one word sits at
791.67 → 804.33 against the cards' label 781.33 → 796.67 and summary
804.00 → 815.00 — centred on the two-line block to within 0.17pt and therefore
level with **neither** row.

The stack fixes exactly that. Solved backwards from the cards, the icon lands in
the label band (789.17 against 789.00) and the word in the summary band (809.00
against 809.50). It still reads worse, and Juan chose the row after seeing both:
**the stack makes that cell a different KIND of thing, and a bar's items should
read as one kind.** Alignment lost to consistency.

## A SCRIM outside the clip selection in Sound Shaper's trimmer — REJECTED 2026-08-21, on sight

Photos dims the film either side of a trim, and this was built to match: the
elapsed track measurably lifted from near-black to (122,122,125) outside the
selection and kept full contrast inside, in both appearances. Two heights were
tried — the full 32pt band, and 8pt hugging the track.

The size was never the problem. **Photos dims an opaque FILMSTRIP; this sits on
a 5.67pt slider track**, so the dimming reads as a mask laid over the player
recolouring the track, with a hole in it exactly where the frame is. A trim
frame on a slider is already unambiguous without repainting everything it is
not.

Shipped instead: no scrim. Two 14 × 32 caps that OVERHANG the box they bracket,
joined by 2pt accent rails.

**2026-08-23 postscript — the premise changed, the rejection stands.** The
trimmer became a zoomed waveform strip (`ClipTrimStripIos`), which IS an opaque
band of material — Photos' filmstrip premise — so it dims outside the selection
legitimately (`background` washed over the bars). Do not read that as licence
to scrim a bare slider track; the reasoning above still holds for one.

## `PRESS_SCALE` at 0.95 — TOO DEEP, 2026-08-21

The portfolio's card squash was 0.97, which is 5.3pt of travel on a 178pt home
tile and 3.9 on a 131pt glass-bar cell — close to invisible on the small
surfaces. 0.95 was shipped and rendered, and read as too much on the large ones.
**0.96** is the value: 7.1 and 5.2, half a step deeper.

A third named scale for "small card", between this and `ICON_PRESS_SCALE`, was
also rejected — the glass bar's compartments would be its only caller, and a
press that differs between a tile and a card for no reason a person can see is
what one shared spring exists to prevent.

## Turning Preserve Pitch OFF automatically at any speed ≠ 1× — REJECTED 2026-08-21, reasoned down (not built)

The one entry here that was never rendered: it was proposed by Juan, argued
against, and dropped in the same conversation. It is listed because it is the
obvious idea, and the next session to hear "preserve pitch sounds grainy" will
propose it again.

**What it was.** Sound Shaper's `keepPitch` switch, flipped off by the app the
moment the playback rate leaves 1×, so nobody's first speed change ever hits the
grainy time-stretcher (`Wsola` — see `apps/sound-shaper/AGENTS.md`).

**Why it dies, in the order the reasons matter:**

- **It turns the setting off exactly where it is the only thing that does
  anything.** Preserving pitch at 1× is a `Passthrough` — the engine touches
  nothing — so the switch has meaning only at rate ≠ 1×. Auto-off there means
  off always, and the control becomes decoration.
- **The value is SAVED.** `createShape({ gains, keepPitch, name, rate })` writes
  it into a shape, so a shape would store a choice nobody made.
- **The way back is ambiguous.** Restore it at 1× and the switch flickers as the
  speed slider is dragged; don't, and the setting is destroyed silently.

**Shipped instead: the DEFAULT flipped to off.** Same outcome for the thing that
actually mattered — the first speed change anybody makes sounds clean — with no
control ever moving on its own, and preserving pitch left reachable as the
deliberate choice it should be. "Auto-off the first time only" is this, with a
moving switch and extra steps.

**The stretcher was fixed the next day** (2026-08-22:
`patches/react-native-audio-api/` swaps the WSOLA for a phase vocoder — see
`pending-upstream.md`), and the off default retired with it: `keepPitch`
defaults to on again. The auto-off idea above stays rejected — every reason it
died is about a control moving on its own and a saved value lying, none of
which the stretcher's quality ever changed.
