import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTrophyStore } from './store';
import { tierColor } from './tierColors';
import { TrophyIcon, TROPHY_PATH } from './TrophyIcon';
import { type QueuedTrophy, type TrophyCopy } from './types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** Colors the banner paints with — pass your Material You roles. */
export type TrophyOverlayColors = {
  /** Banner background (use an elevated surface, e.g. surfaceContainerHigh). */
  surface: string;
  onSurface: string;
  onSurfaceMuted: string;
  /** The one accent in the feature — the platinum banner's glow. */
  primary: string;
};

export type TrophyOverlayStrings = {
  /** Eyebrow above the trophy title, shown for every tier, e.g. "Trophy unlocked". */
  unlockedLabel: string;
};

export type TrophyOverlayProps = {
  /** Localized copy keyed by trophy id (same map the screen uses). */
  copy: Record<string, TrophyCopy>;
  colors: TrophyOverlayColors;
  strings: TrophyOverlayStrings;
  /** Banner corner radius — pass the app's card-container radius so the
   *  banner reads in family with its cards (defaults to the legacy 18). */
  radius?: number;
  /**
   * Optional surface layer rendered UNDER the banner content at its measured
   * size (e.g. an iOS Liquid Glass sheet via @expo/ui — injected so this
   * package stays dependency-light). When set, the banner paints NO solid
   * background/shadow: the underlay IS the surface.
   */
  underlay?: (size: { width: number; height: number }) => ReactNode;
  /** Tap the banner — e.g. navigate to the trophies screen. */
  onPress?: (id: string) => void;
  /** Fires once when a banner appears — e.g. a celebratory haptic. */
  onShow?: (trophy: QueuedTrophy) => void;
  /**
   * While true, the overlay stops pulling from the queue — unlocks keep
   * queueing (in order) and pop once it flips back to false. For windows where
   * the RN root is covered by native chrome the banner can't rise above (e.g.
   * an iOS formSheet route): without this, the banner (and its onShow
   * sound/haptic) fires invisibly behind the sheet. A banner already on screen
   * is NOT interrupted — it finishes its own show/dismiss.
   */
  suspended?: boolean;
};

// Resting-above-the-top-edge offset the banner drops in from / retracts to.
const HIDDEN_OFFSET = -200;
// Entrance settle — a slight overshoot reads as a "drop" (PS banner / iOS
// notification). All three set explicitly: passing only `damping` lets
// Reanimated fall back to its own stiffness/mass and overshoot wildly.
const SETTLE_SPRING = { stiffness: 180, mass: 1, damping: 19 };
const SHOW_MS = 4200;
// Platinum lingers a beat longer so its 3 shine passes (delay + 3×SWEEP_MS ≈ 5.06s)
// finish with a small tail before it retracts.
const PLATINUM_SHOW_MS = 5400;
// Upward swipe-to-dismiss thresholds (mirror the snackbar's downward ones).
const SWIPE_ACTIVATION_OFFSET = 8;
const SWIPE_DISMISS_DISTANCE = 24;
const SWIPE_DISMISS_VELOCITY = 700;
const ICON_SIZE = 40;

// Platinum specular-sweep tuning. The streak is a soft-cored white reflection
// (not a hard band) that grazes across the banner; a second copy, clipped to the
// trophy silhouette, lights the glyph in step. One `sweep` clock drives both.
const BANNER_BLEED = 24; // streak overshoots top/bottom so the skew never clips
const STREAK_FRAC = 0.46; // streak width as a fraction of the banner (wide)
const ICON_GLINT_W = 14; // glint window width, in the icon's 24-grid units
// The icon sits at the banner's LEFT, so the body streak's bright core crosses it
// EARLY in each pass (≈ a quarter through), not at the icon's own center. Flash
// the glint only across that slice — synced to the banner light actually being
// over the icon — and keep the glyph dark the rest of the pass. So the trophy
// catches the SAME light as the banner (one coherent gleam, not an independent
// stripe), and each pass's wrap lands off-glyph — no visible reset on the small
// glyph, which read as the glint "getting disrupted and starting again".
const ICON_GLINT_START = 0.1; // sweep phase the glint enters the glyph
const ICON_GLINT_SPAN = 0.28; // sweep fraction it takes to cross (peak ≈ 0.24)
const SWEEP_MS = 1600; // one shine pass — the SAME for every tier (standardized)
const SWEEP_DELAY_MS = 260; // ≈ the settle, so the light crosses an ARRIVED banner
// Platinum is special: it plays the shared shine exactly this many times (others
// play it once). A counted repeat, so there's no partial extra pass.
const PLATINUM_SWEEPS = 3;

