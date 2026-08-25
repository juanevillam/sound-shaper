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
- **THE COVER SHRINKS TO 0.88 WHILE PAUSED**, critically damped, scaled by the
  expand ramp so it exists only on the open console. 0.94 read as a rendering
  wobble, 0.82 opened a gap under the bar row.
- **FRAMING IS A TRIM FRAME ON THE REAL SLIDER** (2026-08-23,
  `ClipTrimFrameIos`), and it took four generations in three days to land —
  read this before proposing any of the other three again. Gen 1 was two
  grip-barred pills that read as switches. Gen 2 was a proper frame on the
  slider, faulted in review for SCALE (a fifteen-second clip is ~30pt of a
  three-minute track). Gen 3 built the zoomed waveform strip that note asked
  for — RMS bars, a window of `selection ± max(5s, 0.75 × clip)`, edge-pan,
  an overview bar — and Juan rejected the zoom the same day ("the more i
  drag it the more it expands"); made STATIC, the waveform still died, as
  "two diff progress sliders… out of place" on one screen. Both are in
  docs/rejected-experiments.md. The standing conclusion: **the player has
  ONE progress surface and framing is a MODE of it** — the slider stays
  visible and interactive, its thumb stays the playhead, and the fine-trim
  cost of whole-track scale is accepted knowingly, by the person who uses
  it.

  What survived every generation is the FRAME'S TREATMENT, measured from
  Photos' video trimmer (iPhone 17 / iOS 26.5: outer 51pt, rails 5, caps
  ~14.7 wide, ~7pt outer corners, chevron ink 6 × 24 at a 3pt stroke):
  full-height caps carrying `chevron.compact.left/right` — the affordance
  gens 1–2 lacked — joined by 4pt rails, with gen 2's faint `primary` wash
  (0.16) inside as the middle drag zone's body. The box is **44pt** centred
  on the 32pt slider host (`IOS_SLIDER_HOST_HEIGHT`, in `chrome.ts`): it
  shipped at 36, the caps were fiddly to catch, and 44 is Apple's minimum
  touch target — height is the only axis a 14pt cap can grow in without the
  frame mis-stating the range it covers. NO scrim outside the selection — the
  2026-08-21 rejection is back in full force now the surface under the
  frame is a bare slider track again. NO haptics in the drag — the
  per-second buzz was rejected with the zoom ("makes the clipping
  un-usable"); Save keeps its one `haptics.selection()` at the save site.

  **THE TRIMMER ZOOMS AT THE GRAB AND PANS AT THE EDGE** (2026-08-25,
  Google Photos' model) — the answer to the SCALE problem the feature carried
  from gen 2, and the third attempt at it.
  Mapped whole, a 3-minute song is ~0.51s per point and a 6-minute one
  ~0.97s — a finger's wobble is a second or more, so long recordings were
  effectively untrimmable. The window is ~0.081s per point at ANY length;
  measured on device, a 20pt cap drag moves an edge 2s where it used to move
  ~10s.

  **THE WHOLE SOUND AT REST; ZOOMED ONLY WHILE A HANDLE IS HELD.** At rest
  the frame maps everything, so a clip can run 0:15 to 2:00 and be any
  length; grabbing a cap zooms to `CLIP_ZOOM_SPAN_S` around it and HOLDS that
  scale until the finger lifts. The slider's end labels follow the mapped
  slice, since a slider spanning thirty seconds must not be captioned with
  the song's length.

  **THE SCALE NEVER CHANGES MID-DRAG**, which is the whole difference from
  the strip rejected on 2026-08-23, whose span was a function of the
  selection and so rescaled continuously as the clip grew ("the more i drag
  it the more it expands"). Zooming AT the grab is a deliberate transition;
  rescaling DURING the drag is the ground moving under your hand.

  **A FIXED WINDOW WAS TRIED IN BETWEEN AND COULD NOT REACH.** Set once at
  entry and never moved, it was precise and stable — and could express
  neither a clip from 0:15 to 2:00 nor one longer than its own span, because
  a window that never moves bounds the clip's travel and its length. That is
  why the zoom is tied to the GESTURE rather than to the mode.

  **AUTO-PAN IS DRIVEN BY A FRAME CALLBACK, NOT BY THE GESTURE.** A gesture
  only reports while the finger MOVES, so pushing a cap to the screen's edge
  and holding stopped dead a screen-width from where it started — the first
  cut of this had `panFor` inside `onChange` and looked right until it was
  measured. `useFrameCallback` pans while a held edge sits in the margin, at
  the same scale, so travel is continuous. Verified: one gesture took a clip
  from 0:26 to 1:38, a second moved it whole to 1:57–3:09 with the playhead
  left back near 0:30.

  **IT ALSO RETIRED A HAND-DRAWN CONTROL.** At full-track scale the slider's
  36.67pt thumb was WIDER than a 15s clip's ~29pt frame, so framing briefly
  hid the native slider and drew its own track and thin playhead (Photos'
  shape, measured to 1/255). At window scale a 15s clip is ~185pt of frame
  and the native thumb sits inside it comfortably, so the imitation was
  deleted — the better fix removed the need for the workaround rather than
  polishing it. The slider stays INERT while framing, though: a native slider
  claims a touch the instant it lands, and an interactive one underneath
  stole drags aimed at the caps (reproduced twice on device).

  **[RETIRED 2026-08-25 — kept for the measurements.] THE KNOB GOES WHILE
  FRAMING, AND THE TRACK IS DRAWN.** The slider's thumb
  is a **36.67pt** disc, measured, and a fifteen-second clip on a three-minute
  track is a **~29pt** frame — so the knob was WIDER than the selection it sat
  in, covering the thing being trimmed, and its slider stole touches aimed at
  the caps (a cap drag seeked the track instead; reproduced twice). SwiftUI's
  `Slider` exposes no thumb size — `controlSize('mini')` was tried on device
  and does nothing to it — so framing hides the native slider and draws the
  same track with a thin PLAYHEAD in its place, which is what Photos' trimmer
  shows. The drawn layer is inert, so the caps now win every touch in the band.

  This is the console's one deliberate imitation of a system control, so it
  was MEASURED off the real slider (iPhone 17 / iOS 26.5, both appearances):
  track **5.67pt** tall from the host's left edge, played side `onSurface`,
  the rest `onSurface` at **0.083** light / **0.094** dark — one 0.09 covers
  both. Rendered: height 6.00 (one device pixel), origin 16.00, remaining
  within 1/255 light and 2/255 dark. The slider FADES rather than unmounting,
  or its first-frame safe-area race would re-run on every mode exit.

  **ENTERING FRAMING MOVES NOTHING**, as every generation: the frame is an
  ABSOLUTE overlay on the slider block, and the range readout is absolutely
  centred inside the elapsed/total row. Verified by band-scanning bursts
  across the mode change at every generation, most recently: transport ink
  654.33 and footer top 772.00, identical resting and framing, in both
  appearances.

  **The one thing that DOES move is the time row, on purpose, by
  TRANSFORM.** The frame's box bottom lands on the labels' ink, so a cap
  parked near a track end stood on the time under it. The row translates
  down `CLIP_LABELS_DROP` (12, for the 44pt frame — it was 8 at 36) while
  framing, animated 200ms — a designed making-room transition, not reflow: a
  transform costs no layout, so the transport and footer cannot move with
  it, and the resting row keeps its exact position. Measured after the frame
  grew: frame box 548.00–591.67, label ink top 601.67, a 10.00pt band.

  **THE RANGE READOUT IS LIVE, AND IT IS A LEAF** (`ClipRangeLabelIos`). It
  was rendered from committed `clipRange` state, so it held its old value
  for the whole drag and jumped on release — you cannot land a clip on
  1:40–2:00 when the feedback arrives after you let go. The frame's edges
  are shared values OWNED BY THE CONSOLE (two children draw from them), and
  the readout reacts to those at the leaf, so the console never re-renders —
  the same rule `PlayerScrubberLive` follows for the playhead, applied at
  gesture rate. It reacts on the ROUNDED second, which is not a throttle but
  what the label says: it re-renders only when the string would change, and
  the number you watch land is the number that saves. Verified by recording
  the screen through one continuous drag and reading the frames: 0:00–0:15 →
  0:20–0:35 → 0:48–1:03 → 1:19–1:34 → 2:18–2:33, all before the commit.

  **AND IT TAKES THE ELAPSED/TOTAL LABELS' STYLE OBJECT, FOR THE TABULAR
  FIGURES.** SF's proportional digits differ in width, so a CENTRED readout
  re-centres itself on every digit change — several times a second under a
  drag. The elapsed label was fixed for this long ago; the range label,
  written later, never picked the term up, which is the retrofit trap the
  root `AGENTS.md` names. It is handed the style OBJECT rather than
  re-declaring `fontVariant`, so the three readouts cannot drift. Measured
  across a recorded drag: ink width spread **5.00pt before, 1.00pt after**.
  What tabular figures do NOT fix is a change in digit COUNT — a sound over
  ten minutes would widen once at the 9:59 → 10:00 boundary, exactly as the
  elapsed label already does, and that is left alone.

- **THE FRAMING BAR IS CANCEL AND SAVE, AND NOTHING ELSE** (2026-08-23), in
  the same glass box (`MINI_PLAYER_HEIGHT`, `FLOATING_RADIUS`): Cancel as a
  plain word leading, Save as the filled brand pill trailing.

  **IT HELD A THIRD CONTROL FOR A DAY AND THAT WAS THE DEFECT.** A preview
  play glyph sat dead centre here while the TRANSPORT's own play sat ~130pt
  directly above it — the same triangle, on the same centre line, meaning two
  different things. Juan read it as "seeing the player controls twice", which
  is what it was. **PREVIEW IS NOW WHAT THE TRANSPORT'S PLAY DOES WHILE
  FRAMING**, so the screen carries exactly one play control, and this bar is
  left with the two actions that are genuinely its own. Apple ships the same
  split: Photos and Voice Memos put a single play beside the trim surface and
  leave the bar to Cancel and the commit.

  Two things that fall out of it, neither of which needed new state. The two
  SKIPS fade out for the mode — they would leave it anyway, since a sound
  change drops the frame — and the row keeps its height, so the fade cannot
  move the play button beside them. And the GLYPH already tracks `playing`,
  which a preview sets too, so the rule is simply "sounding → pause it,
  silent → play the clip"; that stays honest when framing is entered
  mid-song, where a play glyph over audible sound would have been a lie.
  Band-scanned across mode entry, 7 frames: play ink 654.00–689.67, bar top
  772.00, identical resting and framing.

  A GIGA GLASS BAR swallowing the transport was the other proposal and was
  rejected: it moves the transport on mode entry (the invariant), makes a
  ~180pt panel out of a toolbar the floating-surface family sizes as a bar,
  and does not remove the duplicate play by itself. What it replaced mixed four treatments in
  one row — grey ✕, muted "New Clip" caption, tinted word, filled pill — and
  the muted caption read as disabled text. Photos titles its trim mode
  nowhere: the frame on the slider explains the mode, so the caption went with
  the ✕. The glyph answers the preview's own state read at the leaf
  (`playing && activeClip 'preview'`), so it pauses a running preview; the
  `player.clips.new` key survives — Android's row and the Clips sheet read it.

Band-scanned on iPhone 17 / iOS 26.5, identical across an 8-frame burst with no
interaction: bar glyph ink 79.00, artwork 119.00 (inset 62 + target 43 + gap
14), footer 766.00 → 827.00, clearance below 47.00 (inset 34 +
`FLOATING_EDGE_GAP` 12). Cover 369.00 wide playing, 324.00 paused, centre held.
A LIVE appearance switch reads the same numbers, which is the proof the
`matchContents` header jump is gone.

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
`playerArtTop` clears a 24pt gap instead of `PLAYER_BAR_TARGET + 14` — which is
where the transport and the footer wanted it.

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

So the compartment is sized to what it HOLDS, which is what a toolbar does, and
its two pieces are STACKED — the icon in the cards' label band, the word in
their summary band — so the cell fills the bar's vertical rhythm instead of
sitting between its two rows.

**IT WAS A ROW FIRST, AND THAT IS THE INSTRUCTIVE FAILURE.** Laid out
horizontally, its one word landed at 791.67 → 804.33 against the cards' label
781.33 → 796.67 and summary 804.00 → 815.00. Centred on the two-line block to
within 0.17pt — mathematically correct, optically homeless: 10.3 below the
labels, and its baseline exactly where the summaries begin. Juan read it as a
break in the bar's vertical flow before any of it was measured, and he was
right. **Centring a one-line cell beside two-line ones is not alignment.**

**THE BANDS ARE SOLVED BACKWARDS FROM THE CARDS, not centred and hoped for.**
The label band's ink centre is 789.00 and the summary band's is 809.50, in a bar
whose content starts at 764. The icon's host is 31 and the glyph centres in it,
so the host's top is 789.00 − 15.5 = **773.50**, i.e. `GLASS_EDIT_ICON_TOP` 9.5
below the bar's top. The caption is the summaries' own `bodyMedium`, whose 20pt
line box wants its top at 809.50 − 10 = 799.50 — **5 above** the icon host's
bottom of 804.50, hence `GLASS_EDIT_CAPTION_LIFT` −5. Rendered: icon ink centre
789.17 against the label's 789.00, caption centre 809.00 against the summary's
809.50. A 12pt `caption1` was tried for the word first (the tab-bar treatment)
and read undersized beside "None" and "1 saved"; matching the band's type fixes
that and the alignment together.

**THE TRAILING SIDE TAKES `opticalTextInset`; THE LEADING SIDE DOES NOT — so the
two ends are deliberately UNEQUAL in metric to be equal to the eye.**
Band-scanned, they were already equal in metric: the leading icon's ink starts
19.67 inside the bar and the word ended 19.00 from it, 0.67pt apart. Juan still
read the right as tighter, and both reasons are real. The bar's FIRST ink is a
sparse glyph at the bar's vertical middle, where the edge is at its full 385.67.
Its LAST ink is a dense letterform down in the summary band, where the 22pt
corner has begun pulling in — 385.67 at the word's top, 385.00 at its baseline,
383.33 eight points lower.

That is precisely the case `opticalTextInset` names ("text set flush to the
shape's true edge reads as hanging past it even though the two are
mathematically aligned"), so the word takes the nudge derived from
`FLOATING_RADIUS` — round(22 × 0.215) = 5 — and the icon, which sits nowhere
near a corner, does not. Rendered: leading 19.67, trailing 24.00. The cards give
up 2.5 each for it, leaving a 55.5 copy box against "Flat · 1×"'s 50.67.

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

**The long form still truncates and that is accepted.** "Bright · 1.5×" needs
more than 65.33. Truncation is what `numberOfLines={1}` is for, the label above
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
graph — an automatic headroom trim + 5 biquad EQ bands (`src/lib/audioEngine.ts`,
`src/lib/eqResponse.ts`,
`src/components/player/AudioEngine.tsx`, shaper settings in
`src/store/shaper.ts`) — with speed presets 0.5–2×, keep-pitch (ON by default,
over a patched stretcher — see the stretcher note above), clips (personal
replay bookmarks), and background playback via the plugin's media foreground
service.

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
