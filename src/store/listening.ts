import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Total seconds actually LISTENED, across every sound and every session. Local
// and persisted rather than in Firestore: it is a running total nobody else
// needs, written constantly, and the trophy it feeds is the only reader.
//
// `add` IS NOT CALLED PER TICK, AND MUST NOT BE. Persisting through zustand's
// `persist` means every `set` here is a `JSON.stringify` plus an AsyncStorage
// write — that middleware has no debounce of its own — so a caller banking
// each 100ms transport report put the app at ten disk writes a second for the
// whole of playback. `useListeningTime` accumulates in a ref and commits in
// blocks; see `COMMIT_THRESHOLD_S` there before adding a second writer.
type ListeningState = {
  seconds: number;
  hasHydrated: boolean;
  add: (seconds: number) => void;
  reset: () => void;
};

export const useListeningStore = create<ListeningState>()(
  persist(
    set => ({
      seconds: 0,
      hasHydrated: false,
      add: seconds =>
        set(state => ({ seconds: state.seconds + Math.max(0, seconds) })),
      reset: () => set({ seconds: 0 }),
    }),
    {
      name: 'listening',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ seconds: state.seconds }),
      onRehydrateStorage: () => state => {
        useListeningStore.setState({ hasHydrated: true });
        void state;
      },
    },
  ),
);
