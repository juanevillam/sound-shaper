import { useEffect, useRef } from 'react';

import { useI18n } from '@/i18n';
import { createDefaultPlaylist } from '@/services/firebase/playlists';
import { markLibraryCreated } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

/**
 * Every account starts with one playlist — "My library" — created once, on the
 * first session that finds the profile flag unset. The flag (not the
 * playlist's existence) is the guard, so deleting the default later doesn't
 * resurrect it. Named in the user's CURRENT locale at creation; a regular,
 * fully editable playlist from then on.
 */
export const useEnsureDefaultPlaylist = () => {
  const { t } = useI18n();
  const uid = useAuthStore(s => s.user?.uid);
  const profile = useProfileStore(s => s.profile);
  // One shot per session: the profile snapshot lags the flag write, so without
  // this a fast re-render could fire the (idempotent) create twice.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!uid || !profile || profile.libraryCreated || firedRef.current) return;

    firedRef.current = true;

    (async () => {
      await createDefaultPlaylist({
        name: t('home.defaultPlaylist'),
        ownerId: uid,
      });
      await markLibraryCreated(uid);
    })().catch((error: unknown) => {
      // Reported by the service layer; allow a retry on the next session.
      if (__DEV__) console.warn('ensureDefaultPlaylist failed:', error);
    });
  }, [uid, profile, t]);
};
