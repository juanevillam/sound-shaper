import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useNavigation } from 'expo-router';

// Below this the list is "at rest" and the app bar keeps the page's own ground;
// once content scrolls under it the bar steps up to its container colour. Small,
// not zero, so a hair of rubber-band overscroll at the top doesn't flip it.
const ELEVATE_THRESHOLD = 4;
// Coarse on purpose: this only acts on CROSSING the threshold, so there is
// nothing to gain from a sample every frame.
const SCROLL_THROTTLE_MS = 64;

/** The two grounds an M3 top app bar steps between. */
export type HeaderScrollColors = {
  /** The page's own ground, worn while the list is at the top. */
  atRest: string;
  /** The container colour, worn once content is behind the bar. */
  scrolled: string;
};

/**
 * Material 3 "on-scroll" top app bar. The bar carries the SAME ground as the
 * content while the list is at the top — so there is no seam and nothing to
 * read — and steps to the container colour once content scrolls beneath it.
 * Returns `scrolled` (also what collapses an extended FAB, and what a
 * hand-drawn bar paints itself with) and the scroll props to spread onto the
 * screen's list.
 *
 * THE SIGNAL IS THE CONTAINER COLOUR, NOT A SHADOW. This used to flip
 * `headerShadowVisible`, which is the Material 2 idiom — M3 replaced the top
 * app bar's elevation shadow with the colour step, and on a dark near-black
 * page a shadow is invisible anyway. Measured on a Galaxy A54 (Android 16):
 * the bar read #3A3A3D at rest AND scrolled, so the state had no expression at
 * all, and because it sat permanently at the scrolled colour it also left a
 * hard seam against the #010102 page on every screen that used it.
 *
 * The at-rest colour is the caller's `background` rather than M3's nominal
 * `surface` because that is the ground these screens actually scroll on. The
 * two coincide on AOSP; Samsung splits them (#010102 vs #17171A), and matching
 * the spec's token there would reintroduce the very seam this removes.
 *
 * THE ONE SCREEN THAT WANTS `surface` INSTEAD IS SETTINGS, and the difference
 * is what the content IS. Home and the showcases are full-bleed lists that
 * scroll UNDER the bar, so the bar sharing their ground is the whole point —
 * there is nothing to separate from. Settings is a page of CARDS with the page
 * showing between them, nothing ever passes behind the bar, and at `background`
 * the bar and the page read as one unbroken slab (Juan, 2026-08-29). There the
 * bar is chrome OVER content rather than the content's own ground, so it takes
 * M3's nominal `surface`: measured 24 levels against the page on a Galaxy A54
 * in dark, and it keeps the step to `surfaceContainer` intact, which pinning
 * the bar straight to the container colour would have spent.
 *
 * Apps express that with their own adapter's `elevatedBar` flag; the choice of
 * which two colours to hand over has always been the caller's.
 *
 * IT MUST WATCH THE END OF THE GESTURE, NOT ONLY THE STREAM — this is the half
 * that was missing, and it made the bar a one-way trip. A throttled `onScroll`
 * never samples the offset a list comes to REST at: scrolling home back to the
 * top on the A54, the last event delivered was `y=4.98`, which is above the 4dp
 * threshold, so the bar lit on the way down and stayed lit forever. The
 * terminal offset is exactly what `onMomentumScrollEnd` / `onScrollEndDrag`
 * report, so the threshold is re-evaluated there. Lowering the throttle would
 * only have made the miss rarer, not impossible.
 *
 * `setOptions` fires on the boolean flip, not on every scroll frame.
 *
 * A TAB SCREEN MUST PASS `headerNavigation` — the js-tabs navigator rather than
 * the route inside the tab's pass-through Slot. A pushed screen passes nothing
 * and gets its own.
 *
 * OMIT `headerColors` WHEN THE BAR IS NOT THE NAVIGATOR'S. Sound Shaper's home
 * draws its own app bar as CONTENT (so the player can cover it) and iOS leaves
 * the bar transparent for the system scroll-edge effect — in both cases there
 * is no `headerStyle` to set, and the caller paints from `scrolled` itself.
 * Without the colours this hook only reports the state.
 */
export const useHeaderScroll = ({
  headerNavigation,
  headerColors,
}: {
  /** The navigation object that owns this screen's header. Tab screens supply
   *  their tabs navigator; a pushed screen omits it and this hook uses its own,
   *  which is already the right one. */
  headerNavigation?: { setOptions: (options: object) => void };
  /** Omit to report `scrolled` without touching the navigator's header. */
  headerColors?: HeaderScrollColors;
} = {}) => {
  const ownNavigation = useNavigation();
  const navigation = headerNavigation ?? ownNavigation;
  const [scrolled, setScrolled] = useState(false);

  const apply = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y > ELEVATE_THRESHOLD;
      setScrolled(prev => (prev === next ? prev : next));
    },
    [],
  );

  // Spread as one bundle so a screen cannot wire the stream and forget the two
  // gesture-end events — which is the whole defect described above.
  const scrollProps = useMemo(
    () => ({
      onScroll: apply,
      onScrollEndDrag: apply,
      onMomentumScrollEnd: apply,
      scrollEventThrottle: SCROLL_THROTTLE_MS,
    }),
    [apply],
  );

  const atRest = headerColors?.atRest;
  const scrolledColor = headerColors?.scrolled;

  useEffect(() => {
    if (!atRest || !scrolledColor) return;

    navigation.setOptions({
      headerStyle: {
        backgroundColor: scrolled ? scrolledColor : atRest,
      },
      // The colour IS the elevation in M3; a shadow underneath it would be the
      // old idiom drawn on top of the new one.
      headerShadowVisible: false,
    });
  }, [navigation, scrolled, atRest, scrolledColor]);

  return { scrolled, scrollProps };
};
