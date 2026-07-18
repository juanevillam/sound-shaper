import { useEffect } from 'react';

import { subscribeToSongs } from '@/services/firebase/songs';
import { useSongsStore } from '@/store/songs';

/**
 * Keep the per-playlist songs slice in sync with the `songs` subcollection
 * while a detail screen is mounted. The slice is intentionally NOT cleared on
 * unmount: re-entering a playlist shows the cached songs instantly
 * (stale-while-revalidate — the fresh snapshot replaces them moments later).
 */
export const useSongsSubscription = (playlistId: string | undefined) => {
  const setSongs = useSongsStore(s => s.setSongs);
  const setError = useSongsStore(s => s.setError);
  // Re-attaches the listener when the user retries after an error.
  const subNonce = useSongsStore(s => s.subNonce);

  useEffect(() => {
    if (!playlistId) return;

    const unsubscribe = subscribeToSongs({
      playlistId,
      onNext: songs => setSongs(playlistId, songs),
      onError: error => setError(playlistId, error),
    });

    return unsubscribe;
  }, [playlistId, setSongs, setError, subNonce]);
};
