/**
 * HOW A DRAGGED TILE LIFTS — one value for every reorderable surface.
 *
 * `react-native-sortables` scales the item under the finger to say "this one
 * is travelling". 1.03 is small on purpose: the tile has to read as picked up
 * without covering its neighbours, which is what tells you where it will land.
 *
 * It lived as a private `const` in THREE files — Topper's two profile twins and
 * Sound Shaper's grid — which is how the same gesture ends up feeling different
 * on two screens of one app. Pair it with `useReducedMotion()`: a person who
 * has asked for less motion gets 1, and the reorder still works.
 */
export const DRAG_ACTIVE_SCALE = 1.03;
