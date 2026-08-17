import { StyleSheet, View } from 'react-native';

import { SkeletonBone as Skeleton } from '@portfolio/mobile-ui';

import { TILE_RADIUS } from '@/styles/shape';

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

/** Stand-in for `SongTile` — the home grid: artwork square + two text
 *  lines under it, so the grid doesn't reflow on settle. */
export function SongTileSkeleton() {
  return (
    <View>
      {/* Yoga ignores aspectRatio once width AND height are both set, so the
          square comes from a wrapper and the block just fills it. */}
      <View style={styles.tileArt}>
        <Skeleton radius={TILE_RADIUS} style={styles.fill} />
      </View>
      <Skeleton width="75%" height={16} style={styles.tileName} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  tileArt: { aspectRatio: 1, marginBottom: 10, width: '100%' },
  fill: { height: '100%', width: '100%' },
  tileName: { marginBottom: 6 },
});
