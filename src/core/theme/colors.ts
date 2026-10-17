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
   *
   * ANDROID MAPS TO `primary` because a Compose `Switch` draws its own thumb
   * and track from the Material scheme; nothing there reads this token, and a
   * hardcoded green would be a lie about what that platform shows.
   */
  switchOn: string;
  primaryContainer: string;
  onPrimaryContainer: string;
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
const EMPTY_STEP_TARGET = 5;
const EMPTY_STEP_FLOOR = 3;

/** Channel-wise mix of two palette colours — still a derivation of the
 *  dynamic theme, never a static colour (same licence `mutedInk`'s alpha
 *  fallback already takes). */
const mix = (a: string, b: string, t: number): string => {
  const ch = (hex: string, i: number) =>
    parseInt(hex.replace('#', '').slice(i * 2, i * 2 + 2), 16);
  const blend = (i: number) =>
    Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${blend(0)}${blend(1)}${blend(2)}`.toUpperCase();
};

const emptyMediaMaterial = (m: MaterialColors, card: string): string => {
  if (!sameInk(m.surfaceVariant, m.surfaceContainer)) return m.surfaceVariant;

  /**
   * TARGET a step, don't maximise one — and BLEND DOWN to it when the ladder
   * cannot say it quietly. `bestSeparated` (kept as the floor-failure
   * fallback) picks the candidate FURTHEST from both grounds, and on the A54
   * that meant #4D4D52 — 32.6 L* off a near-black page, three times the step
   * Apple's own empty-media grey takes — so every art-less box and bone
   * shouted (Juan, 2026-09-04, both schemes). The box only has to be VISIBLE
   * on both its grounds; past that, distance is noise.
   *
   * The quietest LADDER answer was still too loud (Juan, same day, second
   * pass): Samsung's dark ladder has nothing between "equal to the card" and
   * ~9 L* above it, so the pick lands at #252528 and cannot go lower by
   * choosing tokens. When the best candidate still overshoots the target, it
   * is therefore blended toward the nearer ground until its worst-case step
   * sits at the target — Apple's own fills are exactly this kind of
   * fractional step (systemGray5 sits ~4 L* off the grouped page). The blend
   * is a mix of two palette colours, so the result is still the dynamic
   * theme's, just between its rungs.
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
  if (!visible.length) return bestSeparated(grounds, candidates);

  const best = visible.reduce((a, b) =>
    Math.abs(worstGap(b) - EMPTY_STEP_TARGET) <
    Math.abs(worstGap(a) - EMPTY_STEP_TARGET)
      ? b
      : a,
  );
  if (worstGap(best) <= EMPTY_STEP_TARGET) return best;

  // Overshot: pull toward the nearer ground until the worst-case step lands
  // on the target (binary search on the mix fraction; monotonic on t).
  const near = grounds.reduce((a, b) =>
    Math.abs(lightness(b) - lightness(best)) <
    Math.abs(lightness(a) - lightness(best))
      ? b
      : a,
  );
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i += 1) {
    const t = (lo + hi) / 2;
    if (worstGap(mix(best, near, t)) > EMPTY_STEP_TARGET) lo = t;
    else hi = t;
  }
  return mix(best, near, lo);
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
 * THE CHROME GROUND — what an Android app bar wears once content is behind it
 * (the top bars rest on the page and step up here on scroll, since
 * 2026-09-08 — see `useHeaderScroll` in `src/ui`; the bottom
 * NavigationBar wears it permanently).
 *
 * `m.surface` is the right token until the card resolution lands ON it, which
 * is exactly what the lighter-than-page card pick did on the A54 in light:
 * `surfaceContainerLowest` #FCFCFF IS `surface` there, so the header wore the
 * same colour as the list rows scrolling under it. Dark never collided
 * (`surface` #17171A vs card #121318, and that 1.9 L* step reads apart on
 * device — hence the loose epsilon; only a genuine collision substitutes, and
 * a palette whose `surface` clears the card passes through untouched).
 *
 * THE COLLIDED VALUE IS A HALF-STEP, because both whole answers were rendered
 * and rejected on device (Juan, 2026-09-04, three passes): `surfaceContainer`
 * #E4E4E7 read as a heavy tonal band once the cards stepped UP off the page,
 * and the bare page ground read as no chrome at all — the bar must differ
 * from BOTH the page and the rows. The ladder holds nothing between those
 * (every token lighter than the page sits within ~2 L* of the rows; every
 * darker one is the band), so the chrome is mixed halfway from the page
 * toward M3's own app-bar colour — the same between-the-rungs licence
 * `emptyMediaMaterial` already takes, still built only from palette colours.
 * Lands #EBEBED on the A54: 6 channels off the page, 17 off the rows.
 */
const CHROME_COLLIDE_EPSILON = 1.5;
const CHROME_STEP_FLOOR = 3;
const CHROME_STEP_CEILING = 12;

const surfaceMaterial = (m: MaterialColors, card: string): string => {
  if (
    Math.abs(lightness(m.surface) - lightness(card)) >= CHROME_COLLIDE_EPSILON
  )
    return m.surface;

  /**
   * ON COLLISION THE CHROME SITS BETWEEN THE PAGE AND THE CARDS — the dark
   * relationship, transposed, and Juan's own spec (2026-09-04, fifth pass):
   * in dark the bars are LIGHTER than both the cards and the page (surface
   * #17171A over cards #121318 over page #010102) and read exactly right; in
   * light every candidate DARKER than the page had been tried — the tonal
   * band #E4E4E7, the half-step #EBEBED, the tinted #E1E2ED — and each read
   * as a band or a dingier page, because it put the chrome BELOW the ground
   * it brackets. The bar may sit a hair off the white cards (dark's bar sits
   * 4 channels off its cards); what it must not be is darker than the page.
   *
   * So the pick is the ladder token strictly between the page and the card,
   * nearest the card — `surfaceBright` #FAF8FF on the A54 (page 241 → chrome
   * 250 → cards 252, mirroring dark's 1 → 19 → 23). The old darker-side
   * candidates survive only as fallbacks for a palette with nothing in the
   * band.
   */
  const pageL = lightness(m.background);
  const cardL = lightness(card);
  const between = [
    m.surfaceBright,
    m.surfaceContainerLowest,
    m.surfaceContainerLow,
    m.surfaceContainerHighest,
    m.surfaceContainer,
  ].filter(c => {
    const l = lightness(c);
    return l > Math.min(pageL, cardL) + 0.5 && l < Math.max(pageL, cardL) - 0.5;
  });
  if (between.length)
    return between.reduce((a, b) =>
      Math.abs(lightness(b) - cardL) < Math.abs(lightness(a) - cardL) ? b : a,
    );

  const grounds = [card, m.background];
  const worstGap = (c: string) =>
    Math.min(...grounds.map(g => Math.abs(lightness(c) - lightness(g))));
  const pick = [m.surfaceContainerHighest, m.surfaceContainer].find(
    c => worstGap(c) >= CHROME_STEP_FLOOR && worstGap(c) <= CHROME_STEP_CEILING,
  );
  return pick ?? mix(m.background, m.surfaceContainer, 0.5);
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
    surface: surfaceMaterial(m, card),
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
    // The SOURCE accent, not the ink repair — see `accentFill`.
    accentFill: m.primary,
    onPrimary: m.onPrimary,
    danger: m.error,
    // A Compose `Switch` draws itself from the scheme — see the token's note.
    switchOn: m.primary,
    primaryContainer: m.primaryContainer,
    onPrimaryContainer: m.onPrimaryContainer,
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
    accentFill: '#6750A4',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
    // A Compose `Switch` draws itself from the scheme — see the token.
    switchOn: '#6750A4',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
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
    accentFill: '#D0BCFF',
    onPrimary: '#381E72',
    danger: '#F2B8B5',
    // A Compose `Switch` draws itself from the scheme — see the token.
    switchOn: '#D0BCFF',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
  },
};
