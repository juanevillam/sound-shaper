import { useMemo } from 'react';

import { Platform } from 'react-native';

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
        // What react-native-screens paints the native bars with before any
        // `headerStyle` lands. On Android the bar now RESTS on the page's own
        // `background` (M3's on-scroll bar — `useHeaderScroll` steps it to
        // `surface` once content is behind it), so the initial paint matches
        // the at-rest ground and nothing flashes. iOS keeps `surface`: its
        // bars are `headerTransparent`, and this only feeds the Liquid Glass
        // items' initial appearance.
        card: Platform.OS === 'android' ? colors.background : colors.surface,
        text: colors.onSurface,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [scheme, colors]);
}
