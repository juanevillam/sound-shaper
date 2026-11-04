import {
  deleteUser,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';

import {
  CLIPS_SUBCOLLECTION,
  SHAPES_SUBCOLLECTION,
  SOUNDS_SUBCOLLECTION,
  TROPHIES_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@app/services/firebase/collections';

import { auth, db } from './firebase';
import { cleanupMyMedia, destroyAsset, uploadImage } from './media';

/**
 * The app's account services (services/firebase/ownProfile.ts and
 * account.ts, hooks/useDeleteAccount.ts) on the web.
 */
const requireUser = () => {
  const user = auth.currentUser;

  if (!user) throw new Error('Not signed in');

  return user;
};

const ownDoc = (uid: string) => doc(db, USERS_COLLECTION, uid);

/** Member Since — the profile document's `createdAt`. */
export const readMemberSince = async (): Promise<number | null> => {
  const data = (await getDoc(ownDoc(requireUser().uid))).data();

  return data?.createdAt ? (data.createdAt as Timestamp).toMillis() : null;
};

/**
 * BOTH places, as in the app: Auth's profile, and the document — the
 * document alone would be "corrected" back to the provider's value by the
 * next sign-in's upsert.
 */
export const setOwnName = async (name: string) => {
  const user = requireUser();

  await updateProfile(user, { displayName: name });
  await setDoc(
    ownDoc(user.uid),
    { displayName: name, updatedAt: serverTimestamp() },
    { merge: true },
  );
};

/**
 * A new photo, or none. Only a photo THIS app uploaded is ever destroyed —
 * `photoPublicId` names it; a provider's own picture is not ours to delete.
 */
export const setOwnPhoto = async (file: Blob | null) => {
  const user = requireUser();
  const ref = ownDoc(user.uid);
  const previous = (await getDoc(ref)).data()?.photoPublicId as
    | string
    | undefined;
  const asset = file ? await uploadImage(file) : null;

  await updateProfile(user, { photoURL: asset?.url ?? null });
  await setDoc(
    ref,
    {
      photoURL: asset?.url ?? null,
      photoPublicId: asset?.publicId ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (previous && previous !== asset?.publicId)
    void destroyAsset(previous, 'image');
};

/** A dismissed sign-in popup: nothing was touched, so nothing to report. */
export class ReauthCancelled extends Error {
  constructor() {
    super('reauth-cancelled');
    this.name = 'ReauthCancelled';
  }
}

const sweep = async (uid: string) => {
  const sounds = await getDocs(
    collection(db, USERS_COLLECTION, uid, SOUNDS_SUBCOLLECTION),
  );

  // Clips first: Firestore does not delete a subcollection with its parent.
  for (const sound of sounds.docs) {
    const clips = await getDocs(collection(sound.ref, CLIPS_SUBCOLLECTION));
    await Promise.all(clips.docs.map(clip => deleteDoc(clip.ref)));
    await deleteDoc(sound.ref);
  }

  // SHAPES is legacy (saved shapes were removed), still swept so an early
  // account leaves nothing behind.
  for (const name of [SHAPES_SUBCOLLECTION, TROPHIES_SUBCOLLECTION]) {
    const docs = await getDocs(collection(db, USERS_COLLECTION, uid, name));
    await Promise.all(docs.docs.map(entry => deleteDoc(entry.ref)));
  }

  await deleteDoc(ownDoc(uid));
};

/**
 * RE-AUTH FIRST, before anything is touched, so backing out of the
 * provider's popup leaves the account whole. Then the media, the documents
 * and the Auth user, in the app's order. Google's access is not revoked
 * here — the web SDK has no call for it; deleting the Auth user ends the
 * app's hold on the account.
 */
export const deleteAccount = async () => {
  const user = requireUser();

  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled'
    )
      throw new ReauthCancelled();
    throw error;
  }

  await cleanupMyMedia();
  await sweep(user.uid);
  await deleteUser(user);
};
