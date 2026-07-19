import { useEffect } from 'react';

import { subscribeToSongs } from '@/services/firebase/songs';
import { useSongsStore } from '@/store/songs';

/**
 * Keep the flat library slice in sync with users/{uid}/songs for the whole
 * session (mounted once in the authenticated layout).
 */
export const useSongsSubscription = () => {
  const setSongs = useSongsStore(s => s.setSongs);
  const setError = useSongsStore(s => s.setError);
  // Re-attaches the listener when the user retries after an error.
  const subNonce = useSongsStore(s => s.subNonce);

  useEffect(
    () =>
      subscribeToSongs({
        onNext: setSongs,
        onError: setError,
      }),
    [setSongs, setError, subNonce],
  );
};
