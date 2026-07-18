import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { uploadSongArt, uploadSongAudio } from '@/services/cloudinary/upload';
import {
  PLAYLISTS_COLLECTION,
  SONGS_SUBCOLLECTION,
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
  position: number;
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
  playlistId: string;
  position: number;
  releaseYear: number | null;
};

type UpdateSongParams = {
  album: string;
  artist: string;
  name: string;
  playlistId: string;
  releaseYear: number | null;
  songId: string;
};

type DeleteSongParams = {
  playlistId: string;
  songId: string;
};

type ReorderSongsParams = {
  orderedSongIds: string[];
  playlistId: string;
};

type SubscribeToSongsParams = {
  onError: (error: Error) => void;
  onNext: (songs: Song[]) => void;
  playlistId: string;
};

const songsCollection = (playlistId: string) =>
  collection(
    getFirestore(),
    PLAYLISTS_COLLECTION,
    playlistId,
    SONGS_SUBCOLLECTION,
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
    position: (data.position as number) ?? 0,
    releaseYear: typeof releaseYear === 'number' ? releaseYear : null,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
  };
};

export const subscribeToSongs = ({
  onError,
  onNext,
  playlistId,
}: SubscribeToSongsParams): (() => void) => {
  const songsQuery = query(
    songsCollection(playlistId),
    orderBy('position', 'asc'),
  );

  return onSnapshot(songsQuery, {
    error: reportedOnError('songs.subscribeToSongs', onError),
    next: snapshot => onNext(snapshot.docs.map(songToModel)),
  });
};

/**
 * Create a song: upload the audio to Cloudinary (the one big network wait — the
 * editor holds its Save spinner on it) plus any embedded art, then write the
 * song doc and bump the playlist's `songCount`.
 */
export const createSong = reported(
  'songs.createSong',
  async ({
    album,
    artist,
    art,
    localAudioUri,
    name,
    playlistId,
    position,
    releaseYear,
  }: CreateSongParams): Promise<string> => {
    const audio = await uploadSongAudio(localAudioUri);
    const cover = art ? await uploadSongArt(art.base64, art.mime) : null;

    const docRef = await addDoc(songsCollection(playlistId), {
      album,
      artist,
      artPublicId: cover?.publicId ?? '',
      artUrl: cover?.url ?? '',
      audioPublicId: audio.publicId,
      audioUrl: audio.url,
      createdAt: serverTimestamp(),
      name,
      position,
      releaseYear,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(getFirestore(), PLAYLISTS_COLLECTION, playlistId), {
      songCount: increment(1),
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
    playlistId,
    releaseYear,
    songId,
  }: UpdateSongParams): Promise<void> => {
    await updateDoc(
      doc(
        getFirestore(),
        PLAYLISTS_COLLECTION,
        playlistId,
        SONGS_SUBCOLLECTION,
        songId,
      ),
      {
        album,
        artist,
        name,
        releaseYear,
        updatedAt: serverTimestamp(),
      },
    );
  },
);

/**
 * Remove a song: delete the doc and decrement the playlist's `songCount`. The
 * Cloudinary audio/art assets are left behind — destroying them needs a signed
 * API call (a backend this app deliberately doesn't have), so orphaned assets
 * are a known gap, same as Topper's pre-Functions state.
 */
export const deleteSong = reported(
  'songs.deleteSong',
  async ({ playlistId, songId }: DeleteSongParams): Promise<void> => {
    const db = getFirestore();

    await deleteDoc(
      doc(db, PLAYLISTS_COLLECTION, playlistId, SONGS_SUBCOLLECTION, songId),
    );

    await updateDoc(doc(db, PLAYLISTS_COLLECTION, playlistId), {
      songCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  },
);

/** Persist a new song ordering by writing each song's array index. */
export const reorderSongs = reported(
  'songs.reorderSongs',
  async ({ orderedSongIds, playlistId }: ReorderSongsParams): Promise<void> => {
    const db = getFirestore();
    const batch = writeBatch(db);

    orderedSongIds.forEach((songId, index) => {
      batch.update(
        doc(db, PLAYLISTS_COLLECTION, playlistId, SONGS_SUBCOLLECTION, songId),
        { position: index },
      );
    });

    await batch.commit();
  },
);
