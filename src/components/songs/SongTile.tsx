import { useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import {
  artworkRadius,
  emptyMediaPlusStyle,
  EMPTY_MEDIA_CAPTION_GAP,
  EMPTY_MEDIA_PLUS,
  TEXT_VARIANTS,
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
 * CAPTION TYPE, sized against the COVER rather than taken from the shared
 * scale — and stepped, not scaled.
 *
 * The shared `bodyMedium` / `bodySmall` (14 / 12) is what Topper's rail tile
 * uses, and it is right THERE: a 124pt cover with a 14pt title puts the caption
 * at 0.113 of the artwork. Under this app's 178pt grid cover the same 14 falls
 * to 0.079 and reads dwarfed — the tile is 44% wider and the words under it are
 * not, which is the disproportion Juan called out (2026-08-20). The 15 / 13
 * this file already carried only half-closed it, at 0.084.
 *
 * SO WHY NOT A RATIO, the way the artwork corner and the add tile's plus are?
 * Because type is not geometry. iOS text styles are a fixed, named ladder that
 * Dynamic Type scales as a unit; deriving a point size from a container's width
 * leaves that ladder, ships a size Apple never draws, and breaks the moment
 * someone raises their text size. The right move is to step UP the ladder, not
 * off it.
 *
 * 17 / 15 is `body` / `subheadline` — both real styles, and the pairing Apple
 * captions a large artwork cell with. It lands at 0.096 of the cover: not
 * Topper's 0.113, and it should not be, because a smaller tile carries a
 * proportionally larger caption. Compared on device against 15/13 and 16/14
 * (16 is `callout`, but 14 is nothing on the ladder — that pair was off it).
 *
 * The `+ 5` leading below is not a house rule either: it reproduces Apple's own
 * for both, 17/22 and 15/20. If either size moves off this pair, check the
 * leading against the real style rather than keeping the arithmetic.
 *
 * Android is frozen and keeps the Material scale untouched.
 */
const CAPTION_TITLE = 17;
const CAPTION_SUB = 15;

/**
 * ARTWORK, so the shared RATIO rather than the grouped-container constant this
 * used to pass. `TILE_RADIUS` is 26 — the iOS grouped-list radius, which is
 * correct for a card and wrong in kind for a cover — and it agreed with the
 * ratio only by coincidence at this exact cell size (0.15 × 178 = 27). Topper's
 * rail tile draws its cover from the same function at 124pt; that is what keeps
 * the two apps' artwork one shape family instead of two that happen to match.
 */
const ART_RADIUS = artworkRadius(GRID_CELL, SHAPE_MD);

/**
 * THE TILE'S GEOMETRY, EXPORTED FOR ITS SKELETON — style objects, not a copy of
 * their numbers.
 *
 * `SongTileSkeleton` stood a hand-copied set that had rotted: a 26 radius
 * against this file's 27, and a caption block of 16 + 6 + 12 = 34pt against the
 * real 22 + 1 + 20 = 43. Nine points of jump per row on settle, invisible in
 * the skeleton itself. Topper's rail hit the identical bug (its labels traced
 * 15/13 against 20/18 line boxes and left the rail 10pt short) and its
 * `Skeleton.tsx` records the rule this now follows: reserve the LINE BOX, draw
 * the bar thinner inside it.
 */
export const SONG_TILE_METRICS = {
  artRadius: ART_RADIUS,
  artToCaption: EMPTY_MEDIA_CAPTION_GAP,
  /**
   * The optical nudge the captions take to clear the artwork's rounded corner.
   * The BONES need it too, and did not have it: they sat flush at the tile's
   * left edge while the real text starts 6pt in, so every caption jumped right
   * on settle. Vertical geometry was shared here and horizontal was not, which
   * is the same defect one axis over. Topper's rail skeleton had it right
   * (`railBodyIos`), which is why the jump showed up in one app and not the
   * other.
   */
  captionInset: Platform.select({
    ios: opticalTextInset(ART_RADIUS),
    default: 0,
  }) as number,
  /** The gap the title's own `marginBottom` opens under it. */
  titleGap: 1,
  lines: Platform.select({
    ios: { title: CAPTION_TITLE + 5, subtitle: CAPTION_SUB + 5 },
    default: {
      title: TEXT_VARIANTS.bodyMedium.lineHeight as number,
      subtitle: TEXT_VARIANTS.bodySmall.lineHeight as number,
    },
  }) as { title: number; subtitle: number },
};

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
      {/* TWO CAPTION LINES, like every real tile — and the second one is not
          filler. Sound Shaper's add tile goes STRAIGHT to the file picker
          (Topper's opens an editor, which is why its create tile needs no
          second line), so what belongs here is what the picker wants. That is
          MP3 and only MP3: `uploadSongAudio` labels every upload `audio/mpeg`
          and `readId3Tags` reads ID3v2, so anything else arrives mislabelled
          and untagged. Saying so on the tile is cheaper than finding out after
          the upload. Muted, like the artist line it stands in for. */}
      <Text text="home.addSong" variant="bodyMedium" style={styles.name} />
      <Text muted text="home.addSongFormat" style={styles.artist} />
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
  // Sizes come from CAPTION_TITLE / CAPTION_SUB above.
  // The optical nudge is iOS-only: the caption sits under the artwork's rounded
  // bottom corners, which curve the edge inward right where the text starts, so
  // flush to the true edge it reads as hanging past the cover. Android's layout
  // is frozen and keeps the flush edge.
  name: {
    marginBottom: 1,
    ...Platform.select({
      ios: {
        fontSize: CAPTION_TITLE,
        lineHeight: CAPTION_TITLE + 5,
        paddingLeft: SONG_TILE_METRICS.captionInset,
      },
    }),
  },
  artist:
    Platform.select({
      ios: {
        fontSize: CAPTION_SUB,
        lineHeight: CAPTION_SUB + 5,
        paddingLeft: SONG_TILE_METRICS.captionInset,
      },
    }) ?? {},
});
