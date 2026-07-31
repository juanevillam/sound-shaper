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
import { AUTHOR_CREDIT, authorUrl } from './author';
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
  logoSlot: { marginBottom: spacing.lg, alignSelf: 'center' },
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
                style={{ typography: 'displaySmall' }}
              >
                {appName}
              </Text>
              <Text
                color={colors?.onSurfaceMuted}
                style={{ typography: 'bodyMedium' }}
                modifiers={[clickable(openCredit)]}
              >
                {AUTHOR_CREDIT}
              </Text>

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

              const ButtonComponent =
                action.variant === 'outlined' ? OutlinedButton : Button;

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
