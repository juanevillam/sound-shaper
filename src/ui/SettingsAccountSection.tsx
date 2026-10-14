import { memo, useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Box,
  Column,
  Icon,
  ListItem,
  OutlinedTextField,
  RNHostView,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';

import { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
import { iconSource, type IconName } from './icons';
import { SettingsDialog } from './SettingsDialog';
import {
  GROUP_HEADERLESS_TOP_GAP,
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
  SCREEN_CONTENT_TOP,
} from './settingsGroup';

const personIcon = iconSource('person');
const logoutIcon = iconSource('logout');
const chevronIcon = iconSource('chevron');

/** App-resolved colors the account section paints with. */
export type SettingsAccountColors = {
  primary: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceContainer: string;
  surfaceVariant: string;
  surfaceDialog: string;
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
 * TURNS THE IDENTITY CARD ITSELF INTO THE ACCOUNT DESTINATION — avatar, name, a
 * legend line saying what is behind it, and a disclosure chevron.
 *
 * This is Apple's own account banner: Settings' Apple Account row, and the App
 * Store's Apple Account sheet, which is the closer twin because it is the same
 * container (a grouped form in a sheet). The card is the tap target; nothing
 * else on the sheet says "Account".
 *
 * IT EXISTS FOR THE APPS WITH NOWHERE ELSE TO PUT THE ENTRY. The portfolio had
 * three cases and this is the third of them (the first went with its app —
 * expo-ui-starter was deleted 2026-09-16 — but the CASE is still the reason
 * every field here is optional, so do not read the remaining apps as the only
 * shapes):
 *
 *  - a SHOWCASE app has no account surface at all — no profile, no link, just
 *    the sign-out card;
 *  - a SOCIAL app (Topper) already shows the person their own identity on a
 *    Profile tab, so the account entry sits there and Settings shows no
 *    identity card;
 *  - a PERSONAL app (Sound Shaper, Booker) has neither, and its home bar must not grow
 *    a second glyph to carry one — every app's home bar is the same single
 *    gear. So the entry comes here, and the identity card does the work
 *    instead of being decoration.
 *
 * BOTH PLATFORMS. It shipped iOS-only, with Android rendering the entry as a
 * `navRow` inside the account group on the reading that Google's apps put the
 * destination in the group rather than on the identity card — but One UI's own
 * Settings leads with exactly this banner (avatar, name, legend, chevron, the
 * Samsung account row), and Juan asked for the same object on both sides
 * (2026-09-08). The Compose side draws it as `SettingsAccountBanner`, a
 * grouped card leading the screen the way the iOS Form's identity card does.
 *
 * Mutually exclusive with `usernameEditor`: both claim the profile row's tap
 * and its second line. No app wants both — an app with usernames is a social
 * one, which is the case that keeps its identity elsewhere.
 */
export type SettingsAccountLink = {
  /**
   * Already-translated legend under the name, naming what is behind the row
   * ("Account info and trophies") — Apple's construction, sentence case, no
   * period. Not an instruction to tap: the chevron says that.
   */
  subtitle: string;
  onPress: () => void;
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
   * When provided, the profile row BECOMES the account destination — see
   * `SettingsAccountLink`. Both platforms: the iOS Form renders it as the
   * identity card, `SettingsScreen` (Compose) as `SettingsAccountBanner`.
   */
  profileLink?: SettingsAccountLink;
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

/**
 * The identity banner's avatar — 55dp, the App Store Apple Account sheet's
 * measured art size, which the iOS banner already renders. One number both
 * platforms, so the two banners read as the same object at a glance; the
 * plain profile row's 40dp slot stays what it was.
 */
const BANNER_AVATAR_SIZE = 55;

/**
 * The banner card's height — stated, because a Compose `ListItem` sizes every
 * row to the same two-line 72dp, which rendered the PRIMARY item on the screen
 * exactly as tall as the Language row beside it (measured on the A54; Juan,
 * 2026-09-08: the iOS banner is visibly the primary item, Android's was not).
 * 96 is the M3 grid's next full step above the three-line 88: 1.7× the
 * one-line row (iOS's banner is 85pt against ~44pt rows, the same class of
 * step), and it gives the 55dp avatar 20dp of air against the current 8.5.
 */
const BANNER_HEIGHT = 96;

/**
 * THE ACCOUNT BANNER, Compose side — the `SettingsAccountLink` card: avatar,
 * name, a legend naming what is behind it, and a disclosure chevron, leading
 * the screen. The chevron is deliberate where this screen's other rows carry
 * none: every other row acts in place or opens a dialog, and this is the one
 * row that LEAVES for a sub-screen — One UI's own Settings draws its Samsung
 * account banner exactly this way.
 *
 * A single-row group, so it takes both outer corners (`groupRowShape(0, 1)`).
 *
 * ITS TOP IS THE FAMILY'S `SCREEN_CONTENT_TOP` (16): the screen's scroller
 * supplies 0 now, so this Column supplies the whole value — the same
 * derivation the General header makes with its own 16 of padding. A first
 * card with no header above it takes the constant's value outright — the
 * rule that term states. (While the family top was 32 the scroller supplied
 * 16 and this Column the other 16; without its half the banner stood one
 * header-slot above every other screen in the family — measured; Juan asked,
 * 2026-09-08.)
 */
const AccountBanner = memo(
  ({
    profile,
    link,
    colors,
  }: {
    profile: SettingsAccountProfile;
    link: SettingsAccountLink;
    colors: SettingsAccountColors;
  }) => (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(GROUP_SIDE_PADDING, SCREEN_CONTENT_TOP, GROUP_SIDE_PADDING, 0),
      ]}
    >
      <ListItem
        colors={listItemColors(colors)}
        modifiers={[
          fillMaxWidth(),
          height(BANNER_HEIGHT),
          clip(groupRowShape(0, 1)),
          clickable(link.onPress),
        ]}
      >
        <ListItem.LeadingContent>
          <Box
            contentAlignment="center"
            modifiers={[
              size(BANNER_AVATAR_SIZE, BANNER_AVATAR_SIZE),
              clip(Shapes.Circle),
              background(colors.surfaceVariant),
            ]}
          >
            {profile.photoUrl ? (
              <RNHostView matchContents>
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={styles.bannerAvatar}
                  contentFit="cover"
                />
              </RNHostView>
            ) : (
              <Icon
                source={personIcon}
                size={32}
                tint={colors.onSurfaceMuted}
              />
            )}
          </Box>
        </ListItem.LeadingContent>
        <ListItem.HeadlineContent>
          {/* A step above the plain rows' face, as the iOS banner's `headline`
              is a step above its rows — M3's emphasized row title. */}
          <Text color={colors.onSurface} style={{ typography: 'titleMedium' }}>
            {profile.displayName}
          </Text>
        </ListItem.HeadlineContent>
        <ListItem.SupportingContent>
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodyMedium' }}
          >
            {link.subtitle}
          </Text>
        </ListItem.SupportingContent>
        <ListItem.TrailingContent>
          <Icon source={chevronIcon} size={24} tint={colors.onSurfaceMuted} />
        </ListItem.TrailingContent>
      </ListItem>
    </Column>
  ),
);

AccountBanner.displayName = 'AccountBanner';

/**
 * Standalone export for `SettingsScreen`, which renders the banner FIRST —
 * above General, the position the iOS Form gives its identity card ("Apple
 * puts the person first", and so does One UI).
 */
export const SettingsAccountBanner = AccountBanner;

/**
 * Text-input dialog in the Material settings idiom — the shared
 * `SettingsDialog` shell around an `OutlinedTextField`. Mounted only while
 * visible so the field state resets — and pre-fills — on every open.
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
    <SettingsDialog
      title={editor.dialog.title}
      colors={colors}
      onDismissRequest={() => {
        if (dismissable && !isSubmitting) onDismiss();
      }}
      actions={
        /* Content colour stated, not inherited — see the note on the radio
           dialog's Cancel in `SettingsScreen`. */
        <>
          {dismissable ? (
            <TextButton
              colors={{ contentColor: colors.primary }}
              enabled={!isSubmitting}
              onClick={onDismiss}
            >
              <Text>{editor.dialog.cancel}</Text>
            </TextButton>
          ) : null}
          <TextButton
            colors={{ contentColor: colors.primary }}
            enabled={!isSubmitting}
            onClick={submit}
          >
            <Text>{editor.dialog.confirm}</Text>
          </TextButton>
        </>
      }
    >
      <Column modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}>
        <OutlinedTextField
          value={valueState}
          onValueChange={onChange}
          singleLine
          isError={!!error}
          // Same reason as the buttons: the focused ring, the label and the
          // caret are accent-drawn, and the native scheme's accent is the
          // one the app repairs.
          colors={{
            focusedIndicatorColor: colors.primary,
            focusedLabelColor: colors.primary,
            cursorColor: colors.primary,
          }}
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
    </SettingsDialog>
  );
};

