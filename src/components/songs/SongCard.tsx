import { useEffect, useRef } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

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
import { type Song } from '@/services/firebase/songs';
import { CARD_RADIUS, innerRadius, SHAPE_MD } from '@/styles/shape';

// Material 3 filled-card look in plain RN views (synchronous measure keeps the
// drag-and-drop list smooth — Topper's TopItemCard reasoning). Unlike Topper's
// ranked items there is NO rank digit or podium color: a playlist is ordered,
// not a ranking.
const CARD_MIN_HEIGHT = 80;
const CARD_PADDING_VERTICAL = 12;
const THUMBNAIL_SIZE = 56;
const THUMBNAIL_RADIUS = innerRadius(
  CARD_RADIUS,
  CARD_PADDING_VERTICAL,
  SHAPE_MD,
);
const THUMBNAIL_EMOJI_SIZE = 28;

// Material Symbols `drag_indicator` (two columns of three dots), drawn with
// views so the pure-RN card needs no icon-font dependency.
const DRAG_DOT_SIZE = 4;
const DRAG_DOT_GAP = 4;

// Entrance: each card fades in while rising, staggered by position so the list
// cascades. Self-driven (react-native-sortables wraps items in `skipEntering`,
// so Reanimated `entering` props never fire).
const ENTER_DURATION_MS = 220;
const ENTER_STAGGER_MS = 40;
const ENTER_STAGGER_CAP = 8;
const ENTER_RISE = 16;

type SongCardProps = {
  /** Show the drag handle — the owner's reorderable list. */
  draggable?: boolean;
  song: Song;
  onPress: () => void;
  /** 1-based position, used only to stagger the entrance cascade. */
  index: number;
  /** Gate for the entrance animation (flips when the push transition lands). */
  shouldEnter?: boolean;
};

// iOS's reorder affordance is the three-line grabber; Android keeps Material's
// six-dot grid — same hand-drawn approach, platform-split look.
const DragDots = ({ color }: { color: string }) =>
  Platform.OS === 'ios' ? (
    <View style={styles.grabber}>
      {[0, 1, 2].map(index => (
        <View
          key={index}
          style={[styles.grabberBar, { backgroundColor: color }]}
        />
      ))}
    </View>
  ) : (
    <View style={styles.dragDots}>
      {Array.from({ length: 6 }, (_, index) => (
        <View
          key={index}
          style={[styles.dragDot, { backgroundColor: color }]}
        />
      ))}
    </View>
  );

/**
 * Card for a single song inside a playlist (playlist-detail screen): cover
 * art, name + artist, drag affordance trailing. `SquashPressable` handles the
 * tap press feedback; the drag gesture is owned by the enclosing sortable
 * grid (long-press).
 */
export function SongCard({
  draggable = true,
  song,
  onPress,
  index,
  shouldEnter = true,
}: SongCardProps) {
  const { colors } = useAppTheme();

  // Mount position, frozen: drag reorders change `index` later and must not
  // replay the entrance.
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

    const delay = Math.min(initialIndex, ENTER_STAGGER_CAP) * ENTER_STAGGER_MS;

    enterProgress.value = withDelay(
      delay,
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
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <SongArt
            artUrl={song.artUrl || undefined}
            displayWidth={THUMBNAIL_SIZE}
            emojiSize={THUMBNAIL_EMOJI_SIZE}
            style={styles.thumbnail}
          />
          <View style={styles.info}>
            <Text
              doNotTranslate
              text={song.name}
              variant="bodyLarge"
              numberOfLines={1}
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
          {draggable ? <DragDots color={colors.onSurfaceMuted} /> : null}
        </View>
      </SquashPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    gap: 12,
    minHeight: CARD_MIN_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: CARD_PADDING_VERTICAL,
  },
  info: {
    flex: 1,
    gap: 2,
    // Keep long titles from ending flush against the drag affordance.
    paddingRight: 12,
  },
  thumbnail: {
    borderRadius: THUMBNAIL_RADIUS,
    height: THUMBNAIL_SIZE,
    width: THUMBNAIL_SIZE,
  },
  dragDots: {
    columnGap: DRAG_DOT_GAP,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: DRAG_DOT_GAP,
    width: DRAG_DOT_SIZE * 2 + DRAG_DOT_GAP,
  },
  dragDot: {
    borderRadius: DRAG_DOT_SIZE / 2,
    height: DRAG_DOT_SIZE,
    width: DRAG_DOT_SIZE,
  },
  grabber: { gap: 3 },
  grabberBar: { borderRadius: 1, height: 2, width: 17 },
});
