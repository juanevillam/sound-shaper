import { useCallback, useEffect, useRef, useState } from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { type QueuedTrophy, type TrophyCopy, type TrophyTier } from './types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** Colors the banner paints with — pass your Material You roles. */
export type TrophyOverlayColors = {
  /** Banner background (use an elevated surface, e.g. surfaceContainerHigh). */
  surface: string;
  onSurface: string;
  onSurfaceMuted: string;
  /** The one accent in the feature — the platinum banner's glow + rim. */
  primary: string;
};

export type TrophyOverlayStrings = {
  /** Eyebrow above the trophy title, e.g. "Trophy unlocked". */
  unlockedLabel: string;
  /** Special eyebrow for the platinum pop; falls back to `unlockedLabel`. */
  platinumUnlockedLabel?: string;
  tierNames: Record<TrophyTier, string>;
};

export type TrophyOverlayProps = {
  /** Localized copy keyed by trophy id (same map the screen uses). */
  copy: Record<string, TrophyCopy>;
  colors: TrophyOverlayColors;
  /** Active color scheme — picks the legible tier-color variant for the icon. */
  scheme: 'light' | 'dark';
  strings: TrophyOverlayStrings;
  /** Tap the banner — e.g. navigate to the trophies screen. */
  onPress?: (id: string) => void;
  /** Fires once when a banner appears — e.g. a celebratory haptic. */
  onShow?: (trophy: QueuedTrophy) => void;
};

// Resting-above-the-top-edge offset the banner drops in from / retracts to.
const HIDDEN_OFFSET = -200;
// Entrance settle — a slight overshoot reads as a "drop" (PS banner / iOS
// notification). All three set explicitly: passing only `damping` lets
// Reanimated fall back to its own stiffness/mass and overshoot wildly.
const SETTLE_SPRING = { stiffness: 180, mass: 1, damping: 19 };
const SHOW_MS = 4200;
// Platinum lingers a beat longer so its light-sweep gets ~two clean passes.
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
const SWEEP_MS = 1500; // one eased pass…
const SWEEP_HOLD_MS = 1700; // …then dead air, so it reads as a glint, not noise
const SWEEP_DELAY_MS = 260; // ≈ the settle, so the light crosses an ARRIVED banner

/**
 * Top-anchored trophy banner with a queue. It drops in from above the status
 * bar (NOT up from the bottom like the snackbar), holds, then retracts —
 * showing queued unlocks one after another. Every tier shares the identical
 * shell; PLATINUM alone layers the flair: a soft specular light sweeps across
 * the banner, the trophy glyph catches the same light (clipped to its
 * silhouette), a primary rim briefly ignites as the streak passes, and the icon
 * gives one entrance pop. Mount it once, high in the tree (above all screens).
 */
