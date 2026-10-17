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
      unlocked: Boolean(earned),
      achievedAt: earned?.achievedAt ?? null,
    };
  });

export type TrophySummary = {
  trophies: ResolvedTrophy[];
  /** Earned count and the total, both INCLUDING platinum. */
  earned: number;
  total: number;
  /**
   * The awarded cache has come back from storage. FALSE MEANS THE COUNTS ARE
   * NOT YET TRUE, and that is the reason this is surfaced: before hydration
   * `awarded` is empty, so every trophy resolves LOCKED and the summary reads
   * "0 of 7" at 0%. A screen that renders that is not showing a loading state,
   * it is stating a wrong answer and then correcting itself. Screens gate their
   * placeholder on this.
   */
  hydrated: boolean;
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
  const hydrated = useTrophyStore(state => state.hydrated);

  return useMemo(() => {
    const trophies = resolveTrophies(configs, awarded, copy);

    return {
      trophies,
      earned: trophies.filter(trophy => trophy.unlocked).length,
      total: trophies.length,
      hydrated,
    };
  }, [configs, awarded, copy, hydrated]);
};
