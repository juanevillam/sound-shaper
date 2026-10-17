import { useMemo } from 'react';

import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_CLIP_COUNT,
  TROPHY_CONFIGS,
  TROPHY_IDS,
  TROPHY_TITLES,
} from '@/constants/trophies';
import { type TranslationKey, useI18n } from '@/i18n';
import {
  type TrophyCopy,
  type TrophyOverlayStrings,
  type TrophyTier,
} from '@/trophies';

// The count folded into each count-based trophy's copy (single-sourced with the
// trigger thresholds), so "Keep {count} sounds" can't drift from the objective.
const TROPHY_COUNTS: Record<string, number> = {
  [TROPHY_IDS.library]: LIBRARY_SOUND_COUNT,
  [TROPHY_IDS.savedClips]: SAVED_CLIP_COUNT,
  [TROPHY_IDS.listening]: LISTENING_MINUTES,
};

const TIERS: TrophyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

/** When a trophy was earned, in the reader's locale — every trophy surface's
 *  one date format. */
export const formatAchievedDate = (locale: string, achievedAt: number) =>
  new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(achievedAt));

/** Strings for the trophies screen, minus the runtime `progress` count line. */
export type TrophyScreenStringsBase = {
  lockedLabel: string;
  achievedLabel: string;
  /** The two figures flanking the summary ring. */
  earnedLabel: string;
  availableLabel: string;
  tierNames: Record<TrophyTier, string>;
};

type TrophyContent = {
  /** Localized copy keyed by trophy id, with `{count}` resolved. */
  copy: Record<string, TrophyCopy>;
  overlayStrings: TrophyOverlayStrings;
  screenStrings: TrophyScreenStringsBase;
};

/**
 * Builds every localized trophy string from the app's i18n (`src/trophies`
 * stays content-free — copy is injected, exactly like `SettingsScreen`). Counts
 * are substituted here so the module never sees a template. Recomputes on
 * locale change.
 */
export const useTrophyContent = (): TrophyContent => {
  const { t } = useI18n();

  return useMemo(() => {
    const fill = (value: string, id: string) =>
      value.replace('{count}', String(TROPHY_COUNTS[id] ?? ''));

    const copy: Record<string, TrophyCopy> = {};
    TROPHY_CONFIGS.forEach(({ id }) => {
      copy[id] = {
        // Title is English-only (single source), never from i18n; only the
        // description is localized, and it's the SAME whether locked or not.
        title: TROPHY_TITLES[id] ?? id,
        description: fill(
          t(`trophies.items.${id}.description` as TranslationKey),
          id,
        ),
      };
    });

    const tierNames = TIERS.reduce(
      (names, tier) => ({ ...names, [tier]: t(`trophies.tier.${tier}`) }),
      {} as Record<TrophyTier, string>,
    );

    return {
      copy,
      overlayStrings: { unlockedLabel: t('trophies.unlocked') },
      screenStrings: {
        lockedLabel: t('trophies.locked'),
        achievedLabel: t('trophies.earned'),
        earnedLabel: t('trophies.earned'),
        availableLabel: t('trophies.available'),
        tierNames,
      },
    };
  }, [t]);
};
