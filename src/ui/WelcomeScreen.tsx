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
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  offset,
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
 * How far the author credit is drawn UP, back-solved from a render the way the
 * iOS variant's `LOGO_TITLE_GAP` was.
 *
 * The credit's name is a Material `TextButton`, which carries
 * `ButtonDefaults.MinHeight` (36dp) and 8dp of vertical content padding — so a
 * Row holding a 20sp line of prose inflates to the button's box and centres
 * everything inside it. Measured on a Galaxy A54: 24.18dp of ink between the
 * title and the credit, against the ~11dp the 4dp column spacing asks for.
 *
 * `offset` MOVES the row without resizing it, which is the point: the button
 * keeps its full 36dp box and its touch target, and only the drawing lands
 * where the rhythm wants it. The `Spacer` below gives back the same amount, so
 * the title-to-features pitch is unchanged.
 *
 * The real fix is an inline `LinkAnnotation` span — Material's own primitive
 * for a link INSIDE a sentence, which has no button box to fight. `@expo/ui`
 * 57's `TextSpanRecord` carries no press handler, so it is not reachable yet;
 * see `docs/pending-upstream.md`.
 */
const CREDIT_ROW_LIFT = 10;
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
            <Column
              modifiers={[fillMaxWidth()]}
              verticalArrangement={{ spacedBy: spacing.xs }}
            >
              <Text
                color={colors?.onSurface}
                style={{ typography: 'displaySmall', fontWeight: TITLE_WEIGHT }}
              >
                {appName}
              </Text>
              {/* Only the name is the link, and it is a Material `TextButton`
                  rather than a `clickable` Text — that is the M3 primitive for
                  a text-only action, so the ripple, the tinted label and the
                  48dp touch target all come from the framework. Its horizontal
                  content padding is trimmed to `xs` so the pair still reads as
                  one line of prose. iOS does the same split with a SwiftUI
                  `Link`; each platform in its own kit. */}
              <Row
                verticalAlignment="center"
                modifiers={[offset(0, -CREDIT_ROW_LIFT)]}
              >
                <Text
                  color={colors?.onSurfaceMuted}
                  style={{ typography: 'bodyMedium' }}
                >
                  {AUTHOR_CREDIT_PREFIX}
                </Text>
                <TextButton
                  onClick={openCredit}
                  colors={{ contentColor: colors?.primary }}
                  contentPadding={{ start: spacing.xs, end: spacing.xs }}
                >
                  <Text style={{ typography: 'bodyMedium' }}>
                    {AUTHOR_NAME}
                  </Text>
                </TextButton>
              </Row>

              <Spacer modifiers={[height(spacing.xxl - CREDIT_ROW_LIFT)]} />

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
