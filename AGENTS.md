# Sound Shaper

Third portfolio app: a **PERSONAL** music player + tweaker — zero social
features, by design (2026-07-18): every upload is for the uploader alone, which
keeps the copyright surface at zero. Upload your own `.mp3`s, read their tags,
play them, shape the sound. Same engineering mentality as Topper — native UI
per platform, shared portfolio Welcome / Settings / Manage-account screens,
full Firebase (Spark), no self-hosted backend.

**No tabs, no playlists.** Home is the single root screen: a 2-column grid of
SONG tiles (cover art + title/artist) plus an Add-song tile — you upload a
song and it's just there (flat library at `users/{uid}/songs`; playlists were
dropped 2026-07-19).

**THE GRID IS HAND-ORDERED, IN BOTH DIRECTIONS** (2026-09-11). It used to be
newest-first and nothing else. Long-press a tile and drag it anywhere — across
columns as well as down rows — and the ADD TILE is an entry in that order too,
parked wherever you like rather than pinned first.

**A NEW UPLOAD LANDS AT THE FRONT** (2026-09-12). It appended for a day, on the
argument that an upload should never displace an arrangement made by hand. That
protected the arrangement and lost the sound: in a library of any size the thing
you just added appeared off the bottom of the screen, and the first thing you
had to do with it was go looking for it. It is the first _sound_ rather than the
first cell — the add tile is a control holding a slot in the same order, so the
front is measured against the sounds alone and that tile stays where it was
parked instead of being pushed down by one on every upload.

**THE LIBRARY IS ON THE HOME SCREEN TOO** (2026-09-11). `targets/widget/` is a
covers-only grid that honours this same hand order — which is the whole reason it
is worth having: it is the person's own arrangement, not "recently played". Small
holds 4, medium 8, large 16, at a tile size that stays within a few points across
all three, so growing the widget shows MORE rather than BIGGER. Tapping a cover
opens `soundshaper://home?play=<id>`, which plays it with the player expanded;
home matches the id against the live store rather than trusting it, because the
widget drew a snapshot that may be older than the session. A small widget is one
tap target — WidgetKit ignores `Link` there — so that size opens the library.

Now Playing and Clips widgets were both proposed and REJECTED (Juan,
2026-09-11): see [`docs/rejected-experiments.md`](../../docs/rejected-experiments.md).
The shared plumbing and its traps are `@portfolio/widget-bridge` and the root
`AGENTS.md`.

The order is a FRACTIONAL INDEX (`src/lib/gridOrder.ts`, 23 unit tests), and
the reason is the two-phone case: a move writes ONE document, so two devices
dragging at once merge instead of interleaving into an order neither person
chose — which is exactly what Topper's `position: index` batch does. Read that
file before touching any of this; it carries the float-vs-string-key trade and
the two defects the feature found in itself (a backfill that handed out
duplicate positions, and a repair that clobbered across devices by rewriting
from a CACHED snapshot). Both are guarded now: `needsPositionRepair` heals a
damaged order, and nothing rewrites a whole collection while
`subscribeToSounds` reports `fromCache`. The player is NOT a route: a bottom banner
that expands in place (PlayerSheet). There is NO Explore and NO profile
screen. Don't reintroduce social affordances (visibility toggles, feeds,
follows) or playlists — simplicity is the point.

**Where Settings and Account live (iOS, 2026-08-20).** Home's bar carries TWO
trailing glyphs in one merged Liquid Glass pill — Account, then Settings — and
both present as full-height native FORM SHEETS, with Trophies stacking over
Account. That is the portfolio-wide placement, matching Topper (and Expo UI
Starter, while it existed); the route table and the reasoning are in `lib/sheetRoutes.ts`
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
save, so cancelling never leaves a Cloudinary asset behind at all. Replacing a
cover used to strand the old one; `updateSound` destroys it now, through the
same worker that closed the delete-a-sound and delete-an-account doors
(2026-09-12, Gate 2b).

The disc presses now, so its caption became an ACTION inside the press target in
the accent ("Add Artwork" / "Change Artwork"), which is exactly Topper's
arrangement. It had been a muted `Button` in `SheetFormMediaIos`'s own slot, and
that — not taste — is why it read at a different size and colour than Topper's
"Change Photo".

**The Android half of the picker is written and UNVERIFIED.** It typechecks and
it mirrors iOS, but nothing Android is installed — see the root AGENTS.md.
Re-check it on device when Android resumes.

**THE ARTWORK WASH IS ONE STEP UP FROM SUBTLE, AND 0.62 WAS A CEILING RATHER
THAN A TASTE** (2026-08-21). The blurred cover is mixed into the page colour, so
light mode drifts toward white and dark toward black. That mix is also what
keeps the bar glyphs legible — a dark cover can never pull the top band very
dark — and the old 0.62 sat almost exactly ON the limit: for a black cover in
light mode it left 0.38 × 242 ≈ 92, against the ~89 a black glyph needs to clear
3:1. So going past it AT ALL requires something else protecting the glyphs.

It is 0.75 now, with a short scrim ramp held FLAT across the bar row and
released just under it. The gradient's offsets are in the OVERSCANNED box, not
the screen — screen y maps to `(OVERSCAN + y) / (OVERSCAN * 2 + screenH)`, so
0.211 is the screen's top edge and 0.281 is the bar's bottom. A ramp that starts
decaying at the top edge has already lost two thirds of itself by the glyphs'
own centre; that was built first and measured 1.34:1. Holding it flat costs the
wash almost nothing, because the cover is an OPAQUE layer above this one
starting at y 119 — between the bar and there the wash shows only in two 16pt
gutters.

Measured on iPhone 17 / iOS 26.5: a BARE chevron over a near-black cover in
light mode reads **4.29:1**, comfortably past the 3:1 a UI glyph needs.

**FULL STRENGTH WAS BUILT AND REJECTED** (Juan, on sight — "too much"). At
opacity 1 the colour swamps the screen, and it also forces protection the design
does not otherwise need: the bar glyphs had to stand on `GlassSurfaceIos` discs,
which is added chrome on a bar that reads better bare. Both were reverted. Two
dead ends worth not re-walking, since each looked right in the abstract:

- **Glass discs alone do not fix it.** Over a near-black cover in light mode the
  material's floor only reached (36,36,37) — 1.35:1.
- **A scrim floor alone does not either.** Costed at ~0.37 of page colour across
  the WHOLE top to clear 3:1, which flattens the wash for exactly the covers it
  should be strongest on.

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
- `edit-sound` **[0.65]** — content-sized, and RE-MEASURED when the form lost
  two of its four fields (below). Content is 474.00pt from the sheet's own top
  edge; the sheet comes to 526.3, the last ink lands at 821.67 and what remains
  is the 34pt home indicator plus ~18 of air.

  **A DETENT FRACTION IS NOT A FRACTION OF THE SCREEN.** Reading 0.6 as "0.6 of
  874" overshoots by 35pt, and it put the destructive row 15pt off the screen
  edge, under the indicator. Two measured points on this device — 0.8 → 638.33pt
  tall, 0.6 → 489.00 — give `height ≈ 746.67 × f + 41`. Solve, then verify;
  don't guess the fraction.

- `trophy-detail` — `fitToContents`, and it must stay RN: a native `Form` is a
  scroll container with no intrinsic height and renders 0pt tall under that
  detent. (`sound-info` was the other one, and it is gone — see below.)

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
- **THE COVER NO LONGER SHRINKS WHILE PAUSED** (Juan, 2026-08-25). It dropped
  to 0.88 — iOS's own now-playing idiom, and the one piece of state you could
  read without looking at a control — but on this console the cover is the
  full width of the content box, so a 44pt breath in and out on every pause is
  movement the screen does not want; the transport says the same thing without
  moving anything. Restoring it is one constant (0.88, chosen over 0.94 as a
  rendering wobble and 0.82 as a hole under the then-present bar row), a
  shared value driven off `playing`, and one factor in `artStyle`.
- **THE COVER SITS 12pt UNDER THE SAFE AREA**, measured top 74.00 on iPhone 17.
  It was 24, sized while that gap was still standing in for the removed bar
  row; nothing shares the band now, so the only job left is keeping the cover
  off the Dynamic Island's own shadow (Juan, 2026-08-25).
