import { useEffect, useState } from 'react';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';

import { USERS_COLLECTION } from '@app/services/firebase/collections';

import { auth } from './auth';

const SIGNED_IN_HINT_KEY = 'soundshaper.signedIn';

const readSignedInHint = (): boolean => {
  try {
    return localStorage.getItem(SIGNED_IN_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSignedInHint = (signedIn: boolean) => {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_HINT_KEY);
  } catch {
    // Private browsing or blocked storage: ignore.
  }
};

export type Session =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'signed-in'; user: User };

/**
 * The web twin of the app's `upsertOwnProfile`
 * (src/services/firebase/users.ts): one read per sign-in, and a write only
 * when the identity changed, so `updatedAt` keeps meaning what it means
 * there. Firestore is imported lazily so a signed-out visit on Welcome never
 * downloads the Firestore or App Check SDKs.
 */
const upsertOwnProfile = async (user: User): Promise<void> => {
  const [{ doc, getDoc, serverTimestamp, setDoc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ]);
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
  // Only hold on a blank frame when a previous sign-in is remembered; a
  // first-time or signed-out visitor paints Welcome on the very first frame.
  const [session, setSession] = useState<Session>(() =>
    readSignedInHint() ? { state: 'loading' } : { state: 'signed-out' },
  );

  useEffect(
    () =>
      onAuthStateChanged(auth, user => {
        writeSignedInHint(Boolean(user));
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
    writeSignedInHint(true);

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

export const signOut = async () => {
  writeSignedInHint(false);
  await firebaseSignOut(auth);
};
