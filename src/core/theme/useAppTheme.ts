import { useMemo } from 'react';

import { Platform, useColorScheme } from 'react-native';

import { getMaterialColors } from '@expo/ui/jetpack-compose';

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
} {
  const systemScheme = useColorScheme();
  const theme = useThemeStore(s => s.theme);

  const scheme: ResolvedScheme =
    theme === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : theme;

  // Each platform gets its palette behind the same AppColors contract. Android
  // reads the live Material 3 palette — the same dynamic source `<Host>` themes
  // from — so the RN and Compose sides always match. iOS uses Apple's system
  // colors and anything else falls back to the Material 3 baseline.
  const colors = useMemo<AppColors>(() => {
    if (Platform.OS === 'ios') return IOS_COLORS[scheme];
    if (Platform.OS !== 'android') return FALLBACK_COLORS[scheme];
    try {
      return materialToAppColors(getMaterialColors({ scheme }));
    } catch {
      return FALLBACK_COLORS[scheme];
    }
  }, [scheme]);

  return { scheme, colors };
}
