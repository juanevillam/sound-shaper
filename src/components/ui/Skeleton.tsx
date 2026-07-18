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
import { CARD_RADIUS, innerRadius, SHAPE_MD } from '@/styles/shape';

// Nested-child radius mirrored from the real SongCard (same outer radius,
// inset, and M3 step), so the bone rounds exactly like the art it stands for.
const SONG_THUMB_RADIUS = innerRadius(CARD_RADIUS, 12, SHAPE_MD);

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

// Shared card chrome so a skeleton sits in the same surface/radius/padding as
// the real card it stands in for.
function SkeletonCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  );
}

/** Stand-in for `PlaylistCard` — home list + profile. */
export function PlaylistCardSkeleton() {
  return (
    <SkeletonCard style={styles.playlistCard}>
      <View style={styles.playlistHeader}>
        <Skeleton width={24} height={24} radius={6} />
        <Skeleton width="55%" height={18} />
      </View>
      <View style={styles.playlistMetaLine}>
        <Skeleton width="30%" height={12} />
      </View>
    </SkeletonCard>
  );
}

/** Stand-in for `SongCard` — the playlist-detail song list (art, title,
 * artist), so a cold load matches the rest of the app instead of a spinner. */
export function SongCardSkeleton() {
  return (
    <SkeletonCard style={styles.songCard}>
      <Skeleton width={56} height={56} radius={SONG_THUMB_RADIUS} />
      <View style={styles.songBody}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="45%" height={14} />
      </View>
    </SkeletonCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, padding: 16 },
  playlistCard: { gap: 10 },
  playlistHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  // bodySmall meta line box (16dp nominal, inflated by includeFontPadding).
  playlistMetaLine: { height: 18, justifyContent: 'center' },
  songCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  songBody: { flex: 1, gap: 4 },
});