type TrophyBannerProps = {
  trophy: QueuedTrophy;
  copy: Record<string, TrophyCopy>;
  colors: TrophyOverlayColors;
  strings: TrophyOverlayStrings;
  radius: number;
  underlay?: TrophyOverlayProps['underlay'];
  onPress?: (id: string) => void;
  onShow?: (trophy: QueuedTrophy) => void;
  /** The banner finished (timer, swipe, or tap) — parent advances the queue. */
  onDone: () => void;
};

/**
 * One banner instance — mounted FRESH for every queued trophy (the parent keys
 * it), so each gets its own shared values and animated styles bound to its own
 * views. This is load-bearing, not style: reusing one set of
 * useSharedValue/useAnimatedStyle hooks across the overlay's unmount→remount
 * cycle left the style mappers bound to the PREVIOUS (dead) banner view — the
 * values animated, onShow (sound/haptic) fired, but the new view never got the
 * updates and every banner after the first stayed invisible at opacity 0
 * (sim-verified via a shared-value reaction log while the screen showed
 * nothing).
 */
const TrophyBanner = ({
  trophy,
  copy,
  colors,
  strings,
  radius,
  underlay,
  onPress,
  onShow,
  onDone,
}: TrophyBannerProps) => {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  const [bannerWidth, setBannerWidth] = useState(0);
  const [bannerHeight, setBannerHeight] = useState(0);

  const translateY = useSharedValue(HIDDEN_OFFSET);
  const opacity = useSharedValue(0);
  const iconScale = useSharedValue(1);
  // Master clock for the platinum light sweep: 0→1 is one pass; held off-screen
  // between passes. Mirrors of the measured banner size let the sweep worklets
  // self-correct the frame after layout lands.
  const sweep = useSharedValue(0);
  const bannerWSV = useSharedValue(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest callbacks without making them effect dependencies (they
  // would otherwise re-fire the entrance on every parent re-render).
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const isPlatinum = trophy.tier === 'platinum';

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  // The exit callback fires on completion AND on cancellation (deliberate —
  // see animateOut), and unmounting this instance cancels the already-finished
  // exit timing, firing it a SECOND time. Without this once-guard that second
  // fire called onDone again → an extra dequeue that silently DROPPED the next
  // queued trophy (its onShow sound played, banner never seen — the chained
  // platinum bug, sim-verified).
  const doneRef = useRef(false);

  // Stop the UI-thread flair, then hand back to the parent (which unmounts
  // this instance and pulls the next queued trophy). Runs on the JS thread.
  const finishDismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimation(iconScale);
    cancelAnimation(sweep);
    onDoneRef.current();
  }, [iconScale, sweep]);

  const animateOut = useCallback(() => {
    clearTimer();
    if (reduceMotion) {
      finishDismiss();
      return;
    }
    opacity.value = withTiming(0, { duration: 160 });
    translateY.value = withTiming(
      HIDDEN_OFFSET,
      { duration: 220 },
      // Dismiss even when the exit animation gets CANCELLED (a competing
      // gesture/animation on translateY): skipping it left the banner stuck at
      // opacity 0 — an invisible banner that swallowed all taps in its box
      // (sim-reproduced via swipe-dismiss racing the exit).
      () => {
        runOnJS(finishDismiss)();
      },
    );
  }, [clearTimer, finishDismiss, opacity, translateY, reduceMotion]);

  const startTimer = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(
      animateOut,
      isPlatinum ? PLATINUM_SHOW_MS : SHOW_MS,
    );
  }, [animateOut, clearTimer, isPlatinum]);

  // Entrance: animate in, start the show timer, and (platinum only) run the
  // flair. Runs once — this instance exists for exactly one trophy.
  useEffect(() => {
    onShowRef.current?.(trophy);

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = withSpring(0, SETTLE_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
    }

    // Entrance flair for EVERY tier: the icon lands with a little spring pop and
    // one specular shine sweeps across the banner. Platinum is the most alive —
    // its shine repeats (3×) and it alone adds the icon glint + glow.
    if (reduceMotion) {
      // Platinum holds a static centered shine; the other tiers show none.
      sweep.value = isPlatinum ? 0.5 : 0;
    } else {
      iconScale.value = 0.7;
      iconScale.value = withDelay(
        140,
        withSpring(1, { stiffness: 320, mass: 0.9, damping: 13 }),
      );
      if (isPlatinum) {
        // The SAME shine as every other tier, just played PLATINUM_SWEEPS times
        // back-to-back (others play it once). A COUNTED repeat — exactly 3 passes,
        // never a partial 4th. Each rep wraps 1→0 fully off-screen (BANNER_BLEED),
        // so the passes chain cleanly with no dead-air hold.
        sweep.value = withDelay(
          SWEEP_DELAY_MS,
          withRepeat(
            withTiming(1, {
              duration: SWEEP_MS,
              easing: Easing.inOut(Easing.cubic),
            }),
            PLATINUM_SWEEPS,
            false,
          ),
        );
      } else {
        // One shine pass as it arrives, then it parks off-screen.
        sweep.value = withDelay(
          SWEEP_DELAY_MS,
          withTiming(1, {
            duration: SWEEP_MS,
            easing: Easing.inOut(Easing.cubic),
          }),
        );
      }
    }

    startTimer();
    return clearTimer;
  }, [
    trophy,
    isPlatinum,
    reduceMotion,
    startTimer,
    clearTimer,
    translateY,
    opacity,
    iconScale,
    sweep,
  ]);

  // Swipe UP to dismiss early (the banner is anchored to the top edge). Only a
  // real upward drag activates it, so a tap on the banner still registers.
  const swipeGesture = Gesture.Pan()
    .activeOffsetY(-SWIPE_ACTIVATION_OFFSET)
    .onStart(() => {
      runOnJS(clearTimer)();
    })
    .onUpdate(event => {
      translateY.value =
        event.translationY < 0 ? event.translationY : event.translationY * 0.1;
    })
    .onEnd(event => {
      const dismissed =
        event.translationY < -SWIPE_DISMISS_DISTANCE ||
        event.velocityY < -SWIPE_DISMISS_VELOCITY;
      if (dismissed) {
        runOnJS(animateOut)();
      } else {
        translateY.value = reduceMotion ? 0 : withSpring(0, SETTLE_SPRING);
        runOnJS(startTimer)();
      }
    });

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  // Body streak: slide a soft-cored gradient Rect from fully off the left to
  // fully off the right (reading the size mirror so it self-corrects on layout).
  const streakProps = useAnimatedProps(() => {
    const width = bannerWSV.value * STREAK_FRAC;
    const startX = -width - BANNER_BLEED;
    const endX = bannerWSV.value + BANNER_BLEED;
    return { x: startX + sweep.value * (endX - startX), width };
  });

  // Icon glint: slide the gradient window across the 24-grid, but only during the
  // early slice of each pass when the banner streak is over the (left-anchored)
  // icon — remap the shared sweep onto [START, START+SPAN]. Outside it the window
  // sits fully off the glyph (transparent), so the trophy gleams once, in step
  // with the body sweep, and the per-pass wrap never flashes on the glyph.
  const iconGlintProps = useAnimatedProps(() => {
    const u = (sweep.value - ICON_GLINT_START) / ICON_GLINT_SPAN;
    const x = -ICON_GLINT_W + u * (24 + ICON_GLINT_W);
    return { x1: x, y1: 0, x2: x + ICON_GLINT_W, y2: 24 };
  });

  // The popped trophy wears its tier color (matching the trophies screen), not a
  // flat white — that's the celebratory cue.
  const iconColor = tierColor(trophy.tier);
  const text = copy[trophy.id];
  // Same eyebrow for every tier — the tier line below the title already names the
  // tier (so a platinum-specific "Platinum unlocked" would just repeat "Platinum").
  const eyebrow = strings.unlockedLabel;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top }]}
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            setBannerWidth(width);
            setBannerHeight(height);
            bannerWSV.value = width;
          }}
          style={[
            styles.banner,
            { borderRadius: radius },
            // With an underlay the banner is a clear shell — the injected
            // surface (glass) provides the depth, so no fill and no shadow
            // (a shadow needs an opaque layer to cast from anyway).
            underlay
              ? styles.bannerClear
              : [styles.bannerSolid, { backgroundColor: colors.surface }],
            // Platinum is the one expressive moment: a faint primary glow. Every
            // other banner sits flat like a Material notification.
            !underlay && isPlatinum
              ? { shadowColor: colors.primary, shadowOpacity: 0.3 }
              : null,
            bannerStyle,
          ]}
        >
          {/* Injected surface (measured size) — pointer-transparent so taps
              and the swipe gesture pass through to the content. */}
          {underlay && bannerWidth > 0 ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {underlay({ width: bannerWidth, height: bannerHeight })}
            </View>
          ) : null}
          <Pressable
            style={styles.row}
            onPress={() => {
              onPress?.(trophy.id);
              animateOut();
            }}
          >
            <Animated.View style={iconStyle}>
              <TrophyIcon color={iconColor} size={ICON_SIZE} />
              {/* The glyph catches the same light, clipped to its own
                  silhouette — platinum only. */}
              {isPlatinum ? (
                <Svg
                  pointerEvents="none"
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  viewBox="0 0 24 24"
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <AnimatedLinearGradient
                      id="iconGlint"
                      gradientUnits="userSpaceOnUse"
                      animatedProps={iconGlintProps}
                    >
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                      <Stop
                        offset="0.45"
                        stopColor="#FFFFFF"
                        stopOpacity={0.85}
                      />
                      <Stop
                        offset="0.55"
                        stopColor="#EAF6FF"
                        stopOpacity={0.85}
                      />
                      <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                    </AnimatedLinearGradient>
                    <ClipPath id="glyph">
                      <Path d={TROPHY_PATH} />
                    </ClipPath>
                  </Defs>
                  <Rect
                    x={0}
                    y={0}
                    width={24}
                    height={24}
                    fill="url(#iconGlint)"
                    clipPath="url(#glyph)"
                  />
                </Svg>
              ) : null}
            </Animated.View>

            <Animated.View style={styles.textColumn}>
              <Text
                numberOfLines={1}
                style={[styles.eyebrow, { color: colors.onSurfaceMuted }]}
              >
                {eyebrow}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.title, { color: colors.onSurface }]}
              >
                {text?.title ?? trophy.id}
              </Text>
              {/* What you did to earn it — more meaningful in the pop than the
                  tier word (the icon color already signals the tier). */}
              <Text
                numberOfLines={2}
                style={[styles.desc, { color: colors.onSurfaceMuted }]}
              >
                {text?.description}
              </Text>
            </Animated.View>
          </Pressable>

          {/* Specular shine sweep — EVERY tier (one pass; platinum plays it 3×). */}
          {bannerWidth > 0 ? (
            <Svg
              pointerEvents="none"
              width={bannerWidth}
              height={bannerHeight}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <LinearGradient id="specular" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.06} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.42} />
                  <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity={0.06} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <AnimatedRect
                animatedProps={streakProps}
                y={-BANNER_BLEED}
                height={bannerHeight + BANNER_BLEED * 2}
                fill="url(#specular)"
                transform="skewX(-18)"
              />
            </Svg>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

