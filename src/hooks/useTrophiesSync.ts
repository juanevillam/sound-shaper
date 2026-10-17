import { useEffect } from 'react';

import { TROPHY_CONFIGS } from '@/constants/trophies';
import { createTrophyAdapter } from '@/services/firebase/trophies';
import { useAuthStore } from '@/store/auth';
import { configureTrophies, resetTrophies } from '@/trophies';

/**
 * Points the trophy engine at the signed-in user and hydrates their awarded
 * trophies from Firestore. Re-runs on account switch (the cleanup resets first,
 * so the next user never inherits the previous one's cache) and clears
 * everything on sign-out. Mount once, app-wide, beside the other authenticated
 * subscriptions.
 */
export const useTrophiesSync = () => {
  const uid = useAuthStore(state => state.user?.uid);

  useEffect(() => {
    if (!uid) return;

    configureTrophies(TROPHY_CONFIGS, createTrophyAdapter(uid));

    return () => resetTrophies();
  }, [uid]);
};
