import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SkeletonBone as Skeleton } from '@portfolio/mobile-ui';

import {
  CAPTION_VARIANTS,
  useSoundTileMetrics,
} from '@/components/sounds/SoundTile';
import { Text, type TextVariant } from '@/components/ui/Text';

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
  const { artRadius, artToCaption, captionInset, lines, titleGap } =
    useSoundTileMetrics();

  return (
    <View>
      {/* Yoga ignores aspectRatio once width AND height are both set, so the
          square comes from a wrapper and the block just fills it. */}
      <View style={[styles.tileArt, { marginBottom: artToCaption }]}>
        <Skeleton radius={artRadius} style={styles.fill} />
      </View>
      <CaptionLine
        variant={CAPTION_VARIANTS.title}
        nominal={lines.title}
        barWidth="75%"
        inset={captionInset}
        style={{ marginBottom: titleGap }}
      />
      <CaptionLine
        variant={CAPTION_VARIANTS.subtitle}
        nominal={lines.subtitle}
        barWidth="40%"
        inset={captionInset}
      />
    </View>
  );
}

/**
 * ONE CAPTION LINE — and it reserves its box by STANDING A REAL `Text`, not by
 * setting a height.
 *
 * This used to take `lines.title` / `lines.subtitle` — the shared
 * `TEXT_VARIANTS[…].lineHeight`, imported rather than copied, which is the rule
 * this repo already had. It was still wrong on Android by 3.91dp PER ROW,
 * measured with the dev state lab against the live grid at a high-contrast
 * column: rows stood at 127.29 / 372.27 / 617.24dp live against
 * 127.29 / 368.36 / 609.43 boned, ~11.7dp of jump handed over on settle.
 *
 * AN ANDROID `Text` DOES NOT RENDER AT ITS STATED `lineHeight`. It came out
 * ~2dp taller per line, and `includeFontPadding: false` — the obvious
 * suspect — was rendered on device and changed NOTHING (the live art tops were
 * identical to the pixel before and after), so the padding is not what the
 * extra is. Whatever it is, it belongs to the platform's text measurement, and
 * a constant of ours describing it would be a number nobody can re-derive.
 *
 * So the bone stops describing the box and STANDS one: an invisible `Text` at
 * the caption's own variant, holding a single space, with the bar absolutely
 * positioned over it. The height is then whatever Android measures for that
 * variant — by construction the same thing the real caption gets — and there is
 * no term left to drift. `nominal` is used only to size the BAR inside the box,
 * where being a couple of points out is invisible.
 *
 * iOS was never affected and is unchanged by this: there the rendered box
 * already equals `lineHeight`.
 */
function CaptionLine({
  variant,
  nominal,
  barWidth,
  inset,
  style,
}: {
  variant: TextVariant;
  /** The variant's nominal line height — sizes the BAR, never the box. */
  nominal: number;
  barWidth: DimensionValue;
  inset: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.line, { paddingLeft: inset }, style]}
      // The space below is a MEASURING DEVICE, not content — keep TalkBack out
      // of it, or a loading grid announces a run of blank rows.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* A space, not an empty string: an empty `Text` measures zero. */}
      <Text doNotTranslate text=" " variant={variant} numberOfLines={1} />
      <View style={styles.barSlot} pointerEvents="none">
        <Skeleton width={barWidth} height={Math.round(nominal * BAR_RATIO)} />
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
const BAR_RATIO = 0.73;

const styles = StyleSheet.create({
  tileArt: { aspectRatio: 1, width: '100%' },
  fill: { height: '100%', width: '100%' },
  // The bar rides OVER the invisible `Text` that sets the box's height, centred
  // in it exactly as the real ink is.
  barSlot: {
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The line BOX. Its HEIGHT is the invisible `Text` inside it (see
  // `CaptionLine`); only the left inset comes from the metrics, because the
  // captions clear the artwork's rounded corner and bones flush to the edge
  // slid 6pt right on settle.
  line: { justifyContent: 'center' },
});
