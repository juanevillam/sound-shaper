import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SCREEN_PADDING } from '@portfolio/core';
import {
  FLOATING_COPY_GAP,
  FLOATING_EDGE_GAP,
  FLOATING_RADIUS,
  usePressSquash,
} from '@portfolio/mobile-ui';

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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  ClipPath,
  Defs,
  G,
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
  /**
   * Banner corner radius. Defaults to the portfolio's FLOATING corner, which is
   * what this is — apps stopped passing their CARD radius (`TILE_RADIUS`, 26),
   * which made this the only floating surface in either app not at 22.
   */
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
// A screen reader reads the banner aloud, which takes longer than reading it
// with your eyes — and the banner is TAPPABLE (it opens the trophy). Apple's
// own banners hold until VoiceOver is done with them; this is the same idea at
// a fixed multiple, so the announcement finishes before the banner retracts.
const SCREEN_READER_SHOW_FACTOR = 2;
// Platinum lingers a beat longer. It is the one unlock that ends something —
// the banner people actually stop and read, and the one most likely to be
// tapped through to the trophies screen.
const PLATINUM_SHOW_MS = 5400;
// Upward swipe-to-dismiss thresholds (mirror the snackbar's downward ones).
const SWIPE_ACTIVATION_OFFSET = 8;
const SWIPE_DISMISS_DISTANCE = 24;
const SWIPE_DISMISS_VELOCITY = 700;
const ICON_SIZE = 40;

