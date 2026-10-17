---
description: Audit and close the native-feel gap between the iOS and Android versions of an app — equal polish, each in its own platform language
argument-hint: [app / platform / screen or flow to focus on]
---

# Native parity — equal polish, each in its own language

Bring the lagging platform version of an app up to the native-feel level of the
leading one. The goal is **parity of quality, never parity of pixels**: each
platform version should be the best possible citizen of _its own_ platform
(Material 3 / Material You on Android, Human Interface Guidelines on iOS),
equally polished, equally fluid. If you ever find yourself copying an iOS
visual onto Android or vice versa, stop — you're translating words when you
should be translating meaning.

Optional scope from the user (app, platform, screen, or flow — full-app audit
if empty): $ARGUMENTS

## THIS AUDIT RUNS ON NUMBERS. IF YOU ARE EYEBALLING, YOU ARE DOING IT WRONG.

Read this before anything else, because it is the difference between a
twenty-minute review and a three-hour one.

An earlier version of this command said to "walk the same flows on both
platforms and ask whether the leading one does something the lagging one
doesn't". That is a human-judgement loop, and it hands the finding job to the
person reviewing. On 2026-08-29 it was run over expo-ui-starter's welcome
screen (an app deleted 2026-09-16) and **found nothing**; Juan then found, by eye, in sequence: a flat
brand tile, a title at the wrong weight, a byline 2x too far from its title, a
feature list starting 34.8dp lower than the iOS twin's, two icons carrying the
same metaphor, a glyph under-sized by a third, a link with no press feedback at
all, a legal link rendering UIKit's grey block, and a navigation bar that stayed
light under a dark app.

**Every one of those was a QUANTITY** — a gap in dp, a rendered ink extent, a
press delta in /255, a colour against another colour. Not one needed taste to
find. They needed a ruler, and the audit did not carry one.

So: the deliverable of Phase 1 is **a table of measurements from both
platforms with the disagreements ranked**, produced BEFORE the user is asked
anything. Their job is to accept or reject rows, not to spot defects. If your
report contains the words "consider whether" or "may feel", you have written
the wrong report.

**The ruler ships WITH this command** — `portfolio-native-parity.py`, sitting
next to this file rather than in the repo's `scripts/`, which is build tooling.
Use it instead of re-deriving PIL code every session:

```bash
python3 .claude/commands/portfolio-native-parity.py bands  shot.png --y 400,1600   # rhythm: every ink run + gaps, in dp
python3 .claude/commands/portfolio-native-parity.py ink    shot.png --box X0,Y0,X1,Y1 --accent
python3 .claude/commands/portfolio-native-parity.py swatch shot.png --box X0,Y0,X1,Y1
python3 .claude/commands/portfolio-native-parity.py press  idle.png held.png --box X0,Y0,X1,Y1
python3 .claude/commands/portfolio-native-parity.py diff   before.png after.png   # did the bundle even reload
```

## THIS COMMAND RUNS TWICE PER APP — ASK THE USER WHICH PASS THIS IS

It opens the parity work and it closes it, and the two passes look for
different things. Establish which one you are in before Phase 0, because it
changes what counts as a finding. The full sequence is in
[`docs/audit-playbook.md`](../../docs/audit-playbook.md).

**The OPENING pass** — the lagging platform has not been walked yet. Findings
are STRUCTURAL: a surface that exists on one side only, a whole wrong idiom, a
control hand-rolled where the platform ships one. Phase 1's A0 inventory is the
heart of it.

**The CLOSING pass** — the user has since walked every screen by hand with the
dev state lab and fixed the quantities. Almost nothing will measure wrong, and
**a clean measurement table is the expected result, not a failed audit.** What
this pass hunts instead is JUNK AND HOLES, and every class below has been found
at least once here:

- a `.ios.tsx` that ACCEPTS a prop and ignores it (three incidents; the type
  checker never catches it, because the base specifier is what `tsc` resolves);
- a constant, style object, export or dev knob with no consumer left;
- a comment that describes its own number as unreviewed / still / frozen /
  never measured — grep those five words first, they are the cheapest findings
  in the repo;
