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

import { HStack, Spacer } from '@expo/ui/swift-ui';
import { frame, glassEffect } from '@expo/ui/swift-ui/modifiers';

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

import { SnackbarContext, type SnackbarAction } from './snackbar';
import { PRESSED_OPACITY } from './SquashPressable';
import { SwiftUIHost } from './SwiftUIHost';

type SnackbarProviderProps = {
  children: React.ReactNode;
  /**
   * iOS gap between the toast and the bottom safe-area edge. Apps with a
   * floating Liquid Glass tab bar pass 76 so the toast clears it; apps without
   * one keep the default.
   */
  iosBottomInset?: number;
};

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
  iosBottomInset = 16,
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

  const showSnackbar = useCallback(
    (next: string, nextAction?: SnackbarAction) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // A new snackbar ends the previous one's undo window — commit it.
      finalize(true);
      pendingRef.current = nextAction
        ? { onCommit: nextAction.onCommit, resolved: false }
        : null;
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
    [finalize, opacity, translateY, reduceMotion, startTimer],
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
        .onEnd(event => {
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

  /**
   * THE OUTLET REGISTRY — ids in claim order, so the LAST one mounted wins.
   * Sheets stack (account → Recently Deleted), and without "topmost only" the
   * toast drew once per stacked sheet.
   */
  const [outlets, setOutlets] = useState<number[]>([]);
  const claimOutlet = useCallback(
    (id: number) => setOutlets(current => [...current, id]),
    [],
  );
  const releaseOutlet = useCallback(
    (id: number) =>
      setOutlets(current => {
        const last = current.lastIndexOf(id);

        return last === -1
          ? current
          : [...current.slice(0, last), ...current.slice(last + 1)];
      }),
    [],
  );
  const activeOutlet = outlets.length > 0 ? outlets[outlets.length - 1] : null;
  // The active outlet's clearance, when it states one — see `SnackbarOutlet`.
  const [outletInset, setOutletInset] = useState<number | undefined>(undefined);
  const bottomClearance =
    activeOutlet !== null && outletInset !== undefined
      ? outletInset
      : iosBottomInset;

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
                  children by the parent's padding). */}
          {Platform.OS === 'ios' && toastSize ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* Without `ignoreSafeArea` the hosting controller insets
                      its SwiftUI content for the home indicator, so the
                      capsule renders half that inset above the toast box. */}
              <SwiftUIHost ignoreSafeArea="all" style={StyleSheet.absoluteFill}>
                <HStack
                  modifiers={[
                    frame({ width: toastSize.w, height: toastSize.h }),
                    glassEffect({
                      glass: { variant: 'regular' },
                      shape: 'capsule',
                    }),
                  ]}
                >
                  <Spacer />
                </HStack>
              </SwiftUIHost>
            </View>
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
                    action slot (labels arrive translated via `action`). */}
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
                  {action ? action.label : 'OK'}
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
        activeOutlet,
        claimOutlet,
        releaseOutlet,
        setOutletInset,
        showSnackbar,
        toast,
      }}
    >
      {children}
      {/* The ROOT renders it only when nothing above it has claimed it. */}
      {activeOutlet === null ? toast : null}
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
        borderRadius: 22,
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
