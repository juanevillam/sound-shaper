import { type TrophyTier } from './types';

/**
 * Flat, solid tier colors — bronze looks bronze, silver steely, gold golden,
 * platinum cool. ONE unified set used in both light and dark themes: a tier
 * color is an identity (like a real medal), so it doesn't shift with the
 * surface. Mid-tone hues — metallic enough to read right, dark enough to stay
 * legible on the near-white light card, bright enough on the dark surface.
 * Earned trophies paint with these; locked ones fall back to a muted onSurface
 * grey passed by the caller, so color is part of the reward.
 */
export const TIER_COLORS: Record<TrophyTier, string> = {
  bronze: '#BE7B3A',
  silver: '#8F9AA6',
  gold: '#CC9A34',
  platinum: '#6FA9C6',
};

/** The tier's color (theme-independent). */
export const tierColor = (tier: TrophyTier): string => TIER_COLORS[tier];
