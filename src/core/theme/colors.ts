import type { MaterialColors } from '@expo/ui/jetpack-compose';

export type AppColors = {
  background: string;
  surface: string;
  surfaceContainer: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primaryMuted: string;
  danger: string;
  // M3 container / on-container pairs — the decorative palette used by
  // showcase demos (colored boxes, carousel pages, list rows).
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  errorContainer: string;
  onErrorContainer: string;
  infoContainer: string;
  onInfoContainer: string;
};

/**
 * Maps the live Material 3 palette read from the native Host (`getMaterialColors`)
 * onto the app's semantic color roles. This is the single source of truth for
 * every color in the app — the RN side and the Compose side render from the same
 * palette, so there are no custom/hardcoded colors. On Android 12+ the palette is
 * wallpaper-derived (Material You); otherwise it is the static Material 3 baseline.
 */
export function materialToAppColors(m: MaterialColors): AppColors {
  return {
    background: m.background,
    surface: m.surface,
    surfaceContainer: m.surfaceContainer,
    surfaceVariant: m.surfaceVariant,
    onSurface: m.onSurface,
    onSurfaceMuted: m.onSurfaceVariant,
    border: m.outlineVariant,
    primary: m.primary,
    onPrimary: m.onPrimary,
    primaryMuted: m.primaryContainer,
    danger: m.error,
    primaryContainer: m.primaryContainer,
    onPrimaryContainer: m.onPrimaryContainer,
    secondaryContainer: m.secondaryContainer,
    onSecondaryContainer: m.onSecondaryContainer,
    tertiaryContainer: m.tertiaryContainer,
    onTertiaryContainer: m.onTertiaryContainer,
    errorContainer: m.errorContainer,
    onErrorContainer: m.onErrorContainer,
    // M3 has no dedicated "info" role; use the highest surface container as a
    // neutral fifth decorative swatch.
    infoContainer: m.surfaceContainerHighest,
    onInfoContainer: m.onSurface,
  };
}

/**
 * Returns `color` with the given opacity (0–1) as an `#RRGGBBAA` string.
 * Accepts `#RRGGBB` or `#RRGGBBAA` input (any existing alpha is replaced), so it
 * works with both the native Material palette (8-digit) and the fallback tokens.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const rgb = hex.slice(0, 6);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${a}`.toUpperCase();
}

/**
 * Canonical Material 3 baseline palette, used only as a fallback when the native
 * Material palette is unavailable (Android without `getMaterialColors`, web, and
 * any other platform without its own palette — iOS has `IOS_COLORS`). These are
 * Google's default Material 3 tokens — not custom colors — so the app looks
 * consistent everywhere it runs.
 */
/**
 * iOS palette built from Apple's UIKit semantic and system colors (HIG), so the
 * app reads native on iOS instead of inheriting Google's Material baseline.
 * Surfaces map to the grouped-background ramp, text to label/secondaryLabel,
 * primary to systemBlue, danger to systemRed. The decorative container pairs
 * (a role iOS doesn't define) are static tints of system colors — blue, gray,
 * pink, red, teal — with darkened/lightened companions for readable text.
 */
export const IOS_COLORS: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceContainer: '#E5E5EA',
    surfaceVariant: '#D1D1D6',
    onSurface: '#000000',
    onSurfaceMuted: '#3C3C4399',
    border: '#C6C6C8',
    primary: '#007AFF',
    onPrimary: '#FFFFFF',
    primaryMuted: '#CCE4FF',
    danger: '#FF3B30',
    primaryContainer: '#CCE4FF',
    onPrimaryContainer: '#00428C',
    secondaryContainer: '#E5E5EA',
    onSecondaryContainer: '#3C3C43',
    tertiaryContainer: '#FFD6DD',
    onTertiaryContainer: '#8A0E28',
    errorContainer: '#FFD8D6',
    onErrorContainer: '#99231C',
    infoContainer: '#D6F1F7',
    onInfoContainer: '#0F535F',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    surfaceContainer: '#2C2C2E',
    surfaceVariant: '#3A3A3C',
    onSurface: '#FFFFFF',
    onSurfaceMuted: '#EBEBF599',
    border: '#38383A',
    primary: '#0A84FF',
    onPrimary: '#FFFFFF',
    primaryMuted: '#0D3A66',
    danger: '#FF453A',
    primaryContainer: '#0D3A66',
    onPrimaryContainer: '#A8CFFF',
    secondaryContainer: '#2C2C2E',
    onSecondaryContainer: '#EBEBF5',
    tertiaryContainer: '#451423',
    onTertiaryContainer: '#FF9FB5',
    errorContainer: '#491511',
    onErrorContainer: '#FFB4AD',
    infoContainer: '#0E3A42',
    onInfoContainer: '#9BE5F2',
  },
};

export const FALLBACK_COLORS: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#FEF7FF',
    surface: '#FEF7FF',
    surfaceContainer: '#F3EDF7',
    surfaceVariant: '#E7E0EC',
    onSurface: '#1D1B20',
    onSurfaceMuted: '#49454F',
    border: '#CAC4D0',
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryMuted: '#EADDFF',
    danger: '#B3261E',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',
    infoContainer: '#E6E0E9',
    onInfoContainer: '#1D1B20',
  },
  dark: {
    background: '#141218',
    surface: '#141218',
    surfaceContainer: '#211F26',
    surfaceVariant: '#49454F',
    onSurface: '#E6E0E9',
    onSurfaceMuted: '#CAC4D0',
    border: '#49454F',
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryMuted: '#4F378B',
    danger: '#F2B8B5',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',
    infoContainer: '#36343B',
    onInfoContainer: '#E6E0E9',
  },
};
