import React, { useCallback } from 'react';

import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  type ImageSourcePropType,
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
  clickable,
  fillMaxWidth,
  height,
  padding,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedEntrance } from './AnimatedEntrance';
import { AppIcon } from './AppIcon';
import { type IconName } from './icons';
import { Screen } from './Screen';
import { duration, spacing } from './tokens';
import { useSplashHidden } from './useSplashHidden';

const LOGO_SIZE = 96;
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
  logo: ImageSourcePropType;
  features: WelcomeFeatureItem[];
  creditLabel?: string;
  creditUrl?: string;
  authActions: [AuthAction] | [AuthAction, AuthAction];
  /** App-resolved color palette. */
  colors?: {
    background?: string;
    onSurface?: string;
    onSurfaceMuted?: string;
    primary?: string;
  };
  colorScheme?: 'light' | 'dark';
};

const styles = StyleSheet.create({
  logo: { height: LOGO_SIZE, width: LOGO_SIZE, marginBottom: spacing.lg },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
});

const anyLoading = (actions: readonly AuthAction[]) =>
  actions.some(action => action.isLoading);

export const WelcomeScreen = ({
  appName,
  logo,
  features,
  creditLabel,
  creditUrl,
  authActions,
  colors,
  colorScheme,
}: WelcomeScreenProps) => {
  const { top, bottom, left, right } = useSafeAreaInsets();
  const isSplashHidden = useSplashHidden();

  const openCredit = useCallback(() => {
    if (creditUrl) Linking.openURL(creditUrl);
  }, [creditUrl]);

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
          <Image source={logo} style={styles.logo} />
          <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
            <Column
              modifiers={[fillMaxWidth()]}
              verticalArrangement={{ spacedBy: spacing.xs }}
            >
              <Text
                color={colors?.onSurface}
                style={{ typography: 'displaySmall' }}
              >
                {appName}
              </Text>
              {creditLabel ? (
                <Text
                  color={colors?.onSurfaceMuted}
                  style={{ typography: 'bodyMedium' }}
                  modifiers={creditUrl ? [clickable(openCredit)] : undefined}
                >
                  {creditLabel}
                </Text>
              ) : null}

              <Spacer modifiers={[height(spacing.xxl)]} />

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
                        style={{ typography: 'titleMedium' }}
                      >
                        {feature.title}
                      </Text>
                      <Text
                        color={colors?.onSurfaceMuted}
                        style={{ typography: 'bodyMedium' }}
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
          <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
            <Column
              modifiers={[fillMaxWidth()]}
              verticalArrangement={{ spacedBy: spacing.sm }}
            >
              {authActions.map(action => {
                const label =
                  action.isLoading && action.loadingLabel
                    ? action.loadingLabel
                    : action.label;
                const isDisabled = someLoading && !action.isLoading;
                const ButtonComponent =
                  action.variant === 'outlined' ? OutlinedButton : Button;

                return (
                  <ButtonComponent
                    key={action.label}
                    onClick={action.onPress}
                    enabled={!isDisabled && !action.isLoading}
                    modifiers={[fillMaxWidth()]}
                  >
                    {action.icon ? (
                      <>
                        <AppIcon
                          name={action.icon}
                          size={18}
                          tint={colors?.primary}
                        />
                        <Spacer modifiers={[width(spacing.sm)]} />
                      </>
                    ) : null}
                    <Text>{label}</Text>
                  </ButtonComponent>
                );
              })}
            </Column>
          </Host>
        </AnimatedEntrance>
      </ScrollView>
    </Screen>
  );
};
