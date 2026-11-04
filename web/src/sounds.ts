import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { positionBetween } from '@app/lib/gridOrder';
import {
  CLIPS_SUBCOLLECTION,
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@app/services/firebase/collections';

import { auth, db } from './firebase';
import { forgetOfflineSound } from './offline';
import type { Sound } from './library';
import { destroyAsset, uploadAudio, uploadImage, type Asset } from './media';

/**
 * The app's sound writes (services/firebase/sounds.ts) on the web — the same
 * documents, the same order of operations, the same reasons for it.
 */
const soundsOf = () => {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error('Not signed in');

  return collection(db, USERS_COLLECTION, uid, SOUNDS_SUBCOLLECTION);
};

/** A NEW UPLOAD LANDS AT THE FRONT — ahead of the first sound, not the add tile. */
export const leadPosition = (sounds: readonly Sound[]) => {
  const positions = sounds
    .map(sound => sound.position)
    .filter((position): position is number => position !== null);

  return positions.length
    ? (positionBetween(null, Math.min(...positions)) ?? 0)
    : 0;
};

/** What the editor's artwork slot holds when it is saved. */
export type CoverChoice =
  | { kind: 'keep' }
  | { kind: 'clear' }
  | { kind: 'file'; file: Blob };

export const createSound = async ({
  artist,
  audio: audioFile,
  cover,
  name,
  position,
}: {
  artist: string;
  audio: File;
  cover: Blob | null;
  name: string;
  position: number;
}): Promise<string> => {
  const audio = await uploadAudio(audioFile);

  // AN MP3 NOTHING POINTS AT IS NOT FREE: a failure after it lands
  // destroys it before the failure propagates.
  const abandon = (error: unknown): never => {
    void destroyAsset(audio.publicId, 'video');
    throw error;
  };

  const art: Asset | null = cover
    ? await uploadImage(cover).catch(abandon)
    : null;

  const ref = await addDoc(soundsOf(), {
    artist,
    artPublicId: art?.publicId ?? '',
    artUrl: art?.url ?? '',
    audioPublicId: audio.publicId,
    audioUrl: audio.url,
    createdAt: serverTimestamp(),
    ...(audio.durationMs === null ? {} : { durationMs: audio.durationMs }),
    name,
    position,
    updatedAt: serverTimestamp(),
  }).catch(error => {
    if (art) void destroyAsset(art.publicId, 'image');
    return abandon(error);
  });

  return ref.id;
};

/**
 * Rename, re-credit, re-cover. A replaced or cleared cover is destroyed AFTER
 * the write that stops naming it — never before, so no document is ever left
 * pointing at a dead asset.
 */
export const updateSound = async ({
  artist,
  cover,
  name,
  soundId,
}: {
  artist: string;
  cover: CoverChoice;
  name: string;
  soundId: string;
}) => {
  const ref = doc(soundsOf(), soundId);
  const previous =
    cover.kind === 'keep'
      ? ''
      : (((await getDoc(ref)).data()?.artPublicId as string) ?? '');
  const art = cover.kind === 'file' ? await uploadImage(cover.file) : null;

  await updateDoc(ref, {
    artist,
    name,
    updatedAt: serverTimestamp(),
    ...(cover.kind === 'keep'
      ? {}
      : { artPublicId: art?.publicId ?? '', artUrl: art?.url ?? '' }),
  });

  if (previous && previous !== art?.publicId)
    await destroyAsset(previous, 'image');
};

/**
 * ITS CLIPS FIRST, then the document, then its media: Firestore does not
 * delete a subcollection with its parent, and the account sweep finds clips
 * only by walking the sounds that still exist.
 */
export const deleteSound = async (soundId: string) => {
  const ref = doc(soundsOf(), soundId);
  const data = (await getDoc(ref)).data();
  const clips = await getDocs(collection(ref, CLIPS_SUBCOLLECTION));

  await Promise.all(clips.docs.map(clip => deleteDoc(clip.ref)));
  await deleteDoc(ref);
  await Promise.all([
    destroyAsset((data?.audioPublicId as string) ?? '', 'video'),
    destroyAsset((data?.artPublicId as string) ?? '', 'image'),
    forgetOfflineSound([
      (data?.audioUrl as string) ?? '',
      (data?.artUrl as string) ?? '',
    ]),
  ]);
};

/**
 * The app's `moveSound`: ONE document per move, which is the whole point of
 * the fractional index (`lib/gridOrder.ts`). No `updatedAt` — where a tile
 * sits is not an edit of the sound.
 */
export const moveSound = (soundId: string, position: number) =>
  updateDoc(doc(soundsOf(), soundId), { position });

/** The app's `setAddTilePosition`: the add tile is a cell in the order too. */
export const setAddTilePosition = (position: number) => {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error('Not signed in');

  return setDoc(
    doc(db, USERS_COLLECTION, uid),
    { addTilePosition: position },
    { merge: true },
  );
};

/**
 * The whole order re-spaced, for the one case a move cannot be given a slot
 * (float64 out of room between two neighbours) — the app's
 * `renormalizeSoundPositions` plus the add tile, in one batch.
 */
export const renormalizeOrder = async (
  order: Array<{ id: string; position: number }>,
  addTileKey: string,
) => {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error('Not signed in');

  const batch = writeBatch(db);
  for (const entry of order)
    if (entry.id === addTileKey)
      batch.set(
        doc(db, USERS_COLLECTION, uid),
        { addTilePosition: entry.position },
        { merge: true },
      );
    else batch.update(doc(soundsOf(), entry.id), { position: entry.position });
  await batch.commit();
};
