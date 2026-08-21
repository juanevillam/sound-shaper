import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { USERS_COLLECTION } from '@/services/firebase/collections';
import { reported } from '@/services/firebase/crashlytics';

// Personal-only: the profile doc is just the signed-in identity snapshot
// (usernames were dropped 2026-07-20 along with the whole account section).
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

const profileToModel = (snapshot: QueryDocumentSnapshot): UserProfile => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;

  return {
    createdAt: createdAt ? createdAt.toMillis() : null,
    displayName: (data.displayName as string) ?? null,
    photoUrl: (data.photoURL as string) ?? null,
    uid: snapshot.id,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
  };
};

/** Create or refresh the signed-in user's profile doc after auth resolves. */
export const upsertOwnProfile = reported(
  'users.upsertOwnProfile',
  async ({
    displayName,
    photoUrl,
    uid,
  }: UpsertOwnProfileParams): Promise<void> => {
    const ref = doc(getFirestore(), USERS_COLLECTION, uid);
    const existing = await getDoc(ref);

    await setDoc(
      ref,
      {
        displayName,
        photoURL: photoUrl,
        updatedAt: serverTimestamp(),
        ...(existing.exists() && existing.get('createdAt') !== undefined
          ? null
          : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  },
);

/**
 * ONE READ, NOT A LISTENER — and the shape of the data is the reason.
 *
 * This doc holds a display name, a photo and a creation date. Only THIS device
 * ever writes it (`upsertOwnProfile`, once per sign-in), and the only surface
 * that reads it is the Account sheet's "member since" row. A live listener over
 * it was held open for the entire session, from the authenticated layout, to
 * keep a date that cannot change in sync with a screen almost nobody opens.
 *
 * A listener is the right tool for data OTHER writers change while you are
 * looking at it. This is the other kind: fetch it when the screen that reads it
 * appears, keep it in the store so a second visit is instant.
 */
export const fetchUserProfile = reported(
  'users.fetchUserProfile',
  async (uid: string): Promise<UserProfile | null> => {
    const snapshot = await getDoc(doc(getFirestore(), USERS_COLLECTION, uid));

    if (!snapshot.exists()) return null;

    return profileToModel(snapshot as unknown as QueryDocumentSnapshot);
  },
);
