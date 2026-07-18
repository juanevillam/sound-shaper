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
  PLAYLISTS_COLLECTION,
  SONGS_SUBCOLLECTION,
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

type ClipPath = {
  playlistId: string;
  songId: string;
};

type CreateClipParams = ClipPath & {
  endMs: number;
  label: string;
  startMs: number;
};

type DeleteClipParams = ClipPath & {
  clipId: string;
};

type SubscribeToClipsParams = ClipPath & {
  onError: (error: Error) => void;
  onNext: (clips: Clip[]) => void;
};

const clipsCollection = ({ playlistId, songId }: ClipPath) =>
  collection(
    getFirestore(),
    PLAYLISTS_COLLECTION,
    playlistId,
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
  playlistId,
  songId,
}: SubscribeToClipsParams): (() => void) => {
  const clipsQuery = query(
    clipsCollection({ playlistId, songId }),
    orderBy('startMs', 'asc'),
  );

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
    playlistId,
    songId,
    startMs,
  }: CreateClipParams): Promise<string> => {
    const docRef = await addDoc(clipsCollection({ playlistId, songId }), {
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
  async ({ clipId, playlistId, songId }: DeleteClipParams): Promise<void> => {
    await deleteDoc(
      doc(
        getFirestore(),
        PLAYLISTS_COLLECTION,
        playlistId,
        SONGS_SUBCOLLECTION,
        songId,
        CLIPS_SUBCOLLECTION,
        clipId,
      ),
    );
  },
);
