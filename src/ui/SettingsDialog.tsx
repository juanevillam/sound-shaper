import React from 'react';

import {
  BasicAlertDialog,
  Column,
  Row,
  Surface,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { dialogContainer } from './settingsGroup';

/**
 * THE HAND-BUILT SETTINGS DIALOG'S SHELL — Material's settings-dialog idiom
 * stated once: a `Surface` on `dialogContainer` at `DIALOG_WIDTH`, clipped to
 * the extra-large corner, a `headlineSmall` title, the caller's body, and a
 * trailing end-aligned action row.
 *
 * It exists because the idiom had been copied three times — the radio picker
 * (`SettingsScreen`), the username dialog (`SettingsAccountSection`) and
 * Topper's delete-account dialog — each carrying its own 312, its own
 * `RoundedCorner(28)` and its own title and action-row paddings, which is
 * exactly the drift the grep-first rule exists to stop (the delete dialog HAD
 * drifted: `tonalElevation` for a container, an inherited Cancel colour).
 *
 * A hand-built dialog is still the EXCEPTION: it earns its place only when
 * the body is content M3's real `AlertDialog` cannot hold (a radio list, a
 * text field, a countdown CTA). A plain confirm stays
 * `DestructiveConfirmDialog`, which is the platform's own component.
 *
 * Mount in its own `Host` — a dialog beside other Compose content corrupts
 * sibling modifiers (clip shapes mis-assign on unmount).
 */

/** One width for every hand-built settings dialog. */
export const DIALOG_WIDTH = 312;
/** M3's extra-large shape — what `AlertDialog` itself is clipped to. */
const DIALOG_CORNER = 28;

export function SettingsDialog({
  title,
  colors,
  onDismissRequest,
  children,
  actions,
}: {
  title: string;
  colors: { onSurface: string; surfaceDialog: string };
  /** Scrim/back dismissal — gate it here (e.g. while busy), not in the body. */
  onDismissRequest: () => void;
  /** The dialog's body, laid out by the caller (list, field, message…). */
  children: React.ReactNode;
  /** The trailing action row's buttons, leading-to-trailing. */
  actions: React.ReactNode;
}) {
  return (
    <BasicAlertDialog onDismissRequest={onDismissRequest}>
      <Surface
        color={dialogContainer(colors)}
        modifiers={[
          width(DIALOG_WIDTH),
          clip(Shapes.RoundedCorner(DIALOG_CORNER)),
        ]}
      >
        <Column modifiers={[fillMaxWidth()]}>
          <Text
            color={colors.onSurface}
            style={{ typography: 'headlineSmall' }}
            modifiers={[padding(24, 24, 24, 16)]}
          >
            {title}
          </Text>
          {children}
          <Row
            horizontalArrangement="end"
            modifiers={[fillMaxWidth(), padding(24, 8, 16, 12)]}
          >
            {actions}
          </Row>
        </Column>
      </Surface>
    </BasicAlertDialog>
  );
}
