import { Platform } from 'react-native';

import { FLOATING_EDGE_GAP } from '@portfolio/mobile-ui';

import { SCREEN_PADDING } from '@/styles/metrics';

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
 * Nothing here may import anything but styles. Anything that needs the banner's
 * box imports it from HERE, `PlayerSheet` included.
 */

/**
 * CONTENT height of the collapsed banner (consumers add the bottom inset).
 * Everything else about the banner is derived from this and the artwork, so
 * resizing it is a matter of these two numbers — they were scaled together
 * (64/44) to give the whole thing more presence.
 */
export const MINI_PLAYER_HEIGHT = 68;

/**
 * Gap from the banner to each screen edge. It is the SCREEN GUTTER, not a
 * number of its own: the banner floats over the library grid, and an edge that
 * nearly lines up with the tiles above it is worse than either lining up or
 * clearly not.
 */
export const BANNER_SIDE_INSET = SCREEN_PADDING;

/**
 * Clearance UNDER the banner, from the screen's bottom edge — the safe area
 * plus a gap. Apple floats an accessory bar just clear of the home indicator;
 * Material holds a floating surface a full grid step off the navigation bar.
 *
 * REJECTED: ANCHORING IT TO TOPPER'S TAB BAR. The two look like the same
 * problem — a detached surface hanging off the bottom, over content — and the
 * two apps do sit differently: band-scanned on iPhone 17 / iOS 26.5, Topper's
 * bar spans 791.00–852.67 and stops 21.33pt off the screen edge, while this
 * banner spans 759.33–827.67 and stops 46.33pt off it. Aligning their TOPS was
 * tried, and it works as arithmetic — the tops came within 1.33pt.
 *
 * It is the wrong reference all the same, and Juan called it on sight (2026-08-20):
 * a tab bar is TERMINAL chrome that never moves, so iOS can tuck it against the
 * edge and let the home indicator draw over it. This banner is the collapsed
 * state of a surface that EXPANDS TO FULL SCREEN, and a thing that is about to
 * grow needs to read as floating with somewhere to go, not as furniture pinned
 * to the bottom. At the tab bar's placement it sat low enough to look stuck.
 *
 * So the number stays what it was, and the lesson is that "these two are both
 * floating bottom chrome" is a resemblance rather than a shared rule.
 */
export const BANNER_BOTTOM_GAP_IOS = FLOATING_EDGE_GAP;
/**
 * ANDROID CLEARS ITS NAVIGATION BAR and must: the inset there is real chrome
 * the system draws opaquely, not an indicator that floats over content.
 */
const BANNER_BOTTOM_GAP_ANDROID = 16;

/**
 * Clearance under the banner, from the screen's bottom EDGE — a total, so
 * callers never add the inset to it a second time.
 */
export const bannerBottomOffset = (bottomInset: number) =>
  bottomInset +
  (Platform.OS === 'ios' ? BANNER_BOTTOM_GAP_IOS : BANNER_BOTTOM_GAP_ANDROID);
