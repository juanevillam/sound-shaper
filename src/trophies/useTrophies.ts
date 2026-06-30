import { useMemo } from 'react';

import { useTrophyStore } from './store';
import {
  type AwardedTrophy,
  type ResolvedTrophy,
  type TrophyConfig,
  type TrophyCopy,
} from './types';

/** Merge config + copy + award state into render-ready rows, in config order. */
export const resolveTrophies = (
  configs: TrophyConfig[],
  awarded: Record<string, AwardedTrophy>,
  copy: Record<string, TrophyCopy>,
): ResolvedTrophy[] =>
  configs.map(config => {
    const earned = awarded[config.id];
    const text = copy[config.id];

    return {
      ...config,
      title: text?.title ?? config.id,
      description: text?.description ?? '',
      hint: text?.hint,
      unlocked: Boolean(earned),
      achievedAt: earned?.achievedAt ?? null,
    };
  });

export type TrophySummary = {
  trophies: ResolvedTrophy[];
  /** Earned count and the total, both INCLUDING platinum. */
  earned: number;
  total: number;
  /** Earned count and total of the non-platinum objectives (the real progress). */
  earnedObjectives: number;
  totalObjectives: number;
  platinumEarned: boolean;
};

/**
 * Read the live engine state merged with the app's localized copy. Re-renders
 * on every award; recomputes when copy (locale) changes. The screen renders
 * straight from this.
 */
export const useTrophies = (
  copy: Record<string, TrophyCopy>,
): TrophySummary => {
  const configs = useTrophyStore(state => state.configs);
  const awarded = useTrophyStore(state => state.awarded);

  return useMemo(() => {
    const trophies = resolveTrophies(configs, awarded, copy);
    const objectives = trophies.filter(trophy => trophy.tier !== 'platinum');
    const platinum = trophies.find(trophy => trophy.tier === 'platinum');

    return {
      trophies,
      earned: trophies.filter(trophy => trophy.unlocked).length,
      total: trophies.length,
      earnedObjectives: objectives.filter(trophy => trophy.unlocked).length,
      totalObjectives: objectives.length,
      platinumEarned: Boolean(platinum?.unlocked),
    };
  }, [configs, awarded, copy]);
};
