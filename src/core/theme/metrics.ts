import { Platform } from 'react-native';

/**
 * Platform-aware spacing and sizing — the second half of the design tokens
 * (`./colors` owns fills and inks).
 *
 * Only values that GENUINELY differ between the platforms live here. A number
 * that is the same on both is a plain constant in the component that uses it;
 * putting it here would imply a difference that isn't there and invite someone
 * to invent one. `ROW_INSET` is the deliberate exception, and says so.
 *
 * Android's values are the ones the frozen apps already ship — this module
 * describes those builds, it does not change them. Every iOS value is the
 * Apple convention it corresponds to, cited in its comment.
 *
 * It lives in the package because Sound Shaper and Topper each had their own
 * copy and they had already drifted: Topper was inseting content 16 where the
 * iOS convention (and its sibling) is 20, had no section-gap token at all, and
 * had settled on a 12pt tile gutter against the sibling's 14. Three constants
 * short, in a file whose whole purpose is to stop exactly that. Apps keep a
 * thin re-export at `src/styles/metrics.ts` so their import paths do not move.
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
 * Gap between two adjacent artwork tiles — beside each other in a row, or
 * stacked as grid rows. iOS album grids (Music, Photos) run a tighter gutter
 * than the M3 grid because the covers themselves carry the rhythm.
 *
 * Named for the tiles rather than the grid: Sound Shaper's songs are a grid and
 * Topper's tops are a one-row rail, but the relationship being spaced is the
 * same one either way.
 */
export const TILE_GAP = Platform.select({ ios: 14, default: 16 }) as number;

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
