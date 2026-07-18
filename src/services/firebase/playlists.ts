import {
  addDoc,
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
  where,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import {
  PLAYLISTS_COLLECTION,
  SONGS_SUBCOLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

export type PlaylistVisibility = 'public' | 'private';

export type Playlist = {
  createdAt: number | null;
  // Optional free-text the owner adds to describe the playlist. Multiline;
  // empty when unset.
  description: string;
  emoji: string;
  id: string;
  // The auto-created "My library" playlist (one per account, created on first
  // sign-in). Regular in every way except it renders with a filled-library
  // affordance; deletable like any other (a profile flag stops re-creation).
  isDefault: boolean;
  name: string;
  ownerId: string;
  songCount: number;
  updatedAt: number | null;
  visibility: PlaylistVisibility;
};

type CreatePlaylistParams = {
  description: string;
  emoji: string;
  isDefault?: boolean;
  name: string;
  ownerId: string;
  visibility: PlaylistVisibility;
};

type UpdatePlaylistParams = {
  description: string;
  emoji: string;
  name: string;
  playlistId: string;
  visibility: PlaylistVisibility;
};

type SubscribeToUserPlaylistsParams = {
  onError: (error: Error) => void;
  onNext: (playlists: Playlist[]) => void;
  ownerId: string;
};

const playlistToModel = (snapshot: QueryDocumentSnapshot): Playlist => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;

  return {
    createdAt: createdAt ? createdAt.toMillis() : null,
    description: (data.description as string) ?? '',
    emoji: (data.emoji as string) ?? '',
    id: snapshot.id,
    isDefault: (data.isDefault as boolean) ?? false,
    name: (data.name as string) ?? '',
    ownerId: (data.ownerId as string) ?? '',
    songCount: (data.songCount as number) ?? 0,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
    visibility: (data.visibility as PlaylistVisibility) ?? 'private',
  };
};

/**
 * Live subscription to the signed-in user's playlists, oldest first — the
 * default "My library" is created first, so it naturally leads the list.
 * (Backed by the (ownerId, createdAt) composite index.)
 */
export const subscribeToUserPlaylists = ({
  onError,
  onNext,
  ownerId,
}: SubscribeToUserPlaylistsParams): (() => void) => {
  const playlistsQuery = query(
    collection(getFirestore(), PLAYLISTS_COLLECTION),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(playlistsQuery, {
    error: reportedOnError('playlists.subscribeToUserPlaylists', onError),
    next: snapshot => onNext(snapshot.docs.map(playlistToModel)),
  });
};

export const createPlaylist = reported(
  'playlists.createPlaylist',
  async ({
    description,
    emoji,
    isDefault = false,
    name,
    ownerId,
    visibility,
  }: CreatePlaylistParams): Promise<string> => {
    const docRef = await addDoc(
      collection(getFirestore(), PLAYLISTS_COLLECTION),
      {
        createdAt: serverTimestamp(),
        description,
        emoji,
        isDefault,
        name,
        ownerId,
        songCount: 0,
        updatedAt: serverTimestamp(),
        visibility,
      },
    );

    return docRef.id;
  },
);

/**
 * Create the account's default "My library" playlist at a DETERMINISTIC doc id
 * (`lib-{uid}`), so a double-fire (two devices, a retry) overwrites the same
 * doc instead of duplicating it.
 */
export const createDefaultPlaylist = reported(
  'playlists.createDefaultPlaylist',
  async ({
    name,
    ownerId,
  }: {
    name: string;
    ownerId: string;
  }): Promise<void> => {
    await setDoc(doc(getFirestore(), PLAYLISTS_COLLECTION, `lib-${ownerId}`), {
      createdAt: serverTimestamp(),
      description: '',
      emoji: '🎵',
      isDefault: true,
      name,
      ownerId,
      songCount: 0,
      updatedAt: serverTimestamp(),
      visibility: 'private',
    });
  },
);

export const updatePlaylist = reported(
  'playlists.updatePlaylist',
  async ({
    description,
    emoji,
    name,
    playlistId,
    visibility,
  }: UpdatePlaylistParams): Promise<void> => {
    await updateDoc(doc(getFirestore(), PLAYLISTS_COLLECTION, playlistId), {
      description,
      emoji,
      name,
      updatedAt: serverTimestamp(),
      visibility,
    });
  },
);

/**
 * Delete a playlist for real: its `songs` subcollection docs, then the playlist
 * doc — Firestore doesn't cascade, so bare doc removal would orphan the songs.
 * The songs' Cloudinary audio/art assets are left behind (signed delete needs a
 * backend this app doesn't have — a known orphan gap).
 */
export const deletePlaylist = reported(
  'playlists.deletePlaylist',
  async (playlistId: string): Promise<void> => {
    const db = getFirestore();
    const songs = await getDocs(
      collection(db, PLAYLISTS_COLLECTION, playlistId, SONGS_SUBCOLLECTION),
    );

    await Promise.all(songs.docs.map(snapshot => deleteDoc(snapshot.ref)));
    await deleteDoc(doc(db, PLAYLISTS_COLLECTION, playlistId));
  },
);
