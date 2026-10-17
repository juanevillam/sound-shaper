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
 * Android's values are the ones the apps already ship — this module
 * describes those builds, it does not change them. Every iOS value is the
 * Apple convention it corresponds to, cited in its comment.
 *
 * It was lifted into the shared kit because Sound Shaper and Topper each had
 * their own copy and they had already drifted: Topper was inseting content 16 where the
 * iOS convention (and its sibling) is 20, had no section-gap token at all, and
 * had settled on a 12pt tile gutter against the sibling's 14. Three constants
 * short, in a file whose whole purpose is to stop exactly that.
 */

/**
 * Gutter from the screen edge to content.
 *
 * 16 on BOTH platforms, and not a platform split. It was iOS 20 on the
 * unmeasured claim that "iOS insets grouped content further (Settings, Music,
 * Files all sit at 20)". Measured on iPhone 17 / iOS 26.5 and it is 16, three
 * ways: a real full-width SwiftUI `Form`'s grouped card sits 16.0 from the
 * screen edge, the system large title's text box sits at ~16, and
 * expo-ui-starter's band-scan of a real `List` recorded "card inset from screen
 * edge 16.00pt (both sides, both modes)".
 *
 * At 20 everything we drew sat 4pt inboard of UIKit's own margin, so on every
 * screen with a large title the section header was visibly right of the app
 * title above it.
 *
 * Material's grid margin is 16 as well, which is why this is a plain constant:
 * this module is for values that GENUINELY differ per platform, and a
 * Platform.select here would imply a difference that is not there.
 */
export const SCREEN_PADDING = 16;

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

/**
 * Nudge for TEXT that sits directly beside or beneath a heavily rounded shape.
 *
 * A corner curves the shape's edge inward exactly where a caption sits — under
 * a tile, or between two cards — so text set flush to the shape's true edge
 * reads as hanging past it even though the two are mathematically aligned. This
 * is the optical correction, applied to the TEXT only; the shapes keep the real
 * margin, so nothing structural moves.
 *
 * DERIVED FROM THE RADIUS IT IS COMPENSATING FOR, not a flat number. The two
 * cases in these apps are not the same size of problem: a rail caption sits
 * under 19pt corners, while a row between two cards sits level with 26pt ones,
 * at the extreme where a rounded rect's leftmost point is a full `r` inboard.
 * A single value under-nudged the second and over-nudged the first.
 *
 * 0.215 is the mean horizontal inset across a quarter-circle corner
 * (1 - pi/4), which is the honest average of how far the edge has actually
 * pulled away over the corner's run. It gives 4 at r=19 and 6 at r=26.
 */
export const opticalTextInset = (cornerRadius: number): number =>
  Math.round(cornerRadius * 0.215);
