import { useState } from 'react';

import {
  Alert,
  Button,
  ConfirmationDialog,
  HStack,
  Image,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { type SettingsAccountSectionProps } from './SettingsAccountSection';

/**
 * iOS counterpart of `SettingsAccountSection`. Same prop API as the Android
 * (Jetpack Compose) variant, rendered as a native `Form`/`List` section: an
 * optional profile row, optional navigation rows, then a red destructive
 * sign-out row confirmed through an action sheet, then optional destructive
 * rows — the standard Apple pattern for account blocks in Settings. Must be
 * composed inside the parent screen's `Form` or `List`.
 *
 * When `usernameEditor` is provided the profile row becomes tappable and opens
 * a native alert with a text field (the `UIAlertController` idiom — the iOS
 * equivalent of the Android text dialog). An iOS alert always dismisses when
 * an action is tapped, so a rejected submit surfaces through the app's own
 * error channel (e.g. snackbar) instead of holding the dialog open.
 */
export const SettingsAccountSection = ({
  title,
  profile,
  usernameEditor,
  navRows,
  dangerRows,
  signOutLabel,
  signOutDialog,
  onSignOut,
  colors,
}: SettingsAccountSectionProps) => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [usernameAlertVisible, setUsernameAlertVisible] = useState(false);

  const initialUsername = usernameEditor?.currentValue?.replace(/^@/, '') ?? '';
  const usernameState = useNativeState(initialUsername);
  const [usernameDraft, setUsernameDraft] = useState(initialUsername);

  const submitUsername = () => {
    // The alert has already dismissed itself; a rejected submit is surfaced
    // by the app (snackbar) — mirroring Android's inline error isn't possible.
    void usernameEditor?.onSubmit(usernameDraft.trim()).catch(() => {});
  };

  const profileContent = profile ? (
    <HStack spacing={12}>
      <Image
        systemName="person.crop.circle.fill"
        size={40}
        color={colors.onSurfaceMuted}
      />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[foregroundStyle(colors.onSurface)]}>
          {profile.displayName}
        </Text>
        <Text
          modifiers={[
            font({ textStyle: 'footnote' }),
            foregroundStyle(colors.onSurfaceMuted),
          ]}
        >
          {profile.username
            ? `@${profile.username}`
            : (usernameEditor?.addPrompt ?? '')}
        </Text>
      </VStack>
    </HStack>
  ) : null;

  return (
    <Section title={title}>
      {profileContent ? (
        usernameEditor ? (
          <Alert
            title={usernameEditor.dialog.title}
            isPresented={usernameAlertVisible}
            onIsPresentedChange={setUsernameAlertVisible}
          >
            <Alert.Trigger>
              <Button onPress={() => setUsernameAlertVisible(true)}>
                {profileContent}
              </Button>
            </Alert.Trigger>
            <Alert.Actions>
              <TextField
                text={usernameState}
                placeholder={usernameEditor.dialog.fieldLabel}
                onTextChange={setUsernameDraft}
              />
              <Button
                label={usernameEditor.dialog.cancel}
                role="cancel"
                onPress={() => setUsernameAlertVisible(false)}
              />
              <Button
                label={usernameEditor.dialog.confirm}
                onPress={submitUsername}
              />
            </Alert.Actions>
          </Alert>
        ) : (
          profileContent
        )
      ) : null}

      {/* Navigation rows (e.g. Trash) between the identity row and sign-out.
          Styled as native disclosure rows — primary-labeled text with a
          trailing chevron — not tinted action buttons (in Apple's Settings,
          blue text means "do something"; navigation is neutral + chevron). */}
      {navRows?.map(row => (
        <Button key={row.id} onPress={row.onPress}>
          <HStack spacing={8}>
            <Text
              modifiers={[
                ...(colors?.onSurface
                  ? [foregroundStyle(colors.onSurface)]
                  : []),
              ]}
            >
              {row.label}
            </Text>
            <Spacer />
            <Image
              systemName="chevron.right"
              size={13}
              color={colors?.onSurfaceMuted}
            />
          </HStack>
        </Button>
      ))}

      {/* The sign-out button doubles as the sheet's native trigger — a
          ConfirmationDialog mounted on demand (the Android dialog pattern)
          loses the presentation race and never shows, so the dialog stays
          mounted and the trigger presents it. */}
      <ConfirmationDialog
        title={signOutDialog.title}
        titleVisibility="visible"
        isPresented={confirmVisible}
        onIsPresentedChange={setConfirmVisible}
      >
        <ConfirmationDialog.Trigger>
          <Button
            label={signOutLabel}
            role="destructive"
            onPress={() => setConfirmVisible(true)}
          />
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <Button
            label={signOutDialog.confirm}
            role="destructive"
            onPress={() => {
              setConfirmVisible(false);
              onSignOut();
            }}
          />
          <Button
            label={signOutDialog.cancel}
            role="cancel"
            onPress={() => setConfirmVisible(false)}
          />
        </ConfirmationDialog.Actions>
        <ConfirmationDialog.Message>
          <Text>{signOutDialog.message}</Text>
        </ConfirmationDialog.Message>
      </ConfirmationDialog>

      {/* Destructive rows (e.g. Delete account) close the group, below the
          milder sign-out — escalating severity reads top-to-bottom. */}
      {dangerRows?.map(row => (
        <Button
          key={row.id}
          label={row.label}
          role="destructive"
          onPress={row.onPress}
        />
      ))}
    </Section>
  );
};