- **A CLIP IS MADE IN THE DEDICATED EDITOR, NOT ON THE SCRUBBER**
  (2026-08-26, Juan's direction, from Voice Memos screenshots: "for audio
  trimming this is the proper ux"). The Clips sheet's + pushes `clip-trim` —
  a full-height sheet stacking over the list the way trophies stacks over
  account — and the in-player framing mode is GONE from iOS: no trim frame on
  the scrubber, no range readout in its label row, no Cancel/Save bar swap,
  no framing transport rules. Android's in-place framing is untouched.

  **THE EDITOR IS VOICE MEMOS' TRIM ANATOMY, PRODUCING A CLIP**
  (`ClipTrimEditorIos`): a ZOOMED waveform that pans under a fixed centred
  playhead (100pt/s, measured off the screenshots), a ruler that pans with
  it, the selection as an accent wash with two draggable edge lines, a
  full-track OVERVIEW strip carrying the selection frame, a large timecode,
  and a ±15s + play transport. (It rendered Voice Memos' centiseconds first;
  Juan cut them 2026-08-26 — MOTION IS CONTINUOUS, VALUES ARE WHOLE SECONDS
  was the settled policy, and it narrowed TWICE on 2026-08-27, ending at:
  only the LABELS speak whole seconds. Caps, the playhead's scrub releases
  and the ±15 skips all commit and seek EXACTLY where they land — snapping
  made anything placed "just in between 2:22 and 2:23" unsettable, first on
  the caps and then on the red line — while the timecode and caption floor
  to the second, `formatTime`'s own semantics.) The commit lives in the sheet BAR: ✕ leads,
  and the trailing slot is ONE merged pill — Shape (`slider.horizontal.3`,
  stacking the Shape sheet over the editor) beside a ✓ tinted
  `colors.primary` exactly as `SheetCommitGlyphIos` tints it everywhere else
  (`HeaderGlyphGroupIos` grew a per-glyph `tint` for it). NOT Voice Memos'
  Trim/Delete pills — those exist there because destructive trimming has two
  verbs; a clip has one. A content-level Shape entry was built three ways
  (capsule, full glass bar, hugging pill) and each read as one object too
  many: the sheet is two calm groups — the wave group (band + overview +
  its corner caption: start left, length centred, end right, the scrubber-
  label idiom) and the control group (timecode + transport).

  **THE 2026-08-27 REFINEMENT PASS, in the terms that survived it:** the
  transport stands on the PLAYER'S OWN SPOT — the console measures its play
  row when the expand settles and the editor pins its row from the screen
  bottom to that anchor (`chrome.ts`), zero shift between the two surfaces;
  the band's bars cap at `WAVE_INK_RATIO` 0.78 of the band and draw at
  `WAVE_BAR_ALPHA` 0.6 with a ground-coloured halo slot behind the red
  playhead (full-contrast bars under a fixed saturated line are a moving
  grating — a visual-stress accessibility problem, not taste); the ruler
  carries ONE minor tick at the half second; and PAUSE SETTLES THE LINE ONTO
  THE ENGINE (~140ms glide), so resume needs no seek — the two prior designs
  are recorded in the follower's own doc and in rejected-experiments (freeze
  left the line lying; seeking the engine back onto it replayed audio).

  **WHY THE WAVEFORM IS ALLOWED BACK, in one sentence:** the 2026-08-23
  rejection was about the PLAYER CONSOLE — a second track-shaped surface
  beside the live scrubber — and a dedicated editor has no competing
  progress surface. The ZOOM rejection does not transfer either: that zoom
  recomputed its window under the drag; the editor's scale is FIXED and the
  waveform pans. Both readings are recorded as postscripts in
  docs/rejected-experiments.md.

  **WHAT CARRIED OVER, because it was already right:** `ClipTrimFrameIos` —
  the Photos-measured caps and rails, the fine-scrub gain, the explicit
  gesture arbitration, the VoiceOver adjustables — IS the overview strip's
  frame, reused with its props unchanged. The selection is ONE pair of
  shared values drawn by three surfaces (frame, wash, edge lines), committed
  through one `onChange`. Play follows the player's own rule: from the
  playhead when it sits inside the selection, else the whole clip, stopping
  on the end cap and parking back on the clip's START so a plain play
  replays it. Entry pauses and
  defaults the selection to playhead−7 … +8, exactly as framing did.

  **THE WAVEFORM PIPELINE IS RESTORED FROM f5b4117** (`lib/waveform.ts`,
  `hooks/useWaveform.ts`) at 50ms buckets (was 250 — the zoomed view draws
  ~5pt per bucket at its scale; cache key bumped to v2, count capped at
  12000). Decode is still by local file path at 8 kHz, cached as JSON,
  placeholder bars until it lands so geometry never waits on the network.

  **THE STRIP RENDERS IN CHUNKS** — three 12s windows, re-centred when the
  playhead crosses a boundary (the neighbour-pager idiom) — because a
  3-minute track at 100pt/s is an 18,000pt SVG nobody should rasterise
  whole. The pan itself is a pure transform; the wash and edge lines live in
  STRIP coordinates so they pan for free.

  **A NO-OP SEEK KILLS PLAYBACK, and the editor is what finally exposed it**
  (fixed in the store's `playClip`): `seekToTime` to the position the engine
  is already at leaves the decoder's `pendingOffloadedSeeks` standing, the
  render path stays silent, and the following `play()` starts nothing —
  every press whose start WAS the playhead did exactly nothing, which is
  also the shape of the old on-device "press play and the clip doesn't
  react" reports. `playClip` now seeks only when the target differs from the
  playhead by more than 50ms — reading the engine's position BEFORE its own
  optimistic write (the guard once read it after, compared `startS` to
  itself and never seeked at all: play a clip, pause, scrub, play it again
  and the engine kept playing from the scrub point). `seek()` and
  `restartLoaded` carry the same guard; the other half of the trap is that a
  seek must travel WITH a play — a seek issued on a paused graph with no
  play behind it (the pause-time park that was tried first) leaves the
  pending count standing and the next play dies.

  **A SOUND'S DURATION IS BANKED METADATA** (2026-08-27): nothing stored
  it, so every skip flashed "3:09 → 0:00 → 2:50". The engine's first report
  writes `durationMs` onto the sound's document (`bankSoundDuration`,
  fire-and-forget, no `updatedAt` bump), `loadReset` seeds from it, the
  engine's report still wins over the seed past a 1s tolerance, and the
  scrubber's total reads `-:--` only on a sound's very first play — never
  `0:00`. The same pass gave the ART-LESS BACKDROP a crossfade (presence is
  an animated value; the image layer holds the last cover while it fades,
  the stand-in fades opposite) and depth (steeper ink ramp + a faint
  crossing ramp — lobes, not a tilted panel; bar band re-scanned at 5.66:1
  dark / 6.60:1 light).

  **The four in-player framing generations and their verdicts** (grip pills,
  frame-on-slider, zoomed strip, frame + live scrubber + fine scrub) remain
  in git history and docs/rejected-experiments.md; the fine-scrub and
  arbitration write-ups above survive inside `ClipTrimFrameIos` itself,
  which is where that behaviour now lives.

**THE EXPANDED PLAYER HAS NO REACTIVE OR ANIMATED BACKGROUND, and one was
built three ways before that was settled** (2026-09-11). Juan asked for a
background that answers to the music — the light strip behind a television as
the reference — and rejected the result outright: it overcomplicates a screen
whose whole case is being calm.

The full post-mortem is in
[`../../docs/rejected-experiments.md`](../../docs/rejected-experiments.md), and
the two findings worth knowing before anyone reaches for this again are that
**the wash cannot be the thing that moves** (it is the ground the title,
transport and cards are read against, so a moving ground reads as instability
at any amplitude) and that **an instant attack on a level envelope is a
strobe**. The `AnalyserNode` approach itself was sound and rate-correct by
construction; it is the surface that was wrong.

**BAND-SCANNED ON iPhone 17 / iOS 26.5**, re-measured 2026-08-28. The figures
that stood here described a screen that no longer exists — they were taken
while the bar row was still up (artwork cleared `PLAYER_BAR_TARGET + 14`) and
while the cover still shrank on pause, so they named a bar glyph, an artwork
top of 119.00 and two different cover widths. What is measurable today:

- artwork top **74.00** — `insets.top` 62 + `IOS_ART_TOP_GAP` 12, the cover's
  own breathing room under the Dynamic Island, with nothing between them;
- cover **370.00** wide (left edge 16.00, right 386.00), ONE width — `winW` 402
  less `SCREEN_PADDING` × 2, identical playing and paused;
- glass footer **764.00 → 832.00**, **370.00** wide (16.00 → 386.00), with its
  ink at 782.33 → 814.00 — `MINI_PLAYER_HEIGHT` 68 standing on `insets.bottom`
  34 + `NOW_PLAYING_BOTTOM_GAP_IOS` 8. That is the banner's OWN gap, not the
  generic `FLOATING_EDGE_GAP`, and the box is the collapsed banner's exactly,
  which is what makes expanding read as one bar staying put while its contents
  change. Identical across an 8-frame burst and in BOTH appearances.

**THAT LAST LINE WAS UNMEASURABLE FOR A WHILE, BECAUSE THE BAR DID NOT RENDER
AT ALL** (found and fixed 2026-08-28, in the craft audit's verification pass).
The console drew its artwork, copy, scrubber and transport and then nothing: a
horizontal scan of the entire 700 → 874 band found only the backdrop's own
gradient. Not the material failing — the compartments' RN labels were absent
too, and a temporary solid `backgroundColor` on the wrapper did not appear
either.

The cause was the wrapper's `entering={FadeIn.duration(200)}` settling at
opacity 0: it mounts inside a tree whose own opacity (`consoleStyle`) the
expand spring is animating, and an entrance started under that does not
reliably finish. **The fix is a deletion, not a repair**, and the reason is in
the prop's own comment — it was there to cover the swap back from CLIP
FRAMING, mirroring `ClipActionsRow`'s entrance. iOS framing left this console
on 2026-08-26 for the `clip-trim` sheet, so nothing has swapped with this bar
since: the entrance was animating an arrival that no longer happens, and
failing at it. The console's own fade brings the bar in with everything else,
which is what should carry it.

**The wrapper is a plain `View` now and must stay one.** See its comment.

**The player's four sheets are on TOPPER'S bar** (2026-08-21). `shaper`,
`clips` and `edit-sound` are `titled` in `IOS_FORM_SHEETS`. `edit-sound` states
its bar through `sheetCommitBarOptionsIos`; `clips` states its own slots (it
commits nothing, so its trailing glyph is `plus`, not a ✓); and `shaper` states
NOTHING at all, so it takes the table's default — a title and one close glyph
(see the removal below). They drew an authored header above their Form before,
which cannot have genuine Liquid Glass and carried the filled-primary-disc ✓
that Topper already rejected.
There were five, and `sound-info` was the fifth — untitled and RN on purpose,
because a `fitToContents` sheet is too short for a bar and a native `Form`
renders 0pt tall inside one. It is deleted; see the header rule below.

**THE SHAPE SHEET'S SECTION BOUNDARIES ARE THE PLATFORM'S, AND THE ONE
OVERRIDE IS GONE** (2026-08-22). Playback Speed carried
`listSectionSpacing(22)`, added on the reading that "a section that follows a
footer loses half its separation" — a card-to-header boundary measures 31.00
while footer-ink to header-ink measures 20.66. Those are not comparable
quantities: a footer's INK is not its section's edge, the footer belongs to the
section above, and Apple's own Settings > Accessibility > Motion — three
headerless sections each carrying a footer — puts a card's bottom 10.00 above
its footer ink and that ink 25.66 above the next card. Ours reads 10.67. There
was nothing to give back.

The override's real cost was the boundary BELOW it: SwiftUI applies the value to
both sides of the section, so Speed to Preserve Pitch came to 22.00 against the
family's 35.00 — the account sheet's two card-to-card boundaries, measured. Juan
caught it by eye. Removed, the sheet's three boundaries are 58.00 (holds the
Equalizer header), 80.00 (holds the EQ footer and the Speed header) and 35.00,
band-scanned in both appearances.

**THE FOOTER-TO-HEADER BOUNDARY IS THE ONE PLACE THIS FORM IS SHORT, AND IT
TAKES A ONE-SIDED MAKE-UP.** Juan read the EQ hint as sitting too close to
"Playback Speed", and he was right: Apple's Settings > General > Keyboard has
two footer-to-header boundaries and both measure **31.00** from the footer's
ink to the header's ink, where a SwiftUI `Form` gives **20.66**. Settings is
UIKit and this is SwiftUI, and the portfolio's reference for sheet metrics is
Settings — the same authority the 84.00 rule rests on — so the 10.34 is made
up rather than lived with.

The lever is `listSectionMargins({edges: 'bottom'})` on the section that OWNS
the footer, which is the only one-sided one: measured at 20 it added exactly 20
above and left the boundary below at 35.00. `listSectionSpacing` cannot do this
— it is additive on a section's top and absolute on its bottom, which is how
the old override broke the boundary under it. At 10 the boundary lands 30.66,
and nothing else on the sheet moves: 58.00, 35.00, card-to-footer-ink 10.67
against Apple's 11.00, first card still 84.00 below the sheet's edge.

**THE TWO `[1]` FORM SHEETS SAT 3.33 LOW, AND THE CONSTANT WAS NOT WRONG — ITS
EVIDENCE WAS** (2026-08-22). `shaper` and `clips` band-scanned at 87.33 below
their own top edge against the family's 84.00. `SheetFormBodyIos`'s pull-back
takes a 3.33 residual off the empty-header slot, and that residual was solved
against Topper's editors, which are `[0.38]` and `[0.62]`; Topper owns no
full-height form sheet, so nothing had ever measured the `[1]` case. There is no
residual there — the Form wants the flat 21 — and both sheets now read 84.00 in
both appearances. The component takes `fullHeight` and this app's two `[1]`
routes pass it; `edit-sound` (`[0.65]`) does not and is unchanged at 98.33, which
is Topper's `edit-item` hero shape to within 0.66. The trap is written up in the
root `AGENTS.md`.

**SAVED SHAPES WERE BUILT AND REMOVED** (Juan's call, 2026-08-22). The Shape
sheet could save the whole live config under a name — the curve plus rate and
keep-pitch — into `users/{uid}/shapes`, list them in their own section, apply
one, and delete one by swipe. All of it is gone: the sheet now SETS presets, EQ,
speed and pitch and nothing else, which is a feature that does not have to be
maintained before a first release and a bar that does not have to carry a ✓.

What that bought, and what it cost, so neither has to be re-derived:

- **The bar collapsed to one glyph.** The ✓ was the sheet's only commit, so with
  it gone `sheetCommitBarOptionsIos` had nothing to state and the sheet fell
  back to `IOS_FORM_SHEETS`' default close glyph. That is Apple's own split, and
  `HeaderCloseButton` was already documenting it: Done for a commit modal, a
  close glyph for a panel that applies as you go. This sheet has always been the
  second kind — every row edits the live graph as you move it — and the ✓ was
  the only thing pretending otherwise.
- **The Picker lost its null case.** `selection` was
  `activeShapeId === null ? activePreset : null`, because a saved shape
  overrode the preset. It is `activePreset` outright now.
- **The GOLD trophy had to move.** "Refiner" (save 3 shapes) became unearnable,
  and so did the platinum that needs every other one. It is `saved-clips`
  ("Splicer", save 10 clips) — the count comes from `store/clipsSaved.ts`,
  banked at the clip save site, because the clips cache only holds the sounds
  you have opened. An account that already earned `saved-shapes` keeps the
  document; nothing reads it, so it stops appearing.
- **Nothing was migrated, and nothing was deleted.** `SHAPES_SUBCOLLECTION`,
  its `firestore.rules` match and its line in the delete-account sweep all
  survive, marked LEGACY, so an early account's rows still get cleaned up when
  that account goes. Restoring the feature is a git revert plus those three
  comments.

**ANDROID'S TWIN WAS EDITED UNVERIFIED**, because leaving it half-removed would
be worse: `ShaperSheet.tsx` lost the chips row, the save dialog and the delete
button, and its `SheetBar` (a title plus a Save pill) became a plain title
`Text`. It typechecks and it mirrors iOS; nothing Android is installed, so
re-check it on device when Android resumes.

**THE EXPANDED PLAYER HAS NO BAR ROW, AND EDIT SITS WITH THE COPY IT EDITS**
(2026-08-21). Above the artwork there is now the artwork and nothing else.

The row that stood there carried `chevron.down` leading and an overflow `Menu`
trailing, at the portfolio's 43pt bar target, and Juan removed it: a personal
player has no bar's worth of work to put in one, the drag already puts the
player away, and two glyphs floating over the wash were the busiest thing on an
otherwise calm screen. It also hands **43pt** back to the column below —
`playerArtTop` cleared `PLAYER_BAR_TARGET + 14` and clears `IOS_ART_TOP_GAP`
alone now — which is where the transport and the footer wanted it. (That gap
was 24 the day the row went and is **12** today: nothing shares the band any
more, so its only remaining job is keeping the cover off the Dynamic Island's
own shadow — see the cover bullet above.)

**EDIT IS THE GLASS BAR'S THIRD COMPARTMENT, and it took two tries.** It was
first hung beside the copy it edits — a `pencil` trailing the title and artist —
on the argument that a button should name its OBJECT, unlike the "…" that acts
on the screen. That reasoning is sound and still is; what it missed is that this
console's whole case is ONE floating control surface, and a lone glyph in the
middle of the screen is a second one. Juan called it: in the bar there is less
floating, so the screen reads cleaner.

**IT IS A LABELLED CARD THAT HUGS ITS CONTENT, AND IT TOOK THREE TRIES.** It
shipped as a bare `pencil` in a fixed slot, and Juan's objection is the one that
matters: you cannot tell what it does. A glyph with no word is a guess, and this
is the one control in the bar whose meaning nothing beside it carries.

**THREE EQUAL CARDS ARE THE OBVIOUS FIX AND THEY DO NOT FIT — measured twice.**
Ink on iPhone 17 / iOS 26.5: "Shape" 46.33, "Flat · 1×" 50.67, "Clips" 35.67,
"None" 34.33. Three equal compartments are 123.33 each, and after 32 of padding,
the 31pt icon host and the 12pt gap that leaves **48.33** of copy — so the
DEFAULT shape summary truncates. Trimming padding to 12 and the gap to 10 buys
61.33, which still loses every preset that is not Flat at 1×.

So the compartment is sized to what it HOLDS, which is what a toolbar does: an
icon, one word, and no summary line — it has no live state to put on one, which
is exactly what separates it from Shape and Clips.

**IT IS A ROW, LIKE THE TWO CARDS, AND THE STACK IS THE REJECTED ALTERNATIVE.**
A STACKED version was built first — icon in the cards' label band (ink centre
789.00), word in their summary band (809.50), each solved backwards from the
cards rather than centred and hoped for, and landing within half a point of
both. The argument for it is real: a one-line cell centred beside two-line ones
is level with neither row. It is not the argument that decides. **The stack
makes this cell a different KIND of thing, and the bar's three items should read
as one kind.** Juan chose the row after seeing both.

**THE TRAILING PADDING CARRIES THE ICON HOST'S SLACK — and that, not
`opticalTextInset`, is why the two ends differ in metric.** At identical
`GLASS_ROW_PADDING` the right read tighter, and the cause is measurable: the
bar's first ink is a glyph inside a 31pt HOST 7 wider than the 24pt symbol it
holds, so the leading ink starts at padding + 3.5 of host slack + the glyph's
own bearing — 19.67 band-scanned. The bar's last ink is text, whose box has
almost no bearing at all: 16.34, a genuine 3.3pt tighter. So the trailing side
adds the host's half-slack back, derived from the two constants rather than
nudged by eye.

**`opticalTextInset` WAS TRIED HERE AND IT DOES NOT BELONG.** It was earned by
the STACKED layout, where the word sat low enough in the bar for the 22pt corner
to have begun pulling the edge in. With the word back at the bar's vertical
middle the edge is at its full 385.67, and there is nothing to compensate for.

**THE WORD IS FULL-STRENGTH, not muted like the summaries it sits beside.** It
is the cell's LABEL — the only one it has, with the icon as its partner — and a
muted button label reads as disabled.

**A SUMMARY WAS THE OTHER FIX AND THERE IS NO ROOM FOR ONE.** The compartment
hugs its content, so every point of summary comes off the two cards: "Details"
(~44 of ink) drops them to 125.5 and their copy box to 50.5 against
"Flat · 1×"'s 50.67 — truncating the DEFAULT state. Live text is worse than
tight: the sound's own name would re-divide the bar on every swipe between
sounds.

**BODY OVER FOOTNOTE (17 / 13) — THE TWO LINES ANSWER TO DIFFERENT CONSTRAINTS,
so they do not step together.** All three pairings were rendered on device once
the bar gained a third cell. Body/Subheadline (17 / 15) read TIGHT — Juan's
iPhone 15 is 393pt against the simulator's 402, so his content box is 361 and
each card is ~4.5pt narrower than anything measured here.
Subheadline/Footnote (15 / 13) fixed the width and read too SMALL. **There is no
rung between them**: the ladder is Body 17, Subheadline 15, Footnote 13, and
16 / 14 was already rendered and rejected in this app for being off it (16 is
`callout`, 14 is nothing).

So the pair SPLITS. The label is short — "Shape" is 46.33 of ink against a copy
box driven entirely by the summary — so keeping it at Body costs the cards
nothing and is what gives the cell its presence; the summary is the long string,
so it takes Footnote and buys the width. Body over Footnote is Apple's own
list-row pair. The icons stay at 24 with the label they sit beside. Band-scanned
after: dividers at 147.00 and 278.33, cards 131.00, copy box 56.00, and both
ends of the bar at 19.67.

**STEPPED, NEVER SCALED.** `bodyLarge`/`bodyMedium`/`bodySmall` are named rungs
Dynamic Type moves as a unit; deriving a point size from the bar's width ships
one Apple never draws and breaks the moment somebody raises their text size.

**THE SHAPE SUMMARY STATES WHAT IS NOT DEFAULT, AND NOTHING ELSE.** It used to
read "Flat · 1×" on a sound nobody had touched — a sentence saying "nothing is
applied" the long way round — and at 65.33 of copy the two-attribute form
overran the box ("Bright · 1…", rendered). Apple writes the exception and leaves
the default silent, so the preset is dropped when it is Flat, the rate when it
is 1×, the pitch note when pitch is preserved, and an untouched sound reads
**"None"** — the same word the Clips card uses for the same idea.

**The long form still truncates and that is accepted.** "Bright · 1.25×" needs
more than 65.33 — a character MORE than the old "Bright · 1.5×", since the
speed range narrowed to hundredths (2026-09-16). Truncation is what `numberOfLines={1}` is for, the label above
carries the meaning, and the state now occurs only when someone has set BOTH a
non-flat preset and a non-default speed. (It was worse while shapes could be
saved: a shape's name was a person's own string of any length.)

**THE LABEL IS ONE WORD; THE SPOKEN NAME IS NOT.** `player.menu.editShort`
("Edit") is a card title beside "Shape" and "Clips" and has to read as one of
them; `player.menu.edit` ("Edit Sound") stays the accessibility label, where the
extra word is worth having.

**IT TAKES THE CARD SQUASH, because it is a card.** As a lone glyph it needed
the ICON pair — `usePressSquash()`'s 3% is 4.8pt on a 161pt card and under a
pixel and a half on a 24pt glyph, so it shipped with what read as NO FEEDBACK AT
ALL, copied straight from `GlassHalf` beside it. `SquashPressable` names that
case in its own docstring. With a label beside it the compartment is the same
object as the two halves and takes their feedback, or one press in the bar would
dim and shrink while the others barely moved. The icon-pair version was verified
by bursting screenshots across a 900ms hold: ink 21.67 wide at rest, 18.67
pressed (0.862 ≈ 0.86), luminance 3.0 → 111.3 (3·0.55 + 242·0.45 = 110.6).

**A POINT SIZE IS A BOX, NOT AN AMOUNT OF INK.** At an identical 24,
band-scanned: `tune` 23.33 × 19.67 (area 459), `scissors` 30.00 × 22.67 (680),
`pencil` 18.67 × 18.33 (342). `pencil` is a thin diagonal with generous bearings
and read visibly smaller than both siblings, which Juan caught by eye. It is
optically sized to **28** — √(459/342) = 1.158 — landing at 469.6 against
`tune`'s 458.9, within 2.3%. The scissors are the outlier at the other end;
matching THOSE would make the pencil the biggest thing in the bar. SF Symbols'
own guidance allows this.

**It renders through `AppIcon`, like its siblings** — it shipped as a bare
`Image systemName="pencil"`, the only glyph in the bar outside the portfolio's
icon set, when `edit` already maps to `pencil` in `SF_SYMBOLS`.

**Every compartment has a divider.** The bar went one divider → none → two: with
a divider on a 48pt slot it read 161 / 161 / 48, a runt whose separator crowded
the rounded corner; without one, the last boundary simply went missing. Both
were called on sight.

**THE CLIPS SUMMARY IS A VALUE, NOT AN EMPTY-STATE TITLE.** It read "No Clips
Yet" — `player.clips.none`, the clips SHEET's empty title — in a slot whose
sibling says "2 saved". Under a label reading "Clips" Apple writes one word, the
way Settings writes "Ringtone: None", and the long string did not fit either:
79.40pt of ink in an 86pt box. `player.clips.noneSummary` is "None" / "Ninguno"
/ "无"; the sheet's empty title is untouched.

**INFO had nowhere to go and nothing left to say** — it listed artist, album and
release year, and the app no longer handles the last two, so what remained was
the title and artist already set two lines under the cover. The route,
`SoundInfoSheet`'s iOS presentation and `PlayerMenuButton.ios.tsx` are all gone.
Android keeps its overflow, its info sheet and its Material bar untouched.

**What it costs is the only dismiss control VoiceOver and Switch Control could
reach** — this is not a real UIKit sheet, so nothing publishes a dismiss action
on its behalf. The drag zone above the artwork carries it now as a labelled
button, and the console answers `onAccessibilityEscape`, which is Apple's own
two-finger-Z.

**One trap worth keeping from the discarded placement**, because it applies to
any absolutely-positioned use of it: `GlyphButton` puts the caller's `style` on
its inner `Pressable` and keeps the squash on an outer `Animated.View`, so an
absolute style handed to it positions the Pressable inside a wrapper that is
still an ordinary flex child. The pencil laid out under the copy, beside the
scrubber. The positioning goes on a WRAPPER.

`PLAYER_BAR_TARGET` (43) went with the row — nothing states it any more, since
the console's only glyph-only control is now a compartment of the bar and takes
the bar's geometry rather than a bar item's.

**THE EDITOR IS A TITLE AND A SUBTITLE** (2026-08-21). It carried four fields
read off the ID3 tag — Title, Artist, Album, Release Year — and the last two are
gone with the info sheet that displayed them: a library that takes any MP3 holds
ringtones and voice memos, and asking those for an album is asking a question
the app has no use for.

"Artist" became "Subtitle" for the same reason "song" became "sound" — the
second line under a cover is whatever the person wants written there. **The
stored FIELD stays `artist`**, exactly as the Firestore subcollection stays
`songs`: nobody reads a wire path, and renaming it would migrate every existing
document.

`album` and `releaseYear` are **optional** on `createSound`/`updateSound` rather
than deleted, and the write omits the key entirely when they are undefined —
so an existing document keeps what it has instead of being cleared, which is
what "not handled" should mean. `Sound` still READS both; nothing renders them
on iOS. Delete the params when there is a reason to migrate.

**Android's editor took the same change and is UNVERIFIED** — the feature spans
both twins and leaving one saying "Artist / Album / Release Year" would be the
drift this repo hates, but nothing Android is installed or run. Re-check
`EditSoundSheet.tsx` on device when Android resumes. Android's `SoundInfoSheet`
was deliberately NOT touched: it displays stored data and its screen is frozen.

**NEXT ROOM — THE SOUND THROUGH A WALL** (Juan's ask, 2026-09-16). A `Toggle`
in the Shape sheet, OFF by default, that plays a sound as if it were coming
from another room: the party down the hall, the music while you are in the
bath. Both are the same physics, which is why the control names the SPACE and
not the occasion — "Party Filter" was the asked-for wording and was reworded,
because Apple names reverbs after rooms (GarageBand's "Small Room", "Large
Hall") and never labels a user-facing effect "Filter", which is engineering
vocabulary in a UI whose own noun is "shape".

It is three HIGH SHELVES in the one serial chain, in `lib/audioEngine.ts`, plus
its own trim. The wall is the whole effect, and the shape of the wall is the
thing that took four goes to get right.

**A WALL IS A TILT, NOT A CUTOFF — and reading it as a cutoff cost three
releases.** Partitions obey the mass law, so transmission loss climbs with
frequency at roughly **6 dB per octave** and then FLATTENS: a real partition
leaks around door gaps, through the floor and along the studs, so the top end
arrives quietly rather than not at all. A cascade of low-passes says the
opposite — no floor, and twice the slope.

It shipped as two cascaded Q 0.707 low-passes and the cutoff was walked up three
times, getting worse at the end, which is the evidence that the MODEL was wrong
rather than the number. Measured at 48 kHz:

| cutoff | 1 kHz | 2 kHz | 3 kHz | 4 kHz | 12 kHz | verdict                     |
| ------ | ----- | ----- | ----- | ----- | ------ | --------------------------- |
| 800    | -10.7 | -32.2 | -46.4 | -56.7 | -102.4 | "TOO FAR FROM WHERE I AM"   |
| 1400   | -2.0  | -14.3 | -27.2 | -37.3 | -82.9  | "a little too far still"    |
| 2200   | -0.4  | -4.5  | -13.1 | -22.1 | -67.1  | "sounds worse" (2026-09-22) |

Every step bought consonants by giving up the illusion, because a single cutoff
has to carry BOTH and they pull opposite ways. 2200 is where that finally shows:
it leaves everything under 1.5 kHz untouched and removes everything over 4 kHz,
which is a **telephone** — full presence band, no air — and a telephone does not
read as distance, it reads as damage. **The report that preceded it was "too far,
too low volume", and raising the cutoff was the wrong lever for both halves.**

**SO THE WALL IS THREE HIGH-SHELF CUTS** at 500 / 1500 / 4000 Hz, stacked an
octave and a half apart, each at `NEXT_ROOM_DEPTH_DB` (-11). Each shelf is
6 dB/oct through its transition and flat after it, so three give a long, even
tilt that ends on a FLOOR:

| 60   | 250  | 500  | 1k    | 2k    | 3k    | 4k    | 8k    | 16k   |
| ---- | ---- | ---- | ----- | ----- | ----- | ----- | ----- | ----- |
| -0.0 | -0.8 | -5.7 | -12.3 | -19.8 | -24.0 | -27.2 | -32.4 | -33.0 |

Read against 1400 Hz, the version called a heavy wall: the tilt is **six dB
darker at 1 kHz** and **fifty dB brighter at 12 kHz**. Both at once is the thing
a cutoff cannot do — the midrange goes, which is what says "not in this room",
while a quiet residue of the top survives, which is what says "and the door is
open". It is also the first version where the bass genuinely passes at unity
while the vocal is gone; under the low-passes the two moved together.

**THE THREE GAINS ARE ONE NUMBER.** `NEXT_ROOM_DEPTH_DB` is the distance
control; the frequencies are the wall's character. Move the listener with the
depth, not the frequencies. Two shelves leave the floor too high to read as a
wall; four is a 24 dB/oct tilt, which is a cutoff again wearing a new shape.

**THE BASS IS NEITHER CUT NOR BOOSTED.** The tilt already passes the bottom at
unity, which IS the thump you hear two rooms away. A first draft shipped +4 dB of
make-up over a +3 dB low shelf, on the reasoning that a bus which has discarded
the top can only be quieter than its input. That is false in exactly the band the
effect keeps, and it modelled at **+7.0 dB peak**.

**OFF IS AN EXACT BYPASS, AND WITH SHELVES THAT IS FREE — WHICH DELETED A WHOLE
APPARATUS.** An RBJ shelf at 0 dB has numerator === denominator, so H(z) = 1 and
the graph is bit-identical to one with no wall in it. A low-pass has no identity
setting, so "off" used to be a DIFFERENT FILTER TYPE, reached by sweeping the
cutoff to a parking spot near Nyquist and flipping the type there on a deferred,
generation-guarded timer — which shipped a marginally stable filter (pole radius
1.000000 at Nyquist: Juan heard it ring for half a second whenever another app
made a sound), then 0.87 dB of phase overshoot in the DEFAULT state once parked
lower, and the only timer in `audioEngine.ts`. All of it is gone: on and off are
one filter at two gains, so the transition is a gain ramp. **A bypass that is a
different filter is a bypass you will get wrong.**

**THE TRIM IS -1.0 dB, half a dB LESS than the low-passes needed.** Re-measured
through the offline DF1 model across every preset × echo on/off: at 0.0 the worst
case overshoots +0.63 dB, at -0.5 it is +0.13, at -1.0 it is -0.37. A gentler
slope rotates less phase, so the tilt is both brighter and slightly louder than
the thing it replaced. Nothing is ever ADDED — make-up would put the bass, which
passes at unity, straight over full scale.

**THE TRANSITION IS A 200 ms LINEAR RAMP OF THE DEPTH**, which is already the
logarithmic domain, so an even-sounding move needs no curve of its own. It reads
as a door swinging rather than a switch being thrown. (The low-pass version had
to ramp FREQUENCY exponentially for the same reason, and then flip a filter type
at the end of it.)

**THERE IS NO REVERB, AND THAT IS A CONSTRAINT AS MUCH AS A TASTE.** A convolved
room was built first and is gone for two reasons that agree. The taste one: on
device it read as "a heavy concert" — reverb is the cue that says LARGE, and a
flat is not large. The hard one is that react-native-audio-api 0.13.2 cannot fan
a node out to two consumers (see `buildGraph`), and a wet/dry mix is nothing but
a fan-out. Baking the dry path into the impulse response would dodge that, and is
the door left open. **It is a SMALLER door now:** reverb was the missing distance
cue the cutoff kept being pushed to compensate for, and the tilt supplies
distance directly.

**MEASURED, NOT YET HEARD** (2026-09-22). Every number above is an offline model
and a green `test/unit/shapeHeadroom.test.ts`, which now asserts the wall's
SHAPE as well as its headroom and poles — bass within 0.2 dB of unity, 1 kHz
past -8, the top two octaves flat within 2.5 dB of each other. This app's rule
stands: measure to find the defect, LISTEN to close it.

**It lives in the SHAPER store, not the player's**, beside the curve rather
than beside `rate` and `keepPitch` — it is applied by the engine, it is what
the Shape summary reports, and `reset()` takes it with it on sign-out for the
same user-scoping reason the curve has one. The two in the player store are
there because the TRANSPORT reads them: a rate is published to the system
now-playing session, and a wall is not. It is also in `useTrophyTriggers`'
`shaped` test — **anything the summary is willing to print is by definition
"not default"**, so a term added to one and not the other makes the trophy
quietly disagree with the screen.

**The summary's terms run in the SHEET'S order** — preset, speed, pitch, room —
so it reads as a walk down the controls that produced it and adding one never
re-orders the terms already there. That is why Next Room is last despite being
the most audible: the alternative is a summary whose word order depends on
which options happen to be active. It shortens the long form further, which
the existing note below already accepts.

**Android took the same change and is UNVERIFIED**, as ever — the row mirrors
Preserve Pitch's label/supporting/`Switch` anatomy so the two read as one list.
The DSP is shared and platform-independent; nothing Android is installed.

**PLAYBACK SPEED IS 0.75×–1.25× IN TWENTIETHS, AND THE RANGE AND THE STEP ARE
ONE DECISION** (Juan, 2026-09-16). It was 0.5×–1.5× in tenths — eleven stops, of
which eight existed to be scrolled past: at 0.5× a song is a dirge and at 1.5× a
chipmunk, and neither is a speed anybody listens at. Narrowing the range and
halving the step keeps the SAME eleven stops and spends all of them where the
listening happens, so 0.85×, 0.95×, 1.1× and 1.25× are picked rather than aimed
at.

**The range is symmetric around 1× on purpose**: the slider's midpoint is
"untouched", which is the one value a person must be able to return to without
reading the label. That is also what rules out the literal 0.75–1.75 — it puts
1× at a quarter of the travel.

**THE THREE CONSTANTS NOW LIVE IN `lib/player.ts`, BESIDE `rateLabel`**, because
both twins stated their own copy of all three (and Android a fourth, the Compose
`steps` derivation) — the exact drift `rateLabel` had already moved there to
avoid. `snapRate` came with them: the old inline `Math.round(v / RATE_STEP) / 10`
silently encoded the step being a tenth, and at 0.05 the obvious replacement
drifts on its own (19 × 0.05 is 0.9500000000000001), so it rounds to two decimals
— which is what keeps `rate === 1` true for the trophy trigger and the shape
summary. Nothing persists a rate, so no stored value needed clamping.

**PRESERVING PITCH IS THE DEFAULT AGAIN, BECAUSE THE STRETCHER IS FIXED**
(2026-08-22). `keepPitch` defaults to **on**, the way every Apple speed control
works. The engine takes one of three paths, in `chooseFillMode()` in
react-native-audio-api's `AudioFileSourceNode`:

| state                  | path          | sound                                   |
| ---------------------- | ------------- | --------------------------------------- |
| preserve on, rate 1×   | `Passthrough` | untouched — why normal playback is fine |
| preserve off           | `Resample`    | varispeed, clean, a record played fast  |
| preserve on, rate ≠ 1× | `Wsola`       | the time-stretcher                      |

That third path was the library's own WSOLA, voice-grade, and on music every
grain splice was audible ("rocky, as in stones") — which is why `keepPitch`
spent 2026-08-21→22 defaulting to off. The artifact was measured to be
inherent to WSOLA, not tunable (every window/search/decimation variant doubled
or dropped transients), so **`patches/react-native-audio-api/` replaces the
stretcher's internals with a phase vocoder** (vendored Signalsmith Stretch,
same class, same API — read that README before touching it, and
[`../../docs/pending-upstream.md`](../../docs/pending-upstream.md) for the
measurements). The patch is applied by the root
postinstall (`scripts/apply-patches.mjs`), so it survives `npm ci` and
`prebuild --clean`; it is C++ in the pod, so changing it needs a native
rebuild, not a Metro reload. If the patch is ever retired without an upstream
fix, the off default and the inverted chip come back with it.

**IT WAS SIGNED OFF ON HARDWARE, NOT ON THE NUMBERS.** The click-train
measurements are what proved WSOLA unfixable, but they could only ever say
"the transients are where they belong" —
whether music SOUNDS right is a listening test, and this one passed on a real
iPhone (2026-08-22, several tracks × several presets × the full 0.5–1.5×
range). Keep that order for any future DSP change here: measure to find the
defect, listen to close it.

**Flipping the switch AUTOMATICALLY at rate ≠ 1 was proposed while the
stretcher was broken and stays rejected** —
see [`../../docs/rejected-experiments.md`](../../docs/rejected-experiments.md).
The short version: a control that moves on its own, and a shape that stores a
choice nobody made.

**THE SHAPE SUMMARY'S PITCH NOTE INVERTS WITH THE DEFAULT**, because that
summary states what is NOT default and nothing else (below). It has now
inverted twice and reads **"pitch off"** (varispeed is the exception worth
printing). It is also silent at 1× at EITHER setting — the engine passes the
audio through untouched there, so the switch describes nothing that is
happening, and a note on a sound nobody has sped up is the "Flat · 1×" noise
the summary was rebuilt to stop.

**THE HEADROOM TRIM IS AUTOMATIC, AND THERE IS NO MANUAL PREAMP** (2026-08-22).
The graph is `mediaSource → trim(gain) → 5 biquads → destination`, and the trim
is COMPUTED FROM THE CURVE by `headroomTrimDb` (`src/lib/eqResponse.ts`), never
chosen by hand.

It replaced a manual `preamp` dB setting that **had no UI on either platform** —
no slider, no row, and its `player.eq.preamp` string was never rendered in any of
the three languages. It could only ever be 0, so the chain shipped with no
headroom protection at all. A second, hand-driven preamp beside the automatic one
would only raise the question of which is which, so there is one gain node and
one meaning for it.

Measured on device (iPhone 17 / iOS 26.5, "Immortals", a 2014 master that already
peaks at **+0.03 dBFS** through the flat chain):

| chain                                    | output peak    |
| ---------------------------------------- | -------------- |
| flat                                     | +0.03 dBFS     |
| old `bass` [9, 5, 0, 0, 1], no trim      | **+6.05 dBFS** |
| new `bass` [3, 2, 0, -1, -2] + auto trim | **-3.55 dBFS** |

Six dB over full scale, sustained for a whole track. That is the crunch, and it
is what a graphic EQ with no trim does to anything mastered after about 1995.

**THE TRIM IS THE CURVE'S PEAK PLUS 1.5 dB, AND THE MARGIN IS NOT A FUDGE.**
Filtering does not preserve sample peak — it shifts phase, which changes the crest
factor — so the output can land ABOVE the maximum of the magnitude response.
Measured against a limited master and pink noise, `treble` overshot its own
theoretical bound by 0.26 dB and `bright` by 0.58, and a curve that only CUTS
([-3, -7, -9, -6, -6], response peak -2.30 dB) still raised the sample peak by
0.32. That last case is why the margin applies to EVERY non-flat curve and not
only to boosts. A perfectly flat curve takes NO trim, so the chain stays
bit-transparent when nobody has shaped anything.

**PEAK-SAFE AND LOUDNESS-MATCHED ARE IN DIRECT CONFLICT, and "let the automatic
trim do the loudness matching" makes it WORSE.** After a peak trim the net
loudness is `loudness − peak`, and a weighted average is never above a maximum,
so every shaped preset ends up quieter than flat — and the more shaped it is, the
quieter it gets. Trimming the OLD boost-only presets would have spread them from
0 to **-7.22 LU** (K-weighted per ITU-R BS.1770 over pink noise), worse than the
3.38 LU they started with.

The fix is in the CURVES, not the trim: every preset is now a TILT around unity —
the characteristic end up, the far end down — so it asks for far less headroom
while saying the same thing tonally. The five shaped presets now sit within
**0.86 LU** of each other, under the ~1 LU nobody can hear, and none of them
clips. Flat stays at 0 and is deliberately NOT pulled down to join them:
attenuating a sound nobody has touched would be its own defect.

**AND THEY WERE LISTENED TO, WHICH THE RE-TUNE ITSELF COULD NOT DO** (Juan,
2026-08-22). Every number above came out of an offline model and a device peak
meter; the curves were rewritten without anybody hearing them, and a tilt that
measures well can still fail the only test that matters — whether a preset
sounds like its own name. Played through on device: each of the five reads as
what it is called, and the set is audibly different curve to curve rather than
audibly louder. The tilt is not a compromise the measurements forced, and
nothing here is waiting on a listening check.

**A LOW SHELF IS THE EXPENSIVE BAND.** It costs its full boost in headroom and
buys almost no loudness back, because K-weighting discounts everything under
~100 Hz. That is why `bass` is +3 and not +9 — the tilt does the work, not the
number. Preset gains must also stay WHOLE dB: the sliders step by 1 and
`matchPreset` compares exactly, so a fractional gain is a preset the chip can
never show as selected.

**EVERY PARAMETER MOVE IS SCHEDULED, NEVER WRITTEN.** `band.gain.value = db` is a
step discontinuity in the signal: measured at **30.9x** the natural
sample-to-sample slew of a 100 Hz tone on a preset change, and **19.1x** while
dragging a band in 1 dB steps. Both return to ~1x — i.e. gone — with
`setTargetAtTime` at a **12 ms** time constant, which is ~95% settled in 36 ms, so
dragging still feels live. The same constant drives the trim, which was verified
rather than assumed: a flat→bass switch on a limited master peaks at -0.40 dBFS
mid-transition, so the trim never lags the boost it is compensating. A fresh graph
still takes its values outright (`setValueAtTime`) — fading the EQ in over the
first 36 ms of a sound would be its own artefact.

**Two things about the library that are easy to assume wrong**, both read out of
its C++ rather than guessed:

- **Shelves ignore Q entirely.** `getLowshelfCoefficients(frequency, gain)` takes
  no Q argument at all — the slope is hardcoded S = 1. Declaring `q` on the 80 Hz
  or 12 kHz band would do nothing, which is why neither does.
- **The peaking bands DO overlap and sum.** At Q = 1 their skirts run ~1.4 octaves
  and 250 / 1k / 4k sit 2 octaves apart, so all five sliders at +12 measures
  **+13.97 dB**, not +12. (The old `bass` was the opposite case and the brief's
  premise for it was wrong: its shelf and peak barely interact, so [9, 5, 0, 0, 1]
  peaks at +8.99 dB — just under the shelf's own +9, not above it.)

**There is no compressor, but there IS a `createWaveShaper`.** The library has no
`DynamicsCompressorNode`, so a true limiter is unavailable — but a static soft-clip
curve on a `WaveShaperNode` would catch the residual, and the residual is real: a
1.5 dB margin covers ~89% of plausible hand-dragged curves, not all of them, and a
pathological one can still overshoot by ~1 dB. It was NOT built, because covering
that tail with trim alone would cost ~4 dB of level on every shaped sound to
protect against curves nobody sets. **Build the waveshaper before raising the
margin.**

**THE ENGINE IS SHARED BY BOTH TWINS, AND ANDROID IS UNVERIFIED.**
`src/lib/audioEngine.ts`, `src/lib/eqResponse.ts` and `src/store/shaper.ts` carry
no platform split, so Android got the automatic trim, the scheduled parameters and
the new preset curves the moment iOS did — and nothing Android is installed or run
(see the root `AGENTS.md` freeze). The DSP is platform-independent, but Compose's
`ShaperSheet.tsx` has never been seen against the new curves; re-check it on
device when Android resumes.

**How to re-measure**, because these numbers are the whole argument. There is no
meter in the app and no dev flag for one — `flags.ts` has ONE switch and will not
get a second. Tap the graph's output with an `AnalyserNode` (`ctx.createAnalyser()`,
inserted between the last band and `destination` so it is actually pulled), hold
the running max of `getFloatTimeDomainData`, and read it from a temporary row in
the Shape form; delete it afterwards. Mind the sampling caveat: a polled analyser
sees roughly a fifth of the samples, which is ample for a sustained clip and
useless for catching a few-sample click. The click figures above therefore come
from an offline port of the library's own `BiquadFilterNode.cpp` (Direct Form 1,
k-rate gain per 128-sample quantum, a-rate gain node), which sees every sample and
agrees with the shipped `peakResponseDb` to 0.05 dB.

**Home's iOS header is the SYSTEM large title**, not the shared
`CollapsingHeaderBar` (Android still uses that). The one thing it costs is
spelled out in `home.tsx`: the bar EMPTIES while the player is expanded rather
than hiding, because hiding it re-lays-out the screen and drops the player 8.67pt.

**The dev state lab is on** (`src/dev/flags.ts` → `STATE_LAB`). It pins home,
the account sheet and trophies to any of their UI states; the picker is the
shared `StateLab`. While it is on, the real account deletion is REFUSED
(`dev/deleteAccountGuard`) — turn the flag off to delete for real. THERE ARE NO
FIXTURES and none are to be added.

## The data layer — audited 2026-08-28

`/portfolio-data-audit` read every Firestore call site, every image site and
every network call. The layer is small and most of it was already right:
persistence on and nothing disabling it, TWO listeners in the whole app (the
library, session-long in the layout; clips, mounted on the console rather than
on `current?.id`), the profile a one-shot from the sheet that reads it, three
`getDocs` and all three correct, the 10Hz tick already pushed to leaves. What
follows is what it changed, and the rules those changes are instances of.

**A PERSISTED STORE MUST NEVER TAKE A PER-TICK WRITE.** `useListeningStore` is
`persist`-wrapped over AsyncStorage, and zustand's persist calls `setItem` on
EVERY `set` with no debounce of its own — so `useListeningTime` banking each
transport report meant a `JSON.stringify` plus a native store write ten times a
second (the transport's `onPositionChangedInterval` default is 100ms and
nothing here overrides it), foreground and background, on the one thing this
app exists to do.

Measured on iPhone 17 / iOS 26.5 off `RCTAsyncLocalStorage_V1/manifest.json`'s
mtime while a track played: **80 rewrites in 20.0s** committing per tick, mean
gap 0.25s, against **5.02s and 4.99s** spacing committing in 5s blocks. Twenty
times fewer. The hook accumulates in a ref now and flushes on every boundary
that ends a stretch of listening.

**The file lands at ~4/s, not the tick's 10/s** — RN's AsyncStorage coalesces
its own queue — so the JS half (stringify + a native module call per tick) was
the larger share of the cost. Reasoning from a disk rate alone understates
this class of bug; measure both ends. The threshold is chosen against the
READER: the `listening` trophy's threshold is in MINUTES, so nothing can
observe 5s granularity.

**FIRESTORE DOES NOT DELETE A SUBCOLLECTION WITH ITS PARENT, AND THAT HAS NOW
BITTEN THIS APP TWICE.** `account.ts` already said so about the user doc;
`deleteSound` did it anyway, removing the sound document and leaving its
`clips` standing underneath a document that was gone. The account sweep could
not reach them either — it finds clips by walking the sounds that still EXIST —
so a clip whose sound went first outlived the account, while the row promised
"All of your sounds and clips will be deleted permanently". Same shape as the
wrong-but-legal collection paths that sweep shipped with, different door.

It was not hypothetical: a collection-group query over the developer account
returned **10 clips, THREE of them orphans** under sound ids that no longer
exist. `deleteClipsOfSound` (in `clips.ts`, which owns that path) runs first
now, verified end to end with a throwaway sound written straight to Firestore,
given a clip and then deleted from the app.

**THE THREE WERE DELETED BY HAND** over the Firestore REST API, and the census
afterwards reads 7 clips and 0 orphans. No code was grown to do it, and none
should be: nothing reaches an orphan by path, a COLLECTION-GROUP query does —
it is how they were found — but sweeping with one spans every user's clips and
needs a `match /{path=**}/clips/{clipId}` rule to match, a wider read surface
than this app has any other reason to open. With the sweep in place there is
nothing left for such code to find.

**THE PLAYER HOLDS A COPY OF THE DOCUMENTS, AND SOMETHING HAS TO REFRESH IT.**
`current` and `queue` were snapshots frozen at `playSound`. Deletion was the
only library change wired up (`soundDeleted`); an EDIT reached nothing, so
renaming the playing sound left the banner showing the old name — on home, the
grid tile and the banner over it named the same sound differently. The banked
duration was the same bug wearing a second hat: `AudioEngine` reads the
player's own copy to decide whether to write `durationMs`, and a frozen copy
never learns the write landed, so skipping away and back re-wrote it every
load. `syncLibrary` takes each snapshot; it compares FIELD-WISE, because
Firestore hands back new objects every time and a reference check would
re-render the player whenever anything anywhere in the library moved.

**AND A REMOVAL IS A CHANGE TOO — THAT HALF WAS MISSING UNTIL 2026-09-11.**
`syncLibrary` used to `return` on a sound missing from the snapshot, with a
comment saying the teardown was `soundDeleted`'s job. True of the only deletion
anyone had wired — a tap in this app's own editor, which calls `soundDeleted`
directly — and it left the OTHER one with no road at all. **A personal app is
still multi-device**: the same account on a phone and a tablet, and the
snapshot is the only thing that ever says a sound went.

Measured on a Galaxy A54 against a throwaway document deleted through the real
`deleteSound` flow on an iOS client: the grid dropped the tile and the player
carried on from a **`404`** — transport live, Shape / Clips / Edit live, audio
still streaming, because **the Cloudinary asset outlived the document** (the
orphan gap that was open when this was measured — closed 2026-09-12, so the
ghost is now a dead stream rather than an audible one, which changes nothing
about the teardown this paragraph is about). The queue kept it too, via `?? queued`, so seven `next` presses
wrapped the library and landed back on the deleted sound.

Both roads share `clearedForMissing` now, so they cannot drift; the queue drops
what the library no longer holds instead of falling back to its stale copy; and
the `changed` check compares LENGTHS before comparing index-wise, since a
shrunk queue otherwise lines up different sounds. No "has it settled" guard was
needed — `subscribeToSounds` carries the whole collection with no limit, so
there is no snapshot that legitimately omits a sound that still exists.

**What is deliberately NOT fixed is the cold-start window.** Firestore
persistence answers the first snapshot from the local cache, so an app reopened
after a delete made elsewhere shows the dead sound for **~4–6s** (measured:
airplane mode with Metro over USB served it from cache indefinitely; restoring
the network reconciled between two frames of a 2s burst). `IdleBanner` is
primed with the first library sound, so during that window the parked banner is
the dead one. Pressing play there now ends in the correct teardown rather than
a ghost, which makes the remainder cosmetic — and un-priming until the first
non-cache snapshot would cost the parked-bar behaviour, which is worth more.

**Topper has none of this, and not by luck:** `subscribeToTop` emits `null` on
`!snapshot.exists()`, so every detail screen has a real "gone" branch. This
player was the portfolio's only surface holding a detached snapshot that also
kept PRODUCING OUTPUT from one.

**Confirmed still intentional, so nobody re-opens them:** `subscribeToSounds`
is unbounded (capping hides someone's own library; the honest fix is paging),
`upsertOwnProfile`'s one extra `getDoc` per sign-in (Firestore has no
set-if-absent for a field). The three Cloudinary orphan doors it listed
alongside them — delete a sound, replace a cover, delete an account — are
CLOSED as of 2026-09-12; each site carries its own note.

**`lib/waveform.ts` downloading the whole mp3 is FINE, and was checked.** It is
reached only from `ClipTrimEditorIos`, so only while the `clip-trim` sheet is
open — not per sound played, not per player open. The JSON cache is consulted
first, the in-memory map dedupes within a session and evicts failures, and the
mp3 is deleted in a `finally`. It is once per sound per cache generation;
`cacheDirectory` being OS-purgeable is the correct trade, since it self-heals
and cannot grow without bound.

## What it relearns — audited 2026-08-28

`/portfolio-cache-audit` read every compute path the day after the data audit
read every network one. Most of what it looked at was already right, and the
list is worth knowing so nobody churns it: the versioned waveform cache, the
banked `durationMs` with seed-then-override past a 1s tolerance,
`prefetchPlayerBackdrop` fetching the exact transformed url the layer will
request, the transport anchor in a module store, the neighbour covers mounted
so a page is a transform on an already-decoded bitmap, `audioEngine`'s
`settings.gains` surviving a graph rebuild, `NO_CLIPS` as a module constant so
a zustand selector cannot hand back a fresh array. The 10Hz transport tick is
genuinely at the leaves — `useListeningTime` subscribes to `position`, but from
inside `AuthenticatedSubscriptions`, which renders `null`.

**A MEASUREMENT ON THE LAYOUT PATH OF ITS OWN FIRST FRAME, ONE MORE TIME.**
`SoundTile` sized its artwork with `useState(0)` + `onLayout`, so frame one
passed `displayWidth: undefined` and `ArtImage`
(`displayWidth ? thumbUrl(...) : uri`) pointed the native view at the raw
Cloudinary original before the measurement landed. `GRID_CELL` was a frozen
178 whose own comment promised that making it dynamic was the one change
"everything below follows"; a window width is available synchronously, so the
cell, the corner, the caption inset and the add tile's plus now derive from it
through `soundTileMetrics`, and the skeleton takes the same
`useSoundTileMetrics` hook rather than a copy.

**THE SIZE OF THAT ONE WAS OVER-CLAIMED FIRST, AND THE CORRECTION IS THE
LESSON.** A day-old image cache held 5.12 MB of raw originals beside 118 KB of
`w_356` tiles, and the audit reported the grid as the fetcher. It is not.
Clearing expo-image's disk cache, cold-starting on the OLD code and matching
every file by MD5 against each candidate url returned 19 files / 192,754 bytes
— every one a `w_356` tile or a `w_92` banner, **not one raw original**.
expo-image cancels the in-flight load when the source prop changes, and the
second render lands within milliseconds. The originals came from the three
slots that passed no `displayWidth` at all, fixed hours earlier in f125517.
**Finding a symptom and a plausible cause in the same cache is not the same as
proving the link** — the fix removes an abandoned request, a `recyclingKey`
churn and a second render, and its real value is correctness on every width
that is not 402pt.

**THE EQ CURVE WAS THE THIRD USER-SCOPED STORE, AND THE ONE THE SWEEP KEPT
MISSING.** `useTrophyTriggers` awards `first-shape` on
`rate !== 1 || gains.some(gain => gain !== 0)`. `rate` is in the player store,
which sign-out already reset; `gains` is in the shaper store, which nothing
reset — so a second account signing in on this device was handed First Shape
off the first one's activity. `useShaperStore.reset()` is back in that list and
applies the flat curve through `audioEngine`, because the engine's own
module-scope copy is just as user-scoped. **The instructive part: 1bd1895
DELETED that `reset()` for having no callers, and 0f5260d added the two sibling
resets six hours later.** The passes crossed, and "uncalled" meant "missing a
call site". Code-verified only — signing out now also clears the two persisted
counters, i.e. real Listener/Splicer progress.

**"NO CLIPS" WAS A CLAIM MADE BEFORE THE ANSWER ARRIVED.** Both twins branched
on `clips.length === 0`, which is also what an unloaded sound looks like.
`settledBySoundId` had been in the store for exactly this since it was written
and had never been read by either platform. iOS takes `ProgressViewIos` behind
the standard 400ms delay — a spinner and not a bone, the call Explore's search
already made, because nothing knows how many clips a sound has until the
snapshot lands. Android takes the same gate with a waiting line and is
UNVERIFIED.

**Two smaller ones.** The neighbours' _washes_ were never prefetched though
their covers were, so a skip left the 420ms crossfade covering a cold fetch;
steady state is unchanged (one new fetch per skip, taken a sound earlier).
And `PlayerBackdrop` is memoized — its only input is a url, its output is two
SVG gradient trees, and `PlayerSheet` re-renders on `playing`, so every
play/pause tap rebuilt the largest layer on screen.

**A VERSIONED CACHE HAS TO DELETE, NOT ONLY REFUSE TO READ.** `CACHE_VERSION`
kept stale buckets from being read and nothing ever removed the superseded
files: the device held two `v1-` waveforms beside their v2 replacements,
stranded by the 250 → 50ms change. Pruned once per session off the first
`getWaveform`; `deleteSound` now calls `forgetWaveform`. Deliberately NOT wired
into the account sweep, which deletes sound docs directly — see that comment.

**Confirmed sound, so nobody re-opens them:** the grid's cell list un-memoized
(O(n) over a personal library, and the sortable wants a fresh `data` identity
when the playing tile changes anyway — it was `toGridRows` over a FlashList
when this was written; the FlashList went with the reorder, since
`Sortable.Grid` needs a real scroller it can drive for edge auto-scroll),
`eqResponse`'s 128-point sweep (~0.02 ms, run per
drag tick on purpose), the scrubber and trim-frame `onLayout` widths (genuinely
variable, and they feed gesture math rather than a fetch), and the transport
anchor re-measuring per expand (equality-guarded, and insets move).

