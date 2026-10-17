/**
 * The iOS-only native form-sheet routes ((app) group), each with its detents —
 * the ONE list both consumers read, so they can never drift (Topper's idiom):
 *
 * - `(app)/_layout` maps it into the `Stack.Screen` sheet entries;
 * - `useIosSheetPresented` matches the focused pathname against it to pause
 *   the trophy overlay (a native sheet covers the RN root, so a banner popping
 *   under one would be invisible).
 *
 * Android never navigates to these routes — it presents the same surfaces as
 * Compose ModalBottomSheets mounted in-place — so this list is iOS-only truth.
 */
export const IOS_FORM_SHEETS: ReadonlyArray<{
  name: string;
  detents: 'fitToContents' | number[];
  /**
   * Give the sheet a real UIKit navigation bar — an inline title plus glass
   * bar glyphs — instead of letting the screen draw its own heading in RN.
   *
   * TOPPER'S STANDARD, adopted here 2026-08-21. The three player editors drew
   * an authored header row above their Form (`SheetFormIos`), and that
   * arrangement cannot have genuine Liquid Glass: nothing ever scrolls behind
   * an `HStack` that owns its own layout row, so its "glass" circles render
   * flat. It also carried a FILLED PRIMARY DISC for ✓ — the nesting artifact
   * Juan rejected on sight in Topper, recorded in `SheetFormIos`'s own
   * docstring and in `docs/pending-upstream.md`.
   *
   * Titled sheets state their bar through `sheetCommitBarOptionsIos` (a
   * commit-modal pair) or their own `Stack.Screen` slots, which override the
   * close glyph this table's `titled` branch supplies by default. `shaper`
   * overrides NOTHING: nothing on it commits, so the plain close glyph is the
   * whole bar — Apple's split between a commit modal and a panel that applies
   * as you go (see `HeaderCloseButtonIos`).
   */
  titled?: boolean;
  /** Translation key for the bar's title. Required when `titled`. */
  titleKey?: string;
}> = [
  /**
   * CONTENT-SIZED — measured, not defaulted (Topper's two editors set the
   * standard).
   *
   * A native SwiftUI `Form` is a scroll container with no intrinsic height, so
   * `fitToContents` hugs the header and renders the form 0pt tall; a fractional
   * detent is the only way to give it a definite box. It sat at a flat 0.9 with
   * the note "a large sheet is the iOS idiom for an editor anyway", which is a
   * default rather than a size.
   *
   * RE-MEASURED 2026-08-21, when the form lost two of its four fields (Album
   * and Release Year went with the info sheet — the app does not handle
   * either). At 0.8 the sheet then spanned 235.67 → 874 against content ending
   * at 709.33: 164.67pt of empty sheet, which is worse than the 144 that got
   * the size measured the first time.
   *
   * Content is 474.00pt from the sheet's own top edge.
   *
   * A DETENT FRACTION IS NOT A FRACTION OF THE SCREEN, which is what makes this
   * worth solving rather than guessing. Two measured points on this device —
   * 0.8 → 638.33pt tall, 0.6 → 489.00 — give `height ≈ 746.67 × f + 41`, so a
   * fraction read as "0.6 of 874" overshoots by 35pt and 0.6 landed the
   * destructive row 15pt off the screen edge, under the home indicator. 0.65
   * gives 526.3: last ink at 821.7, and what remains below is the 34pt
   * indicator plus ~18 of air.
   *
   * Re-measure again if the form gains or loses a row — it is two fields, a
   * media slot and a destructive section today. The first measurement is worth
   * keeping as a worked example: at a flat 0.9 the sheet spanned 164 → 874 with
   * the last ink at 730.
   *
   * KNOWN, ACCEPTED TRADE — the fractional-detent DIMMING: below the large
   * detent iOS keeps the presenting window
   * primary and renders the sheet's SwiftUI in the inactive appearance. The
   * shaper is at [1] BECAUSE it is a primary surface; an editor is not.
   */
  {
    name: 'edit-sound',
    detents: [0.65],
    titled: true,
    titleKey: 'app.soundEdit',
  },
  /**
   * FULL HEIGHT, like Settings and Account — this is a PRIMARY surface, not a
   * quick edit. It holds a preset picker, five EQ sliders, a speed slider, a
   * pitch toggle and the Echo and Next Room level pickers, most with their own
   * footnote; it scrolled at 0.9 and it will scroll at anything less than the
   * screen.
   *
   * A fractional detent also costs it the OS's sheet dimming (see `edit-sound`
   * above): below the large detent iOS keeps the presenting window primary and
   * renders the sheet's SwiftUI in the inactive appearance, so the picker's
   * value greys and the grouped fills desaturate. That is an acceptable trade
   * for a small content-sized editor. It is the wrong trade for the surface a
   * person comes here to USE.
   */
  {
    name: 'shaper',
    detents: [1],
    titled: true,
    titleKey: 'player.shape.title',
  },
  /**
   * FULL HEIGHT, because it is a LIST — and list sheets are [1]: Topper's
   * follow-list, people, trash and blocked-users all were, and blocked-users
   * stood empty more often than this one does.
   *
   * It sat at 0.6, which was sized to nothing in particular. Band-scanned on
   * iPhone 17 / iOS 26.5 with an empty list: the sheet spanned 389 → 874 and
   * its single row ended at 513, so 361pt — about three quarters of the sheet —
   * was empty. A size chosen to fit an empty list is wrong the moment the list
   * fills, and a clips list grows without a bound anyone can predict.
   *
   * The cost is honest: with no clips it is a full screen holding an empty
   * state. Topper already accepted that for blocked-users, and it buys a sheet
   * that is still right at ten clips. It also drops the fractional-detent dimming,
   * so the rows render in the active appearance.
   */
  {
    name: 'clips',
    detents: [1],
    titled: true,
    titleKey: 'player.clips.title',
  },
  { name: 'trophy-detail', detents: 'fitToContents' },
  /**
   * FULL HEIGHT — the Voice Memos-style clip editor, pushed OVER `clips` the
   * way trophies stacks over account. A zoomed waveform, an overview strip
   * and a transport are a primary editing surface, not a quick form; and the
   * fractional-detent dimming would grey the very waveform being aimed.
   * The bar (✕ leading; Shape and ✓ as one `HeaderGlyphGroupIos` trailing) is
   * built by the screen's own `Stack.Screen`, so `titled` supplies only the
   * fallback.
   */
  {
    name: 'clip-trim',
    detents: [1],
    titled: true,
    titleKey: 'player.clips.new',
  },
];

