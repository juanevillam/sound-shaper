import { Platform } from 'react-native';

/**
 * Platform-aware spacing and sizing — the second half of the shape system
 * (`./shape` owns radii and strokes, `./surfaces` owns fills).
 *
 * Only values that GENUINELY differ between the platforms live here. A number
 * that is the same on both is a plain constant in the component that uses it;
 * putting it here would imply a difference that isn't there and invite someone
 * to invent one.
 *
 * Android's values are the ones the frozen app already ships — this module
 * describes that build, it does not change it. Every iOS value is the Apple
 * convention it corresponds to, cited in its comment.
 */

/**
 * Gutter from the screen edge to content. Material's grid margin is 16dp; iOS
 * insets grouped content further (Settings, Music, Files all sit at 20).
 */
export const SCREEN_PADDING = Platform.select({
  ios: 20,
  default: 16,
}) as number;

/**
 * Gap between two tiles in a row, and between rows. iOS album grids (Music,
 * Photos) run a tighter gutter than the M3 grid because the covers themselves
 * carry the rhythm.
 */
export const GRID_GAP = Platform.select({ ios: 14, default: 16 }) as number;

/**
 * Vertical gap between two sections of a screen. Material stacks sections on
 * the 8dp grid; iOS grouped lists leave a deeper trough between groups.
 */
export const SECTION_GAP = Platform.select({ ios: 28, default: 24 }) as number;

/**
 * Minimum height of a tappable row. The platform touch-target minimums differ
 * by design: Apple specifies 44pt, Material 48dp.
 */
export const ROW_MIN_HEIGHT = Platform.select({
  ios: 44,
  default: 48,
}) as number;

/**
 * Inset a row's own content sits at INSIDE its container. iOS list cells run
 * 16pt from the container edge; M3 list items 16dp — the same, so this exists
 * only as the named anchor the two share.
 */
export const ROW_INSET = 16;
