import { useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import {
  artworkRadius,
  emptyMediaPlusStyle,
  EMPTY_MEDIA_CAPTION_GAP,
  EMPTY_MEDIA_PLUS,
} from '@portfolio/mobile-ui';

import { NowPlayingBars } from '@/components/songs/NowPlayingBars';
import { SongArt } from '@/components/ui/SongArt';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Song } from '@/services/firebase/songs';
import { opticalTextInset } from '@/styles/metrics';
import { CONTINUOUS_CURVE, HAIRLINE, SHAPE_MD } from '@/styles/shape';

// The home grid cell: a square artwork tile (the song's embedded cover, or the
// music glyph) with the title + artist under it — YT Music's album-tile
// language, one song per tile. Tap = play, long-press = edit.

// The tile measures its own art box, so this only covers the very first frame
// before `onLayout` reports — roughly a tile's width at the usual grid.
const ART_FALLBACK_SIZE = 148;

/**
 * THE GRID CELL, measured: 402 screen − 2 × 16 gutter − 14 gap, halved.
 *
 * Stated as a constant because two SHARED terms are derived from it — the
 * artwork's corner and the add tile's plus — and both are ratios of the box
 * rather than numbers of their own. It is a static figure for a 2-column grid
 * on iPhone; if the grid ever gains a column or runs on iPad, this is the one
 * value to make dynamic and everything below follows it.
 */
const GRID_CELL = 178;

/**
 * ARTWORK, so the shared RATIO rather than the grouped-container constant this
 * used to pass. `TILE_RADIUS` is 26 — the iOS grouped-list radius, which is
 * correct for a card and wrong in kind for a cover — and it agreed with the
 * ratio only by coincidence at this exact cell size (0.15 × 178 = 27). Topper's
 * rail tile draws its cover from the same function at 124pt; that is what keeps
 * the two apps' artwork one shape family instead of two that happen to match.
 */
const ART_RADIUS = artworkRadius(GRID_CELL, SHAPE_MD);

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
          size={artSize || ART_FALLBACK_SIZE}
          title={song.name}
          style={[styles.artMedia, { borderRadius: ART_RADIUS }]}
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
          { borderRadius: ART_RADIUS },
          // iOS: a FILLED placeholder. A dashed border reads as a web/Material
          // dropzone; Apple's nearest equivalent — the iWork document manager's
          // "Create Document" cell — is a filled tile, and a fill keeps the
          // grid's rhythm by reading as "another tile, empty" rather than as a
          // hole in it. Android keeps the dashed outline its frozen build
          // ships. Matched with Topper's rail, which made the same move.
          Platform.OS === 'ios'
            ? // surfaceContainer, not `fill` — matched with Topper's create
              // tile (2026-08-08): the fill composites within one hex step of
              // the dark card surface, so filled-but-empty tiles read as
              // cards. Both apps anchor the empty-media material on solid
              // systemGray5.
              { backgroundColor: colors.surfaceContainer }
            : { borderColor: colors.border },
        ]}
      >
        <Text doNotTranslate text={EMPTY_MEDIA_PLUS} style={styles.plus} />
      </View>
      <Text text="home.addSong" variant="bodyMedium" style={styles.name} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  nowPlaying: { bottom: 8, left: 8, position: 'absolute' },
  // The shared artwork-to-caption gap, which Topper's create tile and the item
  // editor's picker also take — it was a bare 10 here, the value that spec was
  // written from.
  art: { aspectRatio: 1, marginBottom: EMPTY_MEDIA_CAPTION_GAP, width: '100%' },
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
  /**
   * THE SHARED "ADD MEDIA" PLUS, derived from the box rather than hard-coded.
   *
   * This drew a fixed 40 on a 178pt cell — a ratio of 0.225, which is precisely
   * the value Topper's rail tile was moved OFF on 2026-08-16 for reading as "a
   * small mark in a large empty square". Topper's number followed the spec and
   * this one did not, so the two add tiles drifted apart on the one term a
   * comment in `HomeRailTilesIos` claimed they shared. At 0.3 this renders 53.
   *
   * The explicit line height comes with it: iOS clips a glyph this large to the
   * font's line box and the plus renders as a "T". Android keeps its frozen
   * layout, so it takes neither.
   */
  plus: Platform.select({
    ios: emptyMediaPlusStyle(GRID_CELL),
    default: { fontSize: 40, fontWeight: '300' as const },
  }),
  // The shared type scale is one set of point sizes for both platforms, but SF
  // Pro's smaller x-height makes 14/12 read dwarfed next to a full-width cover
  // on iOS. Apple Music's own album grid captions sit at 15/13 — match those,
  // iOS only, so Android's Material scale is untouched.
  // The optical nudge is iOS-only: the caption sits under the artwork's rounded
  // bottom corners, which curve the edge inward right where the text starts, so
  // flush to the true edge it reads as hanging past the cover. Android's layout
  // is frozen and keeps the flush edge.
  name: {
    marginBottom: 1,
    ...Platform.select({
      ios: {
        fontSize: 15,
        lineHeight: 20,
        paddingLeft: opticalTextInset(ART_RADIUS),
      },
    }),
  },
  artist:
    Platform.select({
      ios: {
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: opticalTextInset(ART_RADIUS),
      },
    }) ?? {},
});
