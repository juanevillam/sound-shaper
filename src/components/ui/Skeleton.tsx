import { StyleSheet, View } from 'react-native';

import {
  CAPTION_VARIANTS,
  useSoundTileMetrics,
} from '@/components/sounds/SoundTile';
import { SkeletonBone, SkeletonTextLine } from '@/ui';

// A first-load surface waits this long before showing its skeleton, so a
// cached snapshot that settles inside the window never flashes one. Pair with
// `useDelayedShow`.
export const SKELETON_DELAY_MS = 400;

/**
 * Stand-in for `SoundTile` — the home grid: artwork square + two text lines
 * under it, so the grid doesn't reflow on settle.
 *
 * EVERY TERM COMES FROM THE TILE (`useSoundTileMetrics`), because every one of
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
  // THE SAME CALL THE TILE MAKES, not a copy of its answer — the cell is
  // derived from the window now, so a bone holding a frozen one would stand the
  // wrong width on any screen that is not 402pt wide. This is the horizontal
  // half of the rule below.
  const { artRadius, artToCaption, captionInset, titleGap } =
    useSoundTileMetrics();

  return (
    <View>
      {/* Yoga ignores aspectRatio once width AND height are both set, so the
          square comes from a wrapper and the block just fills it. */}
      <View style={[styles.tileArt, { marginBottom: artToCaption }]}>
        <SkeletonBone radius={artRadius} style={styles.fill} />
      </View>
      <SkeletonTextLine
        variant={CAPTION_VARIANTS.title}
        barWidth="75%"
        style={{ marginBottom: titleGap, paddingLeft: captionInset }}
      />
      <SkeletonTextLine
        variant={CAPTION_VARIANTS.subtitle}
        barWidth="40%"
        style={{ paddingLeft: captionInset }}
      />
    </View>
  );
}

/**
 * The ghost-measured caption line itself is `SkeletonTextLine` in
 * `src/ui` now — it was written HERE (2026-08-28, for the grid
 * captions whose Android boxes rendered ~2dp past their stated `lineHeight`)
 * and moved the day Topper's owner-row bone hit the identical defect, per the
 * same-component rule. The full argument, the invisible-space trick and the
 * bar ratio live with it.
 */

const styles = StyleSheet.create({
  tileArt: { aspectRatio: 1, width: '100%' },
  fill: { height: '100%', width: '100%' },
});