**This file is the source of truth.** The build plan it was written against was
retired 2026-09-12, its phases all shipped
(`git log --follow -- docs/sound-shaper-plan.md` for the history). Its copyright
rule survives in the only form that outlived the 2026-07-18 zero-social pivot:
**every upload is strictly personal, and nothing a person uploads is reachable
by anyone else.** There is no public feed to shield, and no preview clip.

## Status

**Flat-library phase — Android-first.** Auth (Google/Apple), song upload
(document-picker → ID3 parse `src/lib/id3.ts` → `EditSongSheet` →
**Cloudinary** audio as a `video` resource + embedded art → Firestore at
`users/{uid}/songs`), the song-tile home grid, and the expanding PlayerSheet
(audio-api playback through the EQ graph, Shape/Clips pages) are all built and
device-verified. Long-press a tile edits/deletes; tapping plays and opens the
player.

**THE WHOLE LIBRARY LIVES ON THE PHONE, AND PLAYBACK PREFERS IT** (Juan,
2026-09-14, for a trip with no signal at all). The app streamed from Cloudinary
and nothing else, so with no network it had no sounds: the library still listed
them — Firestore's persistence answers from disk — and pressing play reached
for a URL that could not be fetched. `lib/offlineAudio.ts` mirrors every
sound's mp3 into `documentDirectory/offline-audio/<soundId>.mp3`,
`hooks/useOfflineMirror` keeps that in step with the library snapshot, and the
engine takes the local file whenever it exists.