- a `Platform.select` whose two arms are one shared term and one hard-coded
  number;
- a dead translation key, or a surface with no counterpart on the other
  platform that the paired sweep therefore never looks at;
- BEHAVIOUR that exists on one platform only — report it, never "fix" it: what
  an app DOES is the user's call.

A closing pass ends in a **verdict**: parity is done and here is the evidence,
or here is exactly what is left. Say one or the other plainly.

**Before a closing pass, check what moved under you.** The audits ahead of
it (craft, data, cache) may have just changed `src/ui` or `src/core`. Read
`git log` since the last parity pass, rebuild and reload BOTH platforms, and only then measure anything shared — otherwise you
band-scan a component that has already been fixed and report it as a finding.

## Phase 0 — Ground yourself, and CALIBRATE THE RULER

1. Read `AGENTS.md` / `CLAUDE.md` and the relevant memory. They define the
   product bar and the design conventions, and they override anything generic
   here.
2. Identify the **leading** platform (the reference) and the **lagging** one
   (the target).
3. **Establish the device facts before taking a single measurement.** Each of
   these silently corrupted a reading on 2026-08-29:
   - `adb shell wm density` — **the standing A54 is 450dpi, so dp = px /
     2.8125, NOT 3.** Assuming 3 makes every number 6.25% small and they stay
     self-consistent, which is what makes it survive review.
   - `adb shell settings put secure ui_night_mode_custom_type -1` — kill any
     dark-mode SCHEDULE. It flipped the device mid-capture twice and produced
     two rounds of nonsense before it was noticed.
   - `adb shell settings get secure navigation_mode` — 0 is 3-button, 2 is
     gestures. It changes what system chrome you are looking at.
   - `adb reverse --list` — the Metro mapping DROPS. When it does, the app
     shows a dev-client error screen and you will measure that instead. If a
     change appears to have no effect, run `diff` before believing
     it.
4. **Re-test the expired blockers, don't inherit them.** Grep the target
   platform's code and docs for reasons things were not done:

   ```bash
   grep -rn "frozen\|no-ops\|not supported\|cannot\|blocked on\|unverified" \
     --include='*.tsx' --include='*.ts' --include='*.md' src modules targets docs AGENTS.md
   ```

   **Every one of those is a claim about a past dependency version or a past
   project state, not a law.** Two were found stale in a single session:
   "Android is frozen" (the freeze had lifted) and "react-native-svg's
   `FeGaussianBlur` no-ops on Android" (it had not for some time — the whole
   flat-Android brand tile existed because of it). Spend one cycle rendering
   the supposedly-impossible thing on the device before designing around it.

5. Check what's runnable, and get BOTH platforms in front of you with the same
   account and data.

## Phase 1 — Measure both sides, then diff

Four passes, in this order. **A0 is first and is not optional** — it finds the
class of defect no measurement can, and running it after the pixel pass means
measuring a screen whose contents were never compared. A is mechanical and finds
most of the rest; B and C catch what a still frame cannot.

### A0. The structural inventory — WHAT IS THERE, AND IN WHAT ORDER

**Do this before any pixel measurement, because pixels cannot find it.** A
band-scan measures what is on screen; it can never say a row should not exist,
or that two sections are in the wrong order. Those are among the most visible
divergences there are, and they are invisible to every other pass in this
command.

For each screen, on BOTH platforms, write the ordered inventory:

```
screen: settings
ios:      [identity card] [General: appearance, language] [About: version, …] [Legal] [Sign Out]
android:  [demo profile row] [General: …] [About: version, …, legal rows] [Sign Out]
```

Then diff the two lists on three axes, and report every difference:

1. **Presence** — is there an element on one side with no counterpart? A row, a
   section, a control, an empty-state line, a subtitle, a nudge card.
2. **Order** — do the same sections appear in a different sequence?
3. **Grouping** — are the same rows split into different sections (legal in its
   own card vs appended to About)?

Get the inventory from BOTH the screenshots and the code — a row can be
conditional on `Platform.OS` and never appear in the walk you happened to do.
Grep the screen and every component it renders for platform branches.

