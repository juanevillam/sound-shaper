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
  /**
   * THE INK ON `danger`, and the reason it exists is that nothing else is
   * correct there. M3 pairs `error` with `onError` and the pairing is not
   * cosmetic: in a DARK scheme `error` is a pale pink, so its ink is a dark
   * maroon — the inverse of what every other "on" role does. Reaching for
   * `onPrimary` instead put #FCFCFF on #E9BAB7 in expo-ui-starter's Badge
   * showcase, measured 1.68:1 against the 7.69:1 the same badge scores one
   * route away where Compose supplies the pair itself (Galaxy A54, dark).
   */
  onError: string;
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
   *
   * ANDROID MAPS TO `primary` because a Compose `Switch` draws its own thumb
   * and track from the Material scheme; nothing there reads this token, and a
   * hardcoded green would be a lie about what that platform shows.
   */
  switchOn: string;
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
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OEM PALETTES MAY COLLAPSE ROLES THAT M3 DIFFERENTIATES — MEASURE, DON'T TRUST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The M3 spec gives `onSurfaceVariant` and `surfaceVariant` their own values,
 * and every AOSP/Pixel palette does. Samsung One UI does not: measured live on
 * a Galaxy A54 (SM-A546E, Android 16 / API 36, 2026-08-28) via
 * `getMaterialColors`, in BOTH schemes —
 *
 *   dark   onSurface #FCFCFF == onSurfaceVariant #FCFCFF
 *          surfaceContainer #3A3A3D == surfaceVariant #3A3A3D
 *   light  onSurface #010102 == onSurfaceVariant #010102
 *          surfaceContainer #E4E4E7 == surfaceVariant #E4E4E7
 *
 * The app leans on both pairs to express hierarchy, so on that device it had
 * NO muted text anywhere (every "quiet" string rendered at full primary ink —
 * six pairs measured identical at (252,252,255) on Topper's home, settings and
 * trophies) and NO visible placeholder or bone on any card (`InitialArt`'s box
 * and `SkeletonBone`'s fill both resolve to `surfaceVariant`; a bone on a card
 * measured a channel delta of 18 against the card, and 0 at the sweep's
 * trough, versus 173 for the same bone on the page background).
 *
 * So the two roles are DERIVED when the palette does not separate them, and
 * passed straight through when it does — a Pixel keeps exactly what it had.
 *
 * THE STEP IS CHOSEN BY MEASUREMENT, NOT BY NAME, because Samsung's container
 * ladder is not monotonic: in dark `surfaceContainerHighest` (#23262E) is
 * DARKER than `surfaceContainer` (#3A3A3D), so the highest-sounding token is
 * the wrong one. The pick targets a visible-but-quiet worst-case step from
 * both grounds a box sits on — see `emptyMediaMaterial`, which lands #252528
 * in dark and #DAD9E0 in light on the A54, and passes the spec's own
 * `surfaceVariant` through on any palette that separates it.
 */

/** sRGB relative luminance (WCAG), from an `#RRGGBB` or `#RRGGBBAA` string. */
const luminance = (color: string): number => {
  const hex = color.replace('#', '').slice(0, 6);
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};

/** Same rendered colour? Alpha is ignored — every role here is opaque, and the
 *  native palette hands them over as 8-digit `#RRGGBBFF`. */
const sameInk = (a: string, b: string): boolean =>
  a.replace('#', '').slice(0, 6).toUpperCase() ===
  b.replace('#', '').slice(0, 6).toUpperCase();

/**
 * The candidate that separates best from EVERY ground it has to sit on —
 * maximising the SMALLEST of its distances, not the largest of any one.
 *
 * Both grounds matter because these boxes appear in two places: on the page
 * background (a rail tile, a browse grid cell) and on a card or list row. A
 * plain "furthest from the card" pick was written first and measured wrong on
 * the A54 — it chose `surfaceDim` (#121318), which clears the card #3A3A3D
 * well and then all but vanishes on the #010102 page. Worst-case separation is
 * the property that actually has to hold.
 */
const bestSeparated = (grounds: string[], candidates: string[]): string => {
  const targets = grounds.map(luminance);
  const worstGap = (color: string) =>
    Math.min(...targets.map(t => Math.abs(luminance(color) - t)));
  return candidates.reduce((best, next) =>
    worstGap(next) > worstGap(best) ? next : best,
  );
};

/**
 * The LOWER-EMPHASIS INK. `onSurfaceVariant` is M3's own answer and is used
 * whenever the palette actually differentiates it.
 *
 * When it does not, `outline` is the next role down the same neutral ramp and
 * is what Material spends on lower-emphasis content — measured distinct on the
 * A54 (#A3A3A7 dark / #848487 light), and legible on both the page and a card
 * in each scheme. The alpha step is a last resort for a palette that collapses
 * BOTH, so there is always a hierarchy rather than a silent fall back to full
 * ink — which is the bug this whole block exists to end.
 */
const mutedInk = (m: MaterialColors): string => {
  if (!sameInk(m.onSurfaceVariant, m.onSurface)) return m.onSurfaceVariant;
  if (!sameInk(m.outline, m.onSurface)) return m.outline;
  return withAlpha(m.onSurface, 0.72);
};

/**
 * THE VALUE BEHIND `surfaceVariant` — a tonal step that separates from
 * `surfaceContainer` whatever the OEM ships.
 *
 * An art-less box and a skeleton bone are what exposed it, since those two
 * disappear most obviously into the card they sit on, but the role has about
 * twenty-five readers across the three apps and the substitution serves all of
 * them — see the token's own note in `AppColors`. `surfaceVariant` normally IS
 * that step; when the palette makes it the same ink as `surfaceContainer`,
 * take the container step that separates furthest, whichever direction the
 * ladder happens to run on this OEM.
 *
 * IT IS GROUNDED AGAINST THE CARD WE RESOLVE, not against `m.surfaceContainer`.
 * Those were the same value until `cardMaterial` started stepping the card down
 * on palettes whose own step is out of range; passing the raw token after that
 * would be measuring separation from a colour nothing on screen is painted.
 */
const EMPTY_STEP_TARGET = 8;
const EMPTY_STEP_FLOOR = 3;

const emptyMediaMaterial = (m: MaterialColors, card: string): string => {
  if (!sameInk(m.surfaceVariant, m.surfaceContainer)) return m.surfaceVariant;

  /**
   * TARGET a step, don't maximise one. `bestSeparated` (kept below as the
   * floor-failure fallback) picks the candidate FURTHEST from both grounds,
   * and on the A54 that meant #4D4D52 — 32.6 L* off a near-black page, three
   * times the step Apple's own empty-media grey takes (systemGray5 sits ~11
   * L* off black, ~9 off a white card) — so every art-less box and bone
   * shouted (Juan, 2026-09-04, both schemes). The box only has to be VISIBLE
   * on both its grounds; past that, distance is noise. Same shape as
   * `cardMaterial`: floor for visibility, then closest to the target.
   * Lands `surfaceContainerLow` #252528 in dark and `surfaceDim` #DAD9E0 in
   * light on the A54.
   */
  const grounds = [card, m.background];
  const candidates = [
    m.surfaceContainerHigh,
    m.surfaceContainerHighest,
    m.surfaceContainerLow,
    m.surfaceBright,
    m.surfaceDim,
  ];
  const worstGap = (c: string) =>
    Math.min(...grounds.map(g => Math.abs(lightness(c) - lightness(g))));

  const visible = candidates.filter(c => worstGap(c) >= EMPTY_STEP_FLOOR);
  if (visible.length)
    return visible.reduce((best, next) =>
      Math.abs(worstGap(next) - EMPTY_STEP_TARGET) <
      Math.abs(worstGap(best) - EMPTY_STEP_TARGET)
        ? next
        : best,
    );

  return bestSeparated(grounds, candidates);
};

/** Perceptual lightness (CIE L*), the axis a "step" is actually judged on. */
const lightness = (color: string): number => {
  const y = luminance(color);
  return y > 0.008856 ? 116 * y ** (1 / 3) - 16 : 903.3 * y;
};

const isDarkScheme = (m: MaterialColors): boolean =>
  lightness(m.background) < lightness(m.onBackground);

/**
 * THE ACCENT, WITH ITS DARK TONE PUT BACK.
 *
 * M3 gives a dark scheme a LIGHTER primary than a light one — tone 80 against
 * tone 40 — because a mid-tone accent on a dark ground glows. Samsung One UI
 * returns the SAME value for both: measured live on a Galaxy A54 (2026-08-29),
 * `primary` is #387AFF in dark and #387AFF in light, so every accent in the app
 * was the light-scheme tone painted on near-black.
 *
 * That it is a palette bug rather than a house choice is provable from the same
 * dump, because the OTHER accents flip correctly — `error` #B3261E → #F2B8B5,
 * `secondary` #585E71 → #C0C6DD, `tertiary` #6B5780 → #EDD8FF. Only `primary`
 * and `onPrimary` fail to. (19 of 48 roles do not change between schemes there.)
 *
 * THE TELL IS `inversePrimary`, not a hardcoded list of OEMs. In a correct dark
 * scheme `inversePrimary` IS the light scheme's primary, so the two differ; when
 * they are the same ink the palette has handed back one tone for both. The
 * replacement is already in the palette and needs no colour maths:
 * `primaryFixedDim` is tone 80 by definition, which is exactly what M3's dark
 * `primary` is. Measured #B1C5FF here.
 *
 * A palette that separates them is passed through untouched, so a Pixel keeps
 * what it had.
 */
const schemePrimary = (m: MaterialColors): string =>
  isDarkScheme(m) && sameInk(m.primary, m.inversePrimary)
    ? m.primaryFixedDim
    : m.primary;

/**
 * HOW FAR A CARD SHOULD SIT OFF THE PAGE — AND IN WHICH DIRECTION.
 *
 * A filled card on the page background is ONE elevation step, and in this
 * portfolio the step goes UP — the card is LIGHTER than the page in both
 * schemes, which is Apple's grouped model (white cells on the grey grouped
 * background; elevated #1C1C1E on black) and the look every iOS surface here
 * is the reference for. M3's light convention runs the other way (a filled
 * card is a DARKER tonal container on a near-white page), and following it
 * shipped exactly that inversion: on the A54 the light page is #F1F1F3
 * (L* 95.2 — the same lightness as Apple's #F2F2F7) and the cards came out
 * #E4E4E7, a step DOWN, so light mode read as grey cards on a whiter page —
 * backwards against the iOS twin on every screen (Juan, 2026-09-04). Dark
 * already stepped up and is unchanged by this.
 *
 * So the pick prefers candidates that sit ABOVE the page on the lightness
 * axis, chosen by measured step as before (Samsung's ladder is not monotonic,
 * so names cannot be trusted): in range [FLOOR, CEILING], closest to TARGET.
 * On the A54 that lands `surfaceContainerLowest` #FCFCFF in light (+3.8 L*,
 * against Apple's own +4.8) and keeps `surfaceDim` #121318 in dark (+5.7).
 * If no candidate clears the floor, the lightest one still above the page
 * wins; only a palette whose page IS its lightest surface falls back to the
 * old unsigned pick, because there is nothing to step up to.
 */
const CARD_STEP_TARGET = 6;
const CARD_STEP_FLOOR = 3;
const CARD_STEP_CEILING = 12;

const cardMaterial = (m: MaterialColors): string => {
  const ground = lightness(m.background);
  /** Signed: positive = lighter than the page. */
  const lift = (c: string) => lightness(c) - ground;

  const ladder = [
    m.surface,
    m.surfaceContainerLowest,
    m.surfaceBright,
    m.surfaceDim,
    m.surfaceContainerLow,
    m.surfaceContainer,
    m.surfaceContainerHigh,
    m.surfaceContainerHighest,
  ];

  const inRange = ladder.filter(
    c => lift(c) >= CARD_STEP_FLOOR && lift(c) <= CARD_STEP_CEILING,
  );
  if (inRange.length)
    return inRange.reduce((best, next) =>
      Math.abs(lift(next) - CARD_STEP_TARGET) <
      Math.abs(lift(best) - CARD_STEP_TARGET)
        ? next
        : best,
    );

  const above = ladder.filter(c => lift(c) > 0);
  if (above.length)
    return above.reduce((best, next) =>
      lift(next) > lift(best) ? next : best,
    );

  // The page is the palette's lightest surface: nothing to step up to, so
  // take the least-wrong unsigned step rather than inventing a colour.
  const step = (c: string) => Math.abs(lift(c));
  return ladder.reduce((best, next) =>
    Math.abs(step(next) - CARD_STEP_TARGET) <
    Math.abs(step(best) - CARD_STEP_TARGET)
      ? next
      : best,
  );
};

/**
 * A DIALOG'S CONTAINER, WHICH IS `cardMaterial` ONE STEP HIGHER.
 *
 * M3 puts a dialog on `surfaceContainerHigh` — above a card, so it reads as
 * floating rather than as another card. On the M3 baseline that lands about 10
 * L* off the page. On the A54 `surfaceContainerHigh` is #4D4D52, 32.6 L* off a
 * near-black page: the same over-contrast `cardMaterial` exists to repair, and
 * the dialogs kept it after the cards were fixed, which is how they came to read
 * as slabs against a screen that had gone quiet (Juan, 2026-08-29).
 *
 * The target sits deliberately above the card's — a dialog that matched the
 * cards under it would stop reading as a layer. Measured on the A54 the ladder
 * has nothing between 5.7 and 14.5 L*, so it lands on #252528: 8.5 above the
 * card, clear of it without being a slab.
 */
const DIALOG_STEP_TARGET = 12;
const DIALOG_STEP_CEILING = 20;

const dialogMaterial = (m: MaterialColors): string => {
  const ground = lightness(m.background);
  const step = (c: string) => Math.abs(lightness(c) - ground);

  if (step(m.surfaceContainerHigh) <= DIALOG_STEP_CEILING)
    return m.surfaceContainerHigh;

  return [
    m.surfaceContainerLow,
    m.surfaceContainerHighest,
    m.surfaceContainer,
    m.surfaceBright,
    m.surfaceContainerHigh,
  ].reduce((best, next) =>
    Math.abs(step(next) - DIALOG_STEP_TARGET) <
    Math.abs(step(best) - DIALOG_STEP_TARGET)
      ? next
      : best,
  );
};

/**
 * A COMPOSE COMPONENT THAT PICKS ITS OWN CONTAINER NEVER PASSES THROUGH HERE.
 *
 * Everything below repairs a role on its way to the RN side. A Compose
 * composable inside a `Host` reads the NATIVE scheme instead, so it draws the
 * OEM's raw token — and on One UI that means the very slabs `cardMaterial` and
 * `dialogMaterial` exist to fix. Found on expo-ui-starter's inline
 * `DateTimePicker`, which fills its container `surfaceContainerHigh` (#4D4D52,
 * 32.6 L* off a near-black page) because M3 builds it for `DatePickerDialog`.
 *
 * There is no sweep to do here; the fix is per-component, at the call site,
 * through whatever colour prop that component exposes. Two ways to choose the
 * value, and they are not interchangeable:
 *
 *  - MATCHING A NATIVE DEFAULT (the component has to agree with a sibling that
 *    theming does not reach) — pass the RAW token that sibling draws in. A
 *    derived step cannot track it: `surfaceDialog` matched the sibling in dark
 *    (14.50 L* against 14.88) and was 2.5x heavier in light (13.10 against
 *    5.13), because One UI's container ladder does not behave the same way in
 *    the two schemes. `useSurfaceContainerHighest` is the worked example.
 *  - AUTHORING A STEP (nothing to match; the surface just has to sit correctly
 *    off its ground) — pass the repaired role from here, which is what every
 *    RN-side caller already gets.
 */
export function materialToAppColors(m: MaterialColors): AppColors {
  // Resolved once: the bone/track material measures its separation against it.
  const card = cardMaterial(m);

  return {
    background: m.background,
    surface: m.surface,
    surfaceDialog: dialogMaterial(m),
    card: card,
    sheet: card,
    sheetField: card,
    surfaceContainer: card,
    surfaceVariant: emptyMediaMaterial(m, card),
    // MaterialColors exposes no `shadow` field; M3's scrim shares the same
    // ink (black) so it stands in for the shadow token.
    shadow: m.scrim,
    onSurface: m.onSurface,
    onSurfaceMuted: mutedInk(m),
    border: m.outlineVariant,
    listSeparator: m.outlineVariant,
    primary: schemePrimary(m),
    onPrimary: m.onPrimary,
    primaryMuted: m.primaryContainer,
    secondary: m.secondary,
    onSecondary: m.onSecondary,
    tertiary: m.tertiary,
    onTertiary: m.onTertiary,
    danger: m.error,
    onError: m.onError,
    // A Compose `Switch` draws itself from the scheme — see the token's note.
    switchOn: m.primary,
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
    surfaceDialog: '#E5E5EA',
    surfaceVariant: '#D1D1D6',
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
    onError: '#FFFFFF',
    switchOn: '#34C759', // systemGreen, light
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
    surfaceDialog: '#2C2C2E',
    surfaceVariant: '#3A3A3C',
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
    onError: '#FFFFFF',
    switchOn: '#30D158', // systemGreen, dark
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
    surfaceDialog: '#F3EDF7',
    surfaceVariant: '#E7E0EC',
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
    onError: '#FFFFFF',
    // A Compose `Switch` draws itself from the scheme — see the token.
    switchOn: '#6750A4',
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
    surfaceDialog: '#211F26',
    surfaceVariant: '#49454F',
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
    onError: '#601410',
    // A Compose `Switch` draws itself from the scheme — see the token.
    switchOn: '#D0BCFF',
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
