import { Shapes } from '@expo/ui/jetpack-compose/modifiers';

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
 * header, paid to a card that draws no header — the very trap AGENTS.md names
 * ("was the old render the intent, or the intent plus a box?"), applied
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

const OUTER_RADIUS = 24;
const INNER_RADIUS = 4;

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
 * `dialogMaterial` in `@portfolio/core`.
 *
 * The sign-out dialog is Compose's real `AlertDialog` and takes the same value
 * through `colors.containerColor`, so all three dialogs in the app are one
 * surface rather than two hand-built ones and a framework default.
 */
export const dialogContainer = (colors: { surfaceDialog: string }): string =>
  colors.surfaceDialog;
