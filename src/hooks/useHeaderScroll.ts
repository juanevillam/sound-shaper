import { Platform } from 'react-native';

import { useAppTheme } from '@/core';
import { useHeaderScroll as useSharedHeaderScroll } from '@/ui';

/**
 * Thin adapter over the shared M3 app-bar hook — the threshold, the gesture-end
 * sampling and the measurements behind them live on `useHeaderScroll` in
 * `src/ui`.
 *
 * ANDROID ONLY: at rest the bar wears the page's own `background` (no band at
 * all), and lifts to `surface` — the chrome ground — once content is behind it
 * (Juan, 2026-09-08). iOS passes no colours, so nothing touches the
 * navigator's header there.
 *
 * Home does not use the navigator's bar at all — it draws its OWN bar as
 * content (so the expanded player can cover it) and paints it from `scrolled`
 * itself, calling the SHARED hook directly with no colours.
 */
export const useHeaderScroll = () => {
  const { colors } = useAppTheme();
  return useSharedHeaderScroll({
    headerColors:
      Platform.OS === 'android'
        ? { atRest: colors.background, scrolled: colors.surface }
        : undefined,
  });
};
