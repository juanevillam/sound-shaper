import { useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  ConfirmationDialog,
  HStack,
  Image,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { Image as RemoteImage } from 'expo-image';

import { type SettingsAccountSectionProps } from './SettingsAccountSection';
import { UsernameEditRowIos } from './UsernameEditRow';

/**
 * iOS counterpart of `SettingsAccountSection`. Same prop API as the Android
 * (Jetpack Compose) variant, but split into Apple's two cards: an identity card
 * (the profile row) and a separate destinations card (nav rows, then any
 * destructive rows). Sign-out is NOT here — it renders alone at the bottom of
 * the sheet via `SettingsSignOutSection`, which is where Apple puts it. Must be
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
  colors,
  // `signOutLabel` / `signOutDialog` / `onSignOut` are deliberately NOT read
  // here: sign-out is its own trailing card (`SettingsSignOutSection`). They
  // stay on the shared prop type because Android still renders them inside
  // this section.
}: SettingsAccountSectionProps) => {
  // Apps with no username concept (nor an editor to claim one) have no second
  // line — render the name alone so the HStack centres it, instead of pairing
  // it with an empty Text that pushes it optically high.
  const usernameLine = profile?.username
    ? `@${profile.username}`
    : (usernameEditor?.addPrompt ?? '');

  // `subtitle` marks the Apple-Account-style row: a bigger avatar, the name in
  // `headline`, and a second line that says what the row OPENS rather than who
  // the user is. Without it the row keeps its original compact form (the
  // username line), which is what an app that still edits the handle here uses.
  const secondLine = profile?.subtitle ?? usernameLine;

  const profileContent = profile ? (
    <HStack spacing={12}>
      {/* SwiftUI `Image` can't load remote URLs, so the Google photo bridges
          back through RNHostView (same idiom as the Android Compose row);
          the SF person icon stays as the no-photo fallback. */}
      {profile.photoUrl ? (
        <RNHostView matchContents>
          <RemoteImage
            source={{ uri: profile.photoUrl }}
            style={profile.subtitle ? styles.avatarLarge : styles.avatar}
            contentFit="cover"
          />
        </RNHostView>
      ) : (
        <Image
          systemName="person.crop.circle.fill"
          size={profile.subtitle ? AVATAR_SIZE_LARGE : AVATAR_SIZE}
          color={colors.onSurfaceMuted}
        />
      )}
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[
            // `headline` (17pt semibold) rather than body: in Apple's version
            // the name carries the row, and the line under it is supporting
            // text. Semantic style, so Dynamic Type still scales it.
            ...(profile.subtitle ? [font({ textStyle: 'headline' })] : []),
            foregroundStyle(colors.onSurface),
          ]}
        >
          {profile.displayName}
        </Text>
        {secondLine ? (
          <Text
            modifiers={[
              font({
                textStyle: profile.subtitle ? 'subheadline' : 'footnote',
              }),
              foregroundStyle(colors.onSurfaceMuted),
              // ONE line, truncating: Apple's identity subtitle never wraps,
              // and a locale with a longer phrase must not grow the row.
              ...(profile.subtitle ? [lineLimit(1)] : []),
            ]}
          >
            {secondLine}
          </Text>
        ) : null}
      </VStack>
      {/* Disclosure chevron, only when the row goes somewhere. */}
      {profile.onPress ? (
        <>
          <Spacer />
          <Image
            systemName="chevron.right"
            size={13}
            color={colors.onSurfaceMuted}
          />
        </>
      ) : null}
    </HStack>
  ) : null;

  // An app with no real session (the starter) passes only the sign-out config,
  // so there is no identity to show — render no card at all rather than an
  // empty one under an "Account" header.
  if (!profileContent && !navRows?.length) return null;

  return (
    <>
      {profileContent ? (
        <Section title={title}>
          {/* A row that navigates wins over the username alert: Apple's
              identity row is a destination, and an app that sets `onPress`
              has moved handle editing to the profile header. */}
          {profile?.onPress ? (
            <Button onPress={profile.onPress}>{profileContent}</Button>
          ) : usernameEditor ? (
            <UsernameEditRowIos editor={usernameEditor}>
              {profileContent}
            </UsernameEditRowIos>
          ) : (
            profileContent
          )}
        </Section>
      ) : null}

      {/* Destinations get their OWN card, not a continuation of the identity
          one — Apple splits the two (the Apple Account sheet shows the person
          in one card, then App Updates / Purchase History / … in the next).
          Styled as native disclosure rows — neutral label with a trailing
          chevron — not tinted action buttons (in Apple's Settings, blue text
          means "do something"; navigation is neutral + chevron). */}
      {navRows?.length ? (
        <Section>
          {navRows.map(row => (
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

          {/* Destructive rows (e.g. Delete account) close the destinations card. */}
          {dangerRows?.map(row => (
            <Button
              key={row.id}
              label={row.label}
              role="destructive"
              onPress={row.onPress}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
};

/**
 * Sign out, alone in its own card at the very bottom of the sheet — Apple's
 * placement (App Store → Apple Account → Account Settings puts "Sign Out" in a
 * card of its own, below the legal links, with nothing else in it). It used to
 * sit inside the account group directly under the profile row, which read as
 * "part of your identity" rather than "leave".
 */
export const SettingsSignOutSection = ({
  signOutLabel,
  signOutDialog,
  onSignOut,
}: Pick<
  SettingsAccountSectionProps,
  'signOutLabel' | 'signOutDialog' | 'onSignOut'
>) => {
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <Section>
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
    </Section>
  );
};

const AVATAR_SIZE = 40;
/**
 * The Apple-Account-style row's avatar. Bigger than the compact row's 40 —
 * Apple gives the identity row real presence, since it is the entry point to
 * everything account-shaped rather than one row among many.
 */
const AVATAR_SIZE_LARGE = 52;

const styles = StyleSheet.create({
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarLarge: {
    borderRadius: AVATAR_SIZE_LARGE / 2,
    height: AVATAR_SIZE_LARGE,
    width: AVATAR_SIZE_LARGE,
  },
});
