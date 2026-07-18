import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import {
  USERNAMES_COLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

export type UserProfile = {
  createdAt: number | null;
  displayName: string | null;
  photoUrl: string | null;
  uid: string;
  updatedAt: number | null;
  username: string | null;
  usernameLower: string | null;
  // One-shot flag: the default "My library" playlist has been created for this
  // account (guards against recreating it after the user deletes it).
  libraryCreated: boolean;
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

type ClaimUsernameParams = {
  uid: string;
  username: string;
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
    username: (data.username as string) ?? null,
    usernameLower: (data.usernameLower as string) ?? null,
    libraryCreated: (data.libraryCreated as boolean) ?? false,
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
      username: null,
      usernameLower: null,
      libraryCreated: false,
    });
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

/** Stamp the one-shot "default playlist created" flag on the profile doc. */
export const markLibraryCreated = reported(
  'users.markLibraryCreated',
  async (uid: string): Promise<void> => {
    await setDoc(
      doc(getFirestore(), USERS_COLLECTION, uid),
      { libraryCreated: true },
      { merge: true },
    );
  },
);

/**
 * Reserve `username` for `uid` atomically: rejects with `username-taken` when
 * another uid holds it, and frees the previous reservation on rename.
 */
export const claimUsername = reported(
  'users.claimUsername',
  async ({ uid, username }: ClaimUsernameParams): Promise<void> => {
    const db = getFirestore();
    const usernameLower = username.toLowerCase();
    const usernameRef = doc(db, USERNAMES_COLLECTION, usernameLower);
    const userRef = doc(db, USERS_COLLECTION, uid);

    await runTransaction(db, async tx => {
      const existing = await tx.get(usernameRef);

      if (
        existing.exists() &&
        (existing.data() as { uid?: string })?.uid !== uid
      )
        throw new Error('username-taken');

      const userSnapshot = await tx.get(userRef);
      const previousLower =
        (userSnapshot.data() as { usernameLower?: string | null } | undefined)
          ?.usernameLower ?? null;

      if (previousLower && previousLower !== usernameLower)
        tx.delete(doc(db, USERNAMES_COLLECTION, previousLower));

      tx.set(usernameRef, { uid });
      tx.set(
        userRef,
        {
          updatedAt: serverTimestamp(),
          username,
          usernameLower,
        },
        { merge: true },
      );
    });
  },
);
