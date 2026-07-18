import { useEffect } from 'react';

import { subscribeToUserProfile } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

/**
 * Keep the signed-in user's Firestore profile (username and friends) in sync.
 * Mounted once in the authenticated layout.
 */
export const useOwnProfileSync = () => {
  const uid = useAuthStore(s => s.user?.uid);
  const setProfile = useProfileStore(s => s.setProfile);
  const clear = useProfileStore(s => s.clear);

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToUserProfile({
      uid,
      onNext: setProfile,
      onError: () => {},
    });

    return () => {
      unsubscribe();
      clear();
    };
  }, [uid, setProfile, clear]);
};
