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
  /**
   * A DIALOG'S CONTAINER — the one surface that floats over a scrim, so it sits
   * higher than a card and higher than chrome. M3 spends `surfaceContainerHigh`
   * here; this is that step when the palette's own is in range and a measured
   * substitute when it is not. See `dialogMaterial`.
   */
  surfaceDialog: string;
  /**
   * THE TONAL STEP THAT IS GUARANTEED TO SEPARATE FROM `surfaceContainer`.
   *
   * Read that contract, not the token's M3 name, before using it: on Android
   * this is `m.surfaceVariant` only WHEN THE PALETTE SEPARATES THE TWO, and a
   * measured substitute when it does not (see `emptyMediaMaterial`). Samsung
   * One UI returns the same value for both, which is the whole reason.
   *
   * It is not a bones-and-placeholders role, though that is what forced the
   * derivation. Roughly twenty-five call sites across the three apps read it —
   * a skeleton bone and an art-less box, but also a progress track, a slider's
   * inactive track, a switch's unchecked track, a "Private" pill on a card, a
   * text field's ground and the Android snackbar. Every one of them wants the
   * same thing the contract states: to be visible against the surface it sits
   * on. None of them wants the literal collapsed value, which is why the
   * derivation is applied to the role rather than hidden behind a second one.
   */
  surfaceVariant: string;
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
  /**
   * THE ACCENT AS A FILL, where `primary` is the accent as INK.
   *
   * On a dark Material scheme those are not the same colour and cannot be.
   * M3's dark `primary` is tone 80 — a pastel, built to be READ on a dark
   * ground (a label, a glyph) — and `schemePrimary` exists to guarantee it,
   * because One UI hands back the light tone for both schemes. Filling a
   * shape with tone 80 is a different job: it makes the shape the brightest
   * object on the screen, which is exactly what Juan rejected on Sound
   * Shaper's clip selection (2026-09-08, "too much contrast").
   *
   * Stepping the fill DOWN to `primaryContainer` was the answer for two
   * days and is worse on this palette: One UI's is #181B26 against a
   * #121318 card, a murky navy that belongs to no other control in the
   * portfolio (Juan, 2026-09-10, "a rare blue color").
   *
   * So a fill takes the palette's SOURCE accent — `m.primary` raw, the same
   * ink the Switch already wears (#387AFF on the A54) — which is a true mid
   * blue and lands where Apple's systemBlue lands, making the two platforms
   * read as siblings on a surface that is the same surface. iOS has no split
   * to make: systemBlue is already both.
   *
   * Use `primary` for ink and `accentFill` for a filled shape; they are the
   * same value on iOS and on any palette whose accent needs no repair.
   */
  accentFill: string;
  danger: string;
  /**
   * A SWITCH'S ON STATE, and it is a PLATFORM SEMANTIC rather than the accent.
   *
   * iOS reads green as "on" everywhere Apple draws a switch — Settings and
   * every UIKit `UISwitch` — and RN's own `Switch` already IS a `UISwitch`, so
   * this is the value it shows without being told. A SwiftUI `Toggle` is the
   * odd one out: it takes the ambient accent, which inside our tinted `Form`
   * meant blue, so it has to be told.
   *
   * It sits in the same class as `danger`, not in the same class as `primary`:
   * red means destructive, green means on, and neither is brand colour the
   * monochrome rule has any claim over. Two monochrome alternatives were
   * rendered and rejected first — `onSurface` is a solid white blob in dark
   * (the knob is white and fixed) and a mid grey reads as neither state.
   */
  switchOn: string;
  primaryContainer: string;
  onPrimaryContainer: string;
};

/**
 * Returns `color` with the given opacity (0–1) as an `#RRGGBBAA` string.
 * Accepts `#RRGGBB` or `#RRGGBBAA` input (any existing alpha is replaced).
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
 * iOS palette built from Apple's UIKit semantic and system colors (HIG), so the
 * app reads native on iOS instead of inheriting Google's Material baseline.
 * Surfaces map to the grouped-background ramp, text to label/secondaryLabel,
 * primary to systemBlue, danger to systemRed, `switchOn` to systemGreen. The
 * one container pair (`primaryContainer`, a role iOS doesn't define) is a
 * static tint of systemBlue with a darkened/lightened companion for readable
 * text.
 */
export const IOS_COLORS: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    sheet: '#F2F2F7',
    sheetField: '#FFFFFF',
    surfaceContainer: '#E5E5EA',
    surfaceDialog: '#E5E5EA',
    surfaceVariant: '#D1D1D6',
    shadow: '#000000',
    onSurface: '#000000',
    onSurfaceMuted: '#3C3C4399',
    border: '#C6C6C8',
    listSeparator: '#E8E8E8',
    primary: '#007AFF',
    accentFill: '#007AFF',
    onPrimary: '#FFFFFF',
    danger: '#FF3B30',
    switchOn: '#34C759', // systemGreen, light
    primaryContainer: '#CCE4FF',
    onPrimaryContainer: '#00428C',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    card: '#1C1C1E',
    sheet: '#1C1C1E',
    sheetField: '#2C2C2E',
    surfaceContainer: '#2C2C2E',
    surfaceDialog: '#2C2C2E',
    surfaceVariant: '#3A3A3C',
    shadow: '#000000',
    onSurface: '#FFFFFF',
    onSurfaceMuted: '#EBEBF599',
    border: '#38383A',
    listSeparator: '#38383B',
    primary: '#0A84FF',
    accentFill: '#0A84FF',
    onPrimary: '#FFFFFF',
    danger: '#FF453A',
    switchOn: '#30D158', // systemGreen, dark
    primaryContainer: '#0D3A66',
    onPrimaryContainer: '#A8CFFF',
  },
};