// PLATINUM-ONLY specular sweep. The streak is a soft-cored white reflection (not
// a hard band) that grazes across the banner once; a second copy, clipped to the
// trophy silhouette, lights the glyph in step. One `sweep` clock drives both.
//
// EVERY TIER used to get a pass, and platinum's difference was that it got three
// of them. Both halves were wrong. Measured at 60fps against the settled glass,
// the streak peaks at +3.7/255 on the LIGHT theme and +65/255 on dark — so six
// of the seven banners were paying for an SVG layer and a 1.6s animation that is
// invisible in half the app. And three passes put platinum in motion for 5.06s
// of its 5.4s life, which is not a glint, it is a SHIMMER — the exact language
// `SkeletonBone` uses for "still loading". A reward that animates like a
// placeholder is the wrong signal, and "same shine, three times" is a difference
// nobody can count anyway. One pass, on the platinum alone: a difference in
// KIND, and the only banner where the light can be seen doing something.
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
const SWEEP_MS = 1600; // the single shine pass
const SWEEP_DELAY_MS = 260; // ≈ the settle, so the light crosses an ARRIVED banner

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
  // The banner is a CARD, so it takes the portfolio's card press feedback —
  // the shared squash, never a hand-rolled scale. It rides the OUTER wrapper so
  // the glass underlay squashes with the content rather than sitting still
  // behind a shrinking row.
  const squash = usePressSquash();

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

  // The popped trophy wears its tier color (matching the trophies screen), not a
  // flat white — that's the celebratory cue.
  const iconColor = tierColor(trophy.tier);
  const text = copy[trophy.id];
  // Same eyebrow for every tier — the tier line below the title already names the
  // tier (so a platinum-specific "Platinum unlocked" would just repeat "Platinum").
  const eyebrow = strings.unlockedLabel;
  const title = text?.title ?? trophy.id;
  const description = text?.description;
  // ONE string for the whole banner, because it is ONE control: VoiceOver reads
  // it as a single button rather than three stray labels floating over a screen.
  const label = [eyebrow, title, description].filter(Boolean).join('. ');

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
  // Whether a screen reader is running, read once on mount — it only changes
  // the show duration, so a live subscription would buy nothing.
  const screenReaderRef = useRef(false);

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
    const base = isPlatinum ? PLATINUM_SHOW_MS : SHOW_MS;
    timeoutRef.current = setTimeout(
      animateOut,
      screenReaderRef.current ? base * SCREEN_READER_SHOW_FACTOR : base,
    );
  }, [animateOut, clearTimer, isPlatinum]);

  // Entrance: animate in, start the show timer, and (platinum only) run the
  // flair. Runs once — this instance exists for exactly one trophy.
  useEffect(() => {
    onShowRef.current?.(trophy);

    // A banner that appears and retracts on a timer is INVISIBLE to a screen
    // reader — it never takes focus (moving focus would yank the person out of
    // whatever they were reading), so without this announcement the unlock
    // simply doesn't exist for them. `announceForAccessibility` is the polite
    // form: it speaks after the current utterance instead of interrupting it.
    AccessibilityInfo.announceForAccessibility(label);
    // And it must have TIME to be spoken — re-arm the hold once we know a
    // screen reader is running (the check is async, the timer is not).
    AccessibilityInfo.isScreenReaderEnabled()
      .then(enabled => {
        if (!enabled || doneRef.current) return;
        screenReaderRef.current = true;
        startTimer();
      })
      .catch(() => {});

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = withSpring(0, SETTLE_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
    }

    // Entrance flair. The icon lands ON THE BANNER'S OWN SPRING — it used to
    // have a spring of its own (stiffness 320 / mass 0.9 / damping 13, a 0.383
    // damping ratio) fired 140ms late, and measured at 60fps that produced an
    // 8.2% overshoot with a visible countermove, still wobbling while the
    // container itself was 7pt from settling. Two springs at two ratios on one
    // object, i.e. a second entrance inside the entrance. Every other spring in
    // this family sits near 0.7–0.9 (`SETTLE_SPRING` 0.708, `PRESS_SPRING`
    // 0.917), so the icon takes the container's: one arrival, in phase.
    //
    // The shine is PLATINUM'S ALONE and plays exactly once — see the sweep
    // constants for the measurements behind both halves of that.
    if (reduceMotion) {
      // No shine at all. This used to park the platinum streak at mid-banner
      // (`sweep.value = 0.5`), which is not "reduced motion" — it is a
      // permanent white band painted across the card.
      sweep.value = 0;
    } else {
      iconScale.value = 0.85;
      iconScale.value = withSpring(1, SETTLE_SPRING);
      if (isPlatinum) {
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
    label,
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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top }]}
    >
      <GestureDetector gesture={swipeGesture}>
        {/* TWO wrappers, and the split is load-bearing: the ENTRANCE transform
            (drop-in + retract) and the PRESS squash are both `transform`, and
            two animated styles on one view do not merge — the second simply
            wins. The outer view owns the entrance, the inner owns the press. */}
        <Animated.View style={bannerStyle}>
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
              // surface (glass) provides the depth, INCLUDING its shadow: an
              // RN `shadow*` traces the view's own alpha, so a transparent
              // shell casts nothing. The injected surface draws its own.
              underlay
                ? styles.bannerClear
                : [styles.bannerSolid, { backgroundColor: colors.surface }],
              // Platinum is the one expressive moment: a faint primary glow. Every
              // other banner sits flat like a Material notification.
              !underlay && isPlatinum
                ? { shadowColor: colors.primary, shadowOpacity: 0.3 }
                : null,
              squash.style,
            ]}
          >
            {/* Injected surface (measured size) — pointer-transparent so taps
                and the swipe gesture pass through to the content. */}
            {underlay && bannerWidth > 0 ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {underlay({ width: bannerWidth, height: bannerHeight })}
              </View>
            ) : null}

            {/* Specular shine sweep — PLATINUM ONLY, one pass. It sits ABOVE
                the surface and BELOW the content, because a
                white streak drawn OVER the text washes it out as it crosses:
                on the light theme the eyebrow all but disappeared mid-pass, and
                platinum did it three times. Light falls on a surface, not on
                the words printed on it.

                The rounded box is clipped HERE rather than by `overflow:
                'hidden'` on the banner, so the injected surface is free to
                cast its shadow outside the box. The clip goes on a `G` and not
                on the rect itself: a clip-path resolves in the user space of
                the element that references it, so on the skewed rect the clip
                would come out skewed too. */}
            {isPlatinum && bannerWidth > 0 ? (
              <Svg
                pointerEvents="none"
                width={bannerWidth}
                height={bannerHeight}
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <LinearGradient id="specular" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                    <Stop
                      offset="0.35"
                      stopColor="#FFFFFF"
                      stopOpacity={0.06}
                    />
                    <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.42} />
                    <Stop
                      offset="0.65"
                      stopColor="#FFFFFF"
                      stopOpacity={0.06}
                    />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </LinearGradient>
                  <ClipPath id="bannerBox">
                    <Rect
                      x={0}
                      y={0}
                      width={bannerWidth}
                      height={bannerHeight}
                      rx={radius}
                      ry={radius}
                    />
                  </ClipPath>
                </Defs>
                <G clipPath="url(#bannerBox)">
                  <AnimatedRect
                    animatedProps={streakProps}
                    y={-BANNER_BLEED}
                    height={bannerHeight + BANNER_BLEED * 2}
                    fill="url(#specular)"
                    transform="skewX(-18)"
                  />
                </G>
              </Svg>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              style={styles.row}
              onPress={() => {
                onPress?.(trophy.id);
                animateOut();
              }}
              onPressIn={squash.onPressIn}
              onPressOut={squash.onPressOut}
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

              <Animated.View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.textColumn}
              >
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
                  {title}
                </Text>
                {/* What you did to earn it — more meaningful in the pop than the
                    tier word (the icon color already signals the tier). */}
                <Text
                  numberOfLines={2}
                  style={[styles.desc, { color: colors.onSurfaceMuted }]}
                >
                  {description}
                </Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

