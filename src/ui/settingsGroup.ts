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
 * header's own padding is what opens the space between one group's card and
 * the next. A group with NO header — the trailing sign-out card — gets only
 * the parent Column's 8dp arrangement, so it lands hard against the group
 * above and reads as one more row of it rather than a card of its own.
 *
 * 56 is the remainder that puts it where a headed group's card sits: measured
 * on a Galaxy A54 against the two headed groups on the same screen, whose
 * card-to-card boundary is 64.36dp, less the 8 the arrangement already gives.
 * It is matched to its siblings on the screen it renders on, not back-solved
 * from an old layout — and it lands on Material's 8dp grid.
 */
export const GROUP_HEADERLESS_TOP_GAP = 56;

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
 * above its red, in an app where every other container is neutral — and 23
 * levels DARKER than the cards it floats over, so it read recessed rather than
 * raised.
 *
 * The token was chosen by MEASUREMENT, and the ground truth was already on the
 * same screen: `DestructiveConfirmDialog` (Sign Out) uses Compose's real
 * `AlertDialog`, which draws M3's own dialog container. That measured #4D4D52
 * on this device — exactly what `surfaceVariant` resolves to here, since that
 * role's whole contract is "the tonal step guaranteed to separate from
 * `surfaceContainer`" whatever the OEM ships. So the two hand-built dialogs now
 * match the framework's own dialog beside them instead of being the odd ones.
 */
export const dialogContainer = (colors: { surfaceVariant: string }): string =>
  colors.surfaceVariant;
