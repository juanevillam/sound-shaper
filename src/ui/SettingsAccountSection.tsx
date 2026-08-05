import { memo, useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  BasicAlertDialog,
  Box,
  Column,
  Icon,
  ListItem,
  OutlinedTextField,
  RNHostView,
  Row,
  Surface,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';

import { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
import { iconSource, type IconName } from './icons';
import {
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from './settingsGroup';

const personIcon = iconSource('person');
const logoutIcon = iconSource('logout');

/** App-resolved colors the account section paints with. */
export type SettingsAccountColors = {
  primary: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceContainer: string;
  surfaceVariant: string;
  danger: string;
};

type GroupShape = ReturnType<typeof groupRowShape>;

/**
 * Fixed-width leading slot so every row's text starts at the same x: the
 * profile avatar is a 40dp circle, so the smaller icons of the other rows
 * center inside an invisible 40dp box instead of hugging the start edge.
 */
const LEADING_SLOT_SIZE = 40;

const LeadingSlot = ({ children }: { children: React.ReactNode }) => (
  <Box
    contentAlignment="center"
    modifiers={[size(LEADING_SLOT_SIZE, LEADING_SLOT_SIZE)]}
  >
    {children}
  </Box>
);

/** Optional identity row (avatar, name, username) shown above sign-out. */
export type SettingsAccountProfile = {
  displayName: string;
  /** Omit when the user has not claimed a username yet. */
  username?: string;
  /**
   * Remote avatar (e.g. the Google account photo). When set, the row shows the
   * image instead of the default person icon. On iOS this is currently ignored
   * — the native `Image` only loads SF Symbols / local files, not remote URLs.
   */
  photoUrl?: string | null;
  /**
   * iOS only. Second line of the identity row, describing what pressing it
   * opens — Apple's own pattern ("Account info, payments and settings" under
   * the name in the App Store's Apple Account sheet). When set it REPLACES the
   * username line, because Apple does not put a handle there and the row's job
   * is to be a destination, not a profile summary.
   */
  subtitle?: string;
  /**
   * iOS only. Makes the identity row a disclosure row (chevron, pushes). Set
   * this instead of `usernameEditor` — the username is edited from the profile
   * header, not from Settings.
   */
  onPress?: () => void;
};

/**
 * Optional username editing wired into the profile row: tapping the row opens
 * the text dialog, and `addPrompt` replaces the row's subtitle while the user
 * has no username yet.
 */
export type SettingsUsernameEditor = {
  /** Subtitle when there is no username, e.g. "Tap to add your username". */
  addPrompt: string;
  /** Current value used to pre-fill the dialog field, e.g. "@kim". */
  currentValue?: string;
  dialog: {
    title: string;
    /** Field label inside the dialog. */
    fieldLabel: string;
    confirm: string;
    cancel: string;
  };
  /**
   * Persist the new username. Reject to keep the dialog open (the app
   * surfaces the error, e.g. via snackbar).
   */
  onSubmit: (username: string) => Promise<void>;
};

/**
 * A row that navigates to an in-app sub-screen — leading icon + label, tappable
 * (no trailing chevron: navigation is implied by the tap, matching the screen's
 * other rows). Rendered inside the account group (e.g. a "Trash" entry); the
 * host owns the navigation in `onPress`.
 */
export type SettingsNavRow = {
  /** Stable id — the React key AND the memo's stable opener key. */
  id: string;
  label: string;
  /** Optional leading icon, e.g. 'delete' for Trash. */
  icon?: IconName;
  onPress: () => void;
};

export type SettingsAccountSectionProps = {
  /** Section heading, e.g. "Account". */
  title: string;
  /** When provided, renders the profile row above the sign-out row. */
  profile?: SettingsAccountProfile;
  /** When provided, renders an editable username row under the profile. */
  usernameEditor?: SettingsUsernameEditor;
  /**
   * Optional navigation rows rendered between the profile and the sign-out row,
   * in the SAME grouped card (e.g. a "Trash" entry). The host owns the route.
   */
  navRows?: SettingsNavRow[];
  /**
   * Optional destructive rows rendered AFTER the sign-out row (e.g. a
   * "Delete account" entry) — danger-tinted like sign-out; the host owns
   * whatever confirmation flow the tap opens.
   */
  dangerRows?: SettingsNavRow[];
  signOutLabel: string;
  signOutDialog: {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onSignOut: () => void;
  colors: SettingsAccountColors;
  /**
   * When provided, the profile row delegates to this instead of mounting the
   * username dialog itself. Mounting a dialog inside the same `Host` as the
   * rows corrupts their modifiers (clip shapes mis-assign on unmount), so the
   * parent screen renders the dialog in a separate `Host` (Android only).
   */
  onOpenUsernameDialog?: () => void;
  /** Same as `onOpenUsernameDialog`, for the sign-out confirmation dialog. */
  onOpenSignOutConfirm?: () => void;
};

const listItemColors = (colors: SettingsAccountColors) => ({
  containerColor: colors.surfaceContainer,
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
    usernameLabel,
    shape,
    colors,
    onPress,
  }: {
    profile: SettingsAccountProfile;
    /** Subtitle: the @username, or the "add your username" prompt. */
    usernameLabel: string;
    shape: GroupShape;
    colors: SettingsAccountColors;
    onPress?: () => void;
  }) => (
    <ListItem
      colors={listItemColors(colors)}
      modifiers={[
        fillMaxWidth(),
        clip(shape),
        ...(onPress ? [clickable(onPress)] : []),
      ]}
    >
      <ListItem.LeadingContent>
        <Box
          contentAlignment="center"
          modifiers={[
            size(LEADING_SLOT_SIZE, LEADING_SLOT_SIZE),
            clip(Shapes.Circle),
            background(colors.surfaceVariant),
          ]}
        >
          {/* Compose has no remote-image component, so the Google photo bridges
              back to RN via RNHostView (the same idiom the top cards use); the
              parent Box clips it to the circle. Falls back to the person icon. */}
          {profile.photoUrl ? (
            <RNHostView matchContents>
              <Image
                source={{ uri: profile.photoUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            </RNHostView>
          ) : (
            <Icon source={personIcon} size={24} tint={colors.onSurfaceMuted} />
          )}
        </Box>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text color={colors.onSurface}>{profile.displayName}</Text>
      </ListItem.HeadlineContent>
      {/* No username (apps without handles): omit the slot entirely so the
          name centers vertically instead of floating over an empty line. */}
      {usernameLabel ? (
        <ListItem.SupportingContent>
          <Text color={colors.onSurfaceMuted}>{usernameLabel}</Text>
        </ListItem.SupportingContent>
      ) : null}
    </ListItem>
  ),
);

ProfileRow.displayName = 'ProfileRow';

const USERNAME_DIALOG_WIDTH = 312;

/**
 * Text-input dialog in the Material settings idiom (Surface clipped to 28,
 * width 312, trailing text buttons). Mounted only while visible so the field
 * state resets — and pre-fills — on every open.
 */
export const UsernameDialog = ({
  editor,
  colors,
  onDismiss,
  dismissable = true,
}: {
  editor: SettingsUsernameEditor;
  colors: SettingsAccountColors;
  onDismiss: () => void;
  /**
   * When false the dialog can't be cancelled or scrim-dismissed — only a
   * successful submit closes it. Used to force a username on a new account
   * before the app is usable.
   */
  dismissable?: boolean;
}) => {
  const initialValue = editor.currentValue?.replace(/^@/, '') ?? '';
  const valueState = useNativeState(initialValue);
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: string) => {
    setValue(next);
    if (error) setError(null);
  };

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await editor.onSubmit(value.trim());
      onDismiss();
    } catch (submitError) {
      // Show the (localized) failure INLINE — a snackbar would render behind
      // this Compose dialog window. Keep the dialog open for a retry.
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : null,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <BasicAlertDialog
      onDismissRequest={() => {
        if (dismissable && !isSubmitting) onDismiss();
      }}
    >
      <Surface
        tonalElevation={6}
        modifiers={[
          width(USERNAME_DIALOG_WIDTH),
          clip(Shapes.RoundedCorner(28)),
        ]}
      >
        <Column modifiers={[fillMaxWidth()]}>
          <Text
            color={colors.onSurface}
            style={{ typography: 'headlineSmall' }}
            modifiers={[padding(24, 24, 24, 16)]}
          >
            {editor.dialog.title}
          </Text>
          <Column modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}>
            <OutlinedTextField
              value={valueState}
              onValueChange={onChange}
              singleLine
              isError={!!error}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{editor.dialog.fieldLabel}</Text>
              </OutlinedTextField.Label>
              {error ? (
                <OutlinedTextField.SupportingText>
                  <Text>{error}</Text>
                </OutlinedTextField.SupportingText>
              ) : null}
            </OutlinedTextField>
          </Column>
          <Row
            horizontalArrangement="end"
            modifiers={[fillMaxWidth(), padding(24, 8, 16, 12)]}
          >
            {dismissable ? (
              <TextButton enabled={!isSubmitting} onClick={onDismiss}>
                <Text>{editor.dialog.cancel}</Text>
              </TextButton>
            ) : null}
            <TextButton enabled={!isSubmitting} onClick={submit}>
              <Text>{editor.dialog.confirm}</Text>
            </TextButton>
          </Row>
        </Column>
      </Surface>
    </BasicAlertDialog>
  );
};

const SignOutRow = memo(
  ({
    label,
    shape,
    colors,
    onPress,
  }: {
    label: string;
    shape: GroupShape;
    colors: SettingsAccountColors;
    onPress: () => void;
  }) => (
    <ListItem
      colors={listItemColors(colors)}
      modifiers={[fillMaxWidth(), clip(shape), clickable(onPress)]}
    >
      <ListItem.LeadingContent>
        <LeadingSlot>
          <Icon source={logoutIcon} size={24} tint={colors.danger} />
        </LeadingSlot>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        {/* Danger-colored like the iOS destructive row, so it reads as an action. */}
        <Text color={colors.danger}>{label}</Text>
      </ListItem.HeadlineContent>
    </ListItem>
  ),
);

SignOutRow.displayName = 'SignOutRow';

/**
 * A navigation row inside the account group — leading icon (in the shared 40dp
 * slot so its label aligns with the profile/sign-out rows) + label, whole row
 * clickable. No trailing chevron: this screen signals navigation by tappability
 * (the About "version" row navigates to a URL with no indicator either), so a
 * lone chevron would break that. Memoized with a stable id-keyed opener for the
 * same reason as the other rows: re-sending props to the native `Icon` makes it
 * re-resolve its drawable async (a visible flicker).
 */
const NavRow = memo(
  ({
    row,
    shape,
    colors,
    onOpen,
    destructive = false,
  }: {
    row: SettingsNavRow;
    shape: GroupShape;
    colors: SettingsAccountColors;
    /** Stable opener keyed by row id, so the memo holds. */
    onOpen: (id: string) => void;
    /** Danger-tinted icon + label (e.g. "Delete account"). */
    destructive?: boolean;
  }) => (
    <ListItem
      colors={listItemColors(colors)}
      modifiers={[fillMaxWidth(), clip(shape), clickable(() => onOpen(row.id))]}
    >
      {row.icon ? (
        <ListItem.LeadingContent>
          <LeadingSlot>
            <Icon
              source={iconSource(row.icon)}
              size={24}
              tint={destructive ? colors.danger : colors.onSurfaceMuted}
            />
          </LeadingSlot>
        </ListItem.LeadingContent>
      ) : null}
      <ListItem.HeadlineContent>
        <Text color={destructive ? colors.danger : colors.onSurface}>
          {row.label}
        </Text>
      </ListItem.HeadlineContent>
    </ListItem>
  ),
);

NavRow.displayName = 'NavRow';

const styles = StyleSheet.create({
  // Fills the 40dp leading slot; the parent Box clips it to a circle.
  avatar: { height: LEADING_SLOT_SIZE, width: LEADING_SLOT_SIZE },
});

/**
 * Account block for a settings screen in the Android settings idiom: a section
 * header, an optional profile row (rendered only when `profile` is passed), and
 * a sign-out preference row gated behind a confirmation dialog. When
 * `usernameEditor` is provided the profile row itself opens the username
 * dialog, with `addPrompt` as its subtitle until a username exists. Fully
 * prop-driven so every app supplies its own copy, colors, identity, and
 * sign-out handler.
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
  onOpenUsernameDialog,
  onOpenSignOutConfirm,
}: SettingsAccountSectionProps) => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [usernameDialogVisible, setUsernameDialogVisible] = useState(false);

  const openConfirmFallback = useCallback(() => setConfirmVisible(true), []);
  const openUsernameDialogFallback = useCallback(
    () => setUsernameDialogVisible(true),
    [],
  );

  const openConfirm = onOpenSignOutConfirm ?? openConfirmFallback;
  const openUsernameDialog = onOpenUsernameDialog ?? openUsernameDialogFallback;
  // Stable opener keyed by row id so `NavRow`'s memo holds across this section's
  // dialog-state toggles (re-rendering would re-resolve its native Icons).
  const handleNavPress = useCallback(
    (id: string) =>
      [...(navRows ?? []), ...(dangerRows ?? [])]
        .find(row => row.id === id)
        ?.onPress(),
    [navRows, dangerRows],
  );

  const handleConfirm = () => {
    setConfirmVisible(false);
    onSignOut();
  };

  // Row shapes depend on how many of the optional rows render, so the
  // group's first/last corners always land on the visible rows.
  const rowCount =
    1 + (profile ? 1 : 0) + (navRows?.length ?? 0) + (dangerRows?.length ?? 0);
  let rowIndex = 0;

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Text
        color={colors.primary}
        style={{ typography: 'labelLarge' }}
        modifiers={[padding(16, 16, 16, 8)]}
      >
        {title}
      </Text>

      <Column
        modifiers={[
          fillMaxWidth(),
          padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
        ]}
        verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
      >
        {profile ? (
          <ProfileRow
            profile={profile}
            usernameLabel={
              profile.username
                ? `@${profile.username}`
                : (usernameEditor?.addPrompt ?? '')
            }
            shape={groupRowShape(rowIndex++, rowCount)}
            colors={colors}
            onPress={usernameEditor ? openUsernameDialog : undefined}
          />
        ) : null}

        {/* Navigation rows (e.g. Trash) sit between the identity row and the
            destructive sign-out, which stays last. */}
        {navRows?.map(row => (
          <NavRow
            key={row.id}
            row={row}
            shape={groupRowShape(rowIndex++, rowCount)}
            colors={colors}
            onOpen={handleNavPress}
          />
        ))}

        <SignOutRow
          label={signOutLabel}
          shape={groupRowShape(rowIndex++, rowCount)}
          colors={colors}
          onPress={openConfirm}
        />

        {/* Destructive rows (e.g. Delete account) close the group, below the
            milder sign-out — escalating severity reads top-to-bottom. */}
        {dangerRows?.map(row => (
          <NavRow
            key={row.id}
            row={row}
            destructive
            shape={groupRowShape(rowIndex++, rowCount)}
            colors={colors}
            onOpen={handleNavPress}
          />
        ))}
      </Column>

      {/* Fallback dialogs for standalone use only — when the parent screen
          supplies openers it hosts the dialogs itself, in a separate `Host`,
          because mounting them here corrupts the sibling rows' modifiers. */}
      {!onOpenUsernameDialog && usernameEditor && usernameDialogVisible && (
        <UsernameDialog
          editor={usernameEditor}
          colors={colors}
          onDismiss={() => setUsernameDialogVisible(false)}
        />
      )}

      {!onOpenSignOutConfirm && confirmVisible && (
        <DestructiveConfirmDialog
          dialog={signOutDialog}
          colors={colors}
          onConfirm={handleConfirm}
          onDismiss={() => setConfirmVisible(false)}
        />
      )}
    </Column>
  );
};

/**
 * iOS-only — the real implementation is in `SettingsAccountSection.ios.tsx`,
 * where Apple's placement puts sign-out alone in a trailing card. Declared here
 * because tsc resolves this base file for both platforms. On ANDROID (frozen)
 * the sign-out row stays inside the account section above, so this renders
 * nothing and the Android screen is unchanged.
 */
export const SettingsSignOutSection = (
  _props: Pick<
    SettingsAccountSectionProps,
    'signOutLabel' | 'signOutDialog' | 'onSignOut'
  >,
) => null;
