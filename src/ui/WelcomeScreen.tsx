import React, { useCallback } from 'react';

import {
  Linking,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useColorScheme,
  View,
} from 'react-native';

import {
  Button,
  Column,
  Host,
  OutlinedButton,
  Row,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { AppIcon } from './AppIcon';
import { AUTHOR_CREDIT_PREFIX, AUTHOR_NAME, authorUrl } from './author';
import { BrandTile } from './BrandTile';
import { GoogleSignInButton } from './GoogleSignInButton';
import { type IconName } from './icons';
import { LegalFooter, type WelcomeLegal } from './LegalFooter';
import { Screen } from './Screen';
import { TextLink } from './TextLink';
import { duration, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';

const LOGO_SIZE = 96;
const LOGO_RADIUS = 24;
const LOGO_LETTER_SIZE = 56;
/** Glyph box for the brand mark inside the hero tile — sized so the mark reads
 *  like the app icon (mirrors its foreground proportions). */
const LOGO_GLYPH_SIZE = 90;
/**
 * Tile-to-title spacing. This was `spacing.lg`, which was a default rather than
 * a decision, and it rendered a 27.38dp ink gap under a 96dp tile — measured on
 * a Galaxy A54. Apple's own welcome template (the Passwords first-run screen,
 * band-scanned for the iOS variant's docblock) leaves 40.3pt under an 82pt
 * icon, a ratio of 0.49; the same ratio on a 96dp tile asks for about 47.
 *
 * `spacing.xxl` lands 43.4dp of ink — between Apple's absolute number and its
 * proportional one, and ON Material's 8dp grid rather than off it. The point is
 * not to match iOS: a hero mark needs room to read as a hero on either
 * platform, and 16 was simply not giving it any.
 *
 * NOTE this is spacing, not the rendered gap — a text view carries ascent
 * padding beyond its glyphs, measured at 11.4dp for `displaySmall` here. Same
 * caveat as the iOS variant's `LOGO_TITLE_GAP`; re-measure rather than
 * re-derive if the type scale moves.
 */
const LOGO_TITLE_GAP = spacing.xxl;
/**
 * The hero title's weight. M3 ships the display styles at Regular (400), which
 * is Material's default voice for body-of-the-scale type — but this is a hero,
 * and Material 3 Expressive added the `*Emphasized` styles for exactly that
 * moment: the same size and tracking at a heavier weight. `@expo/ui` 57 does
 * not expose the emphasized tokens (`TypographyStyle` is the 15 baseline
 * names), so the recipe is spelled out — `TextStyle` documents that "other
 * properties in this style object will override specific values from the
 * typography", which is what makes this `displaySmallEmphasized` rather than a
 * font size picked by hand.
 *
 * NOT a port of iOS's `largeTitle` + bold. That screen reads heavier for its
 * own reason and this one lands on Material's own answer to the same problem.
 */
const TITLE_WEIGHT = '700';
/**
 * The author credit's type and the air around it. RN rather than Compose — see
 * `TextLink` for why the Material `TextButton` was dropped and what it cost.
 *
 * The metrics ARE Material's `bodyMedium` (14sp on a 20sp line), restated here
 * because an RN `Text` cannot read the M3 type scale; they must move together
 * with the Compose `bodyMedium` the feature subtitles use, or the two stop
 * matching.
 *
 * THE GAPS ARE THE NOMINAL SPACING, NOT A RENDER BACK-SOLVED FROM THE OLD ONE,
 * and that distinction is the whole bug this replaced. When the credit came out
 * of the `Host` these were solved to reproduce the rhythm the screen had — but
 * that rhythm was inflated by the `TextButton`'s `ButtonDefaults.MinHeight`,
 * which centred one 20sp line inside a 36dp box, and the button was the thing
 * being deleted. Preserving it preserved the artifact: measured on a Galaxy
 * A54, the credit sat 28.09dp under the title and the feature list 63.29dp
 * under the credit, against the 31.0pt the iOS twin renders in the same place.
 * Juan spotted both by eye against his iPhone before any of it was measured.
 *
 * So they are tokens again — `xs` above, because the byline belongs to the
 * title, and `xl` below, Material's own step between content groups. Matching
 * iOS exactly is neither possible nor wanted: the ladders differ, and Android's
 * `displaySmall` carries more descent than a `largeTitle`.
 *
 * WHEN A BOX IS REMOVED, RESTORE THE INTENT — do not preserve what the box was
 * doing.
 */
const CREDIT_FONT_SIZE = 14;
const CREDIT_LINE_HEIGHT = 20;
const CREDIT_TOP_GAP = spacing.xs;
const CREDIT_BOTTOM_GAP = spacing.xl;
const HERO_ENTRY_DURATION = duration.slow;
const FOOTER_ENTRY_DELAY = 120;

export type WelcomeFeatureItem = {
  emoji: string;
  /** Optional Material icon rendered instead of the emoji on Android. */
  icon?: IconName;
  /** Optional SF Symbol name rendered instead of the emoji on iOS. */
  systemImage?: string;
  title: string;
  subtitle: string;
};

/** `apple` renders the branded Apple button only in the iOS variant — the
 *  Android screen has no Apple sign-in and falls through to a plain button,
 *  so don't pass it there. */
export type AuthActionProvider = 'google' | 'apple' | 'custom';

export type AuthAction = {
  provider?: AuthActionProvider;
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  variant?: 'filled' | 'outlined';
  /** Optional leading icon, rendered before the label. */
  icon?: IconName;
  onPress: () => void | Promise<void>;
};

export type WelcomeScreenProps = {
  appName: string;
  features: WelcomeFeatureItem[];
  authActions: [AuthAction] | [AuthAction, AuthAction];
  /** App-resolved color palette. */
  colors?: {
    background?: string;
    onSurface?: string;
    onSurfaceMuted?: string;
    primary?: string;
    primaryContainer?: string;
    onPrimaryContainer?: string;
  };
  colorScheme?: 'light' | 'dark';
  /**
   * App brand seed forwarded to the internal `<Host>`s so the native Compose
   * components (buttons) theme from the brand palette instead of the
   * wallpaper-derived one. Omit to keep dynamic Material colors.
   */
  seedColor?: string;
  /** Optional legal disclaimer rendered under the auth buttons (apps that
   *  handle user data pass it; the starter omits it). */
  legal?: WelcomeLegal;
  /** App brand mark rendered in the hero tile. Receives the tile's glyph size
   *  and the themed foreground color; falls back to the app's initial when
   *  omitted. Keep the mark themed (Material You), never a fixed brand color —
   *  the brand tile lives at the app's edges (icon/splash), not in-app. */
  logo?: (opts: { size: number; color?: string }) => React.ReactNode;
};

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
    marginBottom: spacing.lg,
    borderRadius: LOGO_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSlot: { marginBottom: LOGO_TITLE_GAP, alignSelf: 'center' },
  credit: {
    fontSize: CREDIT_FONT_SIZE,
    lineHeight: CREDIT_LINE_HEIGHT,
    marginTop: CREDIT_TOP_GAP,
    marginBottom: CREDIT_BOTTOM_GAP,
  },
  logoLetter: { fontSize: LOGO_LETTER_SIZE, fontWeight: '700' },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
});

