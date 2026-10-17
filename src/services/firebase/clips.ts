import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { requireUid } from '@/services/firebase/auth';
import {
  CLIPS_SUBCOLLECTION,
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import {
  recordError,
  reported,
  reportedOnError,
} from '@/services/firebase/crashlytics';

// A clip is a personal bookmark into a sound: "the part I love, from here to
// here". Purely for the owner's replay — nothing is shared.
export type Clip = {
  createdAt: number | null;
  endMs: number;
  id: string;
  // Optional nickname ("the drop"); rows fall back to the time range.
  label: string;
  startMs: number;
};

type CreateClipParams = {
  endMs: number;
  label: string;
  soundId: string;
  startMs: number;
};

type DeleteClipParams = {
  clipId: string;
  soundId: string;
};

type UpdateClipParams = {
  clipId: string;
  endMs: number;
  soundId: string;
  startMs: number;
};

type SubscribeToClipsParams = {
  onError: (error: Error) => void;
  onNext: (clips: Clip[]) => void;
  soundId: string;
};

const clipsCollection = (soundId: string) =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SOUNDS_SUBCOLLECTION,
    soundId,
    CLIPS_SUBCOLLECTION,
  );

const clipToModel = (snapshot: QueryDocumentSnapshot): Clip => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;

  return {
    createdAt: createdAt ? createdAt.toMillis() : null,
    endMs: (data.endMs as number) ?? 0,
    id: snapshot.id,
    label: (data.label as string) ?? '',
    startMs: (data.startMs as number) ?? 0,
  };
};

/** Live clips of one sound, ordered by where they start in the track. */
export const subscribeToClips = ({
  onError,
  onNext,
  soundId,
}: SubscribeToClipsParams): (() => void) => {
  const clipsQuery = query(clipsCollection(soundId), orderBy('startMs', 'asc'));

  return onSnapshot(clipsQuery, {
    error: reportedOnError('clips.subscribeToClips', onError),
    next: snapshot => onNext(snapshot.docs.map(clipToModel)),
  });
};

/**
 * WHAT ALL CLIPS REPEAT NEEDS AND NOTHING ELSE HAS: the clips of sounds that
 * are not open. The live store holds only the sound the console is showing
 * (`useClipsSubscription`), so when the Clips sheet's Repeat runs past a
 * sound's last clip the next sound's list comes from here.
 *
 * ONE `getDocs` PER SOUND, ON DEMAND, NOT A COLLECTION-GROUP QUERY. A group
 * query would be one round trip, but it needs a `match /{path=**}/clips/...`
 * rule and an index — the wider read surface `deleteClipsOfSound` already
 * declined to open. A personal library is small, persistence answers from
 * disk, and this is asked once per sound per session at most.
 *
 * THE CACHE IS PER SESSION AND DIES ON SIGN-OUT (`forgetClipsOfSounds`), like
 * every other cache of one account's library. It is a snapshot, so a clip
 * edited on ANOTHER device since it was taken is seen late; the open sound's
 * live list always wins over it at the call site. A sound whose read fails is
 * simply not cached — it counts as having no clips this time and is asked
 * again next time.
 */
const clipsOfSoundCache = new Map<string, Clip[]>();

export const getClipsOfSounds = async (
  soundIds: readonly string[],
): Promise<Record<string, Clip[]>> => {
  const missing = soundIds.filter(id => !clipsOfSoundCache.has(id));

  await Promise.all(
    missing.map(async soundId => {
      try {
        const snapshot = await getDocs(
          query(clipsCollection(soundId), orderBy('startMs', 'asc')),
        );
        clipsOfSoundCache.set(soundId, snapshot.docs.map(clipToModel));
      } catch (error) {
        recordError(error, 'clips.getClipsOfSounds');
      }
    }),
  );

  return Object.fromEntries(
    soundIds.flatMap(id => {
      const clips = clipsOfSoundCache.get(id);
      return clips ? [[id, clips]] : [];
    }),
  );
};

