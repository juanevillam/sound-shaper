import { Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { useAppTheme } from '@portfolio/core';

/**
 * A FAILURE REPORTED INSIDE A COMPOSE SHEET, BECAUSE THE TOAST CANNOT BE SEEN
 * FROM IN THERE.
 *
 * `@expo/ui`'s `ModalBottomSheet` is Material 3's, which presents in its own
 * DIALOG WINDOW (`ModalBottomSheetProperties`) — so the app's snackbar, which
 * lives in the RN root, draws BEHIND it. An RN view cannot be raised over
 * another window; there is no z-order fix, and iOS's answer (`SnackbarOutlet`,
 * which re-homes the toast into the presenting surface's own tree) has no
 * Android equivalent inside a Compose window.
 *
 * Verified on the A54 2026-08-28: a delete fired from an open Clips sheet
 * removed its row and showed nothing at all. It was not a new bug — that
 * sheet's `clip-deleted` toast had never been visible in its life, and nobody
 * had looked.
 *
 * SO THE SPLIT IS BY WHETHER THE SHEET SURVIVES THE ACTION, and only one half
 * needs this component:
 *
 * - **The sheet is going away** (a save that commits, a delete that dismisses):
 *   hide it FIRST and let the toast land on whatever is behind. That is
 *   already Topper's `ReportSheet` idiom — `hide()`, `onClose()`, then
 *   `showSnackbar` — and it is what every close path here now does.
 * - **The sheet stays open** (a save that failed, so the person's input must
 *   survive to be retried): the failure has to be said IN the sheet. That is
 *   this.
 *
 * Material's own answer for a transient failure is a snackbar, which is exactly
 * what is unavailable; an inline error line under the content is what M3 uses
 * where a container has to carry its own error, and it is the same `danger` ink
 * the fields' supporting text already speaks.
 *
 * IT MOVED HERE THE DAY TOPPER TOOK IT (2026-08-28), which is how
 * `SHEET_CONTENT_TOP` and `GROUPED_ROW` both got here too. It was app-local
 * while Sound Shaper was its only caller and the note said exactly that.
 *
 * It reads the palette from `@portfolio/core` rather than taking `colors` as a
 * prop: every app's `useAppTheme` is a pure re-export of that hook, so this is
 * the same theme they resolve and not a second one — the same call `EmptyState`
 * makes one file over.
 */
export function SheetErrorLine({ message }: { message: string }) {
  const { colors } = useAppTheme();

  return (
    <Text
      color={colors.danger}
      style={{ typography: 'bodySmall' }}
      modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
    >
      {message}
    </Text>
  );
}
