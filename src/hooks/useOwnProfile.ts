import { useEffect } from 'react';

import { fetchUserProfile } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

/**
 * Load the signed-in user's Firestore profile — ONE read, from the screen that
 * reads it, not a session-wide listener from the authenticated layout.
 *
 * It was the latter: a live `users/{uid}` listener held open for the whole
 * session so that one row of the Account sheet could show a creation date that
 * cannot change. Nobody else writes the doc (`upsertOwnProfile` runs on this
 * device, once per sign-in), so there was never anything to be live ABOUT.
 *
 * The store is still shared, and that is what makes the fetch invisible: the
 * second time the sheet opens, its values are already there and the read below
 * only refreshes them. `clear` on sign-out lives in the auth listener, so the
 * next account never sees the previous one's dates.
 */
export const useOwnProfile = () => {
  const uid = useAuthStore(s => s.user?.uid);
  const setProfile = useProfileStore(s => s.setProfile);

  useEffect(() => {
    if (!uid) return;

    let active = true;

    fetchUserProfile(uid)
      .then(profile => {
        if (active) setProfile(profile);
      })
      // A failed read leaves whatever the store already had. The sheet's own
      // `hasSettled` branch covers a first visit that never resolves.
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [uid, setProfile]);
};
