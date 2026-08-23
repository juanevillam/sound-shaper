import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// How many clips have ever been SAVED, across every sound and every session.
// Local and persisted, exactly like `listening`: it is a running total nobody
// else needs and the trophy it feeds is the only reader.
//
// IT CANNOT COME OUT OF THE CLIPS CACHE, which is the whole reason it exists.
// `useClipsStore` holds only the sounds you have opened this session, so it can
// answer "how many clips does this sound have" and never "how many have you
// made" — the same limitation that already sends `first-clip` to its save site
// rather than to a store.
//
// IT ONLY GOES UP. Deleting a clip does not take the count back: the trophy
// records something a person DID, and the engine is idempotent anyway, so an
// award never depends on the total still standing.
type ClipsSavedState = {
  count: number;
  hasHydrated: boolean;
  saved: () => void;
  reset: () => void;
};

export const useClipsSavedStore = create<ClipsSavedState>()(
  persist(
    set => ({
      count: 0,
      hasHydrated: false,
      saved: () => set(state => ({ count: state.count + 1 })),
      reset: () => set({ count: 0 }),
    }),
    {
      name: 'clips-saved',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ count: state.count }),
      onRehydrateStorage: () => state => {
        useClipsSavedStore.setState({ hasHydrated: true });
        void state;
      },
    },
  ),
);