const SignOutRow = memo(
  ({
    label,
    shape,
    colors,
    onPress,
    withIcon = true,
  }: {
    label: string;
    shape: GroupShape;
    colors: SettingsAccountColors;
    onPress: () => void;
    /**
     * The leading glyph exists to line this row's label up with the PROFILE
     * row's, whose 40dp avatar sets the group's text inset. Standing alone in
     * the trailing card there is no avatar to line up with — and keeping the
     * icon there pushed "Sign Out" to 88.89dp while every other row on the
     * screen starts its label at 33.07dp (measured on a Galaxy A54). One
     * screen, one text inset: no group, no glyph.
     */
    withIcon?: boolean;
  }) => (
    <ListItem
      colors={listItemColors(colors)}
      modifiers={[fillMaxWidth(), clip(shape), clickable(onPress)]}
    >
      {withIcon ? (
        <ListItem.LeadingContent>
          <LeadingSlot>
            <Icon source={logoutIcon} size={24} tint={colors.danger} />
          </LeadingSlot>
        </ListItem.LeadingContent>
      ) : null}
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
  // The banner's larger disc; same clipping arrangement.
  bannerAvatar: { height: BANNER_AVATAR_SIZE, width: BANNER_AVATAR_SIZE },
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
      {/* Ink, not the accent — a group header is a label. The full argument
          is on `sectionsTitle` in `SettingsScreen`. */}
      <Text
        color={colors.onSurfaceMuted}
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
 * THE TRAILING SIGN-OUT CARD — one destructive action, no header, last on the
 * screen. The iOS twin is in `SettingsAccountSection.ios.tsx`; both platforms
 * export this name and draw the same idea in their own language.
 *
 * IT USED TO RENDER NOTHING HERE, on the grounds that Material keeps sign-out
 * inside the account group. That is true when there IS a group — an app with a
 * profile row, a Trash entry, a delete-account row. It was never true for an
 * app whose account block is nothing but the sign-out action, which is the
 * starter and Topper: there the "Account" header named a group that did not
 * exist, wedged one lone destructive row between General and About. Google puts
 * "Sign out" at the end of Settings, and a header names a group. So the screen
 * picks: a real group renders in place, a lone action renders here.
 * `SettingsScreen`'s `accountIsGroup` is where that choice is made and
 * explained.
 *
 * `colors` and `onOpenSignOutConfirm` are OPTIONAL only so that tsc — which
 * resolves this base file for the iOS call site too — does not demand them of
 * the iOS variant, which needs neither. The Android screen always passes both;
 * without `colors` there is nothing to paint with and this renders nothing,
 * which is exactly the old behaviour.
 */
export const SettingsSignOutSection = ({
  signOutLabel,
  signOutDialog,
  onSignOut,
  colors,
  onOpenSignOutConfirm,
}: Pick<
  SettingsAccountSectionProps,
  'signOutLabel' | 'signOutDialog' | 'onSignOut'
> & {
  colors?: SettingsAccountColors;
  onOpenSignOutConfirm?: () => void;
}) => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const openConfirm = onOpenSignOutConfirm ?? (() => setConfirmVisible(true));

  if (!colors) return null;

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(
          GROUP_SIDE_PADDING,
          GROUP_HEADERLESS_TOP_GAP,
          GROUP_SIDE_PADDING,
          0,
        ),
      ]}
    >
      {/* A single row, so it takes BOTH outer corners — `groupRowShape(0, 1)`
          is the one-row case and needs no special-casing here. */}
      <SignOutRow
        label={signOutLabel}
        shape={groupRowShape(0, 1)}
        colors={colors}
        onPress={openConfirm}
        withIcon={false}
      />

      {/* Fallback dialog for standalone use only — when the screen supplies an
          opener it hosts the dialog itself, in a separate `Host`, because
          mounting it here corrupts the sibling rows' modifiers. */}
      {!onOpenSignOutConfirm && confirmVisible && (
        <DestructiveConfirmDialog
          dialog={signOutDialog}
          colors={colors}
          onConfirm={() => {
            setConfirmVisible(false);
            onSignOut();
          }}
          onDismiss={() => setConfirmVisible(false)}
        />
      )}
    </Column>
  );
};
