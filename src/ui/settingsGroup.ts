import { padding, Shapes } from '@expo/ui/jetpack-compose/modifiers';

/**
 * Corner shapes for rows in a Material 3 grouped settings list (the Google
 * settings idiom): the group's first and last rows get the large outer
 * radius, every inner edge gets the small one, so the rows read as one
 * rounded card split by thin gaps.
 */
export const GROUP_ROW_GAP = 2;
/** Side gutter between a group and the screen edge. */
export const GROUP_SIDE_PADDING = 16;

/**
 * THE TOP GAP A HEADERLESS GROUP HAS TO ASK FOR.
 *
 * Every other group on a settings screen is preceded by its header, and the
 * header's own padding is what opens the space between one group's card and the
 * next. A group with NO header — the trailing sign-out card — gets only the
 * parent Column's arrangement, so it lands hard against the group above and
 * reads as one more row of it rather than a card of its own.
 *
 * IT IS NOT THE HEADED GROUPS' CARD-TO-CARD DISTANCE, and it was written as
 * exactly that first: 56, back-solved so the sign-out card came to rest 71.11dp
 * below Legal against the headed groups' 70.76dp. That is the intent PLUS a
 * header, paid to a card that draws no header — the very trap of restoring
 * the box rather than the intent ("was the old render the intent, or the
 * intent plus a box?"), applied
 * correctly to this row's removed icon in the same change and then missed one
 * line down. Juan read it as too far apart on the device before the numbers did.
 *
 * THE RELATIONSHIP IS THE THING THAT TRANSFERS, NOT THE NUMBER. Measured on
 * iPhone 17 / iOS 26.5, that screen's headed sections open at 58.00 and 57.67pt
 * and its headerless sign-out card at 35.00 — 0.605 of a headed gap. Copying
 * the 35 would be pixel parity for a screen whose Android headed gaps are
 * 70.76dp rather than 58, so what crosses is the ratio: 28 renders 43.02dp,
 * which is 0.608. (Same method as `SECTION_GAP` in the starter's showcase
 * frame, which matches iOS's title-to-boundary ratio rather than its points.)
 *
 * Measured on a Galaxy A54, dark, cold-started — 8 → 23.11dp / 0.327,
 * 16 → 30.93 / 0.437, 28 → 43.02 / 0.608, 56 → 71.11 / 1.005.
 */
export const GROUP_HEADERLESS_TOP_GAP = 28;

/**
 * A grouped card's corners: large where the card meets the page, small on the
 * inner edges, so a run of rows reads as ONE card split by thin gaps.
 *
 * Exported because `groupRowShape` hands back a Compose `Shape`, which is no
 * use to a caller drawing the same group in React Native — Topper's RN bones
 * for grouped rows (`Skeleton.tsx`, `PeopleSheetList`) cannot take one. The rule this repo
 * already has for that case is to import the CONSTANTS rather than re-measure
 * them (`TopItemListIos` learned it the expensive way), so the numbers are the
 * shared term and each technology builds its own shape from them.
 */
export const GROUP_OUTER_RADIUS = 24;
export const GROUP_INNER_RADIUS = 4;

const OUTER_RADIUS = GROUP_OUTER_RADIUS;
const INNER_RADIUS = GROUP_INNER_RADIUS;

type GroupShape = ReturnType<typeof Shapes.RoundedCorner>;

// Cached per (index, count) so row components receive referentially stable
// shapes — they are memoized to keep their native Icons from re-resolving
// (a visible flicker) when sibling dialog state toggles.
const shapeCache = new Map<string, GroupShape>();

export const groupRowShape = (index: number, count: number): GroupShape => {
  const top = index === 0 ? OUTER_RADIUS : INNER_RADIUS;
  const bottom = index === count - 1 ? OUTER_RADIUS : INNER_RADIUS;
  const key = `${top}/${bottom}`;

  let shape = shapeCache.get(key);

  if (!shape) {
    shape = Shapes.RoundedCorner({
      topStart: top,
      topEnd: top,
      bottomStart: bottom,
      bottomEnd: bottom,
    });
    shapeCache.set(key, shape);
  }

  return shape;
};

