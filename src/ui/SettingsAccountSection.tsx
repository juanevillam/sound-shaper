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
import { FormDisclosureIndicatorIos } from './FormDisclosureRowIos';
import { InitialArt } from './InitialArt';
import { SHEET_FIRST_CARD_MARGIN } from './sheetMetrics';

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

export type SettingsAccountSectionProps = {
  /** The identity the banner draws. No profile, no banner. */
  profile?: SettingsAccountProfile;
  /**
   * The account destination the banner opens — see `SettingsAccountLink`. No
   * link, no banner.
   */
  profileLink?: SettingsAccountLink;
  colors: SettingsAccountColors;
};

/**
 * What the trailing sign-out card reads (`SettingsSignOutSection`). Kept off
 * the section's own props: the identity banner never signs anyone out. The
 * screen's account config carries both (`SettingsAccountConfig`).
 */
export type SettingsSignOutProps = {
  signOutLabel: string;
  signOutDialog: {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onSignOut: () => void;
};

/**
 * iOS counterpart of `SettingsAccountSection`: the IDENTITY BANNER that leads
 * the Settings form and opens the account destination — avatar, name, a
 * legend naming what is behind it, a disclosure chevron. Apple's account
 * banner; why the app takes it is on `SettingsAccountLink`. Sign-out is NOT
 * here — it renders alone at the bottom of the sheet via
 * `SettingsSignOutSection`, which is where Apple puts it. Must be composed
 * inside the parent screen's `Form` or `List`. The Compose twin of this name
 * draws the same banner.
 */
export const SettingsAccountSection = ({
  profile,
  profileLink,
  colors,
}: SettingsAccountSectionProps) => {
  // No session, no identity to show — render no card at all.
  if (!profile || !profileLink) return null;

  return (
    /* AN ACCOUNT BANNER CARRIES NO SECTION HEADER. Both of Apple's — the
       Apple Account row at the top of Settings, and the identity card in the
       App Store's Apple Account sheet — are the first card on the screen with
       nothing labelling them: the avatar and the name say what the card is,
       and a header over them repeats it. */
    <Section
      modifiers={[
        listSectionMargins({
          edges: 'top',
          length: BANNER_TOP_MARGIN,
        }),
      ]}
    >
      {/* A plain `Button`, not a tinted action: the labels inside state
          `foregroundStyle` themselves, so the card stays neutral-plus-
          chevron the way navigation does in Apple's Settings. */}
      <Button onPress={profileLink.onPress}>
        <HStack spacing={BANNER_ART_GAP}>
          {/* SwiftUI `Image` can't load remote URLs, so the Google photo
              bridges back through RNHostView (same idiom as the Android
              Compose row). */}
          <VStack
            modifiers={[
              frame({ width: BANNER_AVATAR_SIZE, height: BANNER_AVATAR_SIZE }),
            ]}
          >
            <RNHostView>
              {profile.photoUrl ? (
                <RemoteImage
                  source={{ uri: profile.photoUrl }}
                  style={styles.bannerAvatar}
                  contentFit="cover"
                />
              ) : (
                /**
                 * THE INITIAL, like every other person without a photo in
                 * these apps — not an SF `person.crop.circle.fill`, which is
                 * what this row drew before.
                 *
                 * That glyph is Apple's mark for an account with no identity
                 * yet (a signed-OUT Apple Account); a signed-in person with a
                 * name gets a monogram in Contacts, Mail and Messages, and
                 * gets one everywhere else in this app. `InitialArt` is in
                 * this package precisely so a shared screen can draw the
                 * portfolio's answer instead of picking a glyph of its own.
                 *
                 * ONE HOST EITHER WAY: the branches swap inside a single
                 * `RNHostView` rather than adding a second one beside it,
                 * which is the ceiling a native row has.
                 */
                <InitialArt
                  size={BANNER_AVATAR_SIZE}
                  style={styles.bannerAvatar}
                  title={profile.displayName}
                  // Settings is a form sheet, where a dark row is already
                  // `surfaceContainer` — unstepped, the disc landed on its
                  // own card and only its letter showed (Juan, 2026-10-16).
                  container="sheet"
                />
              )}
            </RNHostView>
          </VStack>
          <VStack alignment="leading" spacing={2}>
            {/* THE BANNER'S NAME IS `headline` — 17 semibold, the ladder's
                own name for the face Apple titles a row with, and what the
                App Store's banner measures at. A STYLE, never a point size,
                so Dynamic Type still moves it. See `BANNER_AVATAR_SIZE`. */}
            <Text
              modifiers={[
                font({ textStyle: 'headline' }),
                foregroundStyle(colors.onSurface),
              ]}
            >
              {profile.displayName}
            </Text>
            {profileLink.subtitle ? (
              <Text
                modifiers={[
                  font({ textStyle: 'footnote' }),
                  foregroundStyle(colors.onSurfaceMuted),
                ]}
              >
                {profileLink.subtitle}
              </Text>
            ) : null}
          </VStack>
          {/* The chevron that says the card goes somewhere — the SAME glyph
              every other destination row in the portfolio draws, at the same
              size and the same muted colour (`FormDisclosureIndicatorIos`). A
              row with leading art and two lines cannot use
              `FormDisclosureRowIos`'s layout, so it takes the indicator on
              its own; that is exactly the case that export exists for. */}
          <Spacer />
          <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
        </HStack>
      </Button>
    </Section>
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
}: SettingsSignOutProps) => (
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
 */
const BANNER_TOP_MARGIN = SHEET_FIRST_CARD_MARGIN;

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

const styles = StyleSheet.create({
  bannerAvatar: {
    borderRadius: BANNER_AVATAR_SIZE / 2,
    height: BANNER_AVATAR_SIZE,
    width: BANNER_AVATAR_SIZE,
  },
});
