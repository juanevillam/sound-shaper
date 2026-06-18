import { useMemo } from 'react';

import { Platform, useColorScheme } from 'react-native';

import { getMaterialColors } from '@expo/ui/jetpack-compose';

import { getAppThemeConfig } from './appTheme';
import {
  FALLBACK_COLORS,
  IOS_COLORS,
  materialToAppColors,
  type AppColors,
} from './colors';
import { useThemeStore } from '../stores/theme';

export type ResolvedScheme = 'light' | 'dark';

export function useAppTheme(): {
  scheme: ResolvedScheme;
  colors: AppColors;
  /** Brand seed from `configureAppTheme`, forwarded to `<Host seedColor>`. */
  seedColor?: string;
} {
  const systemScheme = useColorScheme();
  const theme = useThemeStore(s => s.theme);

  const scheme: ResolvedScheme =
    theme === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : theme;

  // Each platform gets its palette behind the same AppColors contract. Android
  // reads the live Material 3 palette — seeded from the app's brand color when
  // one is configured, otherwise the same dynamic source `<Host>` themes from —
  // so the RN and Compose sides always match. Off Android, a configured brand
  // palette wins; otherwise iOS uses Apple's system colors and anything else
  // falls back to the Material 3 baseline.
  const { seedColor, palettes } = getAppThemeConfig();

  const colors = useMemo<AppColors>(() => {
    if (Platform.OS === 'ios') return palettes?.[scheme] ?? IOS_COLORS[scheme];
    if (Platform.OS !== 'android')
      return palettes?.[scheme] ?? FALLBACK_COLORS[scheme];
    try {
      return materialToAppColors(getMaterialColors({ scheme, seedColor }));
    } catch {
      return palettes?.[scheme] ?? FALLBACK_COLORS[scheme];
    }
  }, [scheme, seedColor, palettes]);

  return { scheme, colors, seedColor };
}
