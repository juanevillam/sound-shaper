import { create } from 'zustand';

import { type Clip } from '@/services/firebase/clips';

// Mirror of per-sound `clips` subcollection subscriptions, keyed by sound id
// (sound ids are unique across playlists, so no composite key needed).
// `settled` flips on the first snapshot so the clips section can branch
// between "loading" and "genuinely empty" — same pattern as the sounds store.
//
// A LISTENER ERROR SETTLES TOO. It used to be swallowed, so `settled` never
// turned and the sheet span forever; now it is held per sound, and `retry`
// bumps `retryNonce` so the subscription hook re-attaches the dead listener
// — the sounds store's shape.
type ClipsState = {
  bySoundId: Record<string, Clip[]>;
  settledBySoundId: Record<string, boolean>;
  failedBySoundId: Record<string, boolean>;
  retryNonce: number;
  setClips: (soundId: string, clips: Clip[]) => void;
  setFailed: (soundId: string) => void;
  retry: () => void;
  clear: () => void;
};

export const useClipsStore = create<ClipsState>()(set => ({
  bySoundId: {},
  settledBySoundId: {},
  failedBySoundId: {},
  retryNonce: 0,
  setClips: (soundId, clips) =>
    set(state => ({
      bySoundId: { ...state.bySoundId, [soundId]: clips },
      settledBySoundId: { ...state.settledBySoundId, [soundId]: true },
      failedBySoundId: { ...state.failedBySoundId, [soundId]: false },
    })),
  setFailed: soundId =>
    set(state => ({
      settledBySoundId: { ...state.settledBySoundId, [soundId]: true },
      failedBySoundId: { ...state.failedBySoundId, [soundId]: true },
    })),
  retry: () =>
    set(state => ({
      failedBySoundId: {},
      // Unsettle the failed sounds so the spinner, not the error, shows while
      // the listener re-attaches.
      settledBySoundId: Object.fromEntries(
        Object.entries(state.settledBySoundId).filter(
          ([id]) => !state.failedBySoundId[id],
        ),
      ),
      retryNonce: state.retryNonce + 1,
    })),
  clear: () =>
    set({ bySoundId: {}, settledBySoundId: {}, failedBySoundId: {} }),
}));
