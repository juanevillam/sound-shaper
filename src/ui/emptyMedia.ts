import { type TextStyle } from 'react-native';

/**
 * THE PORTFOLIO'S "ADD MEDIA" PLACEHOLDER — one spec for every box that offers
 * to fill itself: Topper's create-top rail tile and item-editor picker, and
 * Sound Shaper's Add Sound grid cell. They are the same affordance (a filled square, a centred plus,
 * tap to choose), and they had drifted on all four terms — different
 * background token, different plus CHARACTER, a hand-tuned size against a
 * derived one, and muted ink against full strength.
 *
 * The values are the rail tile's, because that one was already measured and
 * debugged:
 *  - ASCII `+`, never the fullwidth `＋`: the fullwidth glyph carries CJK
 *    metrics, which is what forced a hand-corrected line height (and left
 *    the picker's plus optically small and low).
 *  - weight 300 — the thin plus Apple draws in an add affordance.
 *  - size DERIVED from the box, so a box that changes size keeps the same
 *    plus-to-box relationship. The ratio is **0.3**, up from the `40/178`
 *    (0.225) inherited from the ORIGINAL 178pt rail tile: there the plus
 *    shared the tile with a caption, while in today's ~120pt boxes it is
 *    the only content AND the affordance, and 0.225 read as a small mark
 *    in a large empty square (Juan, 2026-08-16). 0.3 is what Apple's own
 *    add-media placeholders run.
 *  - an explicit 1.2 line height: without it iOS clips a glyph this large to
 *    the font's line box and the plus renders as a "T".
 *
 * The FILL is `surfaceContainer` (see the rail tile's note): the translucent
 * `fill` collided with the card surface in dark — #1D1D1F vs #1C1C1E, an
 * invisible one-step difference — so this is the solid systemGray5 that
 * separates from both the background and cards in both modes. Callers pass
 * it, since the token has to come from the app theme.
 */
const PLUS_RATIO = 0.3;
const PLUS_LINE_RATIO = 1.2;

/**
 * Gap between the placeholder box and its caption. Home's create tile set it
 * (its `createBody` paddingTop); the editor's picker matches, so the two
 * captions sit the same distance under their boxes.
 */
export const EMPTY_MEDIA_CAPTION_GAP = 10;

/** The plus glyph itself — ASCII, for the metrics reason above. */
export const EMPTY_MEDIA_PLUS = '+';

/** Type style for the plus inside a `box`-sized placeholder. */
export const emptyMediaPlusStyle = (box: number): TextStyle => {
  const fontSize = Math.round(box * PLUS_RATIO);

  return {
    fontSize,
    fontWeight: '300',
    lineHeight: Math.round(fontSize * PLUS_LINE_RATIO),
  };
};