/**
 * Top-anchored trophy banner with a queue. It drops in from above the status
 * bar (NOT up from the bottom like the snackbar), holds, then retracts —
 * showing queued unlocks one after another. Every tier shares the identical
 * shell, and every tier arrives the same way: one spring, with the icon landing
 * on that same spring. PLATINUM alone layers the light — a single specular pass
 * across the banner, with the glyph catching that same pass clipped to its own
 * silhouette. Mount it once, high in the tree (above all screens).
 */
export const TrophyOverlay = ({
  copy,
  colors,
  strings,
  radius = FLOATING_RADIUS,
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
    // iOS: the screen gutter, so this banner hangs off the side edges by what
    // the now-playing banner and the toast do. Android is frozen at 12.
    paddingHorizontal: Platform.select({ ios: SCREEN_PADDING, default: 12 }),
    position: 'absolute',
    right: 0,
    top: 0,
  },
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    /**
     * iOS: the SHARED floating-surface gap, so this banner stands off the top
     * safe area by exactly what the now-playing banner stands off the bottom
     * one — same object, opposite ends. Android is frozen and keeps the 18 it
     * shipped with ("a little breathing room below the status bar", which was
     * never a measured number).
     */
    marginTop: Platform.select({ ios: FLOATING_EDGE_GAP, default: 18 }),
    // NO `overflow: 'hidden'` — it would clip the injected surface's shadow off
    // the box. The one thing that needed clipping (the shine) clips itself, in
    // SVG, against the same radius.
    //
    // NO padding here either: Yoga insets absolute children (the underlay +
    // shine layers) by the parent's padding, which would shift them off the
    // banner box — so all padding lives on the inner row (snackbar-proven fix).
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
    /**
     * 12, so the TEXT COLUMN starts where the now-playing banner's does:
     * 16 + `ICON_SIZE` 40 + 12 = 68, against that banner's 11 + 46 + 11 = 68.
     * The two floating banners then hang their copy off the same line, which is
     * the thing a person actually sees — the media in front of it is a glyph in
     * one and artwork in the other, and those are sized by their own boxes.
     * It was 14, which landed at 70: two points off by accident.
     */
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // iOS: the shared title→supporting step. Android is frozen at 1.
  textColumn: {
    flex: 1,
    gap: Platform.select({ ios: FLOATING_COPY_GAP, default: 1 }),
  },
  // iOS TYPE STEPS, not invented sizes — the same correction the snackbar took
  // ("the 14 both platforms shared was Material's body-medium; iOS has no 14pt
  // step at all"). This banner had a 16pt title, and iOS has no 16pt step
  // either. Footnote 13/18 for the label lines, Subheadline 15/20 semibold for
  // the title: the ramp Apple uses on a notification banner.
  eyebrow: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  desc: { fontSize: 13, lineHeight: 18 },
});
