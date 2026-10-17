/**
 * THE HERO for a content-hugging explainer sheet — a mark above a title above a
 * body, centred. TWO sizes, on purpose, because the portfolio has two KINDS of
 * hero and one box cannot serve both.
 *
 * The sheets themselves are identical and stay that way: centred column, gap 8,
 * 24pt side padding, 32 top, and a hero with `marginBottom: 8` so the title
 * lands 16 below it. That rhythm is the thing worth sharing. The hero's
 * diameter is not, and matching it was a mistake that measured itself out —
 * band-scanned on iPhone 17 / iOS 26.5 with both at 64:
 *
 *   creator (`checkmark.circle.fill`)  box 61.00   mark 61.00
 *   trophy  (glyph inside a disc)      box 61.33   mark 25.33   ← 0.41 of box
 *
 * A BARE SYMBOL IS ITS OWN MARK; A BADGE IS A CONTAINER. `checkmark.circle.fill`
 * draws its own disc, so every point of its box is ink. A trophy glyph sits
 * INSIDE a painted disc at 0.41 of it, so an equal box made the trophy's mark
 * 2.4× smaller than its sibling's — which is exactly how it read. Apple sizes
 * these differently for the same reason: `ContentUnavailableView`'s bare hero
 * measures 52.00 × 45.33, while its badge-style heroes (Game Center's trophies,
 * the app-icon heroes in onboarding sheets) run far larger so the glyph inside
 * still reads at symbol scale.
 *
 * So: a bare hero is drawn at symbol size (64), and a container hero at the
 * BADGE size below. Re-measure both marks — not both boxes —
 * if either changes.
 */
/**
 * A painted badge's diameter. Its glyph takes half (below), which lands ~35pt
 * of mark — the closest a contained glyph gets to a bare symbol's 61 without a
 * disc the size of a third of the sheet.
 */
export const SHEET_HERO_BADGE_SIZE = 88;

/** The glyph inside a painted badge — half the disc, Game Center's own ratio. */
export const SHEET_HERO_GLYPH_SIZE = SHEET_HERO_BADGE_SIZE / 2;
