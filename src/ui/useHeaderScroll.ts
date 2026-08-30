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
 * THE BAR RESTS ON `surface` AND LIFTS TO `surfaceRaised`, ON EVERY SCREEN.
 *
 * It used to rest on the caller's `background` and lift to `surfaceContainer`,
 * which is the spec's own pair and was wrong twice on a One UI palette. The
 * lifted colour arrived as a slab — `surfaceContainer` sits 24 L* off a
 * near-black page there, heavier than anything else on screen — and resting on
 * `background` meant a screen that never scrolls (Settings) had no bar at all,
 * just an unbroken sheet of page colour from the status bar down.
 *
 * Fixing that per screen was tried first and is the wrong shape: it gave
 * Settings its own at-rest colour, so two screens of one app had different
 * chrome (Juan, 2026-08-29 — "we can't have diff screens having bg of diff
 * colors"). One pair, everywhere. `surface` is M3's own top-app-bar ground and
 * reads as chrome without being an event; `surfaceRaised` is a measured step
 * above it rather than a named token, because Samsung's container ladder is not
 * monotonic — see `raisedMaterial` in `@portfolio/core`.
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
