import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// How the home grid is ordered. Persisted so the library opens the way you
// left it (the Firestore query stays newest-first; ordering is client-side —
// the whole personal library is already in memory).

export const SORT_MODES = ['recent', 'oldest', 'title', 'artist'] as const;

export type SortMode = (typeof SORT_MODES)[number];

type LibraryState = {
  sortMode: SortMode;
  setSortMode: (sortMode: SortMode) => void;
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    set => ({
      sortMode: 'recent',
      setSortMode: sortMode => set({ sortMode }),
    }),
    {
      name: 'library',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