/**
 * Top-anchored trophy banner with a queue. It drops in from above the status
 * bar (NOT up from the bottom like the snackbar), holds, then retracts —
 * showing queued unlocks one after another. Every tier shares the identical
 * shell; PLATINUM alone layers the flair: the same specular light sweeps across
 * the banner three times (others once) and the trophy glyph catches the same
 * light (clipped to its silhouette), plus the icon gives one entrance pop. Mount
 * it once, high in the tree (above all screens).
 */
export const TrophyOverlay = ({
  copy,
  colors,
  strings,
  radius = 18,
  underlay,
  onPress,
  onShow,
  suspended = false,
}: TrophyOverlayProps) => {
  const queue = useTrophyStore(state => state.queue);
  const dequeue = useTrophyStore(state => state.dequeue);

  const [current, setCurrent] = useState<QueuedTrophy | null>(null);
  // Monotonic mount key: consecutive banners must be DIFFERENT TrophyBanner
  // instances even if a trophy id ever repeated — see TrophyBanner's docs.
  const seqRef = useRef(0);

  // Pull the next queued trophy in when the banner is idle. Suspension only
  // gates the PULL: the queue keeps accumulating in award order, and when
  // `suspended` flips back this effect re-runs and flushes it one by one.
  useEffect(() => {
    if (suspended || current || queue.length === 0) return;
    seqRef.current += 1;
    setCurrent(queue[0]);
  }, [current, queue, suspended]);

  // The showing banner finished — drop it from the queue and go idle, which
  // lets the pull effect mount the next one (a fresh instance).
  const handleDone = useCallback(() => {
    setCurrent(null);
    dequeue();
  }, [dequeue]);

  if (!current) return null;

  return (
    <TrophyBanner
      key={seqRef.current}
      trophy={current}
      copy={copy}
      colors={colors}
      strings={strings}
      radius={radius}
      underlay={underlay}
      onPress={onPress}
      onShow={onShow}
      onDone={handleDone}
    />
  );
};

const styles = StyleSheet.create({
  host: {
    left: 0,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    // A little breathing room below the status bar so the banner doesn't hug
    // the very top edge.
    marginTop: 18,
    overflow: 'hidden',
    // NO padding here: Yoga insets absolute children (the underlay + shine
    // layers) by the parent's padding, which would shift them off the banner
    // box — so all padding lives on the inner row (snackbar-proven fix).
  },
  // Solid variant (no underlay): elevated card with a soft drop shadow.
  bannerSolid: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  // Underlay variant: fully transparent shell over the injected surface.
  bannerClear: { backgroundColor: 'transparent' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textColumn: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 12, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '500' },
  desc: { fontSize: 12, lineHeight: 16 },
});
