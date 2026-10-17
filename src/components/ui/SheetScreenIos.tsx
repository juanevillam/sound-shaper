import { type ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

// DEV LAB — these imports and the picker below go with `src/dev`.
import { UI_STATE_LAB, type LabScreen } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { SnackbarOutlet } from '@/ui';

/**
 * THE ROOT OF A FULL-HEIGHT iOS FORM SHEET — one definition, for every route
 * that presents as one.
 *
 * A BARE VIEW, deliberately NOT this app's `Screen`, which paints
 * `colors.background`. Inside a form sheet that is the wrong colour: the sheet
 * is already painted by `sheetOptions`' `contentStyle` (`colors.sheet`), and
 * covering it makes those sheets read DARKER than every other one in dark mode.
 * The shared `SettingsScreen.ios` is the reference — it wraps in the package's
 * `Screen` with NO backgroundColor for exactly this reason, letting the sheet's
 * own colour through.
 *
 * The `fitToContents` sheet (`trophy-detail`) is NOT this: it hugs its
 * content, paints `colors.sheet` itself because nothing else fills the box, and
 * carries its own centred padding.
 */

/**
 * WHAT A TOAST CLEARS INSIDE A SHEET — nothing but the home indicator, which
 * the toast's own `SafeAreaView` already adds. The app's default (76) exists to
 * clear the floating player banner, and a sheet covers that banner completely,
 * so a toast in here would otherwise float 76pt above nothing.
 */
export const SHEET_TOAST_INSET = 16;

/**
 * THE FAMILY'S SHEET GEOMETRY, re-exported so this app's sheets keep importing
 * it from the component they already import — the definitions live in
 * `src/ui`/sheetMetrics`, because `SheetFormIos` is in that
 * package and the editors need the same numbers.
 *
 * `SHEET_BONE_TOP` is the alias for `SHEET_CONTENT_TOP`: where a bone stands
 * and where content starts are one question.
 */
export {
  SHEET_CONTENT_TOP as SHEET_BONE_TOP,
  SHEET_EMPTY_HEADER_SLOT,
} from '@/ui';

export function SheetScreen({
  children,
  screen,
}: {
  children: ReactNode;
  /** Which dev-lab group this sheet's picker shows. Omit for a sheet with no
   *  lab states of its own. */
  screen?: LabScreen;
}) {
  return (
    <View style={styles.sheet}>
      {children}
      {/* DEV LAB: state picker. Delete with `src/dev`. */}
      {UI_STATE_LAB && screen ? <UiStateLabBar screen={screen} /> : null}
      {/* LAST, so it paints above the dev lab bar as well as the sheet's own
          content.

          THE APP'S TOAST, RENDERED HERE WHILE THIS SHEET IS ON TOP. A sheet is
          presented above the root view, so a toast left at the root draws
          BEHIND it and is never seen — every message this family fires (a sound
          saved or deleted, a shape created, a clip removed, a failed account
          deletion) was invisible. `SnackbarOutlet` moves the same node into
          this tree, where the SwiftUI glass host works exactly as it does for
          the native forms these sheets already draw. See that component for the
          measurements. */}
      <SnackbarOutlet iosBottomInset={SHEET_TOAST_INSET} />
    </View>
  );
}

const styles = StyleSheet.create({
  // No background: the sheet's own `contentStyle` is the surface (see above).
  sheet: { flex: 1 },
});
