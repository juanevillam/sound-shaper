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
  SONGS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

// A clip is a personal bookmark into a song: "the part I love, from here to
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
  songId: string;
  startMs: number;
};

type DeleteClipParams = {
  clipId: string;
  songId: string;
};

type SubscribeToClipsParams = {
  onError: (error: Error) => void;
  onNext: (clips: Clip[]) => void;
  songId: string;
};

const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('clips: no signed-in user');
  return uid;
};

const clipsCollection = (songId: string) =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SONGS_SUBCOLLECTION,
    songId,
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

/** Live clips of one song, ordered by where they start in the track. */
export const subscribeToClips = ({
  onError,
  onNext,
  songId,
}: SubscribeToClipsParams): (() => void) => {
  const clipsQuery = query(clipsCollection(songId), orderBy('startMs', 'asc'));

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
    songId,
    startMs,
  }: CreateClipParams): Promise<string> => {
    const docRef = await addDoc(clipsCollection(songId), {
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
  async ({ clipId, songId }: DeleteClipParams): Promise<void> => {
    await deleteDoc(
      doc(
        getFirestore(),
        USERS_COLLECTION,
        requireUid(),
        SONGS_SUBCOLLECTION,
        songId,
        CLIPS_SUBCOLLECTION,
        clipId,
      ),
    );
  },
);
