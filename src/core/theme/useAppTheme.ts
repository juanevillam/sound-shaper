import { useMemo } from 'react';

import { useColorScheme } from 'react-native';

import { IOS_COLORS, type AppColors } from './colors';
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

  // Apple's system colours, behind the AppColors contract.
  const colors = useMemo<AppColors>(() => IOS_COLORS[scheme], [scheme]);

  return { scheme, colors };
}
