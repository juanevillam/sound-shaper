// Theme resolution (scheme → live Material 3 palette) lives in `src/core`
// so every app themes identically. Re-exported here to keep the app's
// `@/hooks/useAppTheme` import path stable across call sites.
export { useAppTheme, type AppColors, type ResolvedScheme } from '@/core';
