import { Platform } from 'react-native';

import { SCREEN_PADDING } from '@/styles/metrics';
import { NOW_PLAYING_BOTTOM_GAP_IOS } from '@/ui';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE COLLAPSED BANNER'S BOX — a LEAF module, and it has to stay one.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These four terms were declared inside `PlayerSheet` and imported from there,
 * which works for a screen and breaks for anything under the player. The player
 * pulls in its own sheets, those reach `SheetScreenIos`, and that imports the
 * dev lab — so a lab module importing `PlayerSheet` back closed a require cycle
 * and got a PARTIALLY INITIALISED module: the constants read `undefined` and a
 * dev bar positioned at `bottom: NaN` rendered at the top of the screen.
 *
 * Nothing here may import anything that could reach back into the player.
 * Styles and `src/ui` are safe — a package never imports an app,
 * so neither can close the cycle. Anything that needs the banner's box imports
 * it from HERE, `PlayerSheet` included.
 */

/**
 * The banner's HEIGHT and its iOS bottom gap are the PORTFOLIO'S, not this
 * app's — `SNACKBAR_BOTTOM_CLEARANCE` in `src/ui` is derived from
 * them, so the toast in EVERY app is positioned by this banner. The package
 * restated them as `8 + 68` while they lived here, with a comment admitting a
 * drift would go unnoticed; they moved the day a third surface (the expanded
 * console's glass footer) needed them too.
 *
 * Re-exported under the names this app already uses, so its import paths do not
 * churn — the shim pattern `SHEET_CONTENT_TOP` and `GROUPED_ROW` both took.
 */
export {
  MINI_PLAYER_HEIGHT,
  NOW_PLAYING_BOTTOM_GAP_IOS as BANNER_BOTTOM_GAP_IOS,
} from '@/ui';

/**
 * Gap from the banner to each screen edge. It is the SCREEN GUTTER, not a
 * number of its own: the banner floats over the library grid, and an edge that
 * nearly lines up with the tiles above it is worse than either lining up or
 * clearly not.
 */
export const BANNER_SIDE_INSET = SCREEN_PADDING;

/**
 * ANDROID CLEARS ITS NAVIGATION BAR and must: the inset there is real chrome
 * the system draws opaquely, not an indicator that floats over content.
 */
const BANNER_BOTTOM_GAP_ANDROID = 16;

/**
 * The banner's own gap to the screen's bottom edge, WITHOUT the safe-area
 * inset — i.e. how far it floats above whatever chrome is down there.
 *
 * Exported because two callers want the gap on its own rather than the total:
 * anything that positions itself against the inset ALREADY (the dev state
 * lab's picker adds `insets.bottom` itself) would double-count it otherwise.
 * That is not hypothetical — `HOME_LAB_BOTTOM_OFFSET` was built from the iOS
 * gap outright, so the picker stood 8dp low on Android.
 */
export const BANNER_BOTTOM_GAP =
  Platform.OS === 'ios'
    ? NOW_PLAYING_BOTTOM_GAP_IOS
    : BANNER_BOTTOM_GAP_ANDROID;

/**
 * Clearance under the banner, from the screen's bottom EDGE — a total, so
 * callers never add the inset to it a second time.
 */
export const bannerBottomOffset = (bottomInset: number) =>
  bottomInset + BANNER_BOTTOM_GAP;
