/**
 * THE HERO BOX for a content-hugging explainer sheet — a symbol or badge above
 * a title above a body, centred.
 *
 * ONE term because the portfolio has two of these sheets and they had two
 * sizes: Topper's verified-badge explainer drew a 64pt symbol (61.00 rendered)
 * while the trophy detail drew an 88pt disc (84.67 rendered), so opening one
 * after the other jumped the hero by 24pt on an otherwise identical layout —
 * same centred column, same gap 8, same 24/32 padding, same 16 to the title.
 *
 * 64 IS APPLE'S SCALE, not a split of the two. `ContentUnavailableView` is
 * Apple's own version of this composition and this app already renders it; its
 * hero symbol band-scanned at 52.00 × 45.33pt on iPhone 17 / iOS 26.5 (the
 * empty Recently Deleted state). 88 is nearly double that; 64 lands 61.00 of
 * ink, which is the closest either sheet was.
 *
 * A BADGE FILLS THE BOX, A BARE SYMBOL IS DRAWN AT IT. The trophy's disc is
 * painted, so 64 is its diameter; the creator's checkmark is an SF Symbol, so
 * 64 is its point size and its ink comes out a little under. Both reserve the
 * same box, which is what keeps the two sheets' rhythm identical.
 */
export const SHEET_HERO_SIZE = 64;

/**
 * The glyph inside a painted hero badge — half the box, the ratio the trophy
 * disc already used (44 in 88) and the one Game Center's own badges sit at.
 */
export const SHEET_HERO_GLYPH_SIZE = SHEET_HERO_SIZE / 2;
