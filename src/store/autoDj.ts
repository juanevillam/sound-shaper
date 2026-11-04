import { create } from 'zustand';

import { type EffectLevel } from '@/lib/shapeDsp';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';

// ---------------------------------------------------------------------------
// AUTO DJ — whether the DJ is on, and what it knows about the
// sound in front of it. `AutoDjDirector` does the moving; this is its state.
//
// IT PLAYS THE WHOLE LIBRARY AS A SET (Juan, 2026-11-04). Switched on, it
// reads every sound once (cached after), then plays stretches of them —
// a drop here, a phrase there — cut together on downbeats with a way out
// and a way in, never the same set twice. See `lib/autoDj/set.ts`.
//
// NOTHING HERE IS PERSISTED, same as the shaper store. Keeping a mix someone
// liked ("Auto DJ 1") is the next step; a mix is its style plus its seed.
//
// THE DJ BORROWS THE SHAPE AND GIVES IT BACK. Switching it on snapshots the
// person's own shape; switching it off from its own switch restores that.
// Touching any other control in the sheet is a person taking the controls
// back — the DJ stops and leaves the sound where it is, because snapping it
// back to the pre-DJ shape under their finger would undo the move they just
// made. `stop({ restore: false })` is that path.
// ---------------------------------------------------------------------------

type Snapshot = {
  gains: number[];
  nextRoom: EffectLevel;
  echo: EffectLevel;
  rate: number;
  keepPitch: boolean;
};

/**
 * `preparing` — the library is being read and the set has not started yet.
 * `mixing` — a set is playing. Reading carries on in the background while it
 * does (`ready` of `total`).
 */
export type AutoDjStatus = 'idle' | 'preparing' | 'mixing';

type AutoDjState = {
  on: boolean;
  status: AutoDjStatus;
  /** Sounds read so far, out of `total` in the library. */
  ready: number;
  total: number;
  /** The sound the set cuts to next, once it is chosen. */
  snapshot: Snapshot | null;
  start: () => void;
  stop: (options: { restore: boolean }) => void;
  setStatus: (status: AutoDjStatus) => void;
  setProgress: (ready: number, total: number) => void;
  /** Sign-out: forget everything. The shape stores reset themselves. */
  reset: () => void;
};

const IDLE = {
  on: false,
  status: 'idle' as const,
  ready: 0,
  total: 0,
  snapshot: null,
};

const takeSnapshot = (): Snapshot => {
  const { gains, nextRoom, echo } = useShaperStore.getState();
  const { rate, keepPitch } = usePlayerStore.getState();
  return { gains: [...gains], nextRoom, echo, rate, keepPitch };
};

export const useAutoDjStore = create<AutoDjState>()((set, get) => ({
  ...IDLE,

  start: () => {
    if (get().on) return;
    set({ on: true, snapshot: takeSnapshot() });
  },

  stop: ({ restore }) => {
    const { snapshot } = get();
    set(IDLE);
    if (!restore || !snapshot) return;
    const shaper = useShaperStore.getState();
    const player = usePlayerStore.getState();
    shaper.applyGains(snapshot.gains);
    if (shaper.nextRoom !== snapshot.nextRoom)
      shaper.setNextRoom(snapshot.nextRoom);
    if (shaper.echo !== snapshot.echo) shaper.setEcho(snapshot.echo);
    if (player.rate !== snapshot.rate) player.setRate(snapshot.rate);
    if (player.keepPitch !== snapshot.keepPitch)
      player.setKeepPitch(snapshot.keepPitch);
  },

  setStatus: status => set({ status }),
  setProgress: (ready, total) => set({ ready, total }),

  reset: () => set(IDLE),
}));
