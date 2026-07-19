import { create } from 'zustand';

import { type Song } from '@/services/firebase/songs';

// Mirror of the ONE flat library subscription (users/{uid}/songs, newest
// first). `hasSettled` flips on the first snapshot so home can branch between
// "loading" and "genuinely empty".
type SongsState = {
  songs: Song[];
  error: Error | null;
  hasSettled: boolean;
  // Bumped by `retry` to re-attach a dead listener after an error.
  subNonce: number;
  setSongs: (songs: Song[]) => void;
  setError: (error: Error) => void;
  retry: () => void;
  clear: () => void;
};

export const useSongsStore = create<SongsState>()(set => ({
  songs: [],
  error: null,
  hasSettled: false,
  subNonce: 0,
  setSongs: songs => set({ songs, error: null, hasSettled: true }),
  setError: error => set({ error, hasSettled: true }),
  retry: () =>
    set(state => ({
      error: null,
      hasSettled: false,
      subNonce: state.subNonce + 1,
    })),
  clear: () => set({ songs: [], error: null, hasSettled: false }),
}));
