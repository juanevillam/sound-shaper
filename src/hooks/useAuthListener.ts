import { useEffect, useRef } from 'react';

import { clearMirror } from '@/lib/offlineAudio';
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
import { useOfflineStore } from '@/store/offline';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';
import { useShaperStore } from '@/store/shaper';
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
        /**
         * AND THE CURVE, which is the third store feeding the same trophy and
         * the one this list missed twice. `useTrophyTriggers` reads
         * `rate !== 1 || gains.some(...)`: `rate` is cleared by the player
         * reset above, `gains` lives in the shaper store and was cleared by
         * nobody, so a second account inherited a shaped EQ and was handed
         * First Shape for it. `reset` also puts the audio engine's own module
         * copy of the curve back to flat — see the store.
         */
        useShaperStore.getState().reset();
        /**
         * AND THE MIRRORED AUDIO, which is the same rule one level down: the
         * mp3s on disk are the signed-out account's sounds, and the ids they
         * are filed under belong to that account's documents. Fire-and-forget
         * — a sign-out must not wait on a directory delete — and the next
         * session mirrors what it finds.
         */
        useOfflineStore.getState().clear();
        void clearMirror();
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
