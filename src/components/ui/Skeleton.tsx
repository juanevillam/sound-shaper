import { StyleSheet, View } from 'react-native';

import { SkeletonBone as Skeleton } from '@portfolio/mobile-ui';

import { SOUND_TILE_METRICS } from '@/components/sounds/SoundTile';

// A first-load surface waits this long before showing its skeleton, so a
// cached snapshot that settles inside the window never flashes one. Pair with
// `useDelayedShow`.
export const SKELETON_DELAY_MS = 400;

/**
 * ONE NEUTRAL PLACEHOLDER BLOCK — now `SkeletonBone` from
 * `@portfolio/mobile-ui`, re-exported here so this app's import path is
 * unchanged.
 *
 * It moved because Topper had a byte-identical copy of it, and because the
 * animation stopped being a per-bone concern: the sweep runs off ONE app-wide
 * clock and is positioned by where each bone sits on screen. See that file for
 * what Apple actually does here (nothing — `.redacted` is static), why the
 * sweep is not an Android idiom, and what was wrong with the pulse it
 * replaces.
 *
 * The CONTENT-SHAPED bones below stay here: they are this app's geometry.
 */
export { Skeleton };

/**
 * Stand-in for `SoundTile` — the home grid: artwork square + two text lines
 * under it, so the grid doesn't reflow on settle.
 *
 * EVERY TERM COMES FROM THE TILE (`SOUND_TILE_METRICS`), because every one of
 * them had rotted as a copy: a 26 radius against the tile's 27, and a caption
 * block of 16 + 6 + 12 = 34pt against the real 22 + 1 + 20 = 43. Nine points of
 * jump per row on settle, and invisible in the skeleton itself.
 *
 * LINE BOXES, NOT BAR HEIGHTS. A bar is drawn thinner than the text it stands
 * for, so what has to be RESERVED is the real `lineHeight` and the bar sits
 * inside it. Topper's rail carries the same rule after the same bug — see its
 * `Skeleton.tsx`.
 */
export function SoundTileSkeleton() {
  return (
    <View>
      {/* Yoga ignores aspectRatio once width AND height are both set, so the
          square comes from a wrapper and the block just fills it. */}
      <View style={styles.tileArt}>
        <Skeleton radius={SOUND_TILE_METRICS.artRadius} style={styles.fill} />
      </View>
      <View style={styles.tileNameLine}>
        <Skeleton width="75%" height={TITLE_BAR} />
      </View>
      <View style={styles.tileArtistLine}>
        <Skeleton width="40%" height={SUBTITLE_BAR} />
      </View>
    </View>
  );
}

/**
 * The bars themselves, drawn at ~0.73 of their line box — the proportion
 * Topper's rail labels already use (15 on a 20 line, 13 on an 18). Thinner than
 * the text's own ink would be, which is what makes a bone read as a placeholder
 * rather than as a redacted word.
 */
const TITLE_BAR = Math.round(SOUND_TILE_METRICS.lines.title * 0.73);
const SUBTITLE_BAR = Math.round(SOUND_TILE_METRICS.lines.subtitle * 0.73);

const styles = StyleSheet.create({
  tileArt: {
    aspectRatio: 1,
    marginBottom: SOUND_TILE_METRICS.artToCaption,
    width: '100%',
  },
  fill: { height: '100%', width: '100%' },
  // The line BOX, with the bar centred in it — the tile's own two rows. The
  // left inset is the tile's too: its captions clear the artwork's rounded
  // corner, and bones flush to the edge slid 6pt right on settle.
  tileNameLine: {
    height: SOUND_TILE_METRICS.lines.title,
    justifyContent: 'center',
    marginBottom: SOUND_TILE_METRICS.titleGap,
    paddingLeft: SOUND_TILE_METRICS.captionInset,
  },
  tileArtistLine: {
    height: SOUND_TILE_METRICS.lines.subtitle,
    justifyContent: 'center',
    paddingLeft: SOUND_TILE_METRICS.captionInset,
  },
});