/** What `getClipsOfSounds` already holds for one sound, without asking. */
export const cachedClipsOfSound = (soundId: string): Clip[] | undefined =>
  clipsOfSoundCache.get(soundId);

/** Sign-out: the cached lists are the signed-out account's clips. */
export const forgetClipsOfSounds = (): void => clipsOfSoundCache.clear();

/**
 * Write a new clip. THE ID IS MINTED ON THE PHONE (`doc(collection)`), so the
 * returned promise is only the server's acknowledgement — which, offline, does
 * not arrive until the network does. The write itself is already in the local
 * cache, and the clips listener shows it at once; the editor therefore closes
 * without awaiting this and treats a later rejection as the failure.
 */
export const createClip = reported(
  'clips.createClip',
  async ({
    endMs,
    label,
    soundId,
    startMs,
  }: CreateClipParams): Promise<string> => {
    const ref = doc(clipsCollection(soundId));

    await setDoc(ref, {
      createdAt: serverTimestamp(),
      endMs,
      label,
      startMs,
    });

    return ref.id;
  },
);

/**
 * Re-frame an existing clip — the editor opened on it commits here. Only the
 * RANGE moves; `label` and `createdAt` stay what they were (a re-framed clip
 * is the same bookmark, not a new one — which is also why editing never
 * counts toward the saved-clips trophy).
 */
export const updateClip = reported(
  'clips.updateClip',
  async ({
    clipId,
    endMs,
    soundId,
    startMs,
  }: UpdateClipParams): Promise<void> => {
    await updateDoc(
      doc(
        getFirestore(),
        USERS_COLLECTION,
        requireUid(),
        SOUNDS_SUBCOLLECTION,
        soundId,
        CLIPS_SUBCOLLECTION,
        clipId,
      ),
      { endMs, startMs },
    );
  },
);

/**
 * Every clip of one sound — what `deleteSound` calls before removing the sound
 * document itself.
 *
 * FIRESTORE DOES NOT DELETE A SUBCOLLECTION WITH ITS PARENT, and this is the
 * second door that fact has opened in this app. Deleting the sound doc alone
 * left its clips standing under a document that no longer existed, and the
 * account-deletion sweep could not reach them either: `account.ts` finds clips
 * by enumerating the sounds that still EXIST, so a clip whose sound went first
 * outlived the account it belonged to — while the row promised "All of your
 * sounds and clips will be deleted permanently". Same shape as the
 * wrong-but-legal paths that sweep shipped with, through a different door.
 *
 * IT HAD ALREADY HAPPENED, and it was measured rather than assumed: a
 * collection-group query over the developer account on 2026-08-28 returned 10
 * clips, THREE of them under sound ids that no longer exist. Those three would
 * have outlived the account.
 *
 * THE THREE WERE DELETED BY HAND, over the Firestore REST API, and the census
 * afterwards reads 7 clips and 0 orphans. This function is what stops new ones
 * appearing; it does NOT clean up old ones, and deliberately grew no code to.
 * Nothing can reach an orphan by path, since the client cannot list a
 * document's subcollections — a COLLECTION-GROUP query can (it is how these
 * were found), but sweeping with one spans every user's clips and needs a
 * `match /{path=**}/clips/{clipId}` rule to match, a wider read surface than
 * this app has any other reason to open. A one-off repair did not justify
 * that; with the sweep below in place there is nothing left for it to find.
 */
export const deleteClipsOfSound = reported(
  'clips.deleteClipsOfSound',
  async (soundId: string): Promise<void> => {
    const snapshot = await getDocs(clipsCollection(soundId));

    await Promise.all(snapshot.docs.map(clip => deleteDoc(clip.ref)));
  },
);

export const deleteClip = reported(
  'clips.deleteClip',
  async ({ clipId, soundId }: DeleteClipParams): Promise<void> => {
    await deleteDoc(
      doc(
        getFirestore(),
        USERS_COLLECTION,
        requireUid(),
        SOUNDS_SUBCOLLECTION,
        soundId,
        CLIPS_SUBCOLLECTION,
        clipId,
      ),
    );
  },
);
