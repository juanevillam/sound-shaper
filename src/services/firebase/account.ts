import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';

import {
  CLIPS_SUBCOLLECTION,
  SHAPES_SUBCOLLECTION,
  SONGS_SUBCOLLECTION,
  TROPHIES_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported } from '@/services/firebase/crashlytics';

// Account deletion, personal-app scale: a client-side sweep of everything under
// users/{uid} (each song's clips, the songs, the saved shapes, the trophies,
// the profile doc), then the Auth user itself. Cloudinary media is orphaned —
// deleting it needs a signed backend call this app deliberately doesn't have
// (the same accepted gap as deleting a single song).
//
// Firebase requires a RECENT sign-in for user.delete(); when the session is too
// old it throws `auth/requires-recent-login`. iOS re-authenticates first (see
// `hooks/useDeleteAccount`); Android surfaces the error and asks for a retry.

const requireUser = () => {
  const user = getAuth().currentUser;
  if (!user) throw new Error('account: no signed-in user');

  return user;
};

/**
 * EVERY FIRESTORE TRACE OF THE ACCOUNT.
 *
 * THE PATHS HERE ARE THE ONES THE APP ACTUALLY WRITES TO, which they were not:
 * the songs sweep built `users/{uid}/shapes/songs/trophies` and the clips sweep
 * built `users/{uid}/shapes/songs/trophies/{songId}/clips`, by passing all
 * three subcollection constants to one `collection()` call. Both are legal
 * odd-segment collection paths, so nothing threw — `getDocs` simply returned
 * empty and the sweep reported success. Every song and every clip therefore
 * SURVIVED account deletion, orphaned under a user document that was gone,
 * while the row's own copy promised "Your sounds and clips are deleted
 * permanently". Compare `songs.ts` / `clips.ts`, which are the reference for
 * what these collections are really called.
 */
export const deleteAccountData = reported(
  'account.deleteAccountData',
  async (): Promise<void> => {
    const user = requireUser();
    const db = getFirestore();

    const songs = await getDocs(
      collection(db, USERS_COLLECTION, user.uid, SONGS_SUBCOLLECTION),
    );

    for (const song of songs.docs) {
      const clips = await getDocs(
        collection(
          db,
          USERS_COLLECTION,
          user.uid,
          SONGS_SUBCOLLECTION,
          song.id,
          CLIPS_SUBCOLLECTION,
        ),
      );

      await Promise.all(clips.docs.map(clip => deleteDoc(clip.ref)));
      await deleteDoc(song.ref);
    }

    // Deleting the user doc does NOT remove its subcollections, so every one of
    // them has to be swept by hand — shapes and trophies included, or a
    // recreated account would inherit the old one's saved shapes and awards.
    for (const subcollection of [
      SHAPES_SUBCOLLECTION,
      TROPHIES_SUBCOLLECTION,
    ]) {
      const docs = await getDocs(
        collection(db, USERS_COLLECTION, user.uid, subcollection),
      );

      await Promise.all(docs.docs.map(entry => deleteDoc(entry.ref)));
    }

    await deleteDoc(doc(db, USERS_COLLECTION, user.uid));
  },
);

/** The Auth user. Separate from the sweep so a caller can do work in between —
 *  iOS revokes Apple tokens there (see `hooks/useDeleteAccount`). */
export const deleteAuthAccount = reported(
  'account.deleteAuthAccount',
  async (): Promise<void> => {
    await requireUser().delete();
  },
);

/**
 * Sweep then delete, with nothing in between — what Android's manage-account
 * screen calls. iOS drives the two halves itself so it can re-authenticate
 * first and revoke Apple tokens in the middle.
 */
export const deleteAccount = async (): Promise<void> => {
  await deleteAccountData();
  await deleteAuthAccount();
};
