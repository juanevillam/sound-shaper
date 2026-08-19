import { Alert } from 'react-native';

/**
 * THE ONE DESTRUCTIVE CONFIRMATION ON iOS — a native two-button alert, with
 * the house rules in one place.
 *
 * Android has had `DestructiveConfirmDialog` for this since it was written;
 * iOS had TEN hand-rolled `Alert.alert` calls of the identical shape (delete a
 * top, delete an item, empty the trash, delete forever, block a person, delete
 * the account — twice). Ten copies of a rule is ten chances for the eleventh
 * to be written without it, and it very nearly was: `isPreferred` below was
 * missing from all ten.
 *
 * CANCEL IS THE PREFERRED ACTION, and that is the one thing this adds beyond
 * what the copies did. Apple BOLDS an alert's preferred action, and in a
 * destructive alert the preferred action is the safe one — deleting a note,
 * a photo or a message all bold Cancel while the red verb stays plain. Without
 * it both buttons read at the same weight and the destructive one sits where a
 * reflex tap lands (right, in a side-by-side pair). `Alert` has no disabled
 * state and no countdown, so this weight is the whole of iOS's cool-off, and
 * it is the platform's own.
 *
 * NOT A `ConfirmationDialog`. SwiftUI's own would put the choice in a sheet
 * sliding up from the bottom, which is right for a menu of options and wrong
 * for a yes/no on something irreversible; Apple uses an ALERT for those, and
 * an alert is what `Alert.alert` renders.
 */
export const confirmDestructiveIos = ({
  cancelLabel,
  confirmLabel,
  message,
  onConfirm,
  title,
}: {
  /** Already-translated (the package has no translator). */
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
}): void =>
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', isPreferred: true },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
