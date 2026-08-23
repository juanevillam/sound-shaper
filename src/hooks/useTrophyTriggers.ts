import { useEffect } from 'react';

import { awardTrophy, useTrophyStore } from '@portfolio/trophies';

import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_CLIP_COUNT,
  TROPHY_IDS,
} from '@/constants/trophies';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { useListeningStore } from '@/store/listening';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useSoundsStore } from '@/store/sounds';

/**
 * Awards every store-derived trophy straight from the live caches, rather than
 * instrumenting each call site. The engine is idempotent, so re-evaluating on
 * every snapshot is safe — already-earned trophies no-op. Waits for the engine
 * to hydrate AND the sounds subscription to settle, so a cold start never awards
 * off an empty list. Mount once, app-wide.
 *
 * (`first-clip` isn't derivable from the clips cache — it only holds the sounds
 * you have opened — so it is awarded where a clip is saved. The same save site
 * banks the running total `saved-clips` reads.)
 */
export const useTrophyTriggers = () => {
  const hydrated = useTrophyStore(state => state.hydrated);
  const sounds = useSoundsStore(state => state.sounds);
  const hasSettled = useSoundsStore(state => state.hasSettled);
  const clipsSaved = useClipsSavedStore(state => state.count);
  const listened = useListeningStore(state => state.seconds);

  // Shaping is "not default any more", whichever way you got there: a preset, a
  // dragged band, or the speed moved off 1×. Rate counts because this app
  // already treats it as shaping everywhere else — the Shape summary prints it
  // beside the curve — so the trophy's own copy promises it. It lives in the
  // player store, not the shaper's, which is the only reason it was missing
  // here.
  const gains = useShaperStore(state => state.gains);
  const rate = usePlayerStore(state => state.rate);

  useEffect(() => {
    if (!hydrated || !hasSettled) return;

    if (sounds.length >= 1) awardTrophy(TROPHY_IDS.firstSound);
    if (sounds.length >= LIBRARY_SOUND_COUNT) awardTrophy(TROPHY_IDS.library);
    if (clipsSaved >= SAVED_CLIP_COUNT) awardTrophy(TROPHY_IDS.savedClips);
    if (listened >= LISTENING_MINUTES * 60) awardTrophy(TROPHY_IDS.listening);

    const shaped = rate !== 1 || gains.some(gain => gain !== 0);
    if (shaped) awardTrophy(TROPHY_IDS.firstShape);
  }, [clipsSaved, gains, hasSettled, hydrated, listened, rate, sounds.length]);
};
