import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// One row in the picker's 7-column grid, so the "Recent" strip never wraps.
const MAX_RECENT = 7;

// Most-recently-picked emoji, newest first, persisted across sessions so the
// picker can surface a quick "Recent" row above the curated grid.
type RecentEmojiState = {
  recent: string[];
  pushRecent: (emoji: string) => void;
};

export const useRecentEmojiStore = create<RecentEmojiState>()(
  persist(
    set => ({
      recent: [],
      pushRecent: emoji =>
        set(state => ({
          // Move-to-front + dedupe, capped at one row.
          recent: [emoji, ...state.recent.filter(e => e !== emoji)].slice(
            0,
            MAX_RECENT,
          ),
        })),
    }),
    {
      name: 'recent-emoji',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
