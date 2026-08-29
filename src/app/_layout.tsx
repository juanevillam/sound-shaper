import { useEffect } from 'react';

import { Appearance, Platform, StyleSheet } from 'react-native';

import {
  ErrorScreen,
  preloadIcons,
  setSplashHidden,
  useNavigationTheme,
} from '@portfolio/mobile-ui';
import { Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuthListener } from '@/hooks/useAuthListener';
import { useI18n } from '@/i18n';
import { SnackbarProvider } from '@/providers/SnackbarProvider';
import { recordError } from '@/services/firebase/crashlytics';
import { useAuthStore } from '@/store/auth';
import { useLayoutStore } from '@/store/layout';
import { useThemeStore } from '@/store/theme';

// No brand seed: like every portfolio app, Sound Shaper rides the platform
// default palette — wallpaper-derived Material You on Android, Apple system
// colors on iOS.

SplashScreen.preventAutoHideAsync();

// Root fallback for any route that throws during render (expo-router picks this
// export up and cascades it to child routes without their own).
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  useEffect(() => {
    recordError(error, 'RootErrorBoundary');
  }, [error]);

  return (
    <ErrorScreen
      title={t('errors.title')}
      message={t('errors.message')}
      retryLabel={t('errors.retry')}
      onRetry={() => void retry()}
      colors={{
        background: colors.background,
        onSurface: colors.onSurface,
        onSurfaceMuted: colors.onSurfaceMuted,
        primary: colors.primary,
        onPrimary: colors.onPrimary,
      }}
    />
  );
}

export default function RootLayout() {
  const { t } = useI18n();
  const layoutHydrated = useLayoutStore(s => s.hasHydrated);
  const authResolved = useAuthStore(s => s.hasResolved);
  const themeHydrated = useThemeStore(s => s.hasHydrated);
  const theme = useThemeStore(s => s.theme);
  const { colors } = useAppTheme();
  const navigationTheme = useNavigationTheme();

  useAuthListener();

  // iOS: mirror the in-app theme override onto UIKit (window
  // overrideUserInterfaceStyle), so NATIVE chrome — nav bars, form sheets,
  // alerts, action sheets — matches the app palette instead of the system
  // scheme. Android chrome is themed explicitly per-Host, so it needs no
  // override.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [theme]);

  const ready = layoutHydrated && authResolved && themeHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
      setSplashHidden(true);
    }
  }, [ready]);

  // Warm the icon drawable cache once so deep screens don't pay a per-icon
  // fetch on first render. Non-blocking — never gates app readiness.
  useEffect(() => {
    preloadIcons().catch(() => {});
  }, []);

  // iOS: paint the native root view the theme background. `contentStyle` colors
  // each screen, but the react-native-screens root behind them defaults to the
  // system background and flashes (white in dark mode) during push/pop
  // transitions — this keeps that layer themed so back/forward never flickers.
  // iOS-only: Android's window is frozen for release.
  useEffect(() => {
    if (Platform.OS === 'ios') {
      SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    }
  }, [colors.background]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Explicit provider seeded with the native metrics captured at launch,
          so insets are correct on the FIRST frame. Without it the app leaned on
          React Navigation's implicit provider, whose insets can resolve async
          (0 → real) — that gap dropped the bottom player banner under the nav
          bar on some frames. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider value={navigationTheme}>
          <KeyboardProvider>
            {/* `dismissLabel` is Android's action-less dismiss slot — it
                shipped as a hardcoded English 'OK' inside the package's
                default, the one user-facing string outside translations.ts.
                Walked on the A54 2026-08-28: a clip-saved toast renders "Clip
                saved" with an "OK" dismiss. Topper carries the identical
                line. */}
            <SnackbarProvider dismissLabel={t('common.ok')}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                  // Welcome ↔ app hand-off fades like every other Android push.
                  animation: Platform.select({ android: 'fade_from_bottom' }),
                }}
              />
            </SnackbarProvider>
          </KeyboardProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
