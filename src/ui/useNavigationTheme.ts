import { useMemo } from 'react';

import { useAppTheme } from '@portfolio/core';
import { DarkTheme, DefaultTheme } from 'expo-router';

/**
 * The app theme expressed as a React Navigation theme, to be handed to
 * `<ThemeProvider value={…}>` at the app root.
 *
 * This is not cosmetic duplication of `contentStyle`: React Navigation passes
 * these colors down to react-native-screens, which uses them for two native
 * layers nothing else reaches —
 *
 * 1. the container **behind** the screens, which shows through the screen
 *    card's rounded corners while a push/pop is animating, and
 * 2. the native nav bar's initial appearance, which its iOS 26 Liquid Glass
 *    items resolve against before any `headerStyle` is applied.
 *
 * Left at the built-in light `DefaultTheme`, both flash white in dark mode.
 */
export function useNavigationTheme() {
  const { colors, scheme } = useAppTheme();

  return useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        // The CHROME ground, not the card's: this is what react-native-screens
        // paints the native bars with, and `surface` is the one colour every
        // Android app bar here wears ("one ground, and it does not move").
        // It was `surfaceContainer`, which now resolves WITH the card — so a
        // js-tabs bar wore the row colour while every pushed screen's bar wore
        // `surface`, one hair apart in dark and identical in light.
        card: colors.surface,
        text: colors.onSurface,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [scheme, colors]);
}
