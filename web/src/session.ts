import { useEffect, useState } from 'react';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { USERS_COLLECTION } from '@app/services/firebase/collections';

import { auth, db } from './firebase';

export type Session =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'signed-in'; user: User };

/**
 * The web twin of the app's `upsertOwnProfile`
 * (src/services/firebase/users.ts): one read per sign-in, and a write only
 * when the identity changed, so `updatedAt` keeps meaning what it means
 * there.
 */
const upsertOwnProfile = async (user: User): Promise<void> => {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const existing = await getDoc(ref);
  const data = existing.exists() ? existing.data() : {};
  const hasCreatedAt = data.createdAt !== undefined;
  const displayName = user.displayName;
  const photoURL = user.photoURL;

  if (
    hasCreatedAt &&
    data.displayName === displayName &&
    data.photoURL === photoURL
  )
    return;

  await setDoc(
    ref,
    {
      displayName,
      photoURL,
      updatedAt: serverTimestamp(),
      ...(hasCreatedAt ? null : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
};

export const useSession = (): Session => {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(
    () =>
      onAuthStateChanged(auth, user => {
        setSession(
          user ? { state: 'signed-in', user } : { state: 'signed-out' },
        );
        if (user)
          upsertOwnProfile(user).catch(error =>
            console.warn('upsertOwnProfile', error),
          );
      }),
    [],
  );

  return session;
};

/**
 * Google in a popup. Resolves false when the person closes it — the same
 * "dismissed is not an error" the app's sheet has.
 */
export const signInWithGoogle = async (): Promise<boolean> => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());

    return true;
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    )
      return false;

    throw error;
  }
};

export const signOut = () => firebaseSignOut(auth);
