import { Platform } from 'react-native';

/**
 * ARTWORK CORNERS SCALE WITH THE ARTWORK; CONTAINER CORNERS DO NOT.
 *
 * Apple's grouped-list radius is 26 whether the section is 180pt or 370pt wide,
 * so a card and a wider card are the same shape family. A PICTURE is the other
 * case: carrying an absolute radius onto a smaller cover is what turned
 * Topper's first rail pass into blobs — 26 on 88pt artwork is 30% of it, nearly
 * a circle.
 *
 * IT IS IN THE PACKAGE because both apps draw the same kind of artwork at
 * different sizes and only one of them derived it. Sound Shaper's song tile
 * used `TILE_RADIUS` — the grouped-CONTAINER constant — on its 178pt cover, and
 * got away with it only by coincidence: 26 happens to sit one point off the
 * 27 the ratio gives at that size, so the two apps agreed until either grid
 * changed. Naming the real term is what makes them keep agreeing.
 *
 * Android takes a DISCRETE step instead of the ratio: Material's shape scale is
 * 4/8/12/16/28, and a continuous ratio would leave the system for the sake of a
 * proportion.
 */
const ARTWORK_RATIO = 0.15;

export const artworkRadius = (size: number, androidStep: number): number =>
  Platform.OS === 'ios' ? Math.round(size * ARTWORK_RATIO) : androidStep;