/**
 * A GROUP HEADER — the muted `labelLarge` subheader over a grouped card, with
 * the padding every header on the settings family takes (first one included).
 * Spread onto a Compose `Text`: `<Text {...groupHeaderProps(muted)}>`.
 *
 * Ink, not the accent: a group header is a label. The full argument is on
 * `sectionsTitle` in `SettingsScreen`.
 */
export const groupHeaderProps = (onSurfaceMuted: string) => ({
  color: onSurfaceMuted,
  style: { typography: 'labelLarge' as const },
  modifiers: [padding(16, 16, 16, 8)],
});

/**
 * A grouped row's `ListItem` colours — the card fill, the ink, and the muted
 * supporting line. A row whose supporting line carries a SELECTION overrides
 * that one role (`SettingsScreen`'s preference rows).
 */
export const groupRowColors = (colors: {
  surfaceContainer: string;
  onSurface: string;
  onSurfaceMuted: string;
}) => ({
  containerColor: colors.surfaceContainer,
  contentColor: colors.onSurface,
  supportingContentColor: colors.onSurfaceMuted,
});

/**
 * THE CONTAINER A HAND-BUILT SETTINGS DIALOG PAINTS — the radio picker in
 * `SettingsScreen` and `UsernameDialog` in `SettingsAccountSection`.
 *
 * WHY IT IS STATED INSTEAD OF ASKED FOR AS ELEVATION. Both used
 * `tonalElevation={6}`, which does not mean "raise this six steps of grey":
 * Compose derives a tonal overlay by blending the scheme's PRIMARY into the
 * surface, so on a wallpaper-derived palette the dialog picks up the accent.
 * Measured on a Galaxy A54 (dark): #1B2131 — a blue whose blue channel sits 22
 * above its red, in an app where every other container is neutral.
 *
 * IT WAS `surfaceVariant` FOR A DAY, and that was right only until the palette
 * repair landed. It was chosen because it matched what Compose's own
 * `AlertDialog` draws (#4D4D52) — but that value is `surfaceContainerHigh`,
 * which on this palette is 32.6 L* off a near-black page. Once `cardMaterial`
 * brought the cards down to 5.7, the dialogs were the last slabs on a screen
 * that had gone quiet. `surfaceDialog` is the same repair one step higher; see
 * `dialogMaterial` in `src/core`.
 *
 * The sign-out dialog is Compose's real `AlertDialog` and takes the same value
 * through `colors.containerColor`, so all three dialogs in the app are one
 * surface rather than two hand-built ones and a framework default.
 */
export const dialogContainer = (colors: { surfaceDialog: string }): string =>
  colors.surfaceDialog;

/**
 * THE CONTAINER A DROPDOWN MENU PAINTS — every `DropdownMenu` opened from an
 * overflow or icon button.
 *
 * NOT `dialogContainer`, and the difference is the SCRIM: a dialog floats
 * over a dimmed page, where One UI's ~11 L* light step reads as a layer; a
 * menu floats over the undimmed page, where the same step reads as a grey
 * slab (Juan, 2026-09-04 — "too much contrast, unpolished", both modes, on
 * the M3 default it drew before this existed).
 *
 * So the menu takes the quietest surface that still separates in each
 * appearance: in DARK the dialog step (`surfaceDialog`, 8.5 L* over the
 * card — the card itself is only 5.7 off the page and a menu over a card
 * would melt into it); in LIGHT the bright card (`card`, which the light
 * remap already places ABOVE the page), with Compose's own menu elevation
 * shadow carrying the edge — the white-menu-plus-shadow look every polished
 * light menu has.
 */
export const menuContainer = (
  colors: { card: string; surfaceDialog: string },
  scheme: 'light' | 'dark' | null | undefined,
): string => (scheme === 'dark' ? colors.surfaceDialog : colors.card);

