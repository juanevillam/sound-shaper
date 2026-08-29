import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';

import { useAppTheme } from '@portfolio/core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FLOATING_EDGE_GAP,
  FLOATING_RADIUS,
  GlassSurfaceIos,
} from './GlassSurfaceIos';
import { NOW_PLAYING_BANNER_BOX } from './nowPlayingBanner';
import {
  SnackbarContext,
  type SnackbarAction,
  type SnackbarOptions,
  type SnackbarScope,
} from './snackbar';
import { PRESSED_OPACITY } from './SquashPressable';

type SnackbarProviderProps = {
  children: React.ReactNode;
  /**
   * ANDROID ONLY — the constant action slot's label when a snackbar carries no
   * real action (iOS renders no dismiss control at all; auto-dismiss and the
   * swipe are the dismissal there). Already translated, since the package has
   * no translator. Defaults to 'OK' — the one hardcoded English string this
   * file shipped with — so an app that has not wired it yet is unchanged.
   * STILL UNVERIFIED on an Android device — walk it.
   */
  dismissLabel?: string;
  /**
   * iOS clearance between the toast and the bottom safe-area edge.
   *
   * ONLY A PRESENTED SURFACE PASSES THIS — see `SnackbarOutlet`, where a sheet
   * states its own. An APP does not: the toast stands in the same place in
   * every app, which is what `SNACKBAR_BOTTOM_CLEARANCE` is.
   */
  iosBottomInset?: number;
};

/**
 * WHERE THE TOAST STANDS ON iOS, measured up from the bottom safe-area edge —
 * and it is the PORTFOLIO'S number, not each app's.
 *
 * The apps used to pass their own, a flat 76 in both, which was right for
 * neither: it left Topper's tab bar 27pt of air and overlapped Sound Shaper's
 * now-playing banner by 3.33pt, the two surfaces fighting for one band. The
 * obvious repair was to derive it per app from that app's own bottom chrome —
 * and that is worse, because it puts the same toast in a different place in
 * every app for a reason nobody using one app can see.
 *
 * So it is one place everywhere, and the number is the tallest bottom chrome in
 * the portfolio clearing itself. Topper's tab bar is shorter, so its toast
 * simply carries more air — the same surface in the same spot, which is the
 * point.
 *
 * IT USED TO BE THE ONE MANUAL LINK IN THIS FAMILY — the banner's box restated
 * here as `8 + 68`, with a comment admitting that if either number moved in
 * Sound Shaper, nothing would tell you. It is not restated any more: the box
 * lives in `nowPlayingBanner` and the app re-exports it, so the three surfaces
 * that depend on it (the banner, the expanded console's glass footer, and this
 * toast) all read the same term.
 */
export const SNACKBAR_BOTTOM_CLEARANCE =
  NOW_PLAYING_BANNER_BOX + FLOATING_EDGE_GAP;

const AUTO_DISMISS_MS = 4000;

// Gentle entrance / settle spring (stiffness 100, mass 1, damping 18 → ~0.9
// damping ratio, so it eases in with barely any overshoot). All three are set
// explicitly: passing only `damping` lets Reanimated fall back to ITS own
// stiffness/mass defaults, which made the entrance far too bouncy.
const SETTLE_SPRING = { stiffness: 100, mass: 1, damping: 18 };
// Resting-to-hidden travel for the show/dismiss slide. The bar is pinned to the
// bottom edge.
const HIDDEN_OFFSET = 80;
// Swipe-out target — far enough below any realistic drag that the release
// animation always continues downward, never snaps back up.
const SWIPE_OUT_OFFSET = 220;
// A downward drag past this far (or flung faster than this) dismisses; anything
// short of it springs back.
const SWIPE_DISMISS_DISTANCE = 28;
const SWIPE_DISMISS_VELOCITY = 800;
// The downward distance the finger must travel before the drag takes over, so a
// tap on the action button (and any horizontal motion) never starts a swipe.
const SWIPE_ACTIVATION_OFFSET = 8;

/**
 * The one snackbar for every portfolio app: a Material 3 bar on Android and a
 * Liquid Glass capsule toast on iOS (which has no snackbar idiom). Apps differ
 * only by `iosBottomInset` — never fork this to restyle one app.
 */
