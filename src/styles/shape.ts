import { Platform, StyleSheet, type ViewStyle } from 'react-native';

// Container corner radii for the app's CUSTOM cards / rows / tiles, matched
// to each platform's NATIVE list container so custom surfaces read in tone
// with native ones — same system as Topper's shape.ts.
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
 * A small interactive control that is NOT a capsule — a filled field, a
 * compact tile. iOS keeps the continuous 12pt control corner; Android uses
 * the M3 small step.
 */
export const CONTROL_RADIUS = Platform.select({
  ios: 12,
  default: 8,
}) as number;

/**
 * A container that FLOATS over content rather than sitting in the layout —
 * the detached now-playing banner. Deliberately TIGHTER than the grouped-list
 * radius: at the banner's height, 26 on iOS reads as a capsule, and a capsule
 * reads as a widget from somewhere else. Apple's floating accessory views take
 * a continuous corner in the low twenties (22 is the iPhone widget corner);
 * Material's floating surfaces take the large shape step.
 *
 * The two do NOT scale together if the container's size changes: iOS corners
 * are a continuous quantity and can follow it, while Material's shape scale is
 * DISCRETE (4/8/12/16/28) — stepping Android off 16 would leave the system for
 * the sake of a proportion.
 */
export const FLOATING_RADIUS = Platform.select({
  ios: 22,
  default: 16,
}) as number;

/** Fully-rounded capsule (pill buttons, chips-as-buttons). */
export const PILL_RADIUS = 999;

// M3 shape-scale steps — the Android radius of a surface nested inside a
// CARD_RADIUS / TILE_RADIUS container.
export const SHAPE_XS = 4;
export const SHAPE_SM = 8;
export const SHAPE_MD = 12;

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

/**
 * Radius of a rounded child nested inside a rounded container. iOS follows the
 * concentric-corner rule (inner = outer − inset); Android keys to the M3
 * shape-scale step instead (`androidStep`, also the iOS floor).
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
 */
export const HAIRLINE = Platform.select({
  ios: StyleSheet.hairlineWidth,
  default: 1,
}) as number;
