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

import { uploadSoundArt, uploadSoundAudio } from '@/services/cloudinary/upload';
import {
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

export type Sound = {
  album: string;
  artist: string;
  // Cover art from the file's ID3 tag, uploaded to Cloudinary. Empty when the
  // file carried none (SoundArt then shows the music glyph). `artPublicId` is
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

/**
 * ALBUM AND RELEASE YEAR ARE OPTIONAL, AND iOS NO LONGER SENDS THEM.
 *
 * The app does not handle either any more (Juan, 2026-08-21): the editor holds
 * a title and a subtitle and nothing else, and the read-only info sheet those
 * two fed is gone on iOS. They stay on the WRITE as optional rather than being
 * deleted outright for two reasons — existing documents carry values, and
 * `updateSound` writing `undefined` would leave them alone rather than clearing
 * them, which is what "not handled" should mean; and Android's editor still
 * passes both, because Android is frozen and cannot be verified (root
 * AGENTS.md). Delete them here when Android's twin catches up.
 */
type CreateSoundParams = {
  album?: string;
  artist: string;
  /**
   * A cover PICKED from the photo library, already uploaded. Wins over `art`:
   * the person choosing a picture outranks whatever the file happened to
   * carry.
   */
  cover?: { publicId: string; url: string } | null;
  /** ID3-embedded cover art bytes, when the file had them. */
  art: { base64: string; mime: string } | null;
  /** Local uri of the picked .mp3 (document-picker cache copy). */
  localAudioUri: string;
  name: string;
  releaseYear?: number | null;
};

type UpdateSoundParams = {
  album?: string;
  artist: string;
  name: string;
  releaseYear?: number | null;
  soundId: string;
  /**
   * A NEWLY PICKED cover, already uploaded. Omit to leave the existing artwork
   * alone — this is not a "clear the art" channel, and passing `null` would
   * read like one.
   *
   * The old Cloudinary asset ORPHANS when a cover is replaced. That is the same
   * accepted gap deleting a sound has: removing an asset needs a signed backend
   * call this app does not have (no Blaze plan, no Functions). Recorded rather
   * than hidden — see the app's AGENTS.md.
   */
  cover?: { publicId: string; url: string };
};

type SubscribeToSoundsParams = {
  onError: (error: Error) => void;
  onNext: (sounds: Sound[]) => void;
};

// The library is per-user: users/{uid}/sounds. Every call site runs behind the
// auth gate, so a missing user is a programmer error worth throwing on.
const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('sounds: no signed-in user');
  return uid;
};

const soundsCollection = () =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SOUNDS_SUBCOLLECTION,
  );

const soundDoc = (soundId: string) =>
  doc(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SOUNDS_SUBCOLLECTION,
    soundId,
  );

const soundToModel = (snapshot: QueryDocumentSnapshot): Sound => {
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

/**
 * The whole personal library, newest upload first.
 *
 * DELIBERATELY UNBOUNDED, and the reason is the word "personal". This is the
 * app's ONE session-long listener; it has to be live, because an upload has to
 * land on the grid without a refresh. Capping it would hide someone's own
 * sounds from their own library — a silent truncation of the only content the
 * app holds — so the fix for a huge library is PAGING (a cursor plus a "load
 * more" the grid drives), not a `limit()` bolted on here.
 *
 * The cost is bounded in practice by Firestore's disk cache, which is on by
 * default and which nothing in this app disables: a cold start replays the
 * library from disk and resumes the listener from its token, so only sounds
 * that actually CHANGED are billed after the first run. Revisit if a library
 * ever passes a few hundred sounds; nothing here is near that.
 */
export const subscribeToSounds = ({
  onError,
  onNext,
}: SubscribeToSoundsParams): (() => void) => {
  const soundsQuery = query(soundsCollection(), orderBy('createdAt', 'desc'));

  return onSnapshot(soundsQuery, {
    error: reportedOnError('sounds.subscribeToSounds', onError),
    next: snapshot => onNext(snapshot.docs.map(soundToModel)),
  });
};

/**
 * Create a sound: upload the audio to Cloudinary (the one big network wait — the
 * editor holds its Save spinner on it) plus any embedded art, then write the
 * sound doc.
 */
export const createSound = reported(
  'sounds.createSound',
  async ({
    album,
    artist,
    art,
    cover: pickedCover,
    localAudioUri,
    name,
    releaseYear,
  }: CreateSoundParams): Promise<string> => {
    const audio = await uploadSoundAudio(localAudioUri);
    // A picked cover is already uploaded; only fall back to the file's own tag
    // when the person did not choose one.
    const cover =
      pickedCover ?? (art ? await uploadSoundArt(art.base64, art.mime) : null);

    const docRef = await addDoc(soundsCollection(), {
      ...(album === undefined ? {} : { album }),
      artist,
      artPublicId: cover?.publicId ?? '',
      artUrl: cover?.url ?? '',
      audioPublicId: audio.publicId,
      audioUrl: audio.url,
      createdAt: serverTimestamp(),
      name,
      ...(releaseYear === undefined ? {} : { releaseYear }),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },
);

/** Update a sound's metadata (the audio file itself never changes). */
export const updateSound = reported(
  'sounds.updateSound',
  async ({
    album,
    artist,
    cover,
    name,
    releaseYear,
    soundId,
  }: UpdateSoundParams): Promise<void> => {
    await updateDoc(soundDoc(soundId), {
      ...(album === undefined ? {} : { album }),
      artist,
      name,
      ...(releaseYear === undefined ? {} : { releaseYear }),
      updatedAt: serverTimestamp(),
      ...(cover ? { artPublicId: cover.publicId, artUrl: cover.url } : {}),
    });
  },
);

/**
 * Remove a sound. The Cloudinary audio/art assets are left behind — destroying
 * them needs a signed API call (a backend this app deliberately doesn't have),
 * so orphaned assets are a known gap, same as Topper's pre-Functions state.
 */
export const deleteSound = reported(
  'sounds.deleteSound',
  async (soundId: string): Promise<void> => {
    await deleteDoc(soundDoc(soundId));
  },
);