const SnackbarProvider = ({
  children,
  dismissLabel = 'OK',
  iosBottomInset = SNACKBAR_BOTTOM_CLEARANCE,
}: SnackbarProviderProps) => {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<SnackbarAction | null>(null);
  const translateY = useSharedValue(HIDDEN_OFFSET);
  const opacity = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The live transaction: its `onCommit`, and whether it has resolved yet, so
  // exactly one of {commit, undo} ever runs no matter what ends the snackbar.
  const pendingRef = useRef<{
    onCommit?: () => void;
    resolved: boolean;
  } | null>(null);
  // Mirrors of the live toast's state for `releaseOutlet`, which must decide
  // synchronously inside a state updater whether a toast is up and whose it
  // is — see the outlet registry below.
  const messageRef = useRef<string | null>(null);
  const scopeRef = useRef<SnackbarScope>('host');
  const { colors } = useAppTheme();
  // Respect the OS "remove animations" setting: show/hide instantly, no slide.
  const reduceMotion = useReducedMotion();
  // iOS: the capsule is real Liquid Glass — a SwiftUI glass layer sized to
  // the measured RN content sits behind it (glassEffect no-ops before 26).
  const [toastSize, setToastSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  // Settle the current transaction once. `commit` true → run onCommit (timeout,
  // replaced, swiped away, unmounted); false → the user took the action, so
  // skip it.
  const finalize = useCallback((commit: boolean) => {
    const pending = pendingRef.current;
    if (pending && !pending.resolved) {
      pending.resolved = true;
      if (commit) pending.onCommit?.();
    }
  }, []);

  // Drop the visible bar (after its exit animation). Runs on the JS thread.
  const clearMessage = useCallback(() => {
    messageRef.current = null;
    setMessage(null);
    setAction(null);
  }, []);

  const animateOut = useCallback(() => {
    if (reduceMotion) {
      clearMessage();
      return;
    }

    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(
      HIDDEN_OFFSET,
      { duration: 180 },
      finished => {
        if (finished) runOnJS(clearMessage)();
      },
    );
  }, [clearMessage, opacity, translateY, reduceMotion]);

  // Restart the auto-dismiss countdown — on show, and after a drag that springs
  // back (the timer pauses while the user is interacting).
  const startTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      finalize(true);
      animateOut();
    }, AUTO_DISMISS_MS);
  }, [animateOut, finalize]);

  const pauseTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  /**
   * THE OUTLET REGISTRY — ids in claim order (so the LAST one is the topmost
   * surface; sheets stack account → Recently Deleted), each with the bottom
   * clearance its surface stated at claim time. A ref, not state: the
   * registry is read at SHOW time (to bind) and at RELEASE time (to decide a
   * bound toast's fate), and neither read wants to be a render behind.
   *
   * The toast renders in its BOUND outlet, not the topmost one. Binding
   * happens once, in `showSnackbar`; a surface mounting above a live toast
   * does not steal it (it gets covered, like any overlay under a new window),
   * and a surface unmounting UNDER it changes nothing. Only the bound
   * surface's own dismissal acts, per `SnackbarScope`: `host` toasts die with
   * it — committing their transaction, exactly as unmount always has — and
   * `app` toasts re-home to the new top with a fresh entrance. Re-parenting
   * silently was the old behaviour, and it read as a flicker-and-jump on
   * every sheet close (Juan, 2026-08-27).
   */
  const outletsRef = useRef<{ id: number; inset?: number }[]>([]);
  const [boundOutlet, setBoundOutletState] = useState<number | null>(null);
  // Mirror for `releaseOutlet`, which must read the binding synchronously —
  // and NOT via a setState updater, whose double-invocation under StrictMode
  // would run the release side effects twice.
  const boundOutletRef = useRef<number | null>(null);
  const setBoundOutlet = useCallback((id: number | null) => {
    boundOutletRef.current = id;
    setBoundOutletState(id);
  }, []);
  const [boundInset, setBoundInset] = useState<number | undefined>(undefined);
  const claimOutlet = useCallback((id: number, inset?: number) => {
    outletsRef.current = [...outletsRef.current, { id, inset }];
  }, []);
  const rehome = useCallback(() => {
    const top = outletsRef.current.at(-1) ?? null;
    setBoundOutlet(top?.id ?? null);
    setBoundInset(top?.inset);
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = HIDDEN_OFFSET;
      opacity.value = 0;
      translateY.value = withSpring(0, SETTLE_SPRING);
      opacity.value = withTiming(1, { duration: 180 });
    }
    startTimer();
  }, [opacity, reduceMotion, setBoundOutlet, startTimer, translateY]);
  const releaseOutlet = useCallback(
    (id: number) => {
      const index = outletsRef.current.findLastIndex(entry => entry.id === id);
      if (index !== -1)
        outletsRef.current = [
          ...outletsRef.current.slice(0, index),
          ...outletsRef.current.slice(index + 1),
        ];

      if (boundOutletRef.current !== id) return;
      if (messageRef.current === null) {
        setBoundOutlet(null);

        return;
      }
      if (scopeRef.current === 'app') {
        rehome();

        return;
      }
      // `host`: the surface this toast belonged to is gone — so is the
      // toast, instantly (its surface is mid-dismissal; an exit animation
      // would play on whatever is behind, which is the very flicker this
      // exists to remove). Unmount semantics: the transaction commits.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      finalize(true);
      clearMessage();
      setBoundOutlet(null);
    },
    [clearMessage, finalize, rehome, setBoundOutlet],
  );
  const bottomClearance =
    boundOutlet !== null && boundInset !== undefined
      ? boundInset
      : iosBottomInset;

  const showSnackbar = useCallback(
    (next: string, nextAction?: SnackbarAction, options?: SnackbarOptions) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // A new snackbar ends the previous one's undo window — commit it.
      finalize(true);
      pendingRef.current = nextAction
        ? { onCommit: nextAction.onCommit, resolved: false }
        : null;
      // BIND to the surface this is fired on — the topmost outlet right now,
      // or the root. See `SnackbarScope`.
      scopeRef.current = options?.scope ?? 'host';
      const topOutlet = outletsRef.current.at(-1) ?? null;
      setBoundOutlet(topOutlet?.id ?? null);
      setBoundInset(topOutlet?.inset);
      messageRef.current = next;
      setMessage(next);
      setAction(nextAction ?? null);
      if (reduceMotion) {
        translateY.value = 0;
        opacity.value = 1;
      } else {
        translateY.value = HIDDEN_OFFSET;
        opacity.value = 0;
        translateY.value = withSpring(0, SETTLE_SPRING);
        opacity.value = withTiming(1, { duration: 180 });
      }
      startTimer();
    },
    [finalize, opacity, translateY, reduceMotion, setBoundOutlet, startTimer],
  );

  // Plain dismiss (no action): a passive close, so commit the transaction.
  const onDismissPress = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    finalize(true);
    animateOut();
  }, [animateOut, finalize]);

  // The action was taken (e.g. UNDO): resolve without committing, run it.
  const onActionPress = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    finalize(false);
    action?.onAction();
    animateOut();
  }, [action, animateOut, finalize]);

  // Swipe finished past the threshold: commit (same as a timeout) and continue
  // the bar off-screen, then drop it. The timer was already paused on drag
  // start. Runs on the JS thread.
  const commitFromSwipe = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    finalize(true);
  }, [finalize]);

  // On unmount, commit anything still pending so an optimistic delete is never
  // silently dropped.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      finalize(true);
    },
    [finalize],
  );

  // Drag the bar down to dismiss it early (the Google-apps idiom). Only a real
  // downward drag activates it (`activeOffsetY`), so taps on the action button
  // and horizontal motion are untouched. While dragging, the auto-dismiss timer
  // is paused; a release short of the threshold springs back and restarts it.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(SWIPE_ACTIVATION_OFFSET)
        .onStart(() => {
          runOnJS(pauseTimer)();
        })
        .onUpdate(event => {
          // Follow the finger down; heavily resist any upward pull (it can't
          // dismiss upward — it's anchored to the bottom edge).
          translateY.value =
            event.translationY > 0
              ? event.translationY
              : event.translationY * 0.1;
        })
        /**
         * CHECK `success`. RNGH calls `onEnd` for BOTH outcomes — a pan that
         * ended while ACTIVE, and one that never activated and simply failed or
         * was cancelled — and a failed gesture carries junk in `translationY` /
         * `velocityY`, which the dismissal test below would read as a swipe.
         * `activeOffsetY` means most touches that land here take that second
         * path, so the window is real even though nothing has been seen to
         * dismiss through it.
         */
        .onEnd((event, success) => {
          if (!success) return;

          const dismissed =
            event.translationY > SWIPE_DISMISS_DISTANCE ||
            event.velocityY > SWIPE_DISMISS_VELOCITY;

          if (dismissed) {
            runOnJS(commitFromSwipe)();
            if (reduceMotion) {
              translateY.value = SWIPE_OUT_OFFSET;
              opacity.value = 0;
              runOnJS(clearMessage)();
            } else {
              opacity.value = withTiming(0, { duration: 150 });
              translateY.value = withTiming(
                SWIPE_OUT_OFFSET,
                { duration: 150 },
                finished => {
                  if (finished) runOnJS(clearMessage)();
                },
              );
            }
          } else {
            translateY.value = reduceMotion ? 0 : withSpring(0, SETTLE_SPRING);
            runOnJS(startTimer)();
          }
        }),
    [
      reduceMotion,
      pauseTimer,
      startTimer,
      commitFromSwipe,
      clearMessage,
      opacity,
      translateY,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  /**
   * THE TOAST AS A NODE, so a presented surface can render it instead of the
   * root — see `SnackbarOutlet` for the defect that made this necessary and
   * for why `FullWindowOverlay` was measured and rejected.
   */
  const toast = message ? (
    <SafeAreaView
      edges={['bottom']}
      pointerEvents="box-none"
      style={[
        styles.host,
        Platform.OS === 'ios' ? { paddingBottom: bottomClearance } : null,
      ]}
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          onLayout={
            Platform.OS === 'ios'
              ? event => {
                  const { width, height } = event.nativeEvent.layout;
                  setToastSize({ w: width, h: height });
                }
              : undefined
          }
          style={[
            styles.snackbar,
            {
              // Android: solid M3 snackbar. iOS: transparent — the glass
              // layer below is the surface.
              backgroundColor:
                Platform.OS === 'ios' ? 'transparent' : colors.surfaceVariant,
            },
            animatedStyle,
          ]}
        >
          {/* The glass layer must cover the toast box exactly, so all
                  padding lives on the inner row (Yoga offsets absolute
                  children by the parent's padding). The MATERIAL is the
                  portfolio's one floating-glass surface — the same floor the
                  trophy banner and Sound Shaper's now-playing banner stand on.
                  This used to be pure `glassEffect` with nothing behind it,
                  which is where its readability problems came from. */}
          {Platform.OS === 'ios' && toastSize ? (
            <GlassSurfaceIos
              width={toastSize.w}
              height={toastSize.h}
              shape="capsule"
            />
          ) : null}
          <View style={styles.content}>
            <RNText
              style={[styles.message, { color: colors.onSurface }]}
              numberOfLines={2}
            >
              {message}
            </RNText>
            {/* iOS: the trailing control exists ONLY when there is a real
                    action (Undo). A toast never carries a DISMISS button on
                    iOS — auto-dismiss and swipe-down are the dismissal — so
                    the old always-there "OK" was Material's always-has-an-
                    action rule leaking across the split, and a hardcoded
                    untranslated string besides. Android keeps its constant
                    action slot: a real action's label arrives via `action`,
                    the plain dismiss via `dismissLabel`. */}
            {action || Platform.OS !== 'ios' ? (
              <Pressable
                hitSlop={8}
                onPress={action ? onActionPress : onDismissPress}
                // Inline text action → the shared press FADE (see the
                // press-language rule); it had no pressed state at all.
                style={({ pressed }) => ({
                  opacity: pressed ? PRESSED_OPACITY : 1,
                })}
              >
                <RNText style={[styles.action, { color: colors.primary }]}>
                  {action ? action.label : dismissLabel}
                </RNText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
  ) : null;

  return (
    <SnackbarContext.Provider
      value={{
        boundOutlet,
        claimOutlet,
        releaseOutlet,
        showSnackbar,
        toast,
      }}
    >
      {children}
      {/* The ROOT renders the toast bound to it — a sheet's stays in the
          sheet (see the outlet registry above). */}
      {boundOutlet === null ? toast : null}
    </SnackbarContext.Provider>
  );
};

const styles = StyleSheet.create({
  host: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    // Android sits above the opaque nav bar; iOS overrides this with the
    // app's `iosBottomInset`.
    paddingBottom: 16,
    position: 'absolute',
    right: 0,
  },
  snackbar: {
    // Android = the full-width M3 snackbar; iOS (which has no snackbar
    // idiom) = a floating Liquid Glass capsule toast.
    ...Platform.select({
      ios: {
        alignSelf: 'center' as const,
        // The shape is a CAPSULE (`GlassSurfaceIos` draws it as one), so this
        // only has to clip the RN content to the same silhouette. It tracks the
        // family's corner rather than a literal, which is what it was.
        borderRadius: FLOATING_RADIUS,
        maxWidth: '92%' as const,
      },
      default: { borderRadius: 12, elevation: 4 },
    }),
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  message: {
    flexShrink: 1,
    // 15/20 is SUBHEADLINE — the iOS step for a secondary line of running
    // text. The 14 both platforms shared was Material's body-medium leaking
    // across the split; iOS has no 14pt step at all.
    ...Platform.select({
      ios: { fontSize: 15, lineHeight: 20 },
      default: { flex: 1, fontSize: 14, lineHeight: 20 },
    }),
  },
  action: {
    // Uppercase action labels are a Material convention; iOS keeps sentence
    // case at Subheadline with a semibold weight.
    ...Platform.select({
      ios: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
      default: {
        fontSize: 14,
        letterSpacing: 0.5,
        textTransform: 'uppercase' as const,
      },
    }),
  },
});

export { SnackbarProvider };
