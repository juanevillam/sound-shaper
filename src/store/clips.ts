import { create } from 'zustand';

import { type Clip } from '@/services/firebase/clips';

// Mirror of per-sound `clips` subcollection subscriptions, keyed by sound id
// (sound ids are unique across playlists, so no composite key needed).
// `settled` flips on the first snapshot so the clips section can branch
// between "loading" and "genuinely empty" — same pattern as the sounds store.
type ClipsState = {
  bySoundId: Record<string, Clip[]>;
  settledBySoundId: Record<string, boolean>;
  setClips: (soundId: string, clips: Clip[]) => void;
  clear: () => void;
};

export const useClipsStore = create<ClipsState>()(set => ({
  bySoundId: {},
  settledBySoundId: {},
  setClips: (soundId, clips) =>
    set(state => ({
      bySoundId: { ...state.bySoundId, [soundId]: clips },
      settledBySoundId: { ...state.settledBySoundId, [soundId]: true },
    })),
  clear: () => set({ bySoundId: {}, settledBySoundId: {} }),
}));
