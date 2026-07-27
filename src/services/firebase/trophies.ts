import {
  type AwardedTrophy,
  type TrophyPersistenceAdapter,
} from '@portfolio/trophies';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from '@react-native-firebase/firestore';

import {
  TROPHIES_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';

/**
 * Firestore-backed persistence for one user's trophies, stored at
 * `users/{uid}/trophies/{trophyId}` with a server `achievedAt` — so earned
 * trophies survive a reinstall. Plugged into the app-agnostic engine via
 * `configureTrophies`; the engine's zustand cache fronts these reads/writes, so
 * neither call ever blocks a popup.
 */
export const createTrophyAdapter = (uid: string): TrophyPersistenceAdapter => ({
  load: async () => {
    const snapshot = await getDocs(
      collection(getFirestore(), USERS_COLLECTION, uid, TROPHIES_SUBCOLLECTION),
    );

    const awarded: Record<string, AwardedTrophy> = {};
    snapshot.docs.forEach(trophyDoc => {
      const achievedAt = trophyDoc.data().achievedAt as Timestamp | undefined;
      awarded[trophyDoc.id] = {
        achievedAt: achievedAt?.toMillis() ?? Date.now(),
      };
    });

    return awarded;
  },

  // The award time is the server's, not the optimistic client value — so a
  // reload shows the canonical date. `merge` keeps the write idempotent.
  save: async (trophyId: string) => {
    await setDoc(
      doc(
        getFirestore(),
        USERS_COLLECTION,
        uid,
        TROPHIES_SUBCOLLECTION,
        trophyId,
      ),
      { achievedAt: serverTimestamp() },
      { merge: true },
    );
  },
});
