// The spacing tokens are shared by every portfolio app, so they live in
// `@portfolio/core`. Re-exported here to keep this app's import path stable
// across its call sites — the same shim pattern the other shared primitives
// use.
export {
  OPTICAL_TEXT_INSET,
  ROW_INSET,
  ROW_MIN_HEIGHT,
  SCREEN_PADDING,
  SECTION_GAP,
  TILE_GAP,
} from '@portfolio/core';
