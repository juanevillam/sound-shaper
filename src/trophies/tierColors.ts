import { type TrophyTier } from './types';

/**
 * Flat, solid tier colors — a copper trophy looks coppery, gold golden, platinum
 * icy. The hue is intrinsic to a trophy's tier (like a real medal), so it lives
 * in the package; but a single value can't clear the 3:1 legibility floor on
 * BOTH a near-black and a near-white surface, so there's a light/dark pair. The
 * dark set is bright/icy (reads on dark surfaceContainer); the light set is
 * darker and more saturated (reads on a near-white card). Earned trophies paint
 * with these; locked ones fall back to a muted onSurface grey passed by the
 * caller, so color is part of the reward.
 */
export const TIER_COLORS: Record<
  'light' | 'dark',
  Record<TrophyTier, string>
> = {
  dark: {
    copper: '#C8814B',
    silver: '#AEB6C1',
    gold: '#E6B23E',
    platinum: '#A6D8EA',
  },
  light: {
    copper: '#A85D2A',
    silver: '#5F6670',
    gold: '#8C6A12',
    platinum: '#2E7D9E',
  },
};

/** The tier's color for the active color scheme. */
export const tierColor = (tier: TrophyTier, scheme: 'light' | 'dark'): string =>
  TIER_COLORS[scheme][tier];
