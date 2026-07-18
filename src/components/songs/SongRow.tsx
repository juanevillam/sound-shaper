import { useEffect, useRef } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { SongArt } from '@/components/ui/SongArt';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Song } from '@/services/firebase/songs';
import { innerRadius, SHAPE_SM, TILE_RADIUS } from '@/styles/shape';

// YT-Music-style track row: FLAT on the screen background (no card), small
// square art, title over artist, a trailing ⋮ for editing. Tap plays;
// long-press picks the row up for reorder (react-native-sortables). Pure RN so
// dragging stays synchronous-smooth.
const ROW_HEIGHT = 64;
const ART_SIZE = 48;
const ART_RADIUS = innerRadius(TILE_RADIUS, 8, SHAPE_SM);
const ART_EMOJI_SIZE = 24;

// The ⋮ glyph, hand-drawn (a per-row Compose Icon would blink on nav returns
// and lag long lists — the same reason the drag dots are views).
const DOT_SIZE = 4;
const DOT_GAP = 3;

// Entrance cascade, shared vocabulary with the playlist tiles.
const ENTER_DURATION_MS = 220;
const ENTER_STAGGER_MS = 30;
const ENTER_STAGGER_CAP = 10;
const ENTER_RISE = 12;

const OverflowDots = ({ color }: { color: string }) => (
  <View style={styles.dotsColumn}>
    {[0, 1, 2].map(index => (
      <View key={index} style={[styles.dot, { backgroundColor: color }]} />
    ))}
  </View>
);

type SongRowProps = {
  song: Song;
  /** Tap: play the song. */
  onPress: () => void;
  /** The trailing ⋮ — opens the metadata editor. */
  onPressMenu: () => void;
  /** This song is loaded in the player — title tints primary. */
  isCurrent?: boolean;
  /** 1-based position, used only to stagger the entrance cascade. */
  index: number;
  /** Gate for the entrance animation (flips when the push lands). */
  shouldEnter?: boolean;
};

export function SongRow({
  song,
  onPress,
  onPressMenu,
  isCurrent = false,
  index,
  shouldEnter = true,
}: SongRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  const initialIndex = useRef(index).current;
  const hasEntered = useRef(false);
  const enterProgress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!shouldEnter || hasEntered.current) return;

    hasEntered.current = true;

    if (reduceMotion) {
      enterProgress.value = 1;
      return;
    }

    enterProgress.value = withDelay(
      Math.min(initialIndex, ENTER_STAGGER_CAP) * ENTER_STAGGER_MS,
      withTiming(1, {
        duration: ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [enterProgress, initialIndex, shouldEnter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [{ translateY: (1 - enterProgress.value) * ENTER_RISE }],
  }));

  const subtitle = [song.artist, song.releaseYear].filter(Boolean).join(' · ');

  return (
    <Animated.View style={enterStyle}>
      <SquashPressable onPress={onPress}>
        <View style={styles.row}>
          <SongArt
            artUrl={song.artUrl || undefined}
            displayWidth={ART_SIZE}
            emojiSize={ART_EMOJI_SIZE}
            style={styles.art}
          />
          <View style={styles.info}>
            <Text
              doNotTranslate
              text={song.name}
              variant="bodyLarge"
              numberOfLines={1}
              style={isCurrent ? { color: colors.primary } : undefined}
            />
            {subtitle.length > 0 ? (
              <Text
                doNotTranslate
                muted
                text={subtitle}
                variant="bodySmall"
                numberOfLines={1}
              />
            ) : null}
          </View>
          {/* 48dp target for the ⋮; a nested Pressable so the row tap stays
              play-only. */}
          <Pressable
            onPress={onPressMenu}
            hitSlop={8}
            style={styles.menu}
            accessibilityRole="button"
            accessibilityLabel={t('app.songEditExisting')}
          >
            <OverflowDots color={colors.onSurfaceMuted} />
          </Pressable>
        </View>
      </SquashPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: ROW_HEIGHT,
    paddingLeft: 16,
    paddingRight: 4,
  },
  art: {
    borderRadius: ART_RADIUS,
    height: ART_SIZE,
    width: ART_SIZE,
  },
  info: { flex: 1, gap: 1 },
  menu: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  dotsColumn: { gap: DOT_GAP },
  dot: {
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
});
