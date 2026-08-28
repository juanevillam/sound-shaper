import { useEffect, useRef } from 'react';

import {
  configureGoogleSignIn,
  consumeManualSignOutFlag,
  subscribeToAuthChanges,
} from '@/services/firebase/auth';
import { upsertOwnProfile } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useClipsStore } from '@/store/clips';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { useListeningStore } from '@/store/listening';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';
import { useSoundsStore } from '@/store/sounds';

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
        // including live playback (the sounds belong to the signed-out account).
        usePlayerStore.getState().reset();
        useSoundsStore.getState().clear();
        useClipsStore.getState().clear();
        useProfileStore.getState().clear();
        /**
         * THE TWO PERSISTED TROPHY COUNTERS ARE USER-SCOPED TOO, and they were
         * the ones this wipe missed. Both are AsyncStorage-backed running
         * totals — minutes listened, clips ever saved — and both feed
         * `useTrophyTriggers`, so a second account signing in on this device
         * inherited the first one's totals and was handed `Listener` and
         * `Splicer` (and the platinum that needs them) off somebody else's
         * activity. A device-local cache is not a device-local FACT: these
         * count what a PERSON did.
         *
         * Same class as Topper's recent searches, which its own cache audit
         * found in this exact list (2026-08-28).
         */
        useListeningStore.getState().reset();
        useClipsSavedStore.getState().reset();
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
