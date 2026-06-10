import { memo, useCallback, useState } from 'react';

import {
  AlertDialog,
  Box,
  Column,
  Icon,
  ListItem,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import { iconSource } from './icons';

const personIcon = iconSource('person');

/** App-resolved colors the account section paints with. */
export type SettingsAccountColors = {
  primary: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceVariant: string;
  danger: string;
};

/** Optional identity row (avatar, name, username) shown above sign-out. */
export type SettingsAccountProfile = {
  displayName: string;
  username: string;
};

export type SettingsAccountSectionProps = {
  /** Section heading, e.g. "Account". */
  title: string;
  /** When provided, renders the profile row above the sign-out row. */
  profile?: SettingsAccountProfile;
  signOutLabel: string;
  signOutDialog: {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onSignOut: () => void;
  colors: SettingsAccountColors;
};

const listItemColors = (colors: SettingsAccountColors) => ({
  containerColor: 'transparent',
  contentColor: colors.onSurface,
  supportingContentColor: colors.onSurfaceMuted,
});

/**
 * Static rows, memoized so the confirm-dialog state toggle in
 * `SettingsAccountSection` never re-renders them — re-sending props to the
 * native `Icon` makes it re-resolve its drawable async, a visible flicker.
 */
const ProfileRow = memo(
  ({
    profile,
    colors,
  }: {
    profile: SettingsAccountProfile;
    colors: SettingsAccountColors;
  }) => (
    <ListItem colors={listItemColors(colors)}>
      <ListItem.LeadingContent>
        <Box
          contentAlignment="center"
          modifiers={[
            size(40, 40),
            clip(Shapes.Circle),
            background(colors.surfaceVariant),
          ]}
        >
          <Icon source={personIcon} size={24} tint={colors.onSurfaceMuted} />
        </Box>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text color={colors.onSurface}>{profile.displayName}</Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text color={colors.onSurfaceMuted}>@{profile.username}</Text>
      </ListItem.SupportingContent>
    </ListItem>
  ),
);

ProfileRow.displayName = 'ProfileRow';

const SignOutRow = memo(
  ({
    label,
    colors,
    onPress,
  }: {
    label: string;
    colors: SettingsAccountColors;
    onPress: () => void;
  }) => (
    <ListItem colors={listItemColors(colors)} modifiers={[clickable(onPress)]}>
      <ListItem.HeadlineContent>
        {/* Danger-colored like the iOS destructive row, so it reads as an action. */}
        <Text color={colors.danger}>{label}</Text>
      </ListItem.HeadlineContent>
    </ListItem>
  ),
);

SignOutRow.displayName = 'SignOutRow';

/**
 * Account block for a settings screen in the Android settings idiom: a section
 * header, an optional profile row (rendered only when `profile` is passed), and
 * a sign-out preference row gated behind a confirmation dialog. Fully
 * prop-driven so every app supplies its own copy, colors, identity, and
 * sign-out handler.
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

  const openConfirm = useCallback(() => setConfirmVisible(true), []);

  const handleConfirm = () => {
    setConfirmVisible(false);
    onSignOut();
  };

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Text
        color={colors.primary}
        style={{ typography: 'labelLarge' }}
        modifiers={[padding(16, 16, 16, 8)]}
      >
        {title}
      </Text>

      {profile ? <ProfileRow profile={profile} colors={colors} /> : null}

      <SignOutRow label={signOutLabel} colors={colors} onPress={openConfirm} />

      {confirmVisible && (
        <AlertDialog onDismissRequest={() => setConfirmVisible(false)}>
          <AlertDialog.Title>
            <Text>{signOutDialog.title}</Text>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <Text>{signOutDialog.message}</Text>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton onClick={handleConfirm}>
              <Text color={colors.danger}>{signOutDialog.confirm}</Text>
            </TextButton>
          </AlertDialog.ConfirmButton>
          <AlertDialog.DismissButton>
            <TextButton onClick={() => setConfirmVisible(false)}>
              <Text>{signOutDialog.cancel}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        </AlertDialog>
      )}
    </Column>
  );
};
