// The shape terms are shared by every portfolio app, so they live in
// `@portfolio/mobile-ui` (lifted 2026-08-27 — this file and Topper's twin had
// already drifted: this one grew CONTROL_RADIUS and HAIRLINE that Topper
// lacked, while the shared constants were byte-identical copies). Re-exported
// here to keep this app's `@/styles/shape` import path stable — the same shim
// pattern `styles/metrics` uses.
export {
  CARD_RADIUS,
  CONTINUOUS_CURVE,
  CONTROL_RADIUS,
  HAIRLINE,
  innerRadius,
  PILL_RADIUS,
  SHAPE_MD,
  SHAPE_SM,
  SHAPE_XS,
  TILE_RADIUS,
} from '@portfolio/mobile-ui';
