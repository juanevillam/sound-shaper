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
import { reported } from '@/services/firebase/crashlytics';
import { type AwardedTrophy, type TrophyPersistenceAdapter } from '@/trophies';

/**
 * Firestore-backed persistence for one user's trophies, stored at
 * `users/{uid}/trophies/{trophyId}` with a server `achievedAt` — so earned
 * trophies survive a reinstall. Plugged into the app-agnostic engine via
 * `configureTrophies`; the engine's zustand cache fronts these reads/writes, so
 * neither call ever blocks a popup.
 *
 * BOTH CALLS ARE REPORTED HERE, because the engine swallows their failures on
 * purpose (a failed load reads as "nothing earned yet", a failed save leaves
 * the award in the session's cache only) and, being app-agnostic, cannot reach
 * Crashlytics itself. Swallowed and unreported, a broken rule or path would
 * have had no symptom at all.
 */
export const createTrophyAdapter = (uid: string): TrophyPersistenceAdapter => ({
  load: reported('trophies.load', async () => {
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
  }),

  // The award time is the server's, not the optimistic client value — so a
  // reload shows the canonical date. `merge` keeps the write idempotent.
  save: reported('trophies.save', async (trophyId: string) => {
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
  }),
});
