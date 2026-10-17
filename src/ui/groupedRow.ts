import { ROW_INSET } from '@/core';

/**
 * THE TWO-LINE NATIVE GROUPED ROW'S GEOMETRY — one measured spec, for every
 * `insetGrouped` row.
 *
 * This is an OS metric, not an app's taste: it is what a SwiftUI `List` puts
 * around 44pt artwork with a body line over a footnote. It lived in Topper's
 * `PersonListSkeletonIos` while only that app's people and trash rows needed
 * it, and moved here the moment a THIRD surface did — the trophy list, which
 * sits in `src/trophies` and could not reach into an app. A shared metric that
 * a module cannot import is a metric that gets re-invented, and it was:
 * the trophy row ran a 34pt slot against everyone else's 44, so its titles
 * started at 80.00 where a trash row's start at 89.00 (band-scanned, iPhone 17
 * / iOS 26.5) — two grouped lists one gesture apart in the same sheet stack,
 * with different text columns.
 *
 * Re-measure HERE if an iOS bump changes the grouped-list metrics; every row
 * and every bone follows.
 */

/**
 * WHAT A NATIVE `insetGrouped` ROW PUTS ABOVE AND BELOW ITS ARTWORK.
 *
 * MEASURED, not assumed: the row band-scanned at a 73pt pitch around 44pt
 * artwork, so the padding is (73 − 44) / 2. EXPORTED rather than folded into
 * the 73, because `TopItemListSkeletonIos` stands a row of the same kind around
 * 64pt artwork and would otherwise have to measure the identical thing a second
 * time — which is how two bones come to disagree about one OS metric.
 */
export const LIST_ROW_PADDING_VERTICAL = 14.5;

const ART = 44;
/** The List's row box: 44pt artwork with the shared padding above and below. */
const ROW_PITCH = ART + LIST_ROW_PADDING_VERTICAL * 2;
/**
 * Row insets: the card's own 16, then 12 to the text — so a separator starts at
 * 72 (measured x=88 against a card edge of 16), and a title's ink at 89. The
 * card's 16 is the shared `ROW_INSET`.
 */
const ART_GAP = 12;
const SEPARATOR_INSET = ROW_INSET + ART + ART_GAP;
/**
 * The two text bars, placed on the REAL ink rather than on a line-box
 * derivation. Measured from the row's own top edge:
 *
 *   name (body, with descender)   22.3 → 38.0
 *   @handle (footnote)            42.7 → 54.3
 *
 * Centring a 22 + 1 + 18 line-box block, which is how the rest of these apps'
 * skeletons are built, put the name bar 2.7 high — SwiftUI's `VStack` of a body
 * over a footnote does not sit where stacked RN line boxes do.
 */
const NAME_TOP = 22.5;
const NAME_BAR = 15;
const HANDLE_TOP = 42.67;
const HANDLE_BAR = 12;
/**
 * The row divider. ONE POINT, not a hairline — iOS 26 draws a grouped list's
 * separator at 1pt (the same correction `TopCard` records for its own divider),
 * and at a hairline four rows came up 2pt short of the real card by the bottom:
 * the real pitch is 73 + 1, not 73 + ⅓.
 */
const SEPARATOR_HEIGHT = 1;

export const GROUPED_ROW = {
  art: ART,
  artGap: ART_GAP,
  handleBar: HANDLE_BAR,
  handleTop: HANDLE_TOP,
  inset: ROW_INSET,
  nameBar: NAME_BAR,
  nameTop: NAME_TOP,
  pitch: ROW_PITCH,
  separatorHeight: SEPARATOR_HEIGHT,
  separatorInset: SEPARATOR_INSET,
} as const;

/**
 * One bone row's footprint, separator included. Exported (and listed in
 * `docs/standards.md`'s single-source table) although nothing reads it today:
 * it is the term any bone stack standing where grouped rows stand must step
 * by, so the next one imports it rather than re-adding `pitch + separator`.
 */
export const GROUPED_ROW_PITCH = ROW_PITCH + SEPARATOR_HEIGHT;
