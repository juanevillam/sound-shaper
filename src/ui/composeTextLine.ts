import { PixelRatio } from 'react-native';

import { type TextVariant } from './createText';

/**
 * THE LINE BOX A COMPOSE `Text` DRAWS, for an RN bone that stands a COMPOSE
 * row.
 *
 * `SkeletonTextLine` measures the box by standing an invisible RN `Text` at
 * the variant — right whenever the real line is RN text, because it is the
 * same engine measuring the same thing. It is WRONG for a row drawn in
 * Compose, and by a lot on two rungs: RN's Android ladder (`ANDROID_VARIANTS`)
 * writes `bodyLarge` at 16/22 and `labelLarge` at 14/18, while Material 3's
 * own type scale — which is what `MaterialTheme.typography` hands a Compose
 * `Text` — draws them at 16/24 and 14/20. A comment bone built from the RN
 * ghost stood 65.78dp against a 72.89dp Compose row on a Galaxy A54
 * (2026-09-05), the whole 7.11 being those two rungs' 2 + 2, scaled.
 *
 * SCALED, because sp scales. Compose lays a line out at `lineHeight.sp`, so
 * at the A54's font scale of 1.15 a 24sp body line is 27.6dp on screen. An RN
 * `Text` scales its `lineHeight` the same way (that is why the ghost method
 * works at all), so this does the same by hand: the spec's number times the
 * font scale. It is the ONE place a Compose line height is written down on
 * the RN side; a bone standing a Compose row reads it here rather than
 * copying "24" beside a comment saying which control it came from.
 *
 * The numbers are the M3 type-scale tokens (m3.material.io → Styles → Type
 * scale), not a measurement of ours: `bodyLarge` 24, `bodyMedium` 20,
 * `bodySmall` 16, `labelLarge` 20, `labelMedium` 16, `titleMedium` 24,
 * `titleLarge` 28. Measured on the A54: a Compose row of labelLarge + 2 +
 * bodyLarge inside 10dp padding came to 72.89dp; 23.0 + 2 + 27.6 + 20 =
 * 72.6, the rest pixel rounding.
 */
const M3_LINE_HEIGHT: Record<TextVariant, number> = {
  displayLarge: 64,
  headlineLarge: 40,
  titleLarge: 28,
  titleMedium: 24,
  bodyLarge: 24,
  bodyMedium: 20,
  bodySmall: 16,
  labelLarge: 20,
  labelMedium: 16,
};

/** The box, in dp, that a Compose `Text` at this M3 role lays out on THIS
 *  device — the spec's sp line height times the font scale. */
export const composeLineHeight = (variant: TextVariant): number =>
  M3_LINE_HEIGHT[variant] * PixelRatio.getFontScale();
