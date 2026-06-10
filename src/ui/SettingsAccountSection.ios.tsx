import { useState } from 'react';

import {
  Button,
  ConfirmationDialog,
  HStack,
  Image,
  Section,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { type SettingsAccountSectionProps } from './SettingsAccountSection';

/**
 * iOS counterpart of `SettingsAccountSection`. Same prop API as the Android
 * (Jetpack Compose) variant, rendered as a native `Form`/`List` section: an
 * optional profile row followed by a red destructive sign-out row, confirmed
 * through an action sheet (`ConfirmationDialog`) — the standard Apple pattern
 * for account blocks in Settings. Must be composed inside the parent screen's
 * `Form` or `List`.
 */
export const SettingsAccountSection = ({
  title,
  profile,
  signOutLabel,
  signOutDialog,
  onSignOut,
  colors,
}: SettingsAccountSectionProps) => {
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleConfirm = () => {
    setConfirmVisible(false);
    onSignOut();
  };

  return (
    <Section title={title}>
      {profile ? (
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
              @{profile.username}
            </Text>
          </VStack>
        </HStack>
      ) : null}

      <ConfirmationDialog
        title={signOutDialog.title}
        isPresented={confirmVisible}
        onIsPresentedChange={setConfirmVisible}
        titleVisibility="visible"
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
            onPress={handleConfirm}
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
    </Section>
  );
};