**AUTOMATIC AND WHOLE-LIBRARY, NOT PER-SOUND.** Apple Music's download arrow is
the obvious alternative and it is the wrong shape here: everything in this
library is the person's own upload, so a control that asks "which of your own
sounds do you want?" only creates a way to arrive somewhere with the wrong
answer. The cost is storage — measured, 23 sounds came to 123 MB — which a
personal library can afford where a streaming catalogue could not. There is
deliberately NO UI: a sound that has not been mirrored yet still streams,
exactly as the whole app did before, so there is no state worth a row.

Four things not to re-derive:

- **It is in `documentDirectory`, not the cache.** `cacheDirectory` is
  OS-purgeable, which is the one thing a flight cannot rely on; the waveform
  buckets live there because they self-heal in seconds and these do not. Apple
  asks that re-downloadable content be excluded from backup instead and
  `expo-file-system` exposes no flag for it in either API, so the mirror is
  backed up. Revisit if a large library ever makes an iCloud backup
  conspicuous.
- **A download lands atomically** — written to `<id>.part`, then moved. A
  connection that dies mid-file must never leave a truncated mp3 where a whole
  one is expected, which would play as a sound that stops early: worse than not
  having the file.
- **THE SOURCE IS PINNED PER LOAD.** The mirror finishes a download whenever it
  finishes, and swapping `<Audio source>` under a playing element re-mounts it —
  so a sound that started streaming would restart from 0:00 the moment its own
  file landed. `usePinnedSource` resolves the uri once per `id#loadNonce`, and
  the local copy is picked up by the next load.
