import { useEffect, useRef } from 'react';

import { useListeningStore } from '@/store/listening';
import { usePlayerStore } from '@/store/player';

// The transport reports position roughly every frame it changes. Anything
// bigger than this between two reports is a seek, a clip jump or a sound change
// — not time someone sat and listened to — so it is dropped rather than banked.
const MAX_STEP_S = 2;

/**
 * Banks real listening time by watching the transport's own position, so it
 * counts only sound that actually played: paused time never advances position,
 * and scrubbing forward is discarded by the step guard. Mount once, app-wide.
 */
export const useListeningTime = () => {
  const position = usePlayerStore(state => state.position);
  const playing = usePlayerStore(state => state.playing);
  const currentId = usePlayerStore(state => state.current?.id);
  const add = useListeningStore(state => state.add);

  // Last position seen while playing THIS sound; null whenever a comparison
  // would be meaningless (paused, stopped, or a different sound loaded).
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    lastRef.current = null;
  }, [currentId]);

  useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return;
    }

    const previous = lastRef.current;
    lastRef.current = position;

    if (previous === null) return;

    const delta = position - previous;
    if (delta > 0 && delta <= MAX_STEP_S) add(delta);
  }, [playing, position, add]);
};
