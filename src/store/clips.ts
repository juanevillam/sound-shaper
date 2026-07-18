import { create } from 'zustand';

import { type Clip } from '@/services/firebase/clips';

// Mirror of per-song `clips` subcollection subscriptions, keyed by song id
// (song ids are unique across playlists, so no composite key needed).
// `settled` flips on the first snapshot so the clips section can branch
// between "loading" and "genuinely empty" — same pattern as the songs store.
type ClipsState = {
  bySongId: Record<string, Clip[]>;
  settledBySongId: Record<string, boolean>;
  setClips: (songId: string, clips: Clip[]) => void;
  clear: () => void;
};

export const useClipsStore = create<ClipsState>()(set => ({
  bySongId: {},
  settledBySongId: {},
  setClips: (songId, clips) =>
    set(state => ({
      bySongId: { ...state.bySongId, [songId]: clips },
      settledBySongId: { ...state.settledBySongId, [songId]: true },
    })),
  clear: () => set({ bySongId: {}, settledBySongId: {} }),
}));