- **The clip editor's decode borrows that file** rather than downloading the
  mp3 a second time (`lib/waveform.ts`), which is also what makes the waveform
  reachable offline. A borrowed file is not ours to delete — only a file that
  function fetched is removed afterwards.

Deletion and sign-out both take the mirror with them: `deleteSound` drops the
one file beside `forgetWaveform`, and `useAuthListener` wipes the directory,
for the same reason it resets the persisted trophy counters — a device-local
cache is not a device-local FACT.

**VERIFIED WITH THE NETWORK OFF, AND THEN ISOLATED.** iPhone 17 / iOS 26.5,
mirror warm: with the host's Wi-Fi off, a COLD start drew the library from
Firestore's cache, the covers from `expo-image`'s disk cache, and played. Then
the source itself was isolated without touching the network — the remote
fallback was pointed at an unreachable host, and playback ran 30.1s of audio in
a 30s window, with Playback Speed at 1.3× giving 25.1s of audio in 20s of wall
clock (the phase vocoder, on the local file). Android shares every line of
this and is UNVERIFIED — no device attached.

**No Firebase Storage, no Cloud Functions** — both need the Blaze (paid) plan,
and this app stays on Spark (free). Media goes to **Cloudinary** (same cloud
`juanevillam` as Topper, unsigned preset `sound_shaper_unsigned`,
`src/services/cloudinary/`), under a PER-USER folder `sound-shaper/{uid}/`.

