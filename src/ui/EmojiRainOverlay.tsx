import React, { useEffect, useMemo } from 'react';

import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type EmojiRainOverlayProps = {
  /** The emoji that rains, e.g. "👑". */
  emoji: string;
  /** How many drops fall. */
  count?: number;
  /** Called once the last drop has landed — unmount the overlay here. */
  onDone: () => void;
};

type Drop = {
  x: number;
  size: number;
  delay: number;
  duration: number;
  spin: number;
};

const DEFAULT_COUNT = 24;
const MAX_DELAY_MS = 600;
const MIN_DURATION_MS = 1400;
const MAX_DURATION_MS = 2200;

/**
 * A one-shot full-screen emoji downpour — the payload of the "tap the version
 * row seven times" easter egg (the Android build-number gesture). Purely
 * decorative: absolutely positioned, never intercepts touches, unmounts via
 * `onDone`. Honors reduce-motion by skipping straight to `onDone`.
 */
const RainDrop = ({ drop, emoji }: { drop: Drop; emoji: string }) => {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      drop.delay,
      withTiming(1, {
        duration: drop.duration,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, [progress, drop]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -60 + progress.value * (height + 120) },
      { rotate: `${progress.value * drop.spin}deg` },
    ],
    // Hold full opacity for most of the fall, fade over the last stretch.
    opacity: progress.value < 0.8 ? 1 : (1 - progress.value) / 0.2,
  }));

  return (
    <Animated.View style={[styles.drop, { left: drop.x }, style]}>
      <Text style={{ fontSize: drop.size }}>{emoji}</Text>
    </Animated.View>
  );
};

export const EmojiRainOverlay = ({
  emoji,
  count = DEFAULT_COUNT,
  onDone,
}: EmojiRainOverlayProps) => {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: count }, () => ({
        x: Math.random() * (width - 40),
        size: 24 + Math.random() * 20,
        delay: Math.random() * MAX_DELAY_MS,
        duration:
          MIN_DURATION_MS + Math.random() * (MAX_DURATION_MS - MIN_DURATION_MS),
        spin: -90 + Math.random() * 180,
      })),
    [count, width],
  );

  useEffect(() => {
    const total = reduceMotion ? 0 : MAX_DELAY_MS + MAX_DURATION_MS + 100;
    const timer = setTimeout(onDone, total);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {drops.map((drop, index) => (
        <RainDrop key={index} drop={drop} emoji={emoji} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    // Above sibling native (Compose) hosts on Android.
    elevation: 10,
    zIndex: 10,
  },
  drop: { position: 'absolute', top: 0 },
});
