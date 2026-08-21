import { getAuth } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import {
  CLIPS_SUBCOLLECTION,
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

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

type SubscribeToClipsParams = {
  onError: (error: Error) => void;
  onNext: (clips: Clip[]) => void;
  soundId: string;
};

const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('clips: no signed-in user');
  return uid;
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

export const createClip = reported(
  'clips.createClip',
  async ({
    endMs,
    label,
    soundId,
    startMs,
  }: CreateClipParams): Promise<string> => {
    const docRef = await addDoc(clipsCollection(soundId), {
      createdAt: serverTimestamp(),
      endMs,
      label,
      startMs,
    });

    return docRef.id;
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
