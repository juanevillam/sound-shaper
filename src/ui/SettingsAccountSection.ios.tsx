import { StyleSheet } from 'react-native';

import {
  Button,
  HStack,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  listSectionMargins,
} from '@expo/ui/swift-ui/modifiers';
import { Image as RemoteImage } from 'expo-image';

import { confirmDestructiveIos } from './confirmDestructiveIos';
import {
  FormDisclosureIndicatorIos,
  FormDisclosureRowIos,
} from './FormDisclosureRowIos';
import { InitialArt } from './InitialArt';
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
 * THE PROFILE ROW HAS TWO TAPPABLE MODES, and they are mutually exclusive
 * because both claim the row's tap and its second line:
 *
 *  - `usernameEditor` opens a native alert with a text field (the
 *    `UIAlertController` idiom — the iOS equivalent of the Android text
 *    dialog). An iOS alert always dismisses when an action is tapped, so a
 *    rejected submit surfaces through the app's own error channel (e.g.
 *    snackbar) instead of holding the dialog open.
 *  - `profileLink` makes the whole card the ACCOUNT DESTINATION, with a legend
 *    line and a disclosure chevron — Apple's account banner. Which apps use it,
 *    and why, is on `SettingsAccountLink`.
 */
export const SettingsAccountSection = ({
  title,
  profile,
  usernameEditor,
  profileLink,
  navRows,
  dangerRows,
  colors,
  // `signOutLabel` / `signOutDialog` / `onSignOut` are deliberately NOT read
  // here: sign-out is its own trailing card (`SettingsSignOutSection`). They
  // stay on the shared prop type because Android still renders them inside
  // this section.
}: SettingsAccountSectionProps) => {
  /**
   * THE SECOND LINE, from whichever of the row's two modes is in play — the
   * @username (or the prompt to claim one) when the row edits a username, the
   * legend naming what is behind it when the row is the account destination.
   *
   * Apps with neither have no second line at all: the name renders alone so the
   * HStack centres it, instead of pairing it with an empty Text that pushes it
   * optically high.
   */
  const secondLine = profileLink
    ? profileLink.subtitle
    : profile?.username
      ? `@${profile.username}`
      : (usernameEditor?.addPrompt ?? '');

  // The banner stands the person at Apple's own size; the plain row is a
  // normal grouped row with an avatar in it. See `BANNER_AVATAR_SIZE`.
  const avatarSize = profileLink ? BANNER_AVATAR_SIZE : AVATAR_SIZE;
  const avatar = profileLink ? styles.bannerAvatar : styles.avatar;

  const profileContent = profile ? (
    <HStack spacing={profileLink ? BANNER_ART_GAP : 12}>
      {/* SwiftUI `Image` can't load remote URLs, so the Google photo bridges
          back through RNHostView (same idiom as the Android Compose row);
          the SF person icon stays as the no-photo fallback. */}
      <VStack modifiers={[frame({ width: avatarSize, height: avatarSize })]}>
        <RNHostView>
          {profile.photoUrl ? (
            <RemoteImage
              source={{ uri: profile.photoUrl }}
              style={avatar}
              contentFit="cover"
            />
          ) : (
            /**
             * THE INITIAL, like every other person without a photo in these
             * apps — not an SF `person.crop.circle.fill`, which is what this
             * row drew before.
             *
             * That glyph is Apple's mark for an account with no identity yet
             * (a signed-OUT Apple Account); a signed-in person with a name
             * gets a monogram in Contacts, Mail and Messages, and gets one
             * everywhere else in this app. So the same person read as a
             * generic silhouette here and as their own initial one screen
             * away. `InitialArt` is in this package precisely so a shared
             * screen can draw the portfolio's answer instead of picking a
             * glyph of its own.
             *
             * ONE HOST EITHER WAY: the branches swap inside a single
             * `RNHostView` rather than adding a second one beside it, which
             * is the ceiling a native row has.
             */
            <InitialArt
              size={avatarSize}
              style={avatar}
              title={profile.displayName}
            />
          )}
        </RNHostView>
      </VStack>
      <VStack alignment="leading" spacing={2}>
        {/* THE BANNER'S NAME IS `headline` — 17 semibold, the ladder's own
            name for the face Apple titles a row with, and what the App Store's
            banner measures at. One rung up from the plain row's `body`, and the
            difference is the WEIGHT more than the size. A STYLE, never a point
            size, so Dynamic Type still moves it. See `BANNER_AVATAR_SIZE`. */}
        <Text
          modifiers={[
            ...(profileLink ? [font({ textStyle: 'headline' })] : []),
            foregroundStyle(colors.onSurface),
          ]}
        >
          {profile.displayName}
        </Text>
        {secondLine ? (
          <Text
            modifiers={[
              font({ textStyle: 'footnote' }),
              foregroundStyle(colors.onSurfaceMuted),
            ]}
          >
            {secondLine}
          </Text>
        ) : null}
      </VStack>
      {/* The chevron that says the card goes somewhere — the SAME glyph every
          other destination row in the portfolio draws, at the same size and the
          same muted colour (`FormDisclosureIndicatorIos`). A row with leading
          art and two lines cannot use `FormDisclosureRowIos`'s layout, so it
          takes the indicator on its own; that is exactly the case that export
          exists for. */}
      {profileLink ? (
        <>
          <Spacer />
          <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
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
        /* AN ACCOUNT BANNER CARRIES NO SECTION HEADER. Both of Apple's — the
           Apple Account row at the top of Settings, and the identity card in
           the App Store's Apple Account sheet — are the first card on the
           screen with nothing labelling them: the avatar and the name say what
           the card is, and a header over them repeats it. The title still
           heads the card in the other mode, where the row is one of several
           and the group needs naming. */
        <Section
          title={profileLink ? undefined : title}
          modifiers={
            profileLink
              ? [
                  listSectionMargins({
                    edges: 'top',
                    length: BANNER_TOP_MARGIN,
                  }),
                ]
              : undefined
          }
        >
          {usernameEditor ? (
            <UsernameEditRowIos editor={usernameEditor}>
              {profileContent}
            </UsernameEditRowIos>
          ) : profileLink ? (
            /* A plain `Button`, not a tinted action: the labels inside state
               `foregroundStyle` themselves, so the card stays neutral-plus-
               chevron the way navigation does in Apple's Settings. */
            <Button onPress={profileLink.onPress}>{profileContent}</Button>
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
              <FormDisclosureRowIos label={row.label} colors={colors} />
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
 *
 * THE CONFIRMATION IS THE HOUSE ALERT, and this was the ELEVENTH copy the rule
 * on `confirmDestructiveIos` warned about — written before that helper existed
 * and never brought onto it, so sign-out was the one destructive confirmation
 * in the portfolio still presenting a SwiftUI `ConfirmationDialog`. It shipped
 * broken in all three apps, in three different ways on one device:
 *
 *  - IT PRESENTED AS A POPOVER, not an action sheet. `.confirmationDialog`
 *    picks its presentation from the presenting environment's size class, and
 *    the trigger lives in an `@expo/ui` hosting controller inside a form sheet
 *    — which does not report compact, so UIKit chose iPad's idiom on an iPhone.
 *  - THE ANCHOR WAS WRONG, and wrong differently per app: the popover's arrow
 *    landed on the About card in the starter, floated free of the row in
 *    Topper, and covered the Legal card in Sound Shaper. A popover anchors to
 *    the trigger's frame, and the trigger's frame is a bridged view's.
 *  - CANCEL DISAPPEARED. A popover-style dialog drops its `cancel` role on
 *    purpose (tapping outside is the cancel), so all three shipped a
 *    confirmation whose only visible button was the red one.
 *
 * An `Alert` has none of that: it is centred, owns the screen, keeps Cancel,
 * and BOLDS it as the preferred action. It is also what the other ten do and
 * what Android's twin renders — same `signOutDialog` copy, each platform in
 * its own grammar.
 */
export const SettingsSignOutSection = ({
  signOutLabel,
  signOutDialog,
  onSignOut,
}: Pick<
  SettingsAccountSectionProps,
  'signOutLabel' | 'signOutDialog' | 'onSignOut'
>) => (
  <Section>
    <Button
      label={signOutLabel}
      role="destructive"
      onPress={() =>
        confirmDestructiveIos({
          cancelLabel: signOutDialog.cancel,
          confirmLabel: signOutDialog.confirm,
          message: signOutDialog.message,
          onConfirm: onSignOut,
          title: signOutDialog.title,
        })
      }
    />
  </Section>
);

/**
 * WHAT THE BANNER GIVES BACK OF THE EMPTY HEADER SLOT — solved backwards
 * against the family's 84.00, not chosen.
 *
 * A grouped list reserves room above its first section for a header it does not
 * have, and a HEADERLESS first card sits in that empty slot: band-scanned on
 * iPhone 17 / iOS 26.5, this card came to rest 101.00 below the sheet's own top
 * edge, against the account sheet it opens at 83.33 and Topper's Settings sheet
 * — the same component, first section headed — at 79.00. That is the identical
 * defect recorded on `trash` (105.00) and on the trophies summary.
 *
 * SOLVED BACKWARDS, three points on the device, eight frames each:
 *
 *   no modifier   101.00      length 14   80.00      length 18   84.00
 *
 * So the modifier REPLACES the reserved margin rather than adding to it — this
 * is the whole spacing above the card, not a correction to it — and the slope
 * is 1:1, which is what makes 18 exact rather than close. (The trophies
 * summary takes 14 for the same 84.00; its `Form` is not under a native bar.)
 *
 * It applies ONLY in the banner mode: the headed card has a real header and is
 * already where the rest of the family is.
 */
const BANNER_TOP_MARGIN = 18;

/**
 * THE BANNER IS APPLE'S SIZE, AND THE REFERENCE IS THE APP STORE'S APPLE
 * ACCOUNT SHEET — measured off it, not scaled up from the 40pt row by eye.
 *
 * There are two Apple banners and they are NOT the same. Settings' is a
 * standalone card and stands 60pt of art under a `title3`; the App Store's is
 * the first ROW of a stacked card (Game Center sits under it behind a divider),
 * so it takes row metrics instead — smaller art, a row-title face. Juan picked
 * the App Store's, so these are its numbers even though our card, like
 * Settings', holds nothing else.
 *
 * MEASURED FROM TWO SCREENSHOTS OF THE SAME iPhone, ours beside the App Store's,
 * so every figure below is a RATIO between them and the capture scale cancels.
 * Both were confirmed at default Dynamic Type first (our own `footnote` legend
 * and `title3` name land on their nominal sizes, which they would not at any
 * other setting):
 *
 *   art            0.9132 of our 60          → 54.79
 *   art, again     row height 84.8 − 30 pad  → 54.80   (independent, agrees)
 *   name width     0.8636 of our 20pt        → 17.27   → `headline`
 *   name weight    ink coverage ratio 1.008  → the same semibold we had
 *   legend         identical width and cap   → `footnote` 13, already right
 *
 * `headline` IS 17 semibold — the ladder's own name for that face, which is
 * why the weight is no longer stated by hand. It is the style Apple titles a
 * row with, and that is exactly what the App Store's banner is.
 *
 * RENDERED AND RE-SCANNED, ours on the simulator against the App Store capture
 * converted to points — the capture's own scale solved from OUR name's known
 * position in it (100.67), which lands its device at 393pt wide, not 402:
 *
 *   art        55.00 / 54.6      card height   85.00 / 84.0
 *   name left  95.67 / 95.5      name width    75.00 / 73.4
 *
 * Everything inside a point, which is the floor a 1.27 px/pt capture can
 * resolve. Re-measure the same way rather than nudging any of these by eye.
 */
const BANNER_AVATAR_SIZE = 55;
/**
 * Tighter than the plain row's 12 — Apple's own. In the App Store capture the
 * name's ink stands 10.9px off the art's edge, which is 8.8pt less the 'J's own
 * left bearing at this size.
 */
const BANNER_ART_GAP = 8;

/** The plain row: a fact about the person, beside a normal 40pt avatar. */
const AVATAR_SIZE = 40;

const avatarStyle = (size: number) => ({
  borderRadius: size / 2,
  height: size,
  width: size,
});

const styles = StyleSheet.create({
  avatar: avatarStyle(AVATAR_SIZE),
  bannerAvatar: avatarStyle(BANNER_AVATAR_SIZE),
});
