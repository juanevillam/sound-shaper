import React from 'react';

import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import {
  HStack,
  Host,
  Image,
  Link,
  Spacer,
  Text,
  VStack,
  type ImageProps,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
} from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { AppleSignInButton } from './AppleSignInButton';
import { authButtonPoleKey } from './AuthButtonIos';
import { AUTHOR_CREDIT_PREFIX, AUTHOR_NAME, authorUrl } from './author';
import { BrandTile } from './BrandTile';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LegalFooter } from './LegalFooter';
import { Screen } from './Screen';
import { duration, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';
import { type AuthAction, type WelcomeScreenProps } from './WelcomeScreen';

/**
 * Layout constants, MEASURED off Apple's own welcome template — the Passwords
 * app's first-run screen, which carries exactly this content (app icon, title,
 * three icon+title+subtitle rows, one pinned CTA). Captured on iPhone 17 /
 * iOS 26.5 at 3x and band-scanned; see `docs/dev-workflow.md` for the method.
 * Don't round these back to the 4pt grid — 38 and 19 are Apple's, not ours.
 *
 *   content inset       38.0pt (the CTA's own margins measure 38.0 too)
 *   app icon            82 x 82pt, centred
 *   icon → title        40.3pt   title → first row   31.0pt
 *   row → row           19.0pt   title → subtitle     9.7pt
 *   icon column         text starts 48.6pt in from the content edge
 *   CTA                 50.3pt tall, 38.3pt above the screen's bottom edge
 *
 * Two deliberate divergences. Apple centres nothing but the icon, and we keep
 * an author credit line under the title that their template has no equivalent
 * for. And the CTA is 44pt, not Apple's 50.3: this stack can also hold the
 * Google and Apple sign-in buttons, whose contents are pinned by brand specs,
 * and the family standardises on that constrained button — see
 * `layout.authButtonHeight`.
 */
const CONTENT_INSET = 38;
const LOGO_SIZE = 82;
/** Glyph box for the brand mark inside the hero tile — sized so the mark reads
 *  like the app icon (mirrors its foreground proportions: 0.9375 of the tile). */
const LOGO_GLYPH_SIZE = 77;
/* The next three are SPACING values, not the rendered gaps above: a text view
 * carries ascent/descent padding beyond its glyphs, so each is the target gap
 * minus that overhead, back-solved from a render (40.3 needed 32, 31.0 needed
 * 20). Re-measure rather than re-derive if the type scale ever moves. */
const LOGO_TITLE_GAP = 32;
const TITLE_FEATURES_GAP = 20;
/* Left at Apple's number because it already lands: with three-line rows our
 * row-start pitch measures 79.3/79.7pt against Apple's 79.0/80.6. */
const FEATURE_ROW_GAP = 19;
const FEATURE_TEXT_GAP = 2;
const FEATURE_ICON_SIZE = 30;
const FEATURE_ICON_SLOT = 40;
/** Icon slot + this gap = the 48.6pt Apple leaves before a row's text column. */
const FEATURE_ICON_GAP = 9;
/** Apple's CTA sits 38.3pt off the bottom edge; the home indicator owns 34 of
 *  it, so the screen adds the remainder. */
const CTA_BOTTOM_GAP = 4;
/** Breathing room above the pinned CTA block. Invisible while the hero fits
 *  (the flex-grown scroll area simply gives the height back), and load-bearing
 *  once it doesn't: it keeps the last feature row from running into the button
 *  when the content scrolls — at a large Dynamic Type size, in a wordier
 *  locale, or on a shorter device. */
const FOOTER_TOP_GAP = spacing.lg;
const HERO_ENTRY_DURATION = duration.slow;
const FOOTER_ENTRY_DELAY = 120;
// SwiftUI `.infinity` stand-in — `frame` only takes numbers, so an
// over-large max width lets the CTA label stretch to the button's edges.
const FILL_WIDTH = 10_000;

const styles = StyleSheet.create({
  root: { flex: 1 },
  actions: { gap: spacing.sm },
  logoSlot: { marginBottom: LOGO_TITLE_GAP, alignSelf: 'center' },
  scroll: { flexGrow: 1 },
});

const anyLoading = (actions: readonly AuthAction[]) =>
  actions.some(action => action.isLoading);

/**
 * iOS counterpart of `WelcomeScreen` — same prop API as the Android (Jetpack
 * Compose) variant, laid out as Apple's standard onboarding/welcome template:
 * centered logo and large bold title up top, leading-aligned feature rows with
 * tinted SF Symbol icons, and the Apple and Google sign-in buttons pinned to
 * the bottom.
 */
export const WelcomeScreen = ({
  appName,
  features,
  authActions,
  colors,
  colorScheme,
  legal,
  logo,
}: WelcomeScreenProps) => {
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isSplashHidden = useSplashHidden();
  // Falls back to the device scheme so the tile never inverts against the
  // screen when an app forgets to pass `colorScheme`.
  const deviceScheme = useColorScheme();
  const scheme = (colorScheme ?? deviceScheme) === 'dark' ? 'dark' : 'light';

  const someLoading = anyLoading(authActions);
  const hasApple = authActions.some(action => action.provider === 'apple');

  return (
    <Screen backgroundColor={colors?.background}>
      {/* The CTA block is a SIBLING of the scroll view, not its last child —
          Apple pins it with `.safeAreaInset(edge: .bottom)`, which @expo/ui 57
          does not expose. Keeping it outside is the honest equivalent: the
          button never scrolls out of reach on a small screen or at a large
          Dynamic Type size, which is exactly what the inset guarantees. */}
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: top + spacing.xxxl,
              paddingBottom: spacing.xl,
              paddingLeft: left + CONTENT_INSET,
              paddingRight: right + CONTENT_INSET,
            },
          ]}
        >
          <AnimatedEntrance
            duration={HERO_ENTRY_DURATION}
            isVisible={isSplashHidden}
          >
            {/* Brand mark on a themed tile — the app's vector glyph via
              `logo`. */}
            {logo ? (
              <View style={styles.logoSlot}>
                <BrandTile
                  size={LOGO_SIZE}
                  glyphSize={LOGO_GLYPH_SIZE}
                  scheme={scheme}
                  logo={logo}
                />
              </View>
            ) : null}
            <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
              {/* Leading, not centred: Apple centres the app icon and then runs
                the title, the rows and the CTA off one shared left edge. The
                `frame` is what makes `alignment` mean anything — a VStack
                sizes to its content, so without it the column would hug its
                widest line and sit centred in the Host. */}
              <VStack
                alignment="leading"
                spacing={spacing.xs}
                modifiers={[frame({ maxWidth: FILL_WIDTH })]}
              >
                <Text
                  modifiers={[
                    font({ textStyle: 'largeTitle', weight: 'bold' }),
                    multilineTextAlignment('leading'),
                    ...(colors?.onSurface
                      ? [foregroundStyle(colors.onSurface)]
                      : []),
                  ]}
                >
                  {appName}
                </Text>
                {/* Only the name is the link — a native SwiftUI `Link`, so it
                  gets the system's link affordances (tint, press feedback,
                  long-press preview/share menu) for free. */}
                <HStack spacing={spacing.xs}>
                  <Text
                    modifiers={[
                      font({ textStyle: 'subheadline' }),
                      ...(colors?.onSurfaceMuted
                        ? [foregroundStyle(colors.onSurfaceMuted)]
                        : []),
                    ]}
                  >
                    {AUTHOR_CREDIT_PREFIX}
                  </Text>
                  <Link destination={authorUrl(appName)}>
                    <Text
                      modifiers={[
                        font({ textStyle: 'subheadline' }),
                        ...(colors?.primary
                          ? [foregroundStyle(colors.primary)]
                          : []),
                      ]}
                    >
                      {AUTHOR_NAME}
                    </Text>
                  </Link>
                </HStack>

                <Spacer minLength={TITLE_FEATURES_GAP} />

                <VStack alignment="leading" spacing={FEATURE_ROW_GAP}>
                  {features.map((feature, index) => (
                    <HStack
                      key={`${feature.title}-${index}`}
                      alignment="top"
                      spacing={FEATURE_ICON_GAP}
                    >
                      {feature.systemImage ? (
                        <Image
                          systemName={
                            feature.systemImage as NonNullable<
                              ImageProps['systemName']
                            >
                          }
                          size={FEATURE_ICON_SIZE}
                          color={colors?.primary}
                          modifiers={[frame({ width: FEATURE_ICON_SLOT })]}
                        />
                      ) : null}
                      <VStack alignment="leading" spacing={FEATURE_TEXT_GAP}>
                        <Text
                          modifiers={[
                            font({ textStyle: 'headline' }),
                            ...(colors?.onSurface
                              ? [foregroundStyle(colors.onSurface)]
                              : []),
                          ]}
                        >
                          {feature.title}
                        </Text>
                        <Text
                          modifiers={[
                            font({ textStyle: 'subheadline' }),
                            ...(colors?.onSurfaceMuted
                              ? [foregroundStyle(colors.onSurfaceMuted)]
                              : []),
                          ]}
                        >
                          {feature.subtitle}
                        </Text>
                      </VStack>
                      <Spacer />
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Host>
          </AnimatedEntrance>
        </ScrollView>

        <AnimatedEntrance
          delay={FOOTER_ENTRY_DELAY}
          direction="up"
          duration={duration.slow}
          isVisible={isSplashHidden}
        >
          <View
            style={{
              paddingTop: FOOTER_TOP_GAP,
              paddingLeft: left + CONTENT_INSET,
              paddingRight: right + CONTENT_INSET,
              paddingBottom: bottom + CTA_BOTTOM_GAP,
            }}
          >
            <View style={styles.actions}>
              {authActions.map(action => {
                const label =
                  action.isLoading && action.loadingLabel
                    ? action.loadingLabel
                    : action.label;
                const isDisabled = someLoading && !action.isLoading;

                // Google's branding rules pin this button's colors, logo, and
                // type, so it renders RN-side with spec colors instead of the
                // system tint. BESIDE APPLE'S the two share one pole and one
                // mold — see `AuthButtonIos` (Juan, 2026-10-16: the pair read
                // as two products).
                if (action.provider === 'google') {
                  return (
                    <GoogleSignInButton
                      key={action.label}
                      label={label}
                      scheme={scheme}
                      variant={hasApple ? authButtonPoleKey(scheme) : undefined}
                      disabled={isDisabled || Boolean(action.isLoading)}
                      onPress={action.onPress}
                    />
                  );
                }

                // Drawn from the same mold as Google's — see
                // `AppleSignInButton` and `AuthButtonIos`.
                if (action.provider === 'apple') {
                  return (
                    <AppleSignInButton
                      key={action.label}
                      label={label}
                      scheme={scheme}
                      disabled={isDisabled || Boolean(action.isLoading)}
                      onPress={action.onPress}
                    />
                  );
                }

                return null;
              })}
            </View>
            {legal ? <LegalFooter legal={legal} colors={colors} /> : null}
          </View>
        </AnimatedEntrance>
      </View>
    </Screen>
  );
};