/**
 * THE GROUND UNDER EVERY COMPOSE BOTTOM SHEET.
 *
 * A Compose `ModalBottomSheet` left without `containerColor` draws M3's own
 * default, which is the OEM-token case this family of functions exists to
 * take out of the framework's hands. It went unnoticed because the default
 * LOOKS right: the three Compose sheets of the time (clips, shaper, the sound
 * editor) all wore it and all were signed off wearing it.
 *
 * What made it visible is the fourth sheet. The Android clip editor was then
 * drawn as a hand-built RN sheet — on the since-disproved belief that a
 * Compose sheet's dialog window eats its gestures (`ClipTrimSheet` records how
 * that was undone; it is a Compose sheet now and takes this ground too) — so
 * it had to name a colour, reached for `colors.sheet`, and landed somewhere
 * else entirely. Two sheets in ONE flow, two grounds, band-scanned on a
 * Galaxy A54:
 *
 *                      light                dark
 *   clips (Compose)    #F1F1F3              #252528
 *   editor (RN)        #FCFCFF              #121318
 *
 * and #121318 is exactly the fill of the clip ROWS the list above it draws,
 * so in dark the editor wore the row colour as a page (Juan, 2026-09-10).
 *
 * THE VALUE IS THE ONE THE APPROVED SHEETS ALREADY RENDER, stated rather
 * than defaulted — `surfaceDialog` in dark, the page ground in light, which
 * is what those measurements name. Nothing that was signed off moved; the
 * editor got a colour it could share; and a palette that shifts under us now
 * breaks a stated intent instead of silently redecorating four surfaces.
 *
 * NOT `colors.sheet`, and not `menuContainer` either. Both resolve to `card`
 * in light, which is the ROW fill — a sheet wearing it has no rows, just a
 * sheet with text on it. The ground has to sit off the card in both schemes,
 * and the two tokens above are what do (11 levels in light, 19 in dark).
 */
export const sheetContainer = (
  colors: { background: string; surfaceDialog: string },
  scheme: 'light' | 'dark' | null | undefined,
): string => (scheme === 'dark' ? colors.surfaceDialog : colors.background);

/**
 * WHERE A PUSHED SHEET-FAMILY SCREEN'S FIRST CONTENT STARTS on Android — the
 * counterpart of iOS's `SHEET_CONTENT_TOP` (84 below the sheet's own edge):
 * the first content BOX (a section header's padding box, or a card's fill)
 * sits 16dp below the app bar, on every screen of the family.
 *
 * IT WAS 32, AND THE ON-SCROLL BAR IS WHAT HALVED IT (Juan, 2026-09-08, the
 * same day the bar went to resting on the page): with the bar band gone at
 * rest, the old 32 read as part of the bar — a too-tall stretch of bare page
 * between the title and the content. 16 is M3's own content inset and the
 * family's side gutter (`GROUP_SIDE_PADDING`), so the top now matches the
 * sides. iOS is untouched — its bar draws the title in the modern large
 * style, so the air under it never read as bar.
 *
 * Settings and Account derive it STRUCTURALLY — the scroller supplies 0 and
 * the first header's own 16 is the whole gap — and are the reference; a
 * screen whose first content is a bare card takes the constant outright.
 * Before the term existed the family had drifted to three answers
 * (Settings/Account 32, Trash/Blocked 16, Trophies 12), which is exactly the
 * per-screen wobble the iOS 84 was standardized to kill.
 *
 * As on iOS, a text-first screen's INK lands a few dp below a card-first
 * screen's FILL (the glyph's own bearing) — the BOX is the shared edge.
 */
export const SCREEN_CONTENT_TOP = 16;

/**
 * THE VALUE BONE'S BOX — one term for both platforms' account-fact rows.
 *
 * iOS measured it first (`FormDisclosureRowIos`: a one-line value's ink at
 * default Dynamic Type), and the Android row imports the same numbers rather
 * than re-deriving them, per the shared-terms rule. It lives HERE, not in the
 * iOS file, because that file imports `@expo/ui/swift-ui` and cannot be pulled
 * into an Android bundle just for two constants.
 */
export const VALUE_BONE_WIDTH = 110;
export const VALUE_BONE_HEIGHT = 14;
