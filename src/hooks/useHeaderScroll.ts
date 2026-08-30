import { Platform } from 'react-native';

import { useHeaderScroll as useSharedHeaderScroll } from '@portfolio/mobile-ui';

import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Thin adapter over the shared M3 on-scroll app bar hook — the threshold, the
 * gesture-end sampling and the `setOptions` write all live on
 * `useHeaderScroll` in `@portfolio/mobile-ui`, with the measurements that
 * produced them. This supplies only the two grounds, since a package has no
 * theme of its own.
 *
 * ANDROID ONLY PAINTS THE NAVIGATOR'S BAR, and that split is this app's, not
 * the hook's. iOS leaves `headerStyle` alone on purpose: a transparent bar is
 * what arms the system scroll-edge effect, so the bar is clear over the top of
 * the content and materialises as Liquid Glass once anything is behind it (see
 * the stack's `screenOptions`). Painting a background there would opt out of
 * all of it. `scrolled` still comes back on both platforms for a bar the
 * screen draws itself.
 *
 * @param ownBar the screen paints its own app bar from `scrolled` (home draws
 *   one as CONTENT so the expanded player can cover it), so the navigator's
 *   header must not be touched on either platform.
 */
export const useHeaderScroll = ({
  ownBar = false,
}: { ownBar?: boolean } = {}) => {
  const { colors } = useAppTheme();

  return useSharedHeaderScroll({
    headerColors:
      ownBar || Platform.OS === 'ios'
        ? undefined
        : { atRest: colors.surface, scrolled: colors.surfaceRaised },
  });
};