**Deleting from Cloudinary needs the API secret, which cannot ship in an app —
`services/media-worker` holds it instead** (a Cloudflare Worker on the free
plan, shared with Topper as a second environment). It proves ownership from the
upload path alone: it only ever deletes inside `{root}/{uid}/` for the uid on a
verified Firebase ID token, so it needs no database access. That is why the
folder gained its `{uid}` segment on 2026-09-12 — flat, there was nothing to
delete by. `scripts/migrate-media.py` moved the existing library.

**DEPLOYED 2026-09-12** at
`sound-shaper-media-worker.juanesvillamendoza.workers.dev`, with its Cloudinary
secrets set and verified failing closed (405 on GET, 401 without a valid
Firebase token, 404 on an unknown route). Topper has its own deployment of the
same source. Until that day both `FUNCTIONS_BASE` values carried a
`<subdomain>` placeholder, so every call 404'd at DNS and died in its
best-effort catch — the code was right and the media orphaned anyway, which is
worth remembering before trusting any backend-touching verdict.

Playback runs on **react-native-audio-api** (expo-audio is gone from the
player): a streaming `<Audio>` element routed through a Web-Audio shaping
graph — an automatic headroom trim + 5 biquad EQ bands + the Next Room wall
(`src/lib/audioEngine.ts`,
`src/lib/eqResponse.ts`,
`src/components/player/AudioEngine.tsx`, shaper settings in
`src/store/shaper.ts`) — with playback speed 0.75–1.25× in twentieths
(`RATE_MIN` / `RATE_MAX` / `RATE_STEP` in `src/lib/player.ts`), keep-pitch (ON by default,
over a patched stretcher — see the stretcher note above), clips (personal
replay bookmarks), and background playback via the plugin's media foreground
service.

