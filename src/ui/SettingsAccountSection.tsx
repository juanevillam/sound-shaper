import { memo, useState } from 'react';

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
import { iconSource } from './icons';
import { SettingsDialog } from './SettingsDialog';
import {
  GROUP_HEADERLESS_TOP_GAP,
  GROUP_SIDE_PADDING,
  groupRowColors,
  groupRowShape,
  SCREEN_CONTENT_TOP,
} from './settingsGroup';

const personIcon = iconSource('person');
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

/** The identity the account banner draws (avatar and name). */
export type SettingsAccountProfile = {
  displayName: string;
  /**
   * Remote avatar (e.g. the Google account photo). When set, the banner shows
   * the image instead of the default person icon; both platforms bridge it
   * through `RNHostView`, since neither native kit loads a remote URL.
   */
  photoUrl?: string | null;
};

/**
 * A single-field text editor — the shape `UsernameDialog` (Android) and
 * `TextEditRowIos` take. `ManageAccountScreen` and the own-profile hook use it
 * for the name.
 */
export type SettingsUsernameEditor = {
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
 *    a second glyph to carry one — the home bar is a single gear. So the entry comes here, and the identity card does the work
 *    instead of being decoration.
 *
 * BOTH PLATFORMS. It shipped iOS-only, with Android rendering the entry as a
 * `navRow` inside the account group on the reading that Google's apps put the
 * destination in the group rather than on the identity card — but One UI's own
 * Settings leads with exactly this banner (avatar, name, legend, chevron, the
 * Samsung account row), and Juan asked for the same object on both sides
 * (2026-09-08). The Compose side draws it as `SettingsAccountSection`, a
 * grouped card leading the screen the way the iOS Form's identity card does.
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

export type SettingsAccountSectionProps = {
  /**
   * Section heading, e.g. "Account". Neither platform draws it today — the
   * banner carries no header (see `SettingsAccountLink`) — and the caller
   * still passes it.
   */
  title: string;
  /** The identity the banner draws. No profile, no banner. */
  profile?: SettingsAccountProfile;
  /**
   * The account destination the banner opens — see `SettingsAccountLink`. No
   * link, no banner.
   */
  profileLink?: SettingsAccountLink;
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

/**
 * The identity banner's avatar — 55dp, the App Store Apple Account sheet's
 * measured art size, which the iOS banner already renders. One number both
 * platforms, so the two banners read as the same object at a glance.
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
        colors={groupRowColors(colors)}
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
 * THE ACCOUNT BLOCK, Compose side — the banner alone, the same object the iOS
 * twin of this name renders. `SettingsScreen` puts it FIRST, above General,
 * the position the iOS Form gives its identity card ("Apple puts the person
 * first", and so does One UI). Sign-out is not here: it is the trailing
 * `SettingsSignOutSection` card on both platforms.
 *
 * Without a profile and a link there is no identity to show, so it renders
 * nothing — the same rule the iOS twin follows.
 */
export const SettingsAccountSection = ({
  profile,
  profileLink,
  colors,
}: SettingsAccountSectionProps) =>
  profile && profileLink ? (
    <AccountBanner profile={profile} link={profileLink} colors={colors} />
  ) : null;

/**
 * Text-input dialog in the Material settings idiom — the shared
 * `SettingsDialog` shell around an `OutlinedTextField`. Mounted only while
 * visible so the field state resets — and pre-fills — on every open.
 */
export const UsernameDialog = ({
  editor,
  colors,
  onDismiss,
}: {
  editor: SettingsUsernameEditor;
  colors: SettingsAccountColors;
  onDismiss: () => void;
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
        if (!isSubmitting) onDismiss();
      }}
      actions={
        /* Content colour stated, not inherited — see the note on the radio
           dialog's Cancel in `SettingsScreen`. */
        <>
          <TextButton
            colors={{ contentColor: colors.primary }}
            enabled={!isSubmitting}
            onClick={onDismiss}
          >
            <Text>{editor.dialog.cancel}</Text>
          </TextButton>
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
  }: {
    label: string;
    shape: GroupShape;
    colors: SettingsAccountColors;
    onPress: () => void;
  }) => (
    /* No leading glyph. It once lined this label up with a profile row's 40dp
       avatar; standing alone in the trailing card there is nothing to line up
       with, and the icon pushed "Sign Out" to 88.89dp while every other row on
       the screen starts its label at 33.07dp (measured on a Galaxy A54). */
    <ListItem
      colors={groupRowColors(colors)}
      modifiers={[fillMaxWidth(), clip(shape), clickable(onPress)]}
    >
      <ListItem.HeadlineContent>
        {/* Danger-colored like the iOS destructive row, so it reads as an action. */}
        <Text color={colors.danger}>{label}</Text>
      </ListItem.HeadlineContent>
    </ListItem>
  ),
);

SignOutRow.displayName = 'SignOutRow';

const styles = StyleSheet.create({
  // Fills the banner's disc; the parent Box clips it to a circle.
  bannerAvatar: { height: BANNER_AVATAR_SIZE, width: BANNER_AVATAR_SIZE },
});

/**
 * THE TRAILING SIGN-OUT CARD — one destructive action, no header, last on the
 * screen. The iOS twin is in `SettingsAccountSection.ios.tsx`; both platforms
 * export this name and draw the same idea in their own language.
 *
 * Google puts "Sign out" at the end of Settings, and a header names a group:
 * a lone destructive action does not belong under an "Account" header wedged
 * between General and About. This app's account block has no group at all —
 * the identity is the banner leading the screen — so sign-out always closes
 * the screen here.
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
