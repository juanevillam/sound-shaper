import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { USERS_COLLECTION } from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

// Personal-only: the profile doc is just the signed-in identity snapshot
// (usernames were dropped 2026-07-20 along with the whole account section).
export type UserProfile = {
  createdAt: number | null;
  displayName: string | null;
  photoUrl: string | null;
  uid: string;
  updatedAt: number | null;
};

type SubscribeToUserProfileParams = {
  onError: (error: Error) => void;
  onNext: (profile: UserProfile | null) => void;
  uid: string;
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

export const subscribeToUserProfile = ({
  onError,
  onNext,
  uid,
}: SubscribeToUserProfileParams): (() => void) =>
  onSnapshot(doc(getFirestore(), USERS_COLLECTION, uid), {
    error: reportedOnError('users.subscribeToUserProfile', onError),
    next: snapshot => {
      if (!snapshot?.exists()) {
        onNext(null);
        return;
      }

      onNext(profileToModel(snapshot as unknown as QueryDocumentSnapshot));
    },
  });
