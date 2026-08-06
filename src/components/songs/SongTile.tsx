import { useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { NowPlayingBars } from '@/components/songs/NowPlayingBars';
import { SongArt } from '@/components/ui/SongArt';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Song } from '@/services/firebase/songs';
import { CONTINUOUS_CURVE, HAIRLINE, TILE_RADIUS } from '@/styles/shape';

// The home grid cell: a square artwork tile (the song's embedded cover, or the
// music glyph) with the title + artist under it — YT Music's album-tile
// language, one song per tile. Tap = play, long-press = edit.

const ART_EMOJI_RATIO = 0.38;
const EMOJI_FALLBACK_SIZE = 56;

type SongTileProps = {
  song: Song;
  /** Tinted primary while this song is the loaded one. */
  isCurrent: boolean;
  /** Drives the now-playing bars: animating while playing, frozen paused. */
  isPlaying: boolean;
  /** Playback speed, so the bars beat in time with the music. */
  rate: number;
  onPress: () => void;
  onLongPress: () => void;
};

export function SongTile({
  song,
  isCurrent,
  isPlaying,
  rate,
  onPress,
  onLongPress,
}: SongTileProps) {
  const { colors } = useAppTheme();
  // Measured so the glyph fallback scales with the tile (art is width-driven).
  const [artSize, setArtSize] = useState(0);

  return (
    <SquashPressable onPress={onPress} onLongPress={onLongPress}>
      <View
        style={styles.art}
        onLayout={event => setArtSize(event.nativeEvent.layout.width)}
      >
        <SongArt
          artUrl={song.artUrl || undefined}
          displayWidth={artSize || undefined}
          emojiSize={
            artSize
              ? Math.round(artSize * ART_EMOJI_RATIO)
              : EMOJI_FALLBACK_SIZE
          }
          style={[styles.artMedia, { borderRadius: TILE_RADIUS }]}
        />
        {isCurrent ? (
          <View style={styles.nowPlaying} pointerEvents="none">
            <NowPlayingBars playing={isPlaying} rate={rate} />
          </View>
        ) : null}
      </View>
      <Text
        doNotTranslate
        text={song.name}
        variant="bodyMedium"
        numberOfLines={1}
        style={[styles.name, isCurrent && { color: colors.primary }]}
      />
      <Text
        doNotTranslate
        muted
        text={song.artist || ' '}
        variant="bodySmall"
        numberOfLines={1}
        style={styles.artist}
      />
    </SquashPressable>
  );
}

/** The trailing "add a song" cell — a dashed square with a plus. */
export function AddSongTile({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <SquashPressable onPress={onPress} accessibilityLabel={t('home.addSong')}>
      <View
        style={[
          styles.art,
          styles.addBox,
          { borderRadius: TILE_RADIUS },
          // iOS: a FILLED placeholder. A dashed border reads as a web/Material
          // dropzone; Apple's nearest equivalent — the iWork document manager's
          // "Create Document" cell — is a filled tile, and a fill keeps the
          // grid's rhythm by reading as "another tile, empty" rather than as a
          // hole in it. Android keeps the dashed outline its frozen build
          // ships. Matched with Topper's rail, which made the same move.
          Platform.OS === 'ios'
            ? { backgroundColor: colors.surfaceContainer }
            : { borderColor: colors.border },
        ]}
      >
        <Text doNotTranslate text="+" style={styles.plus} />
      </View>
      <Text text="home.addSong" variant="bodyMedium" style={styles.name} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  nowPlaying: { bottom: 8, left: 8, position: 'absolute' },
  art: { aspectRatio: 1, marginBottom: 10, width: '100%' },
  artMedia: { height: '100%', width: '100%', ...CONTINUOUS_CURVE },
  addBox: {
    alignItems: 'center',
    justifyContent: 'center',
    ...CONTINUOUS_CURVE,
    // The dashed outline is Android's only now — see the fill above.
    ...Platform.select({
      android: { borderStyle: 'dashed' as const, borderWidth: HAIRLINE },
      default: {},
    }),
  },
  plus: {
    fontSize: 40,
    fontWeight: '300',
    // iOS clips a glyph this large to the font's line box, which lops the top
    // off the plus and leaves it reading as a "T". Android measures it fine,
    // and its layout is frozen, so only iOS gets the explicit line height.
    ...Platform.select({ ios: { lineHeight: 48 } }),
  },
  // The shared type scale is one set of point sizes for both platforms, but SF
  // Pro's smaller x-height makes 14/12 read dwarfed next to a full-width cover
  // on iOS. Apple Music's own album grid captions sit at 15/13 — match those,
  // iOS only, so Android's Material scale is untouched.
  name: {
    marginBottom: 1,
    ...Platform.select({ ios: { fontSize: 15, lineHeight: 20 } }),
  },
  artist: Platform.select({ ios: { fontSize: 13, lineHeight: 18 } }) ?? {},
});
