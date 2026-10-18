import { useEffect } from 'react';

import { Appearance, Platform, StyleSheet } from 'react-native';

import {
  Stack,
  ThemeProvider,
  usePathname,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { useAppTheme, useThemeStore } from '@/core';
import { useAuthListener } from '@/hooks/useAuthListener';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useI18n } from '@/i18n';
import { trackScreen } from '@/services/firebase/analytics';
// Imported for its side effect: App Check activates before the first
// Firestore call, so every request from here on can carry a token.
import '@/services/firebase/appCheck';
import { recordError } from '@/services/firebase/crashlytics';
import { useAuthStore } from '@/store/auth';
import { useLayoutStore } from '@/store/layout';
import {
  ErrorScreen,
  preloadIcons,
  setSplashHidden,
  SnackbarProvider,
  useNavigationTheme,
} from '@/ui';

// No brand seed: Sound Shaper rides the platform default palette — wallpaper-derived Material You on Android, Apple system
// colors on iOS.

SplashScreen.preventAutoHideAsync();

// UNHANDLED PROMISE REJECTIONS ARE SILENT IN A HERMES RELEASE BUILD. A thrown
// error crashes and reaches Crashlytics as a `JavascriptException`; a rejected
// promise nobody awaited goes nowhere at all. Hermes ships a tracker for
// exactly this — install it once, release only (dev already shows a LogBox).
type HermesRejectionTracker = {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, error: unknown) => void;
  }) => void;
};

if (!__DEV__) {
  (
    globalThis as { HermesInternal?: HermesRejectionTracker }
  ).HermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => recordError(error, 'UnhandledRejection'),
  });
}

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
  // The Home Screen widget's publisher. It lives at the ROOT rather than under
  // the authenticated subscriptions because signing out is exactly when it has
  // work to do — that tree unmounts, and the shared container would keep the
  // last person's library on the Home Screen.
  useWidgetSync();

  const pathname = usePathname();

  useEffect(() => trackScreen(pathname), [pathname]);

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

  // Paint the native window background the theme background — BOTH platforms.
  //
  // iOS: `contentStyle` colors each screen, but the react-native-screens root
  // behind them defaults to the system background and flashes (white in dark
  // mode) during push/pop transitions — this keeps that layer themed so
  // back/forward never flickers.
  //
  // Android: the window background is what shows through the (transparent)
  // 3-button navigation bar, which without this sat at a flat light #E6E6E6
  // under a dark app — measured on a Galaxy A54. This is the whole nav-bar
  // fix, and it needs no native module: `expo-system-ui` is already a
  // dependency and `expo-navigation-bar` is deliberately NOT one.
  //
  // ANDROID ONLY TAKES THIS AT COLD START, and the two appearances therefore
  // land differently. Measured on a Galaxy A54, 3-button navigation
  // (`navigation_mode 0`), density 450:
  //
  //   cold start in dark    nav bar #010101, system flips its glyphs light  ✅
  //   cold start in light   nav bar #FEFEFE, dark glyphs (unchanged)
  //   theme flipped at RUNTIME — bar keeps its old value until relaunch
  //
  // The runtime staleness is not a regression; the bar never followed a live
  // theme change. Fixing it, and controlling the light bar at all, means
  // `setNavigationBarContrastEnforced` / `isAppearanceLightNavigationBars` —
  // native levers that need `expo-navigation-bar`, which is deliberately not a
  // dependency, plus a prebuild and a native rebuild.
  //
  // One measurement worth not re-deriving: a mid-grey (#919192) light bar can
  // be produced by cold-starting in dark and then flipping to light, because
  // the window background lands on a window whose bar is still in its dark
  // state and Android scrims it. It looks good and it is NOT a state a real
  // launch reaches — do not chase it without the native lever above.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
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
                shipped as a hardcoded English 'OK' inside the provider's
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
