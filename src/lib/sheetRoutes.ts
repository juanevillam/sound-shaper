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
}> = [
  { name: 'sound-info', detents: 'fitToContents' },
  { name: 'edit-sound', detents: 'fitToContents' },
  { name: 'shaper', detents: 'fitToContents' },
  { name: 'clips', detents: 'fitToContents' },
  { name: 'trophy-detail', detents: 'fitToContents' },
];

/** Focused-pathname forms of the sheet routes (the (app) group is elided). */
export const IOS_FORM_SHEET_PATHS: ReadonlySet<string> = new Set(
  IOS_FORM_SHEETS.map(sheet => `/${sheet.name}`),
);
