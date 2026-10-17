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
 * SINCE 2026-10-16 THE LAUNCH ALREADY READS IT: `upsertOwnProfile` seeds the
 * store from the one read it makes per launch, so this fetch runs only while
 * that answer lacks the creation date — a brand-new account, whose upsert
 * wrote `createdAt` as a server timestamp it cannot read back yet. Re-reading
 * on every open was one server read per visit for values already in hand. `clear` on sign-out lives in the auth listener, so the
 * next account never sees the previous one's dates.
 */
export const useOwnProfile = () => {
  const uid = useAuthStore(s => s.user?.uid);
  const setProfile = useProfileStore(s => s.setProfile);
  const knowsCreatedAt = useProfileStore(s => s.profile?.createdAt != null);

  useEffect(() => {
    if (!uid || knowsCreatedAt) return;

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
  }, [uid, knowsCreatedAt, setProfile]);
};
