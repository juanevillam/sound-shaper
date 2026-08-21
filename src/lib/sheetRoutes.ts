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
   * close glyph this table's `titled` branch supplies by default.
   */
  titled?: boolean;
  /** Translation key for the bar's title. Required when `titled`. */
  titleKey?: string;
}> = [
  { name: 'sound-info', detents: 'fitToContents' },
  // A native SwiftUI `Form` is a scroll container with no intrinsic height —
  // under `fitToContents` the sheet hugged the header and the form rendered
  // 0pt tall. A fractional detent gives it a definite box, and a large sheet
  // is the iOS idiom for an editor anyway.
  {
    name: 'edit-sound',
    detents: [0.9],
    titled: true,
    titleKey: 'app.songEdit',
  },
  // Native `Form` — see the edit-sound note; a scroll container has no
  // intrinsic height, so no fitToContents.
  {
    name: 'shaper',
    detents: [0.9],
    titled: true,
    titleKey: 'player.shape.title',
  },
  // Native `Form` — see the edit-sound note; a scroll container needs a
  // definite height, so no fitToContents.
  {
    name: 'clips',
    detents: [0.6],
    titled: true,
    titleKey: 'player.clips.title',
  },
  { name: 'trophy-detail', detents: 'fitToContents' },
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
 * and made the same call; see its `IOS_SHEET_SCREENS` for the rejected
 * alternative.
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
    // already are. Android keeps the longer title, because there it really is
    // one row labelled "Manage Account" inside Settings.
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
