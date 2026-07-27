import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Total seconds actually LISTENED, across every sound and every session. Local
// and persisted rather than in Firestore: it is a running total nobody else
// needs, written constantly, and the trophy it feeds is the only reader.
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