export const TrophyOverlay = ({
  copy,
  colors,
  scheme,
  strings,
  onPress,
  onShow,
}: TrophyOverlayProps) => {
  const queue = useTrophyStore(state => state.queue);
  const dequeue = useTrophyStore(state => state.dequeue);
  const reduceMotion = useReducedMotion();

  const [current, setCurrent] = useState<QueuedTrophy | null>(null);
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
  // Always-current mirror so the worklet-driven gesture handlers can restart
  // the timer with the right (platinum vs normal) duration.
  const currentRef = useRef<QueuedTrophy | null>(null);
  currentRef.current = current;
  // Keep the latest onShow without making it an effect dependency (it would
  // otherwise re-fire the entrance on every parent re-render).
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  // Drop the banner after its exit animation, then let the queue effect pull
  // the next one. Runs on the JS thread.
  const finishDismiss = useCallback(() => {
    cancelAnimation(iconScale);
    cancelAnimation(sweep);
    iconScale.value = 1;
    sweep.value = 0;
    setCurrent(null);
    dequeue();
  }, [dequeue, iconScale, sweep]);

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
      finished => {
        if (finished) runOnJS(finishDismiss)();
      },
    );
  }, [clearTimer, finishDismiss, opacity, translateY, reduceMotion]);

  const startTimer = useCallback(() => {
    clearTimer();
    const platinum = currentRef.current?.tier === 'platinum';
    timeoutRef.current = setTimeout(
      animateOut,
      platinum ? PLATINUM_SHOW_MS : SHOW_MS,
    );
  }, [animateOut, clearTimer]);

  // Pull the next queued trophy in when the banner is idle.
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
  }, [current, queue]);

  // Animate the current trophy in, start its timer, and (platinum only) run the
  // flair. Keyed on `current` — every queued trophy gets its own entrance.
  useEffect(() => {
    if (!current) return;

    const platinum = current.tier === 'platinum';
    onShowRef.current?.(current);

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = HIDDEN_OFFSET;
      opacity.value = 0;
      translateY.value = withSpring(0, SETTLE_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
    }

    // Entrance flair for EVERY tier: the icon lands with a little spring pop and
    // one specular shine sweeps across the banner. Platinum is the most alive —
    // its shine KEEPS sweeping (and it alone adds the icon glint + rim + glow).
    if (reduceMotion) {
      iconScale.value = 1;
      // Platinum holds a static centered shine; the other tiers show none.
      sweep.value = platinum ? 0.5 : 0;
    } else {
      iconScale.value = 0.7;
      iconScale.value = withDelay(
        140,
        withSpring(1, { stiffness: 320, mass: 0.9, damping: 13 }),
      );
      if (platinum) {
        // Eased pass, hold off-screen, reset (invisible wrap), forever.
        sweep.value = withDelay(
          SWEEP_DELAY_MS,
          withRepeat(
            withSequence(
              withTiming(1, {
                duration: SWEEP_MS,
                easing: Easing.inOut(Easing.cubic),
              }),
              withTiming(1, { duration: SWEEP_HOLD_MS }),
              withTiming(0, { duration: 0 }),
            ),
            -1,
            false,
          ),
        );
      } else {
        // One shine pass as it arrives, then it parks off-screen.
        sweep.value = 0;
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
    current,
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

  // Primary rim along the top edge, lit only as the streak crosses center.
  const rimProps = useAnimatedProps(() => ({
    fillOpacity: interpolate(
      sweep.value,
      [0, 0.3, 0.5, 0.7, 1],
      [0, 0, 0.5, 0, 0],
    ),
  }));

  // Icon glint: slide the gradient window across the 24-grid, parked fully off
  // the glyph at both ends so the loop wrap never flashes.
  const iconGlintProps = useAnimatedProps(() => {
    const x = -ICON_GLINT_W + sweep.value * (24 + ICON_GLINT_W);
    return { x1: x, y1: 0, x2: x + ICON_GLINT_W, y2: 24 };
  });

  if (!current) return null;

  const isPlatinum = current.tier === 'platinum';
  // The popped trophy wears its tier color (matching the trophies screen), not a
  // flat white — that's the celebratory cue.
  const iconColor = tierColor(current.tier, scheme);
  const text = copy[current.id];
  const eyebrow =
    isPlatinum && strings.platinumUnlockedLabel
      ? strings.platinumUnlockedLabel
      : strings.unlockedLabel;

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.host}>
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
            { backgroundColor: colors.surface },
            // Platinum is the one expressive moment: a faint primary glow. Every
            // other banner sits flat like a Material notification.
            isPlatinum
              ? { shadowColor: colors.primary, shadowOpacity: 0.3 }
              : null,
            bannerStyle,
          ]}
        >
          <Pressable
            style={styles.row}
            onPress={() => {
              onPress?.(current.id);
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
                {text?.title ?? current.id}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.tier, { color: colors.onSurfaceMuted }]}
              >
                {strings.tierNames[current.tier]}
              </Text>
            </Animated.View>
          </Pressable>

          {/* Specular shine sweep — EVERY tier (one pass; platinum loops it).
              The primary rim that ignites with the streak is platinum-only. */}
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
              {isPlatinum ? (
                <AnimatedRect
                  animatedProps={rimProps}
                  x={0}
                  y={0}
                  width={bannerWidth}
                  height={1.5}
                  fill={colors.primary}
                />
              ) : null}
            </Svg>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
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
    borderRadius: 18,
    elevation: 6,
    flexDirection: 'row',
    // A little breathing room below the status bar so the banner doesn't hug
    // the very top edge.
    marginTop: 18,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 14,
  },
  textColumn: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 12, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '500' },
  tier: { fontSize: 12 },
});
