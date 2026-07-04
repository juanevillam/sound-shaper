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
  colors: { danger: string };
  /** Disables both actions and blocks dismissal while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * The one confirmation dialog for destructive actions (sign out, delete a
 * top, delete an item, …): Material `AlertDialog` with the confirm action in
 * the danger color. Android (Jetpack Compose) only — an `.ios` variant with
 * this same mounted-while-visible API is NOT possible: a SwiftUI
 * `ConfirmationDialog` mounted with `isPresented` already true loses the
 * presentation race and never shows (simulator-verified 2026-07-04). On iOS,
 * inline a `ConfirmationDialog` that stays mounted, with its trigger button
 * as `ConfirmationDialog.Trigger` — see `SettingsAccountSection.ios.tsx` for
 * the verified pattern. Mount this Android dialog in its own `Host`: dialogs
 * sharing a Host with other content corrupt sibling modifiers and flicker
 * icons.
 */
export const DestructiveConfirmDialog = ({
  dialog,
  colors,
  busy = false,
  onConfirm,
  onDismiss,
}: DestructiveConfirmDialogProps) => (
  <AlertDialog
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
      <TextButton enabled={!busy} onClick={onConfirm}>
        <Text color={colors.danger}>{dialog.confirm}</Text>
      </TextButton>
    </AlertDialog.ConfirmButton>
    <AlertDialog.DismissButton>
      <TextButton enabled={!busy} onClick={onDismiss}>
        <Text>{dialog.cancel}</Text>
      </TextButton>
    </AlertDialog.DismissButton>
  </AlertDialog>
);
