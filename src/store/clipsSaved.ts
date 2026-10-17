import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// How many clips have ever been SAVED, across every sound, session and device.
// Cache plus buffer over `users/{uid}.clipsSaved`, exactly like `listening` —
// except that a save is a handful of writes in a lifetime, so the buffer is
// sent on the spot rather than at a boundary (`lib/trophyCounters`).
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
  unsynced: number;
  hasHydrated: boolean;
  saved: () => void;
  reset: () => void;
};

export const useClipsSavedStore = create<ClipsSavedState>()(
  persist(
    set => ({
      count: 0,
      unsynced: 0,
      hasHydrated: false,
      saved: () =>
        set(state => ({
          count: state.count + 1,
          unsynced: state.unsynced + 1,
        })),
      reset: () => set({ count: 0, unsynced: 0 }),
    }),
    {
      name: 'clips-saved',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ count: state.count, unsynced: state.unsynced }),
      onRehydrateStorage: () => state => {
        useClipsSavedStore.setState({ hasHydrated: true });
        void state;
      },
    },
  ),
);