**THE SYSTEM NOW PLAYING SESSION IS PUBLISHED — BOTH PLATFORMS** (iOS
2026-08-26, Android 2026-08-28; the component is `NowPlayingBridge`, one file,
no platform twin — the paragraphs below still say "iOS only" and
`NowPlayingBridgeIos` in places, and that is the state they were written in).
The Dynamic Island's audio pill, the Lock Screen
player and Control Center's card are ONE system surface, drawn by iOS for
whichever app owns the now-playing session; the bridge publishes it through
the library's `PlaybackNotificationManager` (`MPNowPlayingInfoCenter` +
`MPRemoteCommandCenter` underneath) and answers play / pause / nextTrack /
previousTrack / seekTo with the store's own transport actions. The rule
worth keeping: **publish on DISCONTINUITIES, never on the position tick** —
iOS interpolates the playhead itself from one (elapsedTime, rate) pair, so
the bridge keys off the sound, play/pause, the rate, the duration landing,
and the store's `seekNonce`, which every discontinuous playhead move stamps
(a scrub, a clip start, a boundary park, a restart). Verified on simulator:
Control Center's card carries the artwork, both text lines and a progress
bar that advances between screenshots off a single publish; seven publishes
across a whole play/skip/pause session, none from ticks. What the simulator
cannot show is the island pill itself and remote button presses (its card
renders non-interactive) — check both on hardware.