**Then classify each difference, and DO NOT assume it is intentional.** This is
where the freeze did its worst damage: for a year, divergences of exactly this
kind were explained by "Android is frozen", so an audit that treated existing
differences as decisions would re-confirm every one of them. Ask instead: what
is the platform ARGUMENT for this difference? If there is one — Material groups
legal with About, Material puts account inside Settings — record it as
Intentional with that reason. **If the only argument is "it has always been
like that", it is a gap.**

Worked example, recorded 2026-08-29 (the app it is drawn from was deleted
2026-09-16, so read it as a shape rather than as somewhere to go look):
expo-ui-starter's Settings showed a DEMO PROFILE ROW on Android and nothing on
iOS, and ordered its sections differently. The iOS side had a written reason (the
starter had no real session, so a profile row is a photo and a handle standing
for nobody); the Android side had none beyond the freeze. That is a gap, and no amount of band-scanning would
ever have said so.

### A. The paired measurement (once the inventory matches)

For each screen, on EACH platform, in BOTH appearances:

1. **Cold-start** the app — force-stop and relaunch. Do not flip a setting on a
   running app and measure that; a state reached by flipping may be one no real
   launch reaches, and a live theme change leaves some system chrome stale.
2. Capture a **burst of 3+ frames with no interaction at all.** A gesture is
   frequently the thing that HIDES a late-resolving layout: scrolling or
   tapping makes the OS recompute and the wrong offset vanishes. If the frames
   disagree, that instability IS the finding.
3. Run `bands` and record the rhythm table.
4. For every glyph, `ink`. For every fill and every ink colour,
   `swatch`. For every tappable thing, `press` (idle vs held).

Then **put the two platforms' tables side by side and subtract.** The
disagreements are the audit. Rank them by size.

### B. Interaction sweep — every tappable thing, measured

Press each one and diff. **A control with no measurable press delta is a
defect**, and so is one whose delta is too small to perceive: a Material
`TextButton`'s ripple at link size measured 18-25/255 — present, spec-correct
and invisible — against ~82 for an RN fade. Under ~40, look at it.

Also check what a bare `<Text onPress>` does on iOS: UIKit draws its own grey
highlight tracing the TEXT RUN, so a link that wraps renders as two mismatched
slabs. `suppressHighlighting` plus the portfolio's own fade is the fix.

### C. What a still frame cannot show

Transitions, springs, haptics, scroll physics, predictive back, keyboard
avoidance. Walk these deliberately and write the observation down in the
moment. This is the part that genuinely needs a human loop — which is why
everything in A and B must NOT consume that budget.

Classify every gap into exactly one bucket:

- **Port** — platform-agnostic polish present on one side only.
- **Translate** — the leading platform uses a platform idiom; find the target
  platform's own idiom for the same job.
- **Intentional** — genuinely platform-specific by design. List it, mark it
  "leave alone", and say why, so it isn't re-flagged next audit.

## Phase 2 — Report the measurements, then stop

The report is a **table of numbers**, ranked. The user accepts or rejects rows;
they do not hunt for defects. Nothing in it should require them to look at a
screen to know whether it is wrong.

```
# Native parity: <app> — <target> vs <reference>

## Verdict
One paragraph: where the gap actually lives.

## Structural divergences (from the A0 inventory)
Present-on-one-side / wrong order / wrong grouping. Each with the platform
ARGUMENT for it, or marked a gap if there isn't one.

## Measured disagreements (ranked by size)
| what | reference | target | delta | bucket | fix |
Every row carries the number that found it.

## Present but imperceptible
Controls whose feedback measured under ~40/255, or elements whose contrast
against their own ground is under ~10 levels. These read as broken without
looking broken in a diff.

## Expired blockers found
Each "can't / frozen / no-ops" claim re-tested, with the result.

## Intentionally different (no action)
With the reason, so it isn't re-flagged next audit.

## Proposed batches
Grouped so each batch is device-verifiable in one pass.
```

