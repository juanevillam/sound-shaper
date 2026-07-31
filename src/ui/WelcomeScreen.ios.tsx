import React from 'react';

import {
  ScrollView,
  StyleSheet,
  Text as RNText,
  useColorScheme,
  View,
} from 'react-native';

import {
  Button,
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
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { AppIcon } from './AppIcon';
import { AppleSignInButton } from './AppleSignInButton';
import { AUTHOR_CREDIT_PREFIX, AUTHOR_NAME, authorUrl } from './author';
import { BrandTile } from './BrandTile';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LegalFooter } from './LegalFooter';
import { Screen } from './Screen';
import { duration, layout, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';
import { type AuthAction, type WelcomeScreenProps } from './WelcomeScreen';

const LOGO_SIZE = 96;
const LOGO_RADIUS = 24;
const LOGO_LETTER_SIZE = 56;
/** Glyph box for the brand mark inside the hero tile — sized so the mark reads
 *  like the app icon (mirrors its foreground proportions). */
const LOGO_GLYPH_SIZE = 90;
const FEATURE_ICON_SIZE = 30;
const FEATURE_ICON_SLOT = 40;
const HERO_ENTRY_DURATION = duration.slow;
const FOOTER_ENTRY_DELAY = 120;
// SwiftUI `.infinity` stand-in — `frame` only takes numbers, so an
// over-large max width lets the CTA label stretch to the button's edges.
const FILL_WIDTH = 10_000;
// A `bordered`/`borderedProminent` button paints its capsule around the label,
// so `.frame` on the button only pads the slot — the label is what grows the
// pill. At `controlSize('regular')` SwiftUI adds ~7pt above and below.
const CTA_LABEL_INSET = 7;
const CTA_LABEL_HEIGHT = layout.authButtonHeight - CTA_LABEL_INSET * 2;

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
    marginBottom: spacing.lg,
    alignSelf: 'center',
    borderRadius: LOGO_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSlot: { marginBottom: spacing.lg, alignSelf: 'center' },
  logoLetter: { fontSize: LOGO_LETTER_SIZE, fontWeight: '700' },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
});

const anyLoading = (actions: readonly AuthAction[]) =>
  actions.some(action => action.isLoading);

/**
 * iOS counterpart of `WelcomeScreen` — same prop API as the Android (Jetpack
 * Compose) variant, laid out as Apple's standard onboarding/welcome template:
 * centered logo and large bold title up top, leading-aligned feature rows with
 * tinted SF Symbol icons (falling back to the shared emoji when a feature has
 * no `systemImage`), and full-width large `borderedProminent`/`bordered`
 * buttons pinned to the bottom.
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
          <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
            <VStack spacing={spacing.xs}>
              <Text
                modifiers={[
                  font({ textStyle: 'largeTitle', weight: 'bold' }),
                  multilineTextAlignment('center'),
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

              <Spacer minLength={spacing.xxl} />

              <VStack alignment="leading" spacing={spacing.lg}>
                {features.map((feature, index) => (
                  <HStack
                    key={`${feature.title}-${index}`}
                    spacing={spacing.md}
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
                    ) : (
                      <Text
                        modifiers={[
                          font({ size: FEATURE_ICON_SIZE }),
                          frame({ width: FEATURE_ICON_SLOT }),
                        ]}
                      >
                        {feature.emoji}
                      </Text>
                    )}
                    <VStack alignment="leading" spacing={2}>
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
              const isOutlined = action.variant === 'outlined';
              const isDisabled = someLoading && !action.isLoading;

              // Google's branding rules pin this button's colors, logo, and
              // type, so it renders RN-side with spec colors instead of the
              // system tint.
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

              // Apple's branding rules likewise pin this button's black/white
              // variants and logo, so it renders RN-side with spec colors.
              if (action.provider === 'apple') {
                return (
                  <AppleSignInButton
                    key={action.label}
                    label={label}
                    scheme={colorScheme}
                    disabled={isDisabled || Boolean(action.isLoading)}
                    onPress={action.onPress}
                  />
                );
              }

              return (
                <Host
                  key={action.label}
                  matchContents={{ vertical: true }}
                  colorScheme={colorScheme}
                >
                  <Button
                    onPress={action.onPress}
                    modifiers={[
                      buttonStyle(
                        isOutlined ? 'bordered' : 'borderedProminent',
                      ),
                      // Sized and shaped to the branded sign-in buttons it
                      // stacks with (`layout.authButtonHeight`) — a 40pt pill —
                      // so the welcome CTAs read as one family. Google's and
                      // Apple's heights are pinned by their brand specs, so the
                      // system button is the one that gives.
                      controlSize('regular'),
                      buttonBorderShape('capsule'),
                      ...(colors?.primary ? [tint(colors.primary)] : []),
                      disabled(isDisabled || Boolean(action.isLoading)),
                    ]}
                  >
                    <HStack
                      spacing={spacing.sm}
                      // Two frames on purpose: `frame` takes the exact-size
                      // branch as soon as `height` is set (dropping `maxWidth`),
                      // so the fill-width frame has to be its own modifier.
                      modifiers={[
                        frame({ height: CTA_LABEL_HEIGHT }),
                        frame({ maxWidth: FILL_WIDTH }),
                      ]}
                    >
                      {action.icon ? (
                        <AppIcon
                          name={action.icon}
                          size={18}
                          // Filled (borderedProminent) labels are tinted by the
                          // system; only outlined buttons need the explicit tint.
                          tint={isOutlined ? colors?.primary : undefined}
                        />
                      ) : null}
                      <Text>{label}</Text>
                    </HStack>
                  </Button>
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
