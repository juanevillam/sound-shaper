import React, { useCallback } from 'react';

import {
  Image as RNImage,
  Linking,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  Button,
  HStack,
  Host,
  Image,
  Spacer,
  Text,
  VStack,
  type ImageProps,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  onTapGesture,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { AppIcon } from './AppIcon';
import { AUTHOR_CREDIT, AUTHOR_URL } from './author';
import { GoogleSignInButton } from './GoogleSignInButton';
import { Screen } from './Screen';
import { duration, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';
import { type AuthAction, type WelcomeScreenProps } from './WelcomeScreen';

const LOGO_SIZE = 96;
const FEATURE_ICON_SIZE = 30;
const FEATURE_ICON_SLOT = 40;
const HERO_ENTRY_DURATION = duration.slow;
const FOOTER_ENTRY_DELAY = 120;
// SwiftUI `.infinity` stand-in — `frame` only takes numbers, so an
// over-large max width lets the CTA label stretch to the button's edges.
const FILL_WIDTH = 10_000;

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
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
  logo,
  features,
  authActions,
  colors,
  colorScheme,
}: WelcomeScreenProps) => {
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isSplashHidden = useSplashHidden();

  const openCredit = useCallback(() => {
    Linking.openURL(AUTHOR_URL);
  }, []);

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
          <RNImage source={logo as ImageSourcePropType} style={styles.logo} />
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
              <Text
                modifiers={[
                  font({ textStyle: 'subheadline' }),
                  multilineTextAlignment('center'),
                  ...(colors?.onSurfaceMuted
                    ? [foregroundStyle(colors.onSurfaceMuted)]
                    : []),
                  onTapGesture(openCredit),
                ]}
              >
                {AUTHOR_CREDIT}
              </Text>

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
                      controlSize('large'),
                      ...(colors?.primary ? [tint(colors.primary)] : []),
                      disabled(isDisabled || Boolean(action.isLoading)),
                    ]}
                  >
                    <HStack
                      spacing={spacing.sm}
                      modifiers={[frame({ maxWidth: FILL_WIDTH })]}
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
        </AnimatedEntrance>
      </ScrollView>
    </Screen>
  );
};