**Where a change is a matter of TASTE rather than correctness, render the
options and show them — do not pick for the user and do not ask them to
imagine it.** Two or three variants, captured on device, with the measurement
under each. A taste call reverted without being shown costs a whole round trip,
and picking one silently costs more. Correctness — a contrast failure, a
control reading as disabled, a touch target under the minimum — is yours to
call, and you say which measurement forced it.

## Phase 3 — Implement, batch by batch

- One batch at a time; **re-measure** on the device before moving on. A
  screenshot proves a fill; only a gesture proves a block; only `diff` proves
  the bundle reloaded.
- Every fix speaks the target platform's design language. When unsure of the
  idiom, check that platform's own first-party apps.
- Behaviour and features stay identical — this audit changes _feel_, not
  function.
- **When you remove a control, restore the NOMINAL spacing, do not back-solve
  the old render.** A Material `TextButton` was replaced by RN text and its
  gaps were re-solved so the render matched; but the old render was inflated by
  that button's `MinHeight` centring one line in a 36dp box — so the artifact
  was preserved, with a docblock explaining how carefully it had been measured.
  Ask: was the old render the intent, or the intent plus a box?
- Record discovered API limits somewhere durable — `docs/pending-upstream.md`
  for anything blocked on a dependency, with the exact symbol to grep so the
  next bump makes the check mechanical.

---

# The defect catalogue — what to look for, and the test that finds it

Every entry was found the expensive way on 2026-08-29, by Juan, on a screen a
qualitative audit had already passed. Run these AS CHECKS; each has a
mechanical test that does not need judgement.

| #   | defect                                                                                                                                                                                                                                                                                           | the test                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **An expired blocker.** A comment says something can't be done; the dependency moved.                                                                                                                                                                                                            | Grep for frozen / no-ops / cannot / blocked. Render the "impossible" thing once.                                                                                                           |
| 2   | **A glyph sized by its BOX instead of its INK.** Material Symbols carry viewBox padding, SF Symbols barely do — a 28dp Material box draws 21.33dp of ink where a 30pt SF Symbol draws nearly 30. Matching nominal sizes, or even the glyph-to-title RATIO, still leaves Android visibly smaller. | `ink` on both platforms and compare the INK.                                                                                                                                               |
| 3   | **A control with no perceptible press feedback.**                                                                                                                                                                                                                                                | `press`. Zero is a defect; under ~40/255 is one too.                                                                                                                                       |
| 4   | **UIKit's grey highlight on an inline link.** A wrapped link renders as two mismatched slabs.                                                                                                                                                                                                    | Press-test every `<Text onPress>` on iOS. Fix with `suppressHighlighting` + the shared fade.                                                                                               |
| 5   | **Two icons carrying the same metaphor.** `widgets` (squares) sat above `apps` (dot grid) — both read "grid".                                                                                                                                                                                    | Look at the icon SET as a set, not row by row. Check the emoji fallback and the other platform's symbol agree with it.                                                                     |
| 5b  | **An element PRESENT on one platform and absent on the other.** A demo profile row, a nudge card, an empty-state subtitle, an edit flow.                                                                                                                                                         | The A0 inventory diff. Pixels cannot find this.                                                                                                                                            |
| 5c  | **The same sections in a DIFFERENT ORDER, or grouped differently.**                                                                                                                                                                                                                              | The A0 inventory diff, on the ordered list.                                                                                                                                                |
| 5d  | **A divergence whose only justification is that it has always been there.**                                                                                                                                                                                                                      | For each difference, name the platform ARGUMENT. "It shipped like that" is not one.                                                                                                        |
| 6   | **A back-solved constant preserving a removed box's distortion.**                                                                                                                                                                                                                                | Any gap constant that is not a token: ask what it was solved against.                                                                                                                      |
| 7   | **A spacing rhythm that differs from the twin's by a lot.** The feature list started 34.8dp lower than iOS's.                                                                                                                                                                                    | `bands` on both, subtract.                                                                                                                                                                 |
| 8   | **Type at the wrong rung.** M3 display styles are Regular; the hero title read thin against iOS's bold `largeTitle`. M3 Expressive's `*Emphasized` is the Android answer.                                                                                                                        | Compare ink coverage of the same run across weights.                                                                                                                                       |
| 9   | **A shared component whose one value should be per-platform.** SF Pro has an optical size axis and Roboto does not, so the same nominal weight renders differently at small sizes. Apple's `caption1`/`footnote` are regular; Material has `bodySmall` 400 AND `labelMedium` 500 at 12sp.        | Ask what each ladder says at THAT size, not what one number should be.                                                                                                                     |
| 10  | **System chrome not following the app theme.** The nav bar stayed light under a dark app on every screen.                                                                                                                                                                                        | `swatch` the chrome band vs the app background, cold-started in both appearances.                                                                                                          |
| 11  | **A fixed-colour element invisible against a themed ground.** The brand tile's `#F5F5F5` sat on a `#F1F1F3` page — a delta of 4, separated only by a hairline.                                                                                                                                   | `swatch` any element whose colour is fixed while its background is themed.                                                                                                                 |
| 12  | **An accent that is inherited rather than meaningful — or a monochrome pass that eats an affordance.**                                                                                                                                                                                           | Three buckets: INK by default, ACCENT where the colour IS the information, PLATFORM SEMANTICS untouched. Then ask in BOTH appearances: would someone know this is tappable, and available? |

