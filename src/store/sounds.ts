import { create } from 'zustand';

import { type Sound } from '@/services/firebase/sounds';

// Mirror of the ONE flat library subscription (users/{uid}/sounds, newest
// first). `hasSettled` flips on the first snapshot so home can branch between
// "loading" and "genuinely empty".
type SoundsState = {
  sounds: Sound[];
  error: Error | null;
  hasSettled: boolean;
  // Bumped by `retry` to re-attach a dead listener after an error.
  subNonce: number;
  setSounds: (sounds: Sound[]) => void;
  setError: (error: Error) => void;
  retry: () => void;
  clear: () => void;
};

export const useSoundsStore = create<SoundsState>()(set => ({
  sounds: [],
  error: null,
  hasSettled: false,
  subNonce: 0,
  setSounds: sounds => set({ sounds, error: null, hasSettled: true }),
  setError: error => set({ error, hasSettled: true }),
  retry: () =>
    set(state => ({
      error: null,
      hasSettled: false,
      subNonce: state.subNonce + 1,
    })),
  clear: () => set({ sounds: [], error: null, hasSettled: false }),
}));
