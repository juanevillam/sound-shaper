import { Platform } from 'react-native';

import { SCREEN_PADDING } from '@/core';
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
 * `src/ui` is safe — nothing in it imports the player, so it cannot close the
 * cycle. Anything that needs the banner's box imports
 * it from HERE, `PlayerSheet` included.
 */

/**
 * The banner's HEIGHT and its iOS bottom gap live in `src/ui`'s
 * `nowPlayingBanner`, because `SNACKBAR_BOTTOM_CLEARANCE` is derived from
 * them and the toast is positioned by this banner. The snackbar restated them
 * as `8 + 68` while they lived here, with a comment admitting a drift would go
 * unnoticed; they moved the day a third surface (the expanded console's glass
 * footer) needed them too.
 *
 * Re-exported here under the player's names (`BANNER_BOTTOM_GAP_IOS`).
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

/**
 * THE LIFT — Android's alone. iOS's was measured out of existence.
 *
 * A detached surface needs to read as floating rather than as a sticker painted
 * on the screen, and Android raises it through the elevation system. iOS had an
 * RN drop shadow beside it (0.3 opacity, 14 radius, +6) written when the banner
 * was an OPAQUE card. It is Liquid Glass now, and the material supplies its own
 * separation — so the shadow was stacked on top of something already doing the
 * job.
 *
 * Band-scanned against the portfolio's other floating glass surface, Topper's
 * UIKit tab bar, sampling the page just outside each edge (iPhone 17 / iOS 26.5,
 * light; darkening in luminance steps from a CLEAN page reference):
 *
 *              2pt out   8pt out   16pt out
 *   UIKit         +8        +5        +3
 *   ours @0.3    +40       +26       +12
 *   ours @0.09   +21       +13        +7
 *   ours @0.035  +15        +9        +5
 *   ours OFF     +15        +9        +5   ← identical
 *
 * The last two rows are the finding: by the time the shadow is faint enough to
 * approach UIKit it contributes NOTHING, because the glass alone already
 * darkens the gutter by +15 — roughly twice what UIKit's whole treatment does.
 * Any RN shadow on top can only overshoot. iOS therefore draws none and lets
 * the material be the lift, which is the iOS 26 idiom besides.
 *
 * Take the reference FAR from the banner: it sits 16pt from the screen edge and
 * its own halo reaches the gutter, so a "page" sample beside it is already
 * darkened and flatters whatever is being tested.
 *
 * Exported because the expanded console's footer IS this banner's box, and it
 * takes the same lift.
 */
export const BANNER_ELEVATION = 8;
