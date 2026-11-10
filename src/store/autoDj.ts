import { create } from 'zustand';

import { type TranslationKey } from '@/i18n';
import { type AutoDjMode, type DjFocus } from '@/lib/autoDj/plan';
import { type EffectLevel } from '@/lib/shapeDsp';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';

// ---------------------------------------------------------------------------
// AUTO DJ (DJ JUAN) — whether the DJ is on, which mode it runs ('sound' or
// 'all'), which control it just moved (`focus`), and what it knows about the
// sound in front of it. `AutoDjDirector` does the moving; this is its state.
//
// TWO MODES:
//   - `sound` (This Sound): mixes ONLY the playing sound from start to end,
//     playing with all Shape controls across the whole track, and continuously
//     re-mixing that same sound when it finishes.
//   - `all` (All Sounds): reads every sound once (cached after), then plays
//     stretches of them — a drop here, a phrase there — cut together on
//     downbeats with a way out and a way in, never the same set twice.
//     See `lib/autoDj/set.ts`.
//
// NOTHING HERE IS PERSISTED, same as the shaper store.
//
// THE DJ BORROWS THE SHAPE AND GIVES IT BACK. Switching it on snapshots the
// person's own shape; switching it off from its own picker restores that.
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
  mode: AutoDjMode;
  status: AutoDjStatus;
  /** The section of the Shape sheet the DJ most recently changed. */
  focus: DjFocus | null;
  /** Sounds read so far, out of `total` in the library. */
  ready: number;
  total: number;
  /** The person's shape before DJ Juan took over. */
  snapshot: Snapshot | null;
  setMode: (mode: AutoDjMode) => void;
  start: (mode?: 'sound' | 'all') => void;
  stop: (options: { restore: boolean }) => void;
  setStatus: (status: AutoDjStatus) => void;
  setFocus: (focus: DjFocus | null) => void;
  setProgress: (ready: number, total: number) => void;
  /** Sign-out: forget everything. The shape stores reset themselves. */
  reset: () => void;
};

const IDLE = {
  on: false,
  mode: 'off' as AutoDjMode,
  status: 'idle' as const,
  focus: null as DjFocus | null,
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

  setMode: mode => {
    if (mode === 'off') {
      get().stop({ restore: true });
      return;
    }
    const { on, snapshot } = get();
    set({
      on: true,
      mode,
      focus: null,
      snapshot: on && snapshot ? snapshot : takeSnapshot(),
    });
  },

  start: (mode = 'all') => {
    get().setMode(mode);
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
  setFocus: focus => {
    if (get().focus !== focus) set({ focus });
  },
  setProgress: (ready, total) => set({ ready, total }),

  reset: () => set(IDLE),
}));

export const autoDjModeLabel = (
  t: (key: TranslationKey) => string,
  mode: AutoDjMode,
): string => {
  switch (mode) {
    case 'sound':
      return t('player.autoDjMode.sound');
    case 'all':
      return t('player.autoDjMode.all');
    default:
      return t('player.autoDjMode.off');
  }
};
