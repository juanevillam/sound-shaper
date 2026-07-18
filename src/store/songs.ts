import { create } from 'zustand';

import { type Song } from '@/services/firebase/songs';

// Mirror of per-playlist `songs` subcollection subscriptions, keyed by
// playlist id. `settled` flips on the first snapshot so detail screens can
// branch between "loading" and "genuinely empty".
type SongsState = {
  byPlaylistId: Record<string, Song[]>;
  errorByPlaylistId: Record<string, Error | null>;
  settledByPlaylistId: Record<string, boolean>;
  // Bumped by `retryPlaylist` to re-attach a dead per-playlist listener after
  // an error; only one detail screen is mounted at a time, so a single global
  // nonce is enough.
  subNonce: number;
  setSongs: (playlistId: string, songs: Song[]) => void;
  setError: (playlistId: string, error: Error) => void;
  retryPlaylist: (playlistId: string) => void;
  clear: () => void;
};

export const useSongsStore = create<SongsState>()(set => ({
  byPlaylistId: {},
  errorByPlaylistId: {},
  settledByPlaylistId: {},
  subNonce: 0,
  setSongs: (playlistId, songs) =>
    set(state => ({
      byPlaylistId: { ...state.byPlaylistId, [playlistId]: songs },
      errorByPlaylistId: { ...state.errorByPlaylistId, [playlistId]: null },
      settledByPlaylistId: {
        ...state.settledByPlaylistId,
        [playlistId]: true,
      },
    })),
  setError: (playlistId, error) =>
    set(state => ({
      errorByPlaylistId: { ...state.errorByPlaylistId, [playlistId]: error },
      settledByPlaylistId: {
        ...state.settledByPlaylistId,
        [playlistId]: true,
      },
    })),
  retryPlaylist: playlistId =>
    set(state => ({
      errorByPlaylistId: { ...state.errorByPlaylistId, [playlistId]: null },
      settledByPlaylistId: {
        ...state.settledByPlaylistId,
        [playlistId]: false,
      },
      subNonce: state.subNonce + 1,
    })),
  clear: () =>
    set({
      byPlaylistId: {},
      errorByPlaylistId: {},
      settledByPlaylistId: {},
    }),
}));
