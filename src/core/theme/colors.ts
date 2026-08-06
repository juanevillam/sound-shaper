import type { MaterialColors } from '@expo/ui/jetpack-compose';

export type AppColors = {
  background: string;
  surface: string;
  // Content cards / list rows sitting on `background`. On Android this is the
  // same value as `surfaceContainer` (the M3 filled-card token); on iOS it is
  // the grouped-list cell color (white / #1C1C1E), one step subtler than the
  // control fill — Apple's cell-on-grouped-background ramp.
  card: string;
  // Background of a modal sheet. iOS never presents sheets on the base
  // background: dark mode uses the ELEVATED background (#1C1C1E), light mode
  // the grouped gray. Android's editors are Compose ModalBottomSheets that
  // theme themselves, so there this simply mirrors surfaceContainer.
  sheet: string;
  // Filled input/cell sitting ON a sheet. iOS: white cells on the light
  // grouped sheet, one ramp step up (#2C2C2E) on the dark elevated sheet.
  sheetField: string;
  surfaceContainer: string;
  surfaceVariant: string;
  /**
   * Fill for a SHAPE rather than a content area — a placeholder tile, an empty
   * media slot. Apple splits these deliberately: background colors (systemGray5
   * and friends) are for large content areas, FILL colors for elements filled
   * with color, and this is iOS's `systemFill`.
   *
   * It is TRANSLUCENT on purpose, which is the whole point. The opaque greys
   * pair unevenly because the two ramps start in different places: systemGray5
   * on light sits one step from the systemGray6 page and reads faint (measured
   * separation 13.0), while on dark it sits against pure black and reads strong
   * (44.1) — a 3.4x imbalance from one token. A translucent fill with a
   * different alpha per appearance lands evenly on both.
   *
   * TERTIARY, not `systemFill` itself. The fills are a ramp, and the level is a
   * judgement about what the shape has to compete with. Everywhere this is used
   * so far the shape is a PLACEHOLDER sitting beside real artwork — cover art
   * runs 200+ separation from the page — so the fill has to stay clearly
   * secondary or the empty slot starts drawing more attention than the content
   * it sits next to. `systemFill` (0.20/0.36) measured 24.4/43.4 and read as a
   * competing block; tertiary (0.12/0.24) measures 14.6/28.9 and recedes.
   */
  fill: string;
  // Elevation ink — the color shadows are cast in. Black in BOTH modes on
  // every platform (M3's shadow/scrim token, and Apple's shadows are black
  // too); a light-mode/dark-mode split here would be wrong. Callers apply
  // opacity with `withAlpha()` (SwiftUI's own default shadow is 33% black).
  // NOTE: @expo/ui's SwiftUI `shadow` modifier defaults its color to WHITE
  // when none is passed — always pass this role explicitly.
  shadow: string;
  onSurface: string;
  onSurfaceMuted: string;
  border: string;
  // Row separator inside an iOS grouped list/card. NOT the same ink as
  // `border`: SwiftUI's List draws its separators lighter than UIKit's
  // classic separator color — measured from a real `List` on iOS 26.5
  // (#E8E8E8 on white cells, #38383B on #1C1C1E). Android has no such
  // distinction, so there it simply mirrors `border`.
  listSeparator: string;
  primary: string;
  onPrimary: string;
  primaryMuted: string;
  // Full M3 accent roles beyond primary — distinct, harmonious hues the dynamic
  // palette derives from the same source color. Surfaced so showcase demos can
  // prove components accept any themed accent (not just primary), while staying
  // 100% OS-derived (no hardcoded colors).
  secondary: string;
  onSecondary: string;
  tertiary: string;
  onTertiary: string;
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
    card: m.surfaceContainer,
    sheet: m.surfaceContainer,
    sheetField: m.surfaceContainer,
    surfaceContainer: m.surfaceContainer,
    surfaceVariant: m.surfaceVariant,
    // M3 has no translucent fill role; the tonal step is the honest analogue.
    // Only iOS surfaces use `fill` today, so this is a sane value rather than a
    // considered Material decision.
    fill: m.surfaceVariant,
    // MaterialColors exposes no `shadow` field; M3's scrim shares the same
    // ink (black) so it stands in for the shadow token.
    shadow: m.scrim,
    onSurface: m.onSurface,
    onSurfaceMuted: m.onSurfaceVariant,
    border: m.outlineVariant,
    listSeparator: m.outlineVariant,
    primary: m.primary,
    onPrimary: m.onPrimary,
    primaryMuted: m.primaryContainer,
    secondary: m.secondary,
    onSecondary: m.onSecondary,
    tertiary: m.tertiary,
    onTertiary: m.onTertiary,
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
    card: '#FFFFFF',
    sheet: '#F2F2F7',
    sheetField: '#FFFFFF',
    surfaceContainer: '#E5E5EA',
    surfaceVariant: '#D1D1D6',
    fill: 'rgba(120, 120, 128, 0.12)', // tertiarySystemFill, light
    shadow: '#000000',
    onSurface: '#000000',
    onSurfaceMuted: '#3C3C4399',
    border: '#C6C6C8',
    listSeparator: '#E8E8E8',
    primary: '#007AFF',
    onPrimary: '#FFFFFF',
    primaryMuted: '#CCE4FF',
    secondary: '#5856D6',
    onSecondary: '#FFFFFF',
    tertiary: '#AF52DE',
    onTertiary: '#FFFFFF',
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
    card: '#1C1C1E',
    sheet: '#1C1C1E',
    sheetField: '#2C2C2E',
    surfaceContainer: '#2C2C2E',
    surfaceVariant: '#3A3A3C',
    fill: 'rgba(120, 120, 128, 0.24)', // tertiarySystemFill, dark
    shadow: '#000000',
    onSurface: '#FFFFFF',
    onSurfaceMuted: '#EBEBF599',
    border: '#38383A',
    listSeparator: '#38383B',
    primary: '#0A84FF',
    onPrimary: '#FFFFFF',
    primaryMuted: '#0D3A66',
    secondary: '#5E5CE6',
    onSecondary: '#FFFFFF',
    tertiary: '#BF5AF2',
    onTertiary: '#FFFFFF',
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
    card: '#F3EDF7',
    sheet: '#F3EDF7',
    sheetField: '#F3EDF7',
    surfaceContainer: '#F3EDF7',
    surfaceVariant: '#E7E0EC',
    fill: '#E7E0EC',
    shadow: '#000000',
    onSurface: '#1D1B20',
    onSurfaceMuted: '#49454F',
    border: '#CAC4D0',
    listSeparator: '#CAC4D0',
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryMuted: '#EADDFF',
    secondary: '#625B71',
    onSecondary: '#FFFFFF',
    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
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
    card: '#211F26',
    sheet: '#211F26',
    sheetField: '#211F26',
    surfaceContainer: '#211F26',
    surfaceVariant: '#49454F',
    fill: '#49454F',
    shadow: '#000000',
    onSurface: '#E6E0E9',
    onSurfaceMuted: '#CAC4D0',
    border: '#49454F',
    listSeparator: '#49454F',
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryMuted: '#4F378B',
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    tertiary: '#EFB8C8',
    onTertiary: '#492532',
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
