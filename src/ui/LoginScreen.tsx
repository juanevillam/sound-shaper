import React, { useCallback, useMemo } from 'react';

import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  Button,
  Column,
  Host,
  OutlinedButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { LoginFeature } from './LoginFeature';
import { Screen } from './Screen';
import { duration, opacity, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';

const LOGO_SIZE = 96;
const HERO_ENTRY_DURATION = duration.slow;
const FEATURE_ENTRY_DELAY_BASE = 80;
const FEATURE_ENTRY_DELAY_STEP = 60;
const FOOTER_ENTRY_DELAY = 280;

export type LoginFeatureItem = {
  emoji: string;
  title: string;
  subtitle: string;
};

export type AuthActionProvider = 'google' | 'apple' | 'custom';

export type AuthAction = {
  provider?: AuthActionProvider;
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  variant?: 'filled' | 'outlined';
  onPress: () => void | Promise<void>;
};

export type LoginScreenProps = {
  appName: string;
  logo: ImageSourcePropType;
  features: LoginFeatureItem[];
  creditLabel?: string;
  creditUrl?: string;
  authActions: [AuthAction] | [AuthAction, AuthAction];
  /** App-resolved color palette. */
  colors?: {
    background?: string;
    onSurface?: string;
    onSurfaceMuted?: string;
  };
  colorScheme?: 'light' | 'dark';
};

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xxxl,
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
    marginLeft: -spacing.xs,
  },
  credit: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    opacity: opacity.muted,
  },
  creditPressed: {
    opacity: opacity.soft,
    textDecorationLine: 'underline',
  },
  features: {
    gap: spacing.lg,
    marginTop: spacing.xxxl,
  },
  flex: { flex: 1 },
  hero: { alignItems: 'flex-start' },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  heroText: { flex: 1, gap: 4 },
  logo: { height: LOGO_SIZE, width: LOGO_SIZE },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
});

const anyLoading = (actions: readonly AuthAction[]) =>
  actions.some(action => action.isLoading);

export const LoginScreen = ({
  appName,
  logo,
  features,
  creditLabel,
  creditUrl,
  authActions,
  colors,
  colorScheme,
}: LoginScreenProps) => {
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isSplashHidden = useSplashHidden();

  const openCredit = useCallback(() => {
    if (creditUrl) Linking.openURL(creditUrl);
  }, [creditUrl]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingTop: top + spacing.xxxl,
          paddingBottom: bottom + spacing.lg,
          paddingLeft: left + spacing.xl,
          paddingRight: right + spacing.xl,
        },
      }),
    [bottom, left, right, top],
  );

  const someLoading = anyLoading(authActions);

  return (
    <Screen backgroundColor={colors?.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, dynamicStyles.scroll]}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <AnimatedEntrance
              duration={HERO_ENTRY_DURATION}
              isVisible={isSplashHidden}
            >
              <View style={styles.hero}>
                <View style={styles.heroRow}>
                  <Image source={logo} style={styles.logo} />
                  <Host
                    matchContents
                    colorScheme={colorScheme}
                    style={styles.heroText}
                  >
                    <Column>
                      <Text style={{ typography: 'displaySmall' }}>
                        {appName}
                      </Text>
                      {creditLabel ? (
                        <Text
                          color={colors?.onSurfaceMuted}
                          style={{ typography: 'bodyMedium' }}
                        >
                          {creditLabel}
                        </Text>
                      ) : null}
                    </Column>
                  </Host>
                  {creditLabel && creditUrl ? (
                    <Pressable
                      onPress={openCredit}
                      style={StyleSheet.absoluteFill}
                      accessibilityRole="link"
                      accessibilityLabel={creditLabel}
                    />
                  ) : null}
                </View>
              </View>
            </AnimatedEntrance>
            <View style={styles.features}>
              {features.map((feature, index) => (
                <AnimatedEntrance
                  delay={
                    FEATURE_ENTRY_DELAY_BASE + index * FEATURE_ENTRY_DELAY_STEP
                  }
                  duration={duration.base}
                  isVisible={isSplashHidden}
                  key={`${feature.emoji}-${index}`}
                >
                  <LoginFeature
                    colorScheme={colorScheme}
                    emoji={feature.emoji}
                    title={feature.title}
                    subtitle={feature.subtitle}
                    subtitleColor={colors?.onSurfaceMuted}
                  />
                </AnimatedEntrance>
              ))}
            </View>
          </View>
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
                const ButtonComponent =
                  action.variant === 'outlined' ? OutlinedButton : Button;

                return (
                  <Host
                    key={action.label}
                    matchContents
                    colorScheme={colorScheme}
                  >
                    <ButtonComponent
                      onClick={action.onPress}
                      enabled={!isDisabled && !action.isLoading}
                      modifiers={[fillMaxWidth()]}
                    >
                      <Text>{label}</Text>
                    </ButtonComponent>
                  </Host>
                );
              })}
            </View>
          </AnimatedEntrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
