import { useEffect, useId, useRef } from 'react';

import {
  StyleSheet,
  useWindowDimensions,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@portfolio/core';
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE LOADING PLACEHOLDER — one bone, one sweep, for every app.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Both apps had a byte-identical copy of this atom (`Skeleton` in each app's
 * `components/ui/Skeleton.tsx`), which is exactly the duplication the shared
 * package exists to end — and it is what let them both carry the same wrong
 * animation for as long as they did. Each app keeps its own file of
 * CONTENT-SHAPED bones (a rail tile's bone is that app's geometry); only this
 * atom is shared.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHY A SWEEP, AND WHAT APPLE ACTUALLY DOES
 * ───────────────────────────────────────────────────────────────────────────
 *
 * APPLE'S OWN ANSWER IS NO ANIMATION AT ALL, and that is worth stating plainly
 * because it is the thing this file deliberately does not do. SwiftUI ships a
 * first-party skeleton primitive — `.redacted(reason: .placeholder)`, exposed
 * by @expo/ui 57 as the `redacted` modifier — and it renders plain static grey
 * shapes. Apple's own apps (App Store, Music, News, TV) match it: static blocks
 * that swap for content, no pulse and no sweep. Where Apple wants to signal
 * ACTIVITY rather than SHAPE it uses a spinner, which is a different control
 * for a different job — `ProgressViewIos`, the sibling of this file. Which of
 * the two a given wait takes is decided by AGENTS.md → "Waiting has two
 * shapes", and NOT by how long the wait is: a bone promises a layout that is
 * going to arrive, so a surface whose shape cannot be predicted before it
 * lands (search results) or a task the person started (a delete, a save) is
 * the spinner's, however long it runs.
 *
 * THE NATIVE PRIMITIVE IS THEREFORE NAMED AND REJECTED, as the standard
 * requires, and the reason is reach rather than taste: `.redacted` is a SwiftUI
 * view modifier, and most of what these bones stand in for is an RN scroller
 * (Home's feed, Profile's grid, Explore's mosaic). It cannot be applied to
 * them. Where a surface IS a native `List`, `redacted` is the better answer and
 * should be preferred — it is reachable today.
 *
 * THE SWEEP IS NOT AN ANDROID IDIOM EITHER, which is the misreading worth
 * heading off: it is Facebook's, open-sourced in 2015 for both platforms, and
 * it spread to Instagram, LinkedIn and YouTube. It is PRODUCT-CATEGORY
 * vernacular — what a social app looks like while it waits — and it renders
 * identically on both platforms, so adopting it does not make iOS wear
 * Android's clothes. It earns its place here because these apps wait on
 * Firestore over a network, where Apple's static block reads as frozen rather
 * than as loading.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  WHAT WAS WRONG WITH THE PULSE (the defect, not the taste)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The bone this replaces breathed its whole fill between 0.35 and 0.7 opacity
 * over a 1.5s cycle. Two things made that read as a "loading screen" rather
 * than as content arriving, and neither is fixed by slowing it down:
 *
 *  1. EVERY BONE SHARED ONE PHASE, so the entire screen throbbed as a single
 *     object. Nothing on either platform pulses in unison like that.
 *  2. Animating OPACITY ON THE FILL changes the block's contrast, so the page
 *     brightens and dims instead of something moving across it.
 *
 * Both are answered by construction below: the fill is now static and only a
 * highlight moves, and the sweep is driven from SCREEN POSITION so bones light
 * at different moments by definition.
 */

/** One traverse of the screen. Fast enough to read as motion, slow enough not
 *  to strobe — roughly Facebook's original cadence. */
const SWEEP_MS = 1200;
/**
 * How far the highlight's leading edge runs ahead per point of DEPTH — i.e.
 * the diagonal. `tan(20°)`, the angle the original shimmer uses.
 *
 * The BAND ITSELF IS NOT ROTATED, and that is a deliberate simplification
 * rather than an omission. The diagonal a reader perceives comes from bones at
 * different heights lighting at different moments, which this offset produces
 * on its own; rotating each band would additionally slant its edges, which
 * across a 14pt text bar is a ~5pt shift nobody can see, and it would cost an
 * oversized band and a transform on every bone. Revisit only if a very tall
 * bone ever needs it.
 */
const SKEW = 0.364;
/** Width of the moving highlight. Wide enough that its falloff is gradual on a
 *  full-width card, narrow enough to still read as a band and not a flash. */
const BAND_WIDTH = 220;

/**
 * ONE DRIVER FOR THE WHOLE APP, at module scope — not one loop per bone.
 *
 * This is what makes the sweep global: every bone reads the same clock, so a
 * bone near the top of the screen lights before one near the bottom because of
 * WHERE IT IS, not because of when it mounted. Per-bone loops (what the pulse
 * did) cannot produce that no matter how they are tuned — and they also meant
 * twenty independent animations running for one loading state.
 *
 * Ref-counted so the loop exists only while bones are on screen.
 */
const sweep = makeMutable(0);
let boneCount = 0;

const startSweep = () => {
  boneCount += 1;
  if (boneCount > 1) return;

  sweep.value = 0;
  sweep.value = withRepeat(
    // LINEAR, deliberately. An eased traverse slows at the edges, which reads
    // as the highlight hesitating at the screen margin; a specular sweep moves
    // at a constant rate.
    withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
    -1,
    false,
  );
};

const stopSweep = () => {
  boneCount = Math.max(0, boneCount - 1);
  if (boneCount === 0) cancelAnimation(sweep);
};

/**
 * THE HIGHLIGHT IS A DELIBERATELY THEME-INDEPENDENT WHITE, the same carve-out
 * the private badge's scrim documents: a specular highlight is light in both
 * appearances — there is no semantic token for "a glint travelling over a
 * surface", and the palette's inks all invert with the scheme, which is the
 * one thing this must not do.
 *
 * The STRENGTH does vary, because the ramps it sits on are not symmetric: in
 * light the base is already near-white so the highlight has to be strong enough
 * to separate, while in dark the same alpha would blow out to a white streak.
 */
const HIGHLIGHT = '#FFFFFF';
const HIGHLIGHT_ALPHA = { light: 0.6, dark: 0.09 } as const;

type SkeletonBoneProps = {
  /**
   * Square/ratio sizing from `width` — omits the fixed `height`, for bones the
   * real component sizes by aspect ratio rather than by a number.
   */
  aspectRatio?: number;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
};

/**
 * One neutral placeholder block. The fill is static `surfaceVariant`; a
 * highlight sweeps over it, positioned by where this bone sits on screen.
 *
 * REDUCE MOTION LANDS ON APPLE'S ANSWER EXACTLY: no loop, no band, just the
 * static shape — which is `.redacted(.placeholder)` in every respect but the
 * renderer.
 */
export function SkeletonBone({
  aspectRatio,
  height = 14,
  radius = 8,
  style,
  width = '100%',
}: SkeletonBoneProps) {
  const { colors, scheme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  // Unique per instance: two SVG gradients sharing an id collide.
  const gradientId = `skeleton-sweep-${useId()}`;

  const boneRef = useRef<View>(null);
  /**
   * WHERE THIS BONE IS, in window coordinates, collapsed to one number along
   * the sweep's axis. A shared value rather than state — the phase feeds an
   * animated style and must never cost a re-render.
   */
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;

    startSweep();
    return stopSweep;
  }, [reduceMotion]);

  /**
   * MEASURED IN WINDOW SPACE, once per layout — `onLayout`'s own x/y are
   * relative to the immediate parent, so a bone nested two views deep would
   * report a position that has nothing to do with where it is on screen, and
   * the sweep would break up into per-card sub-waves.
   *
   * This is not the re-measuring pattern the repo bans (a guessed chrome height
   * re-derived on every layout and focus change): it is one shot per bone per
   * layout, on a surface that exists for under a second, and being wrong by a
   * few points costs a slightly early highlight rather than a mislaid layout.
   */
  const measure = () => {
    boneRef.current?.measureInWindow((x, y) => {
      phase.value = x + y * SKEW;
    });
  };

  /**
   * The band's position in WINDOW space is `sweep` across the full travel; its
   * position inside THIS bone is that minus the bone's own offset. Travel spans
   * the screen's width plus what the diagonal adds over its height, plus the
   * band, so the highlight starts and ends fully off-screen.
   */
  const travel = screenWidth + screenHeight * SKEW + BAND_WIDTH;
  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -BAND_WIDTH + sweep.value * travel - phase.value },
    ],
  }));

  return (
    <View
      ref={boneRef}
      onLayout={reduceMotion ? undefined : measure}
      style={[
        // The fill no longer animates — see the note on the pulse above.
        { backgroundColor: colors.surfaceVariant, borderRadius: radius },
        aspectRatio ? { aspectRatio, width } : { height, width },
        // Clips the band to the bone's own shape, corners included.
        styles.bone,
        style,
      ]}
    >
      {reduceMotion ? null : (
        <Animated.View style={[styles.band, bandStyle]} pointerEvents="none">
          <Svg width={BAND_WIDTH} height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={HIGHLIGHT} stopOpacity={0} />
                <Stop
                  offset="0.5"
                  stopColor={HIGHLIGHT}
                  stopOpacity={HIGHLIGHT_ALPHA[scheme]}
                />
                <Stop offset="1" stopColor={HIGHLIGHT} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { overflow: 'hidden' },
  band: { bottom: 0, position: 'absolute', top: 0, width: BAND_WIDTH },
});
