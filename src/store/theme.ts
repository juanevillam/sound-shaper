// Theme preference (light / dark / system) is shared via `src/core` so
// `useAppTheme` can live there too. Re-exported here for a stable
// `@/store/theme` import path.
export { useThemeStore } from '@/core';
