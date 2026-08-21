/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE NOW-PLAYING BANNER'S BOX — the portfolio's, not one app's.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Only Sound Shaper draws this banner, so these look like they belong to that
 * app, and they lived there. They do not: `SNACKBAR_BOTTOM_CLEARANCE` is where
 * the toast stands in EVERY app, and it is derived from this box — the tallest
 * bottom chrome in the portfolio clearing itself. Topper's toast is positioned
 * by Sound Shaper's banner, and that is deliberate (a toast in a different spot
 * per app is a difference nobody using one app can see).
 *
 * A package cannot import an app, so the box was restated inside
 * `SnackbarProvider` as `8 + 68` with a comment saying that if either number
 * ever moved, nothing would tell you. Three things now depend on it — the
 * banner, the expanded console's glass footer, and the toast — and one of them
 * lives here, so the term moves here and the app re-exports it. That is what
 * `SHEET_CONTENT_TOP` and `GROUPED_ROW` both did the day a third surface needed
 * them.
 *
 * A LEAF: nothing here may import anything. Sound Shaper's `bannerMetrics`
 * carries a hard-won rule about staying importable from anywhere (a require
 * cycle through the dev lab once left its constants `undefined` and rendered a
 * bar at `bottom: NaN`), and it re-exports these — so they inherit the rule.
 */

/**
 * CONTENT height of the collapsed banner (consumers add the bottom inset).
 * Everything else about the banner is derived from this and its artwork, so
 * resizing it is a matter of two numbers — they were scaled together (64/44)
 * to give the whole thing more presence.
 *
 * It is ALSO the expanded console's glass footer height, which is not a
 * coincidence but the point: the two are the same object in the same place,
 * and expanding reads as the bar staying put while its contents change.
 */
export const MINI_PLAYER_HEIGHT = 68;

/**
 * Clearance UNDER the banner on iOS, on top of the bottom safe-area inset.
 * Apple floats an accessory bar just clear of the home indicator; Material
 * holds a floating surface a full grid step off the navigation bar.
 *
 * REJECTED: ANCHORING IT TO TOPPER'S TAB BAR. The two look like the same
 * problem — a detached surface hanging off the bottom, over content — and the
 * two apps do sit differently: band-scanned on iPhone 17 / iOS 26.5, Topper's
 * bar spans 791.00–852.67 and stops 21.33pt off the screen edge, while this
 * banner spans 759.33–827.67 and stops 46.33pt off it. Aligning their TOPS was
 * tried, and it works as arithmetic — the tops came within 1.33pt.
 *
 * It is the wrong reference all the same, and Juan called it on sight
 * (2026-08-20): a tab bar is TERMINAL chrome that never moves, so iOS can tuck
 * it against the edge and let the home indicator draw over it. This banner is
 * the collapsed state of a surface that EXPANDS TO FULL SCREEN, and a thing
 * that is about to grow needs to read as floating with somewhere to go, not as
 * furniture pinned to the bottom. At the tab bar's placement it sat low enough
 * to look stuck.
 *
 * So the number stays what it was, and the lesson is that "these two are both
 * floating bottom chrome" is a resemblance rather than a shared rule.
 *
 * ITS OWN NUMBER, NOT `FLOATING_EDGE_GAP`. It was briefly the shared gap, on
 * the argument that the trophy banner hangs off the TOP safe area by the same
 * amount and the two are one object at opposite ends of the screen. That is
 * shakier than it sounds: the top safe area is a 62pt notch and status bar, the
 * bottom one is a 34pt home indicator, and Apple does not mirror them.
 *
 * BEWARE THE OBVIOUS COMPARISON, which is wrong and was nearly acted on.
 * Topper's tab bar sits 23.04pt off the screen edge and Apple's Photos viewer
 * toolbar about 29 — both LESS than the 34pt bottom inset, because both draw
 * INSIDE the safe area and let the home indicator pass over them. Terminal
 * chrome may do that; this banner may not, being the collapsed state of a
 * surface that expands to full screen. Its floor is therefore the inset itself
 * and the only thing to choose is the gap on top of it — measuring it against
 * surfaces that ignore the inset compares two different quantities.
 *
 * Rendered at 12 / 8 / 4 (total air below: 46.17 / 42.16 / 38.16). 8 tightens
 * the band without the banner reading as pinned, and it leaves the DESIGNED
 * gaps in a sensible order — 12 above it to the toast, 8 below it to the
 * indicator — where the shared 12 had them equal and the stack bottom-loose.
 */
export const NOW_PLAYING_BOTTOM_GAP_IOS = 8;

/**
 * The banner's full footprint above the bottom safe-area edge — its own gap
 * plus its height. What anything standing OVER it has to clear.
 */
export const NOW_PLAYING_BANNER_BOX =
  NOW_PLAYING_BOTTOM_GAP_IOS + MINI_PLAYER_HEIGHT;