const anyLoading = (actions: readonly AuthAction[]) =>
  actions.some(action => action.isLoading);

export const WelcomeScreen = ({
  appName,
  features,
  authActions,
  colors,
  colorScheme,
  seedColor,
  legal,
  logo,
}: WelcomeScreenProps) => {
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isSplashHidden = useSplashHidden();
  // Falls back to the device scheme so the tile never inverts against the
  // screen when an app forgets to pass `colorScheme`.
  const deviceScheme = useColorScheme();
  const scheme = (colorScheme ?? deviceScheme) === 'dark' ? 'dark' : 'light';

  const openCredit = useCallback(() => {
    Linking.openURL(authorUrl(appName));
  }, [appName]);

  const someLoading = anyLoading(authActions);

  return (
    <Screen backgroundColor={colors?.background}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: top + spacing.xxxl,
            paddingBottom: bottom + spacing.lg,
            paddingLeft: left + spacing.xl,
            paddingRight: right + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedEntrance
          duration={HERO_ENTRY_DURATION}
          isVisible={isSplashHidden}
        >
          {/* Brand mark on a themed tile. Apps pass their vector glyph via
              `logo`; the letter is the fallback when they don't. */}
          {logo ? (
            <View style={styles.logoSlot}>
              <BrandTile
                size={LOGO_SIZE}
                glyphSize={LOGO_GLYPH_SIZE}
                scheme={scheme}
                logo={logo}
              />
            </View>
          ) : (
            <View
              style={[
                styles.logo,
                { backgroundColor: colors?.primaryContainer },
              ]}
            >
              <RNText
                style={[
                  styles.logoLetter,
                  { color: colors?.onPrimaryContainer },
                ]}
              >
                {appName.charAt(0).toUpperCase()}
              </RNText>
            </View>
          )}
          <Host
            matchContents={{ vertical: true }}
            colorScheme={colorScheme}
            seedColor={seedColor}
          >
            <Column modifiers={[fillMaxWidth()]}>
              <Text
                color={colors?.onSurface}
                style={{ typography: 'displaySmall', fontWeight: TITLE_WEIGHT }}
              >
                {appName}
              </Text>
            </Column>
          </Host>

          {/* Only the name is the link. It is RN rather than a Material
              `TextButton`, which departs from native-primitive-first and is
              argued — with the measurements that forced it — in `TextLink`.
              Living outside the `Host` is what it costs: the hero is two Hosts
              now, with this one line of prose between them. iOS keeps a native
              SwiftUI `Link` and needs none of this. */}
          <RNText style={[styles.credit, { color: colors?.onSurfaceMuted }]}>
            {`${AUTHOR_CREDIT_PREFIX} `}
            <TextLink
              label={AUTHOR_NAME}
              color={colors?.primary}
              onPress={openCredit}
            />
          </RNText>

          <Host
            matchContents={{ vertical: true }}
            colorScheme={colorScheme}
            seedColor={seedColor}
          >
            <Column modifiers={[fillMaxWidth()]}>
              {/* Plain rows instead of ListItem (its leading slot floats on
                  two-line items). Top alignment lines the 24dp icon up with
                  the title's 24sp line box, the Material multi-line idiom. */}
              <Column
                modifiers={[fillMaxWidth()]}
                verticalArrangement={{ spacedBy: spacing.lg }}
              >
                {features.map(feature => (
                  <Row
                    key={feature.title}
                    verticalAlignment="top"
                    modifiers={[fillMaxWidth()]}
                  >
                    {feature.icon ? (
                      // Nudged down so the glyph optically matches the title,
                      // whose text sits low in its line box (ascent gap).
                      <AppIcon
                        name={feature.icon}
                        size={24}
                        tint={colors?.primary}
                        modifiers={[padding(0, 2, 0, 0)]}
                      />
                    ) : (
                      <Text style={{ fontSize: 24, lineHeight: 24 }}>
                        {feature.emoji}
                      </Text>
                    )}
                    <Spacer modifiers={[width(spacing.md)]} />
                    <Column modifiers={[weight(1)]}>
                      <Text
                        color={colors?.onSurface}
                        style={{
                          typography: 'titleMedium',
                        }}
                      >
                        {feature.title}
                      </Text>
                      <Text
                        color={colors?.onSurfaceMuted}
                        style={{
                          typography: 'bodyMedium',
                        }}
                      >
                        {feature.subtitle}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Column>
            </Column>
          </Host>
        </AnimatedEntrance>

        <AnimatedEntrance
          delay={FOOTER_ENTRY_DELAY}
          direction="up"
          duration={duration.slow}
          isVisible={isSplashHidden}
        >
          <View style={styles.actions}>
            {authActions.map(action => {
              const label =
                action.isLoading && action.loadingLabel
                  ? action.loadingLabel
                  : action.label;
              const isDisabled = someLoading && !action.isLoading;

              // Google's branding rules pin this button's colors, logo, and
              // type — it brings its own Host with spec colors instead of the
              // seeded palette.
              if (action.provider === 'google') {
                return (
                  <GoogleSignInButton
                    key={action.label}
                    label={label}
                    scheme={colorScheme}
                    disabled={isDisabled || Boolean(action.isLoading)}
                    onPress={action.onPress}
                  />
                );
              }

              const isOutlined = action.variant === 'outlined';
              const ButtonComponent = isOutlined ? OutlinedButton : Button;

              return (
                <Host
                  key={action.label}
                  matchContents={{ vertical: true }}
                  colorScheme={colorScheme}
                  seedColor={seedColor}
                >
                  <ButtonComponent
                    onClick={action.onPress}
                    enabled={!isDisabled && !action.isLoading}
                    modifiers={[fillMaxWidth()]}
                    // MONOCHROME, and it is the FILLED variant only — the same
                    // split the iOS twin makes, site for site. Monochrome is a
                    // BRAND rule rather than a platform one, so it crosses to
                    // Android; what does NOT cross is the decision about which
                    // controls it claims, and the three buckets already settled
                    // that. A filled CTA's colour is inherited (Material fills
                    // it with the accent because that is the default), so it
                    // takes the ink. An OUTLINED button derives both its wash
                    // and its label from the tint, and the monochrome version
                    // reads as disabled — so it keeps the accent, exactly as
                    // `actionButtonModifiersIos` does.
                    //
                    // Unlike SwiftUI, Material DOES invert a filled button's
                    // label for you — `contentColor` is a real role on the
                    // container, so there is no `labelColor` trap here. The
                    // disabled pair is deliberately left to Material.
                    colors={
                      isOutlined
                        ? undefined
                        : {
                            containerColor: colors?.onSurface,
                            contentColor: colors?.background,
                          }
                    }
                  >
                    {action.icon ? (
                      <>
                        <AppIcon
                          name={action.icon}
                          size={18}
                          // A bare `AppIcon` does not inherit the button's
                          // content colour the way `Text` does (see the icon
                          // theming notes), so it is mapped explicitly to
                          // whatever the container's label is.
                          tint={
                            isOutlined ? colors?.primary : colors?.background
                          }
                        />
                        <Spacer modifiers={[width(spacing.sm)]} />
                      </>
                    ) : null}
                    <Text>{label}</Text>
                  </ButtonComponent>
                </Host>
              );
            })}
          </View>
          {legal ? <LegalFooter legal={legal} colors={colors} /> : null}
        </AnimatedEntrance>
      </ScrollView>
    </Screen>
  );
};
