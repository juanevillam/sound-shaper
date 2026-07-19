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
  updateDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { uploadSongArt, uploadSongAudio } from '@/services/cloudinary/upload';
import {
  SONGS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

export type Song = {
  album: string;
  artist: string;
  // Cover art from the file's ID3 tag, uploaded to Cloudinary. Empty when the
  // file carried none (SongArt then shows the music glyph). `artPublicId` is
  // kept for a future signed delete (Cloudinary deletion needs a backend, which
  // this app doesn't have — orphans-on-delete is a known gap).
  artPublicId: string;
  artUrl: string;
  audioPublicId: string;
  audioUrl: string;
  createdAt: number | null;
  id: string;
  name: string;
  releaseYear: number | null;
  updatedAt: number | null;
};

type CreateSongParams = {
  album: string;
  artist: string;
  /** ID3-embedded cover art bytes, when the file had them. */
  art: { base64: string; mime: string } | null;
  /** Local uri of the picked .mp3 (document-picker cache copy). */
  localAudioUri: string;
  name: string;
  releaseYear: number | null;
};

type UpdateSongParams = {
  album: string;
  artist: string;
  name: string;
  releaseYear: number | null;
  songId: string;
};

type SubscribeToSongsParams = {
  onError: (error: Error) => void;
  onNext: (songs: Song[]) => void;
};

// The library is per-user: users/{uid}/songs. Every call site runs behind the
// auth gate, so a missing user is a programmer error worth throwing on.
const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('songs: no signed-in user');
  return uid;
};

const songsCollection = () =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SONGS_SUBCOLLECTION,
  );

const songDoc = (songId: string) =>
  doc(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SONGS_SUBCOLLECTION,
    songId,
  );

const songToModel = (snapshot: QueryDocumentSnapshot): Song => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;
  const releaseYear = data.releaseYear;

  return {
    album: (data.album as string) ?? '',
    artist: (data.artist as string) ?? '',
    artPublicId: (data.artPublicId as string) ?? '',
    artUrl: (data.artUrl as string) ?? '',
    audioPublicId: (data.audioPublicId as string) ?? '',
    audioUrl: (data.audioUrl as string) ?? '',
    createdAt: createdAt ? createdAt.toMillis() : null,
    id: snapshot.id,
    name: (data.name as string) ?? '',
    releaseYear: typeof releaseYear === 'number' ? releaseYear : null,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
  };
};

/** The whole personal library, newest upload first. */
export const subscribeToSongs = ({
  onError,
  onNext,
}: SubscribeToSongsParams): (() => void) => {
  const songsQuery = query(songsCollection(), orderBy('createdAt', 'desc'));

  return onSnapshot(songsQuery, {
    error: reportedOnError('songs.subscribeToSongs', onError),
    next: snapshot => onNext(snapshot.docs.map(songToModel)),
  });
};

/**
 * Create a song: upload the audio to Cloudinary (the one big network wait — the
 * editor holds its Save spinner on it) plus any embedded art, then write the
 * song doc.
 */
export const createSong = reported(
  'songs.createSong',
  async ({
    album,
    artist,
    art,
    localAudioUri,
    name,
    releaseYear,
  }: CreateSongParams): Promise<string> => {
    const audio = await uploadSongAudio(localAudioUri);
    const cover = art ? await uploadSongArt(art.base64, art.mime) : null;

    const docRef = await addDoc(songsCollection(), {
      album,
      artist,
      artPublicId: cover?.publicId ?? '',
      artUrl: cover?.url ?? '',
      audioPublicId: audio.publicId,
      audioUrl: audio.url,
      createdAt: serverTimestamp(),
      name,
      releaseYear,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },
);

/** Update a song's metadata (the audio file itself never changes). */
export const updateSong = reported(
  'songs.updateSong',
  async ({
    album,
    artist,
    name,
    releaseYear,
    songId,
  }: UpdateSongParams): Promise<void> => {
    await updateDoc(songDoc(songId), {
      album,
      artist,
      name,
      releaseYear,
      updatedAt: serverTimestamp(),
    });
  },
);

/**
 * Remove a song. The Cloudinary audio/art assets are left behind — destroying
 * them needs a signed API call (a backend this app deliberately doesn't have),
 * so orphaned assets are a known gap, same as Topper's pre-Functions state.
 */
export const deleteSong = reported(
  'songs.deleteSong',
  async (songId: string): Promise<void> => {
    await deleteDoc(songDoc(songId));
  },
);
