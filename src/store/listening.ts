import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Total seconds actually LISTENED, across every sound, every session and every
// device. The FACT lives on `users/{uid}.listenedSeconds` (gate 2d, 2026-10-16:
// a lifetime total is a fact about a PERSON, and kept on the phone it reset
// with every reinstall and every second device). This store is its CACHE plus
// a BUFFER: `seconds` is the best-known total, `unsynced` the part of it the
// server has not been sent yet. `lib/trophyCounters` moves one into the other.
//
// `add` IS NOT CALLED PER TICK, AND MUST NOT BE. Persisting through zustand's
// `persist` means every `set` here is a `JSON.stringify` plus an AsyncStorage
// write — that middleware has no debounce of its own — so a caller banking
// each 100ms transport report put the app at ten disk writes a second for the
// whole of playback. `useListeningTime` accumulates in a ref and commits in
// blocks; see `COMMIT_THRESHOLD_S` there before adding a second writer.
type ListeningState = {
  seconds: number;
  unsynced: number;
  hasHydrated: boolean;
  add: (seconds: number) => void;
  reset: () => void;
};

export const useListeningStore = create<ListeningState>()(
  persist(
    set => ({
      seconds: 0,
      unsynced: 0,
      hasHydrated: false,
      add: seconds =>
        set(state => {
          const delta = Math.max(0, seconds);
          return {
            seconds: state.seconds + delta,
            unsynced: state.unsynced + delta,
          };
        }),
      reset: () => set({ seconds: 0, unsynced: 0 }),
    }),
    {
      name: 'listening',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        seconds: state.seconds,
        unsynced: state.unsynced,
      }),
      onRehydrateStorage: () => state => {
        useListeningStore.setState({ hasHydrated: true });
        void state;
      },
    },
  ),
);
