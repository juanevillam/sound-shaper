import { updateProfile } from '@react-native-firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';

import { type CloudinaryAsset } from '@/services/cloudinary/upload';
import { requireUser } from '@/services/firebase/auth';
import { USERS_COLLECTION } from '@/services/firebase/collections';
import { recordError, reported } from '@/services/firebase/crashlytics';
import { destroyProfilePhoto } from '@/services/firebase/functions';

/**
 * THE PERSON'S OWN NAME AND PHOTO, WHICH THEY CAN NOW SET THEMSELVES
 * (Juan, 2026-10-16).
 *
 * Both came from the sign-in provider and nowhere else. Google hands over a
 * name and a photo; Sign in with Apple hands over a name only if the person
 * chooses to share it, only on the FIRST authorization, and a photo NEVER —
 * there is no API for it. So an Apple account that kept its name private read
 * "Your Account" forever, with a monogram for a face, and nothing could change
 * either.
 *
 * EACH EDIT WRITES TWO PLACES, AND BOTH ARE NEEDED. Firebase Auth's profile is
 * what the session hands the app on every launch, and `upsertOwnProfile`
 * compares the Firestore doc against it — so a change made in Firestore alone
 * would be "corrected" back to the provider's value on the next cold start.
 */

const ownDoc = (uid: string) => doc(getFirestore(), USERS_COLLECTION, uid);

/** Set the display name. An empty name is refused by the caller. */
export const setOwnName = reported(
  'ownProfile.setOwnName',
  async (name: string): Promise<void> => {
    const user = requireUser();
    await updateProfile(user, { displayName: name });
    await setDoc(
      ownDoc(user.uid),
      { displayName: name, updatedAt: serverTimestamp() },
      { merge: true },
    );
  },
);

/**
 * Set the photo to an uploaded image, or clear it (`null`) back to the
 * monogram — and destroy the photo it replaces, if this app uploaded it.
 *
 * Only an uploaded photo has a `photoPublicId`. A provider's photo (Google's)
 * is a URL on Google's servers and is never ours to delete; replacing it just
 * stops pointing at it. The destroy is best-effort, like every other media
 * delete here: an orphan is a cost, a profile change that refused to finish
 * would be a defect.
 */
export const setOwnPhoto = reported(
  'ownProfile.setOwnPhoto',
  async (asset: CloudinaryAsset | null): Promise<void> => {
    const user = requireUser();
    const ref = ownDoc(user.uid);
    const previous = (await getDoc(ref)).data()?.photoPublicId as
      | string
      | undefined;

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

    if (previous && previous !== asset?.publicId) {
      destroyProfilePhoto(previous).catch(error =>
        recordError(error, 'ownProfile.destroyProfilePhoto'),
      );
    }
  },
);
