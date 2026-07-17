// Color roles, the Material → roles mapper, the off-Android baseline, and the
// alpha helper all live in @portfolio/core so every app shares one palette.
// Re-exported here to keep the app's `@/styles/colors` import path stable.
export {
  type AppColors,
  FALLBACK_COLORS,
  IOS_COLORS,
  materialToAppColors,
  withAlpha,
} from '@portfolio/core';
