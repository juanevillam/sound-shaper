import { useEffect } from 'react';

import { awardTrophy, useTrophyStore } from '@portfolio/trophies';

import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_SHAPE_COUNT,
  TROPHY_IDS,
} from '@/constants/trophies';
import { useListeningStore } from '@/store/listening';
import { useShaperStore } from '@/store/shaper';
import { useShapesStore } from '@/store/shapes';
import { useSoundsStore } from '@/store/sounds';

/**
 * Awards every store-derived trophy straight from the live caches, rather than
 * instrumenting each call site. The engine is idempotent, so re-evaluating on
 * every snapshot is safe — already-earned trophies no-op. Waits for the engine
 * to hydrate AND the sounds subscription to settle, so a cold start never awards
 * off an empty list. Mount once, app-wide.
 *
 * (`first-clip` isn't derivable from a store — the clips cache only holds the
 * sounds you have opened — so it is awarded where a clip is saved.)
 */
export const useTrophyTriggers = () => {
  const hydrated = useTrophyStore(state => state.hydrated);
  const sounds = useSoundsStore(state => state.sounds);
  const hasSettled = useSoundsStore(state => state.hasSettled);
  const shapes = useShapesStore(state => state.shapes);
  const listened = useListeningStore(state => state.seconds);

  // Shaping is "not flat any more", whichever way you got there: a preset, a
  // dragged band, the preamp, speed, or a saved shape applied.
  const gains = useShaperStore(state => state.gains);
  const preamp = useShaperStore(state => state.preamp);
  const activeShapeId = useShaperStore(state => state.activeShapeId);

  useEffect(() => {
    if (!hydrated || !hasSettled) return;

    if (sounds.length >= 1) awardTrophy(TROPHY_IDS.firstSound);
    if (sounds.length >= LIBRARY_SOUND_COUNT) awardTrophy(TROPHY_IDS.library);
    if (shapes.length >= SAVED_SHAPE_COUNT) awardTrophy(TROPHY_IDS.savedShapes);
    if (listened >= LISTENING_MINUTES * 60) awardTrophy(TROPHY_IDS.listening);

    const shaped =
      activeShapeId !== null || preamp !== 0 || gains.some(gain => gain !== 0);
    if (shaped) awardTrophy(TROPHY_IDS.firstShape);
  }, [
    activeShapeId,
    gains,
    hasSettled,
    hydrated,
    listened,
    preamp,
    shapes.length,
    sounds.length,
  ]);
};