# Measurement hygiene — the traps that produce confident wrong numbers

Each of these produced a wrong reading in one session, and every one of them
looked plausible at the time.

- **Density.** dp = px / 2.8125 on the A54, not 3.
- **Scan through the CENTRE, not the edge.** A column dropped a few dp inside a
  rounded container crosses the corner arc: a 96dp tile measured 83.20. When
  the centre is occupied by a glyph, scan every column and take the extreme —
  do not pick a column that merely looks clear.
- **Detect the background; never hardcode it.** A scheduled dark mode flipped
  the device between captures twice.
- **An exact-fill match breaks the moment something gains a gradient.** Match a
  tolerance.
- **A shadow is not an edge.** Detecting a tile by "differs from the page"
  caught its elevation shadow and moved the measured edge by 9.6dp.
- **Use ONE threshold for a before/after pair.** A light-mode threshold that
  excluded a subtitle included it in dark, inventing a 6.8dp shift.
- **Re-capture the baseline immediately before the change.** A stale baseline
  from a previous launch diffs against everything.
- **Confirm you are looking at the app.** Metro dies, `adb reverse` drops, a tap
  opens a browser. `diff` on two frames you expect to differ.
- **Never measure after a gesture** unless the gesture is the subject. It is
  frequently the thing that hides the defect.

---

# Appendix — Native-feel dimensions & idiom translation

Use this as the sweep checklist in Phase 1 and the translation dictionary in
Phase 3. It is dimension-based, not app-specific — walk every dimension for
every audited flow.

## Dimensions of perceived nativeness

### 1. Motion & transitions

- Screen push/pop transitions: platform-default curves and durations
  (iOS: interactive edge-swipe pop, spring sheets; Android: Material motion —
  shared axis, container transform, predictive back).
- Sheet/dialog enter-exit: spring physics, partial-expand behavior, drag
  handles.
- List item add/remove/reorder animations.
- Reduce-motion setting respected on both platforms.

### 2. Micro-interactions & feedback

- Haptics at meaningful moments (selection, success, destructive-arm,
  pull-to-refresh threshold). iOS haptic vocabulary is richer — on Android map
  to `HapticFeedbackConstants` / vibration effects, don't skip.
- Touch feedback: iOS highlight/opacity vs Android ripple. Every tappable
  surface needs its platform's feedback — a dead-feeling press reads as web.
- Press-state scale/spring on cards and buttons.
- Sounds where the platform expects them (and only there).

### 3. Materials & depth

- iOS: blur/vibrancy materials, liquid glass, layered translucency.
- Android: Material You tonal surfaces, elevation tints — the Android answer
  to iOS blur is usually a tonal surface color step, NOT a blur.
