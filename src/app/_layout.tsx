import { useEffect } from 'react';

import { Appearance, Platform, StyleSheet, Text, View } from 'react-native';

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
  setSplashHidden,
  SnackbarProvider,
  useNavigationTheme,
} from '@/ui';

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

// SOUND SHAPER IS iOS AND THE WEB ONLY (Juan, 2026-11-04). There is no Android
// build, but expo-router still compiles for it, so an Android run gets one
// plain screen saying so and nothing else — none of the app's hooks mount.
function NotAvailableOnAndroid() {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.unavailable, { backgroundColor: colors.background }]}>
      <Text style={[styles.unavailableText, { color: colors.onSurface }]}>
        {t('platform.androidUnavailable')}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return Platform.OS === 'android' ? <NotAvailableOnAndroid /> : <AppRoot />;
}

function AppRoot() {
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

  // Mirror the in-app theme override onto UIKit (window
  // overrideUserInterfaceStyle), so NATIVE chrome — nav bars, form sheets,
  // alerts, action sheets — matches the app palette instead of the system
  // scheme.
  useEffect(() => {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [theme]);

  const ready = layoutHydrated && authResolved && themeHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
      setSplashHidden(true);
    }
  }, [ready]);

  // Paint the native window background the theme background. `contentStyle`
  // colors each screen, but the react-native-screens root behind them defaults
  // to the system background and flashes (white in dark mode) during push/pop
  // transitions — this keeps that layer themed so back/forward never flickers.
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
            <SnackbarProvider dismissLabel={t('common.ok')}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
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
  unavailable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  unavailableText: { fontSize: 17, lineHeight: 22, textAlign: 'center' },
});
