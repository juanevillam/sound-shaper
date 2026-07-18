import { create } from 'zustand';

import { type Playlist } from '@/services/firebase/playlists';

// Mirror of the user's `playlists` Firestore subscription. Not persisted —
// `hasSettled` distinguishes "still waiting for the first snapshot" from
// "settled and genuinely empty" so the home screen can branch correctly.
type PlaylistsState = {
  playlists: Playlist[];
  error: Error | null;
  hasSettled: boolean;
  // Bumped by `retry` to re-attach the Firestore listener after an error: the
  // subscription hook keys its effect on this, so incrementing it tears the
  // dead listener down and re-subscribes.
  subNonce: number;
  setPlaylists: (playlists: Playlist[]) => void;
  setError: (error: Error) => void;
  retry: () => void;
  clear: () => void;
};

export const usePlaylistsStore = create<PlaylistsState>()(set => ({
  playlists: [],
  error: null,
  hasSettled: false,
  subNonce: 0,
  setPlaylists: playlists => set({ playlists, error: null, hasSettled: true }),
  setError: error => set({ error, hasSettled: true }),
  retry: () =>
    set(state => ({
      error: null,
      hasSettled: false,
      subNonce: state.subNonce + 1,
    })),
  // Runs as the subscription effect's cleanup; leaves `subNonce` alone (it
  // must stay monotonic or the re-subscribe would loop).
  clear: () => set({ playlists: [], error: null, hasSettled: false }),
}));
