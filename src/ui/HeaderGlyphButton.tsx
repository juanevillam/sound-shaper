import type { HeaderGlyphButtonProps } from './HeaderGlyphButton.ios';

/**
 * Android base so `tsc` resolves the import; Metro picks the `.ios` variant on
 * iOS. Nothing renders this — Android app bars use Compose `IconButton` +
 * `AppIcon`, whose ripple is the affordance there. Kept as a null render
 * rather than a Compose twin so an accidental Android call site is visibly
 * empty instead of silently drawing a second, differently-styled action.
 */
export function HeaderGlyphButtonIos(_props: HeaderGlyphButtonProps) {
  return null;
}

export function HeaderGlyphGroupIos(_props: {
  glyphs: HeaderGlyphButtonProps[];
}) {
  return null;
}

export const HEADER_GLYPH_SIZE = 24;
export const HEADER_CLOSE_GLYPH_SIZE = 20;
export const HEADER_LONE_TARGET = 36;

export type { HeaderGlyphButtonProps };