**TWO THINGS THE FIRST CUT GOT WRONG, both found on Juan's device and both
about the CONTRACT rather than the drawing** (2026-08-26):

- **The button set is decided by what you DISABLE.** The library enables all
  seven remote commands in its own `initializeWithOptions`, and iOS gives the
  outer slots to skip-forward/back whenever those are enabled alongside
  next/previous track — so the island shipped with a ±15s pair on a music
  player whose own transport has prev/next. `REMOTE_CONTROLS` now states
  `skipForward`/`skipBackward` as `false`; every `true` in that list is a
  no-op restating a default, and the disables are the whole point. They are
  also applied ONCE AT MOUNT, before any metadata: the command centre decides
  which controls exist and the now-playing info fills them, and wiring it the
  other way round left the first rendered session holding the defaults.
- **`speed` must be 0 when paused, and it is the only pause signal that
  reaches iOS.** It maps to `MPNowPlayingInfoPropertyPlaybackRate`, which is
  what the system interpolates its own playhead from, so publishing the app's
  rate setting (1 by default) while paused told it to keep counting — on
  device the Lock Screen player ran to the end of the track and sat there
  showing a playing glyph over silence. The `state` field cannot cover for
  it: the library reads `_currentInfo[@"state"]` but only stores keys present
  in its `NOW_PLAYING_INFO_KEYS` map, and `state` is not one, so its
  `playbackState` write is dead code upstream.

**EVERY COMMAND THE LIBRARY CAN EMIT IS ANSWERED, INCLUDING THE ONES WE
DISABLE** (2026-08-26). The disable above is a REQUEST about which buttons
exist, not a guarantee: on device the ±15 pair survived it and then did
nothing when pressed — a control the system draws and the app ignores, which
is worse than either alternative and is the one state that must never ship.
`skipForward` / `skipBackward` are handled now, seeking by the event's own
`MPSkipIntervalCommandEvent.interval` so our number cannot disagree with the
one iOS drew inside the glyph. If the disable does take, they simply never
fire. The bridge listens for all seven events the library can emit; it
listened for five, and the two it skipped were exactly the two iOS chose to
draw.

**NEITHER IS SIMULATOR-VERIFIABLE, AND THAT IS THE LESSON.** The sim draws no
island, a blank Lock Screen player, and a Control Center card too blurred to
read a glyph from — and it freezes the paused playhead correctly even when
rate 1 is published, which is exactly why the first pass passed. What CAN be
verified there is the contract: every `enableControl` resolving (all seven,
including the two `false`) and the published payload itself
(`speed=1 state=playing` → `speed=0 state=paused elapsed=32.1` → `speed=1
state=playing elapsed=32.1` across a play/pause/resume). Verify the payload
on the simulator; verify the PIXELS on hardware. **Android was wired
2026-08-28** — the same manager, a `POST_NOTIFICATIONS` request made on the
first loaded sound rather than at launch, and the same `REMOTE_CONTROLS` set.
It is verifiable far better than iOS's is, because `adb shell dumpsys
media_session` prints the session's real metadata and action bitmask:
`metadata: size=` counts the keys it carries (5 with artwork, 4 without) and
`actions=` is non-zero only if the control set actually took.

**AN EMPTY ARTWORK MEANS REMOVE, AND THAT TOOK AN OVERLAY** (2026-09-11). A
sound with no cover used to inherit whichever cover was published last — sound
1's artwork under sound 2's title, on the island, the Lock Screen and the
shade. A now-playing publish is a **PATCH, not a PUT**, on both platforms, so
OMITTING the key changed nothing: iOS merges over the centre's existing
dictionary, Android holds the decoded bitmap in a field that outlives the
track, and `""` / `null` both fell through to a load that failed and left every
field standing. Nothing a caller could send cleared it short of `hide()`, which
on Android releases the MediaSession and zeroes the control bitmask. The bridge
now publishes `artwork: ''` and
[`patches/react-native-audio-api`](../../patches/react-native-audio-api/README.md)
makes that mean REMOVE on both sides, with a generation counter so a late
artwork load cannot land on a session that has moved on. What the emptied slot
falls back to is each platform's own art-less placeholder — what Music and
Podcasts show, and what this app already showed for a sound that never had a
cover, so both cover-less cases finally agree.

**EVERY PUBLISH GOES THROUGH ONE QUEUE, BECAUSE THE LIBRARY IS NOT
THREAD-SAFE** (2026-09-14). `show`, `hide` and `enableControl` are all one
native call, and on iOS that call hands its work to
`dispatch_get_global_queue` — a CONCURRENT queue — then returns. So two JS
calls made in the same tick really do run on two threads, over a plain
`NSMutableDictionary`: the registry's `_notifications[key] = notification` on
the first publish, and `_currentInfo[key]` on every one after. That corrupts,
and it corrupts as a **SIGSEGV rather than an exception** —
`EXC_BAD_ACCESS` at `0x0` inside
`-[__NSDictionaryM setObject:forKeyedSubscript:]`, or an over-release in
`objc_release` while the pool drains.

This bridge was the thing firing the storm: loading a sound turns `hasCurrent`
true and lands `current` in the same commit, so seven un-awaited
`enableControl` calls and one metadata publish went out together — eight
blocks racing to create the one notification object. It took the app down five
times in one evening's testing, always while the player expanded, and never
twice in a row, because it needs two of the eight to actually collide.

`enqueuePublish` chains them, which also makes REAL the ordering the file
already argued for — the button set before the first metadata publish. Proved
by experiment on iPhone 17 / iOS 26.5: thirty parallel `show()` calls crash on
the first tap, the same thirty through the queue do not, and the log then shows
exactly one "Created notification" on one thread. **Never call
`PlaybackNotificationManager` directly** — a single un-queued call anywhere
brings the race back, and nothing in the toolchain will tell you.

Account deletion now sweeps the Cloudinary media too — `cleanupAccountMedia`
before the Firestore sweep, best-effort. It was the last of the three orphan
doors; see the worker note above for what is still un-deployed.

**Account deletion is `hooks/useDeleteAccount` on iOS** — re-auth FIRST, then the
Firestore sweep, then the Apple token revoke, then the Auth user. Android calls
the combined `deleteAccount` and has no re-auth. Its sweep silently deleted no
songs or clips until 2026-08-20 (wrong collection paths that were still legal
paths); the refs now mirror `songs.ts` / `clips.ts` exactly, and any new
subcollection has to be added there or a recreated account inherits it.

**The brand has landed** — the deferral is over. The mark is a **five-bar
equalizer** (`src/components/ui/BrandMark.tsx`), the shape of sound being
tuned: a 48-unit grid at stroke 3.25 with round caps and no fill, a sibling to
Topper's crown and the starter's bento by construction. Its bars are uneven on
purpose — rise, dip, peak, settle — rather than a symmetric curve, so the glyph
reads as audio rather than as a chart.

It is wired everywhere the family expects: `assets/AppIcon.icon` (the Icon
Composer document iOS renders itself, so the shine, the squircle and the
tinted/clear appearances all come from the OS), `icon.png`, both splash glyphs
and the Android adaptive set — all generated by `scripts/gen-brand-art.py`, and
the Welcome hero passes it through `WelcomeScreen`'s `logo` prop. Never
hand-edit any of those outputs; the runbook is in the root `AGENTS.md`.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing native code. `@expo/ui` (Jetpack Compose + SwiftUI) markdown snapshots
live in [`../../docs/expo-ui/`](../../docs/expo-ui) — they were
`apps/expo-ui-starter/docs/` until that app was removed from the portfolio on
2026-09-16. The installed TypeScript types under `node_modules/@expo/ui` are the
source of truth when the docs disagree.

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
