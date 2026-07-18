import { useEffect } from 'react';

import { subscribeToUserPlaylists } from '@/services/firebase/playlists';
import { useAuthStore } from '@/store/auth';
import { usePlaylistsStore } from '@/store/playlists';

/**
 * Keep the playlists store in sync with the signed-in user's Firestore
 * playlists. Mounted app-wide by `(app)/_layout`; tears down (and clears the
 * store) on sign-out.
 */
export const usePlaylistsSubscription = () => {
  const uid = useAuthStore(s => s.user?.uid);
  const setPlaylists = usePlaylistsStore(s => s.setPlaylists);
  const setError = usePlaylistsStore(s => s.setError);
  const clear = usePlaylistsStore(s => s.clear);
  // Re-attaches the listener when the user retries after an error.
  const subNonce = usePlaylistsStore(s => s.subNonce);

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToUserPlaylists({
      ownerId: uid,
      onNext: setPlaylists,
      onError: setError,
    });

    return () => {
      unsubscribe();
      clear();
    };
  }, [uid, setPlaylists, setError, clear, subNonce]);
};
