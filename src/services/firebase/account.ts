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
  SONGS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported } from '@/services/firebase/crashlytics';

// Account deletion, personal-app scale: client-side sweep of everything under
// users/{uid} (each song's clips, the songs, the profile doc), then the Auth
// user itself. Cloudinary media is orphaned — deleting it needs a signed
// backend call this app deliberately doesn't have (same accepted gap as
// deleting a single song).
//
// Firebase requires a RECENT sign-in for user.delete(); when the session is
// too old it throws `auth/requires-recent-login` — the caller surfaces that
// as "sign in again, then retry".

export const deleteAccount = reported(
  'account.deleteAccount',
  async (): Promise<void> => {
    const user = getAuth().currentUser;
    if (!user) throw new Error('account: no signed-in user');

    const db = getFirestore();
    const songsRef = collection(
      db,
      USERS_COLLECTION,
      user.uid,
      SONGS_SUBCOLLECTION,
    );

    const songs = await getDocs(songsRef);
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

    await deleteDoc(doc(db, USERS_COLLECTION, user.uid));
    await user.delete();
  },
);
