import { Platform, type ViewStyle } from 'react-native';

import { type AppColors } from '@/styles/colors';

import { CONTINUOUS_CURVE, HAIRLINE } from './shape';

/**
 * How a surface is FILLED, per platform — the third part of the shape system
 * (`./shape` = radii and strokes, `./metrics` = spacing and sizes).
 *
 * This is where the two platforms diverge most, and where iOS was silently
 * inheriting Material. The rule, in one line each:
 *
 * - **Android separates surfaces by TONE.** A card is a lighter grey than the
 *   background; nothing is outlined. That is the M3 elevation model and it is
 *   what the frozen Android build ships.
 * - **iOS separates surfaces by EDGE.** A grouped cell is barely lighter than
 *   its background and is read from its hairline and its corner, not its
 *   value. Piling on tonal steps is exactly what makes an iOS screen look
 *   like a port.
 *
 * Each function returns a style object to spread. Passing the theme's colors
 * in (rather than calling `useAppTheme` here) keeps these usable from
 * `StyleSheet`-adjacent code and from `.ios.tsx` twins alike.
 *
 * The three fill KINDS are distinct — do not mix them (Topper learned this the
 * hard way; see its container-consistency notes):
 */

/**
 * 1. **Surface stack** — a non-interactive panel sitting on the background:
 * a card, a tile, a row group. iOS: the grouped-cell colour plus a hairline.
 * Android: one tonal step, no outline.
 */
export const cardSurface = (colors: AppColors): ViewStyle => ({
  backgroundColor: colors.card,
  ...CONTINUOUS_CURVE,
  ...(Platform.OS === 'ios'
    ? { borderColor: colors.border, borderWidth: HAIRLINE }
    : null),
});

/**
 * 2. **Control fill** — an interactive grey pill or field. It needs CONSTANT
 * contrast wherever it lands (on a card AND on a sheet AND on the
 * background), so it does NOT follow the surface ramp on either platform.
 */
export const controlFill = (colors: AppColors): ViewStyle => ({
  backgroundColor: colors.surfaceVariant,
  ...CONTINUOUS_CURVE,
});

/**
 * 3. **Selected control** — the same control in its active state. iOS has no
 * tonal-container semantics: a selected control is a SOLID accent fill
 * (the Messages tapback / `borderedProminent` read). Android keeps the M3
 * primary-container pair. Returns the matching content colour too, because
 * getting the fill right and the label wrong is the usual failure.
 */
export const selectedControl = (
  colors: AppColors,
): { container: ViewStyle; content: string } =>
  Platform.OS === 'ios'
    ? {
        container: { backgroundColor: colors.primary, ...CONTINUOUS_CURVE },
        content: colors.onPrimary,
      }
    : {
        container: { backgroundColor: colors.primaryContainer },
        content: colors.onPrimaryContainer,
      };

/**
 * A surface nested INSIDE a `cardSurface` — an artwork slot, an emoji box.
 * One ramp step only, and on iOS no second hairline: two concentric outlines
 * read as a mistake.
 */
export const nestedSurface = (colors: AppColors): ViewStyle => ({
  backgroundColor: colors.surfaceContainer,
  ...CONTINUOUS_CURVE,
});

/**
 * A hairline separator between rows of one grouped container. iOS draws it
 * inset from the leading content edge (the cell's text lines up across it);
 * Android's frozen build separates rows with gaps instead, so there the
 * caller simply does not use this.
 */
export const separator = (colors: AppColors, leadingInset = 0): ViewStyle => ({
  backgroundColor: colors.border,
  height: HAIRLINE,
  marginLeft: leadingInset,
});
