import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { USERS_COLLECTION } from '@/services/firebase/collections';
import { reported } from '@/services/firebase/crashlytics';

export type UserProfile = {
  createdAt: number | null;
  displayName: string | null;
  photoUrl: string | null;
  uid: string;
  updatedAt: number | null;
};

type UpsertOwnProfileParams = {
  displayName: string | null;
  photoUrl: string | null;
  uid: string;
};

/**
 * Create or refresh the signed-in user's profile doc after auth resolves.
 * P0 keeps this minimal (name + photo); the discovery/search fields (username,
 * searchTokens, counters) land with the social phase.
 */
export const upsertOwnProfile = reported(
  'users.upsertOwnProfile',
  async ({
    displayName,
    photoUrl,
    uid,
  }: UpsertOwnProfileParams): Promise<void> => {
    const ref = doc(getFirestore(), USERS_COLLECTION, uid);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      await setDoc(
        ref,
        {
          displayName,
          photoURL: photoUrl,
          updatedAt: serverTimestamp(),
          ...(existing.get('createdAt') === undefined
            ? { createdAt: serverTimestamp() }
            : null),
        },
        { merge: true },
      );
      return;
    }

    await setDoc(ref, {
      createdAt: serverTimestamp(),
      displayName,
      photoURL: photoUrl,
      updatedAt: serverTimestamp(),
    });
  },
);

/** Reads the signed-in user's profile doc once (unused placeholder for now). */
export const getOwnProfile = reported(
  'users.getOwnProfile',
  async (uid: string): Promise<UserProfile | null> => {
    const snapshot = await getDoc(doc(getFirestore(), USERS_COLLECTION, uid));

    if (!snapshot.exists()) return null;

    const data = snapshot.data() ?? {};
    const createdAt = data.createdAt as Timestamp | undefined;
    const updatedAt = data.updatedAt as Timestamp | undefined;

    return {
      createdAt: createdAt ? createdAt.toMillis() : null,
      displayName: (data.displayName as string) ?? null,
      photoUrl: (data.photoURL as string) ?? null,
      uid: snapshot.id,
      updatedAt: updatedAt ? updatedAt.toMillis() : null,
    };
  },
);
