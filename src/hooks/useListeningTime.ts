import { useCallback, useEffect, useRef } from 'react';

import { useListeningStore } from '@/store/listening';
import { usePlayerStore } from '@/store/player';

// The transport reports position roughly every frame it changes. Anything
// bigger than this between two reports is a seek, a clip jump or a sound change
// — not time someone sat and listened to — so it is dropped rather than banked.
const MAX_STEP_S = 2;

/**
 * HOW MUCH LISTENING PILES UP BEFORE IT REACHES THE STORE, and it exists
 * because that store is on DISK.
 *
 * `useListeningStore` is `persist`-wrapped over AsyncStorage, and zustand's
 * persist writes on EVERY `set` with no debounce of its own. The transport
 * ticks at 100ms (react-native-audio-api's `onPositionChangedInterval`
 * default, which nothing here overrides), so banking each report meant a
 * `JSON.stringify` plus a native store write ten times a second, for as long
 * as anything was playing, in the background as well as the foreground — on
 * the one thing this app exists to do. It also woke `useTrophyTriggers` at
 * that rate, since that hook reads this total.
 *
 * MEASURED rather than reasoned, by watching
 * `RCTAsyncLocalStorage_V1/manifest.json`'s mtime on iPhone 17 / iOS 26.5
 * while a track played. Committing per tick rewrote that file **80 times in
 * 20.0s** (mean gap 0.25s); committing in 5s blocks rewrote it at **5.02s and
 * 4.99s** spacing. Twenty times fewer writes.
 *
 * WORTH KNOWING FOR THE NEXT MEASUREMENT: the file lands at ~4/s, not the
 * tick's 10/s, because RN's AsyncStorage coalesces its own queue. So the JS
 * half — a stringify and a native module call per tick — was the larger share
 * of the cost, and reasoning from the disk rate alone would have understated
 * it. Both halves go away here.
 *
 * Five seconds is chosen against the READER, not the writer: the only thing
 * that reads this total is the `listening` trophy, whose threshold is in
 * MINUTES, so nothing can observe the granularity. Every boundary that ends a
 * stretch of listening flushes, so what a process kill can cost is under five
 * seconds of credit toward an hour.
 */
const COMMIT_THRESHOLD_S = 5;

/**
 * Banks real listening time by watching the transport's own position, so it
 * counts only sound that actually played: paused time never advances position,
 * and scrubbing forward is discarded by the step guard. Mount once, app-wide.
 */
export const useListeningTime = () => {
  const position = usePlayerStore(state => state.position);
  const playing = usePlayerStore(state => state.playing);
  const currentId = usePlayerStore(state => state.current?.id);

  // Last position seen while playing THIS sound; null whenever a comparison
  // would be meaningless (paused, stopped, or a different sound loaded).
  const lastRef = useRef<number | null>(null);
  // Listened seconds not yet written to the store — see COMMIT_THRESHOLD_S.
  const pendingRef = useRef(0);

  // Push whatever has piled up, and forget it. Called on every boundary that
  // ends a stretch of listening, so a partial block is only ever lost to a
  // kill — never to something the person did on purpose.
  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (pending <= 0) return;

    pendingRef.current = 0;
    useListeningStore.getState().add(pending);
  }, []);

  useEffect(() => {
    flush();
    lastRef.current = null;
  }, [currentId, flush]);

  useEffect(() => {
    if (!playing) {
      flush();
      lastRef.current = null;
      return;
    }

    const previous = lastRef.current;
    lastRef.current = position;

    if (previous === null) return;

    const delta = position - previous;
    if (delta <= 0 || delta > MAX_STEP_S) return;

    pendingRef.current += delta;
    if (pendingRef.current >= COMMIT_THRESHOLD_S) flush();
  }, [flush, playing, position]);

  // Sign-out and teardown: bank the last partial block rather than dropping it.
  useEffect(() => () => flush(), [flush]);
};
