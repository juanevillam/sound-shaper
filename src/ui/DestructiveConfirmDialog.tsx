import { AlertDialog, Text, TextButton } from '@expo/ui/jetpack-compose';

/** Copy for a destructive confirmation dialog. */
export type DestructiveConfirmDialogContent = {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
};

export type DestructiveConfirmDialogProps = {
  dialog: DestructiveConfirmDialogContent;
  colors: { danger: string; primary: string; surfaceDialog: string };
  /** Disables both actions and blocks dismissal while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * The one confirmation dialog for destructive actions (sign out, delete a
 * top, delete an item, …): Material `AlertDialog` with the confirm action in
 * the danger color. Android (Jetpack Compose) only — the iOS twin is
 * `confirmDestructiveIos`, an `Alert.alert` fired from the action's own
 * handler, so there is no mounted-while-visible component to mirror. A SwiftUI
 * `ConfirmationDialog` is NOT the iOS answer and was measured out twice: one
 * mounted with `isPresented` already true loses the presentation race and never
 * shows (simulator-verified 2026-07-04), and one kept mounted behind a trigger
 * presents as a mis-anchored POPOVER with no Cancel button inside a form sheet
 * (device-verified 2026-08-25 — the full account is on `SettingsSignOutSection`,
 * the last surface that used it). Mount this Android dialog in its own `Host`:
 * dialogs sharing a Host with other content corrupt sibling modifiers and
 * flicker icons.
 */
export const DestructiveConfirmDialog = ({
  dialog,
  colors,
  busy = false,
  onConfirm,
  onDismiss,
}: DestructiveConfirmDialogProps) => (
  <AlertDialog
    // The same container the two hand-built dialogs paint, so the app's three
    // dialogs are one surface. Left to itself this draws M3's
    // `surfaceContainerHigh`, which is 32.6 L* off the page on a One UI palette
    // — see `dialogMaterial` in `src/core`.
    colors={{ containerColor: colors.surfaceDialog }}
    onDismissRequest={() => {
      if (!busy) onDismiss();
    }}
  >
    <AlertDialog.Title>
      <Text>{dialog.title}</Text>
    </AlertDialog.Title>
    <AlertDialog.Text>
      <Text>{dialog.message}</Text>
    </AlertDialog.Text>
    <AlertDialog.ConfirmButton>
      {/* THE DANGER COLOUR IS THE BUTTON'S `contentColor`, NOT THE LABEL'S.
          Stated on the `Text` it survived `enabled={false}`: an explicitly
          coloured child wins over the container's disabled content colour, so
          a dialog that had gone busy still drew Delete at full strength while
          Cancel beside it dimmed correctly. Measured on the A54 in dark —
          Cancel (181,196,250) → (119,119,122), Delete (233,186,183) →
          (233,186,183), i.e. no change at all.

          The fix is the answer Cancel already used three lines down, which is
          also the rule: let the framework do the disabling and never hand-paint
          a dimmed colour. */}
      <TextButton
        colors={{ contentColor: colors.danger }}
        enabled={!busy}
        onClick={onConfirm}
      >
        <Text>{dialog.confirm}</Text>
      </TextButton>
    </AlertDialog.ConfirmButton>
    <AlertDialog.DismissButton>
      {/* Content colour stated, not inherited — see the note on the radio
          dialog's Cancel in `SettingsScreen`. */}
      <TextButton
        colors={{ contentColor: colors.primary }}
        enabled={!busy}
        onClick={onDismiss}
      >
        <Text>{dialog.cancel}</Text>
      </TextButton>
    </AlertDialog.DismissButton>
  </AlertDialog>
);
