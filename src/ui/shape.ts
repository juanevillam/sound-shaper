import { Platform, StyleSheet, type ViewStyle } from 'react-native';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE PORTFOLIO'S SHAPE TERMS — one file, every app.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Topper and Sound Shaper each carried a `styles/shape.ts` of their own, and
 * the two had drifted exactly the way the standardisation rule predicts:
 * Sound Shaper grew `CONTROL_RADIUS` and `HAIRLINE` that Topper lacked, while
 * the shared constants were byte-identical copies waiting to disagree.
 * Topper's own file said "worth lifting the whole thing into a package rather
 * than porting a constant at a time" — this is that lift (2026-08-27). Each
 * app keeps a thin `styles/shape.ts` re-export so its import paths hold, the
 * same shim pattern `styles/metrics` uses.
 *
 * `FLOATING_RADIUS` is NOT here and must not migrate back: a floating
 * surface's corner lives with its material (`GlassSurfaceIos`), where the
 * whole floating family's terms are.
 */

// Container corner radii for the apps' CUSTOM cards / rows / tiles, matched
// to each platform's NATIVE list container so custom surfaces read in tone
// with native ones (a Settings Form section beside a TopCard must feel like
// one family): Android = the M3 card values the apps shipped with;
// iOS = the iOS 26 inset-grouped-list radius.
const IOS_GROUP_RADIUS = 26;

/** Standard card/row container (M3 12 / iOS grouped 26). */
export const CARD_RADIUS = Platform.select({
  ios: IOS_GROUP_RADIUS,
  default: 12,
}) as number;

/** Larger tile container (M3 16 / iOS grouped 26). */
export const TILE_RADIUS = Platform.select({
  ios: IOS_GROUP_RADIUS,
  default: 16,
}) as number;

/**
 * The corner CURVE, not its size. Apple's corners are continuous ("squircle")
 * — the curvature eases in rather than meeting the edge at a hard tangent —
 * while Material's are circular arcs. At the radii above the difference is
 * plainly visible, and it is one of the cheapest, most reliable ways to stop
 * an iOS build from reading as a Material app. Spread onto any rounded
 * surface; on Android it resolves to RN's default and changes nothing.
 */
export const CONTINUOUS_CURVE: { borderCurve: ViewStyle['borderCurve'] } = {
  borderCurve: Platform.OS === 'ios' ? 'continuous' : 'circular',
};

// M3 shape-scale steps — the Android radius of a surface nested inside a
// CARD_RADIUS / TILE_RADIUS container (M3 has no concentric-corner rule; it
// keys nested radii to this fixed scale instead).
export const SHAPE_SM = 8;
export const SHAPE_MD = 12;

/**
 * CONTAINERS DO NOT SCALE THEIR RADIUS WITH SIZE, and that is correct: Apple's
 * grouped-list radius is 26 whether the section is 180pt or 370pt wide, so a
 * card and a wider card are the same shape family. Only ARTWORK scales — a
 * picture is cut to a ratio of its own size (`artworkRadius`, its own file in
 * this package, where the ratio's origin and the three-way drift it unified
 * are recorded).
 *
 * The failure mode to watch is a container much SHORTER than 2 × radius, which
 * stops being a rounded rectangle and reads as a lozenge. A `min(radius,
 * shortSide / 2)` clamp was written for this and then REMOVED, measured: no
 * surface in either app violates it today (the tightest is a ~24pt pill at
 * radius 10), and it would not have caught the one real case — Sound Shaper's
 * floating banner dropped 26 → FLOATING_RADIUS 22 at 64pt tall, which is 41%
 * of the height, well inside a geometric clamp. That was a judgement about
 * proportion, not a violation, and a helper that cannot make it is dead API.
 * If a new surface is short, judge it by eye against FLOATING_RADIUS's
 * precedent and give it a named token — do not reach for a formula.
 */

/**
 * Radius of a rounded child nested inside a rounded container. iOS follows the
 * concentric-corner rule (inner = outer − inset between the surfaces, so both
 * curves share a center); Android keys to the M3 shape-scale step instead
 * (`androidStep`, also the iOS floor so a deep inset can't push the child
 * sharper than its platform scale).
 */
export const innerRadius = (
  outerRadius: number,
  inset: number,
  androidStep: number,
): number =>
  Platform.OS === 'ios'
    ? Math.max(outerRadius - inset, androidStep)
    : androidStep;

/**
 * Stroke width for a separator or an outlined surface. iOS draws true hairlines
 * (0.33pt at @3×); Material's outline is a full 1dp.
 *
 * NOT the iOS 26 grouped-list separator, which is a full 1pt — `TopCard`,
 * `GROUPED_ROW` and the bones all record that measurement. This is the stroke
 * for an OUTLINE a surface draws itself.
 */
export const HAIRLINE = Platform.select({
  ios: StyleSheet.hairlineWidth,
  default: 1,
}) as number;
