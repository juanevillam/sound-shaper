import type { AppColors } from './colors';

/**
 * Per-app theme identity. Apps with their own brand (Topper) configure this
 * once at startup; apps that skip it (expo-starter) keep the platform default
 * palette — wallpaper-derived Material You on Android, Apple system colors on
 * iOS, the Material 3 baseline elsewhere.
 */
export type AppThemeConfig = {
  /**
   * Brand seed color. On Android the native side generates the full Material 3
   * palette from it via `SchemeTonalSpot` (the Material You algorithm), so the
   * RN side, every `<Host>` that forwards it, and all Compose components theme
   * from the same brand palette on every API level. No effect on other
   * platforms — provide `palettes` for those.
   */
  seedColor?: string;
  /**
   * Static brand palettes for platforms without the seeded Material engine
   * (iOS today, and the web/fallback path). Generate them from `seedColor`
   * with `SchemeTonalSpot` so they match what Android renders at runtime.
   */
  palettes?: Record<'light' | 'dark', AppColors>;
};

let config: AppThemeConfig = {};

/**
 * Registers the app's theme identity. Call once at module scope of the app's
 * root layout, before the first render — `useAppTheme` reads the config but
 * does not subscribe to changes.
 */
export function configureAppTheme(next: AppThemeConfig): void {
  config = next;
}

export function getAppThemeConfig(): AppThemeConfig {
  return config;
}