- Scroll-under effects: iOS large-title collapse / bar blur-in; Android
  top-app-bar scroll behaviors (pinned/enterAlways + container-color change).

### 4. Navigation & structure

- Platform navigation container: iOS tab bar & nav bar behaviors vs Android
  navigation bar (M3) with active-indicator pill.
- Back: iOS edge swipe everywhere; Android system back + predictive-back
  animation support.
- Context menus: iOS long-press preview menus vs Android dropdown/overflow
  menus or bottom sheets.
- Search idiom: iOS searchable nav bar vs Android search bar/docked search.

### 5. Typography & layout

- Platform type: SF Pro / platform-default vs Roboto; platform type scale
  (Dynamic Type on iOS, M3 type roles on Android). Respect user font scaling.
- Safe areas / insets: notches, home indicator, edge-to-edge with correct
  system-bar scrims on Android 15+.
- Touch targets: 44pt (iOS) / 48dp (Android) minimums.
- Corner-radius language: iOS concentric/continuous curves vs M3 shape scale.

### 6. System components over custom

- Prefer the platform's own control for pickers, switches, date/time,
  menus, alerts, refresh indicators. A custom-drawn control that's 95% right
  reads as less native than the system one.
- Loading: iOS spinner vs M3 (expressive/contained) loading indicators.
- Snackbars/toasts are Android idiom; iOS prefers inline status or subtle
  banners — translate, don't port.

### 7. Gestures

- Swipe actions on rows (leading/trailing) with platform-correct visuals.
- Pull-to-refresh: platform-correct indicator and physics.
- Dismiss gestures on sheets, images (drag-to-dismiss), keyboards
  (interactive scroll-dismiss).

### 8. Color & theming

- Android: dynamic color (Material You, wallpaper-derived) — the app should
  feel like it belongs on THIS user's device.
- iOS: system tints, semantic colors, elevated-dark-mode surfaces.
- Dark mode parity on every audited screen, including images/placeholders.

### 9. System integration

- App icon quality per platform (adaptive/themed icon on Android).
- Splash-to-first-frame continuity.
- Share sheet, keyboard types/autofill hints, status-bar style per screen,
  home-screen shortcuts (Quick Actions vs App Shortcuts), widgets if any.
- Permission prompts: timing, pre-prompt rationale per platform norms.

### 10. Perceived performance

- Optimistic updates, skeletons dimension-matched to loaded content,
  no-flash delayed spinners, image fade-in/caching, 120Hz-smooth scrolling.
- These are usually **Port** bucket — if one platform got the optimistic
  treatment and the other didn't, that's a pure win to copy.

## Idiom translation quick table

| Job to be done         | iOS idiom                       | Android idiom                             |
| ---------------------- | ------------------------------- | ----------------------------------------- |
| Transient confirmation | Inline banner / subtle HUD      | Snackbar (with action)                    |
| Item actions           | Long-press context menu / swipe | Overflow menu, long-press bottom sheet    |
| Destructive confirm    | Action sheet / alert            | M3 dialog / bottom sheet                  |
| Modal task             | Sheet w/ detents, grabber       | ModalBottomSheet / full-screen dialog     |
| Primary action         | Nav-bar button                  | FAB or prominent button                   |
| Bar behavior on scroll | Large title collapse + blur     | Top app bar color-fill / lift on scroll   |
| Depth/emphasis         | Blur material                   | Tonal surface step / elevation            |
| Settings screen        | Grouped Form/List, no row icons | Preference rows with icons, radio dialogs |
| Back                   | Edge swipe + chevron            | System back + predictive back             |

## How to compare live (when both platforms are runnable)

1. Same account, same data, both devices side by side.
2. Drive Android with `adb` (screenshots: `adb exec-out screencap -p`,
   input: `adb shell input ...`); drive the iOS simulator with `xcrun simctl`
   / `idb` (screenshots: `xcrun simctl io booted screenshot`).
3. For each flow, capture the _pair_ of screenshots and note transitions that
   a screenshot can't show — record those observations in the moment, they're
   the ones you'll forget.
4. Test both themes (light/dark) and at least one non-default font scale.
