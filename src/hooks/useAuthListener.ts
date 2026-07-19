import { useEffect, useRef } from 'react';

import {
  configureGoogleSignIn,
  consumeManualSignOutFlag,
  subscribeToAuthChanges,
} from '@/services/firebase/auth';
import { upsertOwnProfile } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';
import { useSongsStore } from '@/store/songs';

/**
 * Bridge Firebase auth into the zustand store. Mounted once in the root layout;
 * the first callback resolves the splash-screen gate. On sign-in it also
 * refreshes the user's Firestore profile doc.
 */
export const useAuthListener = () => {
  const setUser = useAuthStore(s => s.setUser);
  const clearUser = useAuthStore(s => s.clearUser);
  const wasAuthedRef = useRef(false);

  useEffect(() => {
    configureGoogleSignIn();

    return subscribeToAuthChanges(user => {
      if (!user) {
        const wasManual = consumeManualSignOutFlag();

        // Wipe every user-scoped store so the next account starts clean —
        // including live playback (the songs belong to the signed-out account).
        usePlayerStore.getState().reset();
        useSongsStore.getState().clear();
        useClipsStore.getState().clear();
        useProfileStore.getState().clear();
        clearUser({ sessionExpired: wasAuthedRef.current && !wasManual });
        wasAuthedRef.current = false;
        return;
      }

      wasAuthedRef.current = true;
      setUser({
        displayName: user.displayName,
        email: user.email,
        photoUrl: user.photoURL,
        uid: user.uid,
      });

      // Fire-and-forget: the service layer records the failure as a Crashlytics
      // non-fatal; the warn is dev-only visibility.
      upsertOwnProfile({
        displayName: user.displayName,
        photoUrl: user.photoURL,
        uid: user.uid,
      }).catch((error: unknown) => {
        if (__DEV__) console.warn('upsertOwnProfile failed:', error);
      });
    });
  }, [setUser, clearUser]);
};