/**
 * Routes that exist on BOTH platforms but present as sheets only on iOS:
 * Settings and everything it drills into.
 *
 * Separate from `IOS_FORM_SHEETS` because Android really does navigate to
 * these — they are ordinary pushed screens in its Material stack, and their
 * `Stack.Screen` entries have to keep their Android titles. Only the iOS
 * options come from here.
 *
 * WHY THE CHILDREN ARE SHEETS TOO, and not pushes inside the Settings sheet:
 * RNScreens draws NO back button for a screen pushed on top of a `formSheet`
 * root — no chevron and no edge-swipe, so the reader is trapped one level in.
 * Stacking each child as its own sheet keeps every level dismissible and
 * returns you to the sheet below on swipe-down or close. Topper hit this first
 * and made the same call.
 *
 * All full height: each one scrolls, and a `fitToContents` sheet over a native
 * SwiftUI `Form` renders 0pt tall (the Form is a scroll container with no
 * intrinsic height — same trap as the editors above).
 */
export const IOS_SHEET_SCREENS: ReadonlyArray<{
  name: string;
  detents: 'fitToContents' | number[];
  titleKey: string;
}> = [
  { name: 'settings', detents: [1], titleKey: 'app.settings' },
  {
    name: 'manage-account',
    // "Account", not "Manage account": on iOS this IS the account surface —
    // everything account-shaped lives on it, and it is reached by tapping the
    // person themselves on Settings' identity banner, so a title telling them
    // they are about to "manage" something is the longer word for where they
    // already are. Android reaches it the same way (the identity banner, since
    // 2026-09-08) and takes the same title.
    detents: [1],
    titleKey: 'settings.account.sheetTitle',
  },
  { name: 'trophies', detents: [1], titleKey: 'trophies.title' },
];

/**
 * Focused-pathname forms of every iOS sheet route (the (app) group is elided) —
 * both families, since `useIosSheetPresented` cares only about "is a native
 * sheet covering the RN root right now".
 */
export const IOS_FORM_SHEET_PATHS: ReadonlySet<string> = new Set(
  [...IOS_FORM_SHEETS, ...IOS_SHEET_SCREENS].map(sheet => `/${sheet.name}`),
);
