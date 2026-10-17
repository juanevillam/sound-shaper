import {
  doc,
  getDoc,
  getFirestore,
  increment,
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
  /**
   * WHERE THE ADD-SOUND TILE SITS IN THE GRID, in the same fractional keyspace
   * the sounds use (`lib/gridOrder.ts`).
   *
   * It lives on the USER rather than on a sound because it is not one — it is
   * the one piece of grid chrome the person can park wherever they like (Juan,
   * 2026-09-11), and it has nowhere else to be. `null` means "never moved",
   * which the grid reads as leading the library, the position it held for the
   * app's whole life before this.
   */
  addTilePosition: number | null;
  /**
   * HOW MANY CLIPS THE PERSON HAS EVER SAVED, server-side — the `saved-clips`
   * trophy's count. Only ever moved by `increment`; see `lib/trophyCounters`.
   * `null` means this account has never synced one.
   */
  clipsSaved: number | null;
  createdAt: number | null;
  displayName: string | null;
  /** Seconds listened, lifetime — the `listening` trophy's total. Same rules
   *  as `clipsSaved`. */
  listenedSeconds: number | null;
  photoUrl: string | null;
  uid: string;
  updatedAt: number | null;
};

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

type UpsertOwnProfileParams = {
  displayName: string | null;
  photoUrl: string | null;
  uid: string;
};

const dataToModel = (
  uid: string,
  data: Record<string, unknown>,
): UserProfile => {
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;

  return {
    addTilePosition: finiteOrNull(data.addTilePosition),
    clipsSaved: finiteOrNull(data.clipsSaved),
    createdAt: createdAt ? createdAt.toMillis() : null,
    displayName: (data.displayName as string) ?? null,
    listenedSeconds: finiteOrNull(data.listenedSeconds),
    photoUrl: (data.photoURL as string) ?? null,
    uid,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
  };
};

const profileToModel = (snapshot: QueryDocumentSnapshot): UserProfile =>
  dataToModel(snapshot.id, snapshot.data());

/**
 * Create or refresh the signed-in user's profile doc after auth resolves, and
 * hand back the profile it read.
 *
 * THE READ IS THE LAUNCH'S ONLY READ OF THIS DOC. `upsertOwnProfile` has to
 * read it anyway (Firestore has no set-if-absent for `createdAt`), and the
 * grid needs `addTilePosition` from it at launch — so the caller seeds the
 * profile store from what comes back instead of a second `getDoc` from the
 * layout reading the same document a moment later.
 *
 * THE WRITE ONLY HAPPENS WHEN THE IDENTITY CHANGED. It ran on every cold
 * start, because `onAuthStateChanged` fires for a persisted session too, and
 * bumped `updatedAt` each time — a field meant to say when the identity
 * snapshot last changed, reporting when the app was last opened.
 */
export const upsertOwnProfile = reported(
  'users.upsertOwnProfile',
  async ({
    displayName,
    photoUrl,
    uid,
  }: UpsertOwnProfileParams): Promise<UserProfile> => {
    const ref = doc(getFirestore(), USERS_COLLECTION, uid);
    const existing = await getDoc(ref);
    const data = (existing.exists() ? existing.data() : undefined) ?? {};
    const hasCreatedAt = data.createdAt !== undefined;

    if (
      hasCreatedAt &&
      data.displayName === displayName &&
      data.photoURL === photoUrl
    ) {
      return dataToModel(uid, data);
    }

    await setDoc(
      ref,
      {
        displayName,
        photoURL: photoUrl,
        updatedAt: serverTimestamp(),
        ...(hasCreatedAt ? null : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    // The dates the write just stamped are server-side and land with the next
    // read; the model carries what was there (or nothing, for a new account).
    return dataToModel(uid, { ...data, displayName, photoURL: photoUrl });
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

/**
 * Park the add-sound tile at a new grid position — ONE field on one document.
 *
 * `setDoc` with `merge`, not `updateDoc`: an account whose profile doc has not
 * been written yet (the window between first auth and `upsertOwnProfile`
 * landing) would reject an update, and losing a drag to a race is worse than
 * creating the doc a moment early.
 *
 * NO `updatedAt` BUMP — that field tracks the identity snapshot, and where a
 * tile sits is not part of it.
 */
export const setAddTilePosition = reported(
  'users.setAddTilePosition',
  async ({
    position,
    uid,
  }: {
    position: number;
    uid: string;
  }): Promise<void> => {
    await setDoc(
      doc(getFirestore(), USERS_COLLECTION, uid),
      { addTilePosition: position },
      { merge: true },
    );
  },
);

/**
 * Add to the person's two trophy totals — BY `increment`, never by writing a
 * total. Two phones each writing "their" total wholesale would be
 * last-writer-wins, and the other phone's listening would be erased: the exact
 * loss keeping these server-side exists to stop. An increment from each
 * merges.
 *
 * `merge` rather than `updateDoc`, for `setAddTilePosition`'s reason: the doc
 * may not exist yet in the first moments of a new account.
 */
export const incrementTrophyCounters = reported(
  'users.incrementTrophyCounters',
  async ({
    clipsSaved,
    listenedSeconds,
    uid,
  }: {
    clipsSaved: number;
    listenedSeconds: number;
    uid: string;
  }): Promise<void> => {
    await setDoc(
      doc(getFirestore(), USERS_COLLECTION, uid),
      {
        ...(listenedSeconds > 0
          ? { listenedSeconds: increment(listenedSeconds) }
          : null),
        ...(clipsSaved > 0 ? { clipsSaved: increment(clipsSaved) } : null),
      },
      { merge: true },
    );
  },
);
