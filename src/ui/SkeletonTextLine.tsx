import {
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { TEXT_VARIANTS, type TextVariant } from './createText';
import { SkeletonBone } from './SkeletonBone';

/**
 * A BONE FOR ONE LINE OF TEXT — the line's box measured by the PLATFORM, not
 * described by a constant.
 *
 * AN ANDROID `Text` DOES NOT RENDER AT ITS STATED `lineHeight`. Sound Shaper
 * measured its grid captions ~2dp taller per line than the scale says, and
 * `includeFontPadding: false` — the obvious suspect — changed NOTHING on
 * device; whatever the extra is, it belongs to the platform's text
 * measurement, and a constant of ours describing it would be a number nobody
 * can re-derive. Topper then hit the identical defect on Home's owner row
 * (bone card 4.3dp off the live one, 2026-09-04), which made this the second
 * app re-deriving the same fix — so the fix moved here.
 *
 * The bone therefore STANDS a line rather than describing one: an invisible
 * `Text` at the line's own variant, holding a single space, with the bar
 * absolutely positioned over it. The height is then whatever the platform
 * measures for that variant — by construction the same thing the real text
 * gets — and there is no term left to drift. iOS was never affected (there
 * the rendered box already equals `lineHeight`) and is unchanged by
 * construction.
 *
 * The bar draws at `BAR_RATIO` of the variant's nominal line height — the
 * proportion Topper's rail labels established (15 on a 20 line, 13 on an 18).
 * Thinner than the text's own ink would be, which is what makes a bone read
 * as a placeholder rather than as a redacted word.
 */
export const SKELETON_BAR_RATIO = 0.73;

export function SkeletonTextLine({
  variant,
  barWidth,
  align = 'flex-start',
  style,
}: {
  variant: TextVariant;
  barWidth: DimensionValue;
  /** Where the bar sits in the line — `center` for text the real component
   *  centres (a person card's name), leading otherwise. */
  align?: 'flex-start' | 'center';
  /** The line's place in its column — margins/padding only; never a height. */
  style?: StyleProp<ViewStyle>;
}) {
  const metrics = TEXT_VARIANTS[variant];

  return (
    <View
      style={[styles.line, style]}
      // The space below is a MEASURING DEVICE, not content — keep screen
      // readers out of it, or a loading screen announces a run of blank rows.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* A space, not an empty string: an empty `Text` measures zero. */}
      <Text style={metrics} numberOfLines={1}>
        {' '}
      </Text>
      <View
        style={[styles.barSlot, { alignItems: align }]}
        pointerEvents="none"
      >
        <SkeletonBone
          width={barWidth}
          height={Math.round(
            (metrics.lineHeight as number) * SKELETON_BAR_RATIO,
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bar rides OVER the invisible `Text` that sets the box's height,
  // centred in it exactly as the real ink is.
  barSlot: {
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  line: { justifyContent: 'center' },
});
