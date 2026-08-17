import { useState } from 'react';

import { Alert, Button, TextField, useNativeState } from '@expo/ui/swift-ui';

import { type SettingsUsernameEditor } from './SettingsAccountSection';

/**
 * Wraps any Form row so tapping it opens the native "choose a username" alert —
 * the `UIAlertController` idiom, which is the iOS equivalent of the Android
 * text dialog.
 *
 * ONE implementation, two call sites. It used to live inline in
 * `SettingsAccountSection.ios`, wrapped around the identity row; when the
 * username moved out of Settings and into Manage account's read-only Username
 * row, the choice was to copy it or to extract it. Copying is how the two
 * would drift — the alert has non-obvious behaviour (below) that a second copy
 * would not carry.
 *
 * An iOS alert ALWAYS dismisses when an action is tapped, so a rejected submit
 * cannot hold it open the way Android's dialog does. It is re-presented
 * instead, and because the field's text lives in native `ObservableState` the
 * attempted value is still there — the user corrects rather than retypes. The
 * error copy itself surfaces through the app's own channel (snackbar).
 */
export function UsernameEditRowIos({
  editor,
  children,
}: {
  editor: SettingsUsernameEditor;
  /**
   * The row that presents the alert — rendered inside `Alert.Trigger`.
   *
   * `ReactElement`, not `ReactNode`: `Button`'s children are typed as elements
   * (a native trigger has to be exactly one view), and `ReactNode` admits
   * `null`, so the wider type failed to assign. It was never called with
   * anything but a single element.
   */
  children: React.ReactElement;
}) {
  const [visible, setVisible] = useState(false);

  const initial = editor.currentValue?.replace(/^@/, '') ?? '';
  const text = useNativeState(initial);
  const [draft, setDraft] = useState(initial);

  return (
    <Alert
      title={editor.dialog.title}
      isPresented={visible}
      onIsPresentedChange={setVisible}
    >
      <Alert.Trigger>
        <Button onPress={() => setVisible(true)}>{children}</Button>
      </Alert.Trigger>
      <Alert.Actions>
        <TextField
          text={text}
          placeholder={editor.dialog.fieldLabel}
          onTextChange={setDraft}
        />
        <Button
          label={editor.dialog.cancel}
          role="cancel"
          onPress={() => setVisible(false)}
        />
        <Button
          label={editor.dialog.confirm}
          onPress={() => {
            void editor.onSubmit(draft.trim()).catch(() => setVisible(true));
          }}
        />
      </Alert.Actions>
    </Alert>
  );
}
