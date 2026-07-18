import { useEffect, useRef } from 'react';

import { StyleSheet, View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Playlist } from '@/services/firebase/playlists';
import { useArtTransitionStore } from '@/store/artTransition';
import { TILE_RADIUS } from '@/styles/shape';

// YT-Music-style library tile: the "artwork" square (the playlist's emoji as
// its cover) with the name + count stacked UNDER it, not boxed in a card —
// art-forward, flat, unmistakably a music app. Pure RN (grids of Compose
// Hosts measure async and lag — the Topper cards lesson).
const EMOJI_SIZE = 56;

// Entrance: tiles fade-rise in a stagger, same vocabulary as the song rows.
const ENTER_DURATION_MS = 220;
const ENTER_STAGGER_MS = 30;
const ENTER_STAGGER_CAP = 10;
const ENTER_RISE = 12;

type PlaylistTileProps = {
  onPress: () => void;
  /** Long-press quick actions (Edit / Delete). */
  onLongPress?: () => void;
  playlist: Playlist;
  /** Grid position, used only to stagger the entrance cascade. */
  index: number;
};

export function PlaylistTile({
  onPress,
  onLongPress,
  playlist,
  index,
}: PlaylistTileProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const setHandoff = useArtTransitionStore(s => s.setHandoff);

  const artRef = useRef<View>(null);
  const initialIndex = useRef(index).current;
  const hasEntered = useRef(false);
  const enterProgress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // Measure the artwork in window coordinates and park it for the detail
  // screen's hero morph, THEN navigate. Falls back to a plain push when the
  // measure fails (or motion is reduced) — the destination just skips the
  // overlay.
  const pressWithHandoff = () => {
    const art = artRef.current;

    if (reduceMotion || !art) {
      onPress();
      return;
    }

    art.measureInWindow((x, y, width) => {
      if (width > 0)
        setHandoff({ x, y, size: width, emoji: playlist.emoji || '🎵' });
      onPress();
    });
  };

  useEffect(() => {
    if (hasEntered.current) return;

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
  }, [enterProgress, initialIndex, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [{ translateY: (1 - enterProgress.value) * ENTER_RISE }],
  }));

  const countLabel = `${playlist.songCount} ${t(
    playlist.songCount === 1 ? 'home.song' : 'home.songs',
  )}`;

  return (
    <Animated.View style={enterStyle}>
      <SquashPressable onPress={pressWithHandoff} onLongPress={onLongPress}>
        <View
          ref={artRef}
          style={[styles.art, { backgroundColor: colors.surfaceContainer }]}
        >
          <Text
            doNotTranslate
            text={playlist.emoji || '🎵'}
            style={styles.emoji}
          />
        </View>
        <Text
          doNotTranslate
          text={playlist.name}
          variant="bodyLarge"
          numberOfLines={1}
          style={styles.name}
        />
        <Text doNotTranslate muted text={countLabel} variant="bodySmall" />
      </SquashPressable>
    </Animated.View>
  );
}

/** The grid's trailing "create" tile — the + IS the artwork. */
export function NewPlaylistTile({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <SquashPressable onPress={onPress}>
      <View style={[styles.art, styles.newArt, { borderColor: colors.border }]}>
        <Text
          doNotTranslate
          text="＋"
          style={[styles.plus, { color: colors.onSurfaceMuted }]}
        />
      </View>
      <Text text="home.fab.newPlaylist" variant="bodyLarge" numberOfLines={1} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  art: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: TILE_RADIUS,
    justifyContent: 'center',
    marginBottom: 8,
    width: '100%',
  },
  newArt: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  // Explicit line height: Android clips large emoji glyphs to the font's
  // nominal line box otherwise (only the stems survive).
  emoji: { fontSize: EMOJI_SIZE, lineHeight: EMOJI_SIZE * 1.4 },
  plus: { fontSize: 44, lineHeight: 60 },
  name: { marginBottom: 1 },
});
