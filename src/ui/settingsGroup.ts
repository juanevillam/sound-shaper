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
