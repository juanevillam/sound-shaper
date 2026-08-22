import { useEffect } from 'react';

import { awardTrophy, useTrophyStore } from '@portfolio/trophies';

import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_SHAPE_COUNT,
  TROPHY_IDS,
} from '@/constants/trophies';
import { useListeningStore } from '@/store/listening';
import { usePlayerStore } from '@/store/player';
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

  // Shaping is "not default any more", whichever way you got there: a preset, a
  // dragged band, a saved shape applied, or the speed moved off 1×. Rate counts
  // because this app already treats it as shaping everywhere else — the Shape
  // summary prints it, and `createShape` stores it beside the gains — so the
  // trophy's own copy promises it. It lives in the player store, not the
  // shaper's, which is the only reason it was missing here.
  const gains = useShaperStore(state => state.gains);
  const activeShapeId = useShaperStore(state => state.activeShapeId);
  const rate = usePlayerStore(state => state.rate);

  useEffect(() => {
    if (!hydrated || !hasSettled) return;

    if (sounds.length >= 1) awardTrophy(TROPHY_IDS.firstSound);
    if (sounds.length >= LIBRARY_SOUND_COUNT) awardTrophy(TROPHY_IDS.library);
    if (shapes.length >= SAVED_SHAPE_COUNT) awardTrophy(TROPHY_IDS.savedShapes);
    if (listened >= LISTENING_MINUTES * 60) awardTrophy(TROPHY_IDS.listening);

    const shaped =
      activeShapeId !== null || rate !== 1 || gains.some(gain => gain !== 0);
    if (shaped) awardTrophy(TROPHY_IDS.firstShape);
  }, [
    activeShapeId,
    gains,
    hasSettled,
    hydrated,
    listened,
    rate,
    shapes.length,
    sounds.length,
  ]);
};
