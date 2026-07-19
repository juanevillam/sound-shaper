import { useEffect } from 'react';

import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { TILE_RADIUS } from '@/styles/shape';

// A first-load surface waits this long before showing its skeleton, so a
// cached snapshot that settles inside the window never flashes one. Pair with
// `useDelayedShow`.
export const SKELETON_DELAY_MS = 400;

// A loading placeholder breathes between these opacities; reduce-motion holds
// it steady at the midpoint instead (no pulse).
const PULSE_MIN = 0.35;
const PULSE_MAX = 0.7;
const PULSE_STEADY = 0.5;
const PULSE_MS = 750;

type SkeletonProps = {
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
};

/**
 * One neutral placeholder block (themed `surfaceVariant`) with a gentle opacity
 * pulse, the building block for every content-shaped skeleton. Reanimated on
 * the native driver, and respects the OS reduce-motion setting.
 */
export function Skeleton({
  height = 14,
  radius = 8,
  style,
  width = '100%',
}: SkeletonProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(PULSE_MAX);

  useEffect(() => {
    if (reduceMotion) return;

    pulse.value = withRepeat(
      withSequence(
        withTiming(PULSE_MIN, {
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(PULSE_MAX, {
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? PULSE_STEADY : pulse.value,
  }));

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.surfaceVariant, borderRadius: radius },
        { height, width },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Stand-in for `SongTile` — the home grid: artwork square + two text
 *  lines under it, so the grid doesn't reflow on settle. */
export function SongTileSkeleton() {
  return (
    <View>
      <Skeleton
        width="100%"
        height={undefined}
        radius={TILE_RADIUS}
        style={styles.tileArt}
      />
      <Skeleton width="75%" height={16} style={styles.tileName} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  // aspectRatio drives the height; the fixed-height prop is overridden.
  tileArt: { aspectRatio: 1, marginBottom: 10 },
  tileName: { marginBottom: 6 },
});
