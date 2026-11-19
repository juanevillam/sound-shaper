import { useEffect, useSyncExternalStore } from 'react';

import {
  CLIPS_SUBCOLLECTION,
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@app/services/firebase/collections';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';

import { auth, db } from './firebase';

/** The app's `Clip` (services/firebase/clips.ts): a bookmark into a sound. */
export type Clip = {
  createdAt: number | null;
  endMs: number;
  id: string;
  label: string;
  startMs: number;
};

const clipsOf = (soundId: string) => {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error('Not signed in');

  return collection(
    db,
    USERS_COLLECTION,
    uid,
    SOUNDS_SUBCOLLECTION,
    soundId,
    CLIPS_SUBCOLLECTION,
  );
};

const toClip = (id: string, data: Record<string, unknown>): Clip => ({
  createdAt: data.createdAt ? (data.createdAt as Timestamp).toMillis() : null,
  endMs: (data.endMs as number) ?? 0,
  id,
  label: (data.label as string) ?? '',
  startMs: (data.startMs as number) ?? 0,
});

/**
 * Every sound's clips the session has seen, keyed by sound id, each list in
 * the sheet's order (`startMs` ascending, the query's own). The open sound's
 * list is live; the others are read once when an All Clips run needs them —
 * the app's `getClipsOfSounds`, one read per sound, never a group query.
 */
let known: Record<string, Clip[] | undefined> = {};
let loaded: Record<string, true> = {};
const listeners = new Set<() => void>();
const activeSubs = new Map<string, { count: number; unsub: () => void }>();

const publish = (soundId: string, clips: Clip[]) => {
  known = { ...known, [soundId]: clips };
  loaded = { ...loaded, [soundId]: true };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const knownClips = () => known;

/** The open sound's clips, live; `null` until its first snapshot lands. */
export const useClips = (soundId: string | undefined): Clip[] | null => {
  useEffect(() => {
    if (!soundId) return;

    const existing = activeSubs.get(soundId);
    if (existing) {
      existing.count += 1;
    } else {
      const unsub = onSnapshot(
        query(clipsOf(soundId), orderBy('startMs', 'asc')),
        snapshot =>
          publish(
            soundId,
            snapshot.docs.map(d => toClip(d.id, d.data())),
          ),
        error => console.warn('clips', error),
      );
      activeSubs.set(soundId, { count: 1, unsub });
    }

    return () => {
      const entry = activeSubs.get(soundId);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count <= 0) {
        activeSubs.delete(soundId);
        entry.unsub();
      }
    };
  }, [soundId]);

  return useSyncExternalStore(subscribe, () =>
    soundId && loaded[soundId] ? (known[soundId] ?? null) : null,
  );
};

export const getClipsOfSounds = async (soundIds: readonly string[]) => {
  await Promise.all(
    soundIds
      .filter(id => !loaded[id])
      .map(async soundId => {
        try {
          const snapshot = await getDocs(
            query(clipsOf(soundId), orderBy('startMs', 'asc')),
          );
          publish(
            soundId,
            snapshot.docs.map(d => toClip(d.id, d.data())),
          );
        } catch (error) {
          console.warn('getClipsOfSounds', error);
        }
      }),
  );

  return known;
};

/** The id is minted here, so the list shows the clip before the server acks. */
export const createClip = (
  soundId: string,
  { startMs, endMs }: { startMs: number; endMs: number },
) => {
  const ref = doc(clipsOf(soundId));

  return setDoc(ref, {
    createdAt: serverTimestamp(),
    endMs: Math.round(endMs),
    label: '',
    startMs: Math.round(startMs),
  });
};

/** Re-frame a clip: only the range moves, as the app's `updateClip`. */
export const updateClip = (
  soundId: string,
  clipId: string,
  { startMs, endMs }: { startMs: number; endMs: number },
) =>
  updateDoc(doc(clipsOf(soundId), clipId), {
    endMs: Math.round(endMs),
    startMs: Math.round(startMs),
  });

export const deleteClip = (soundId: string, clipId: string) =>
  deleteDoc(doc(clipsOf(soundId), clipId));

/** Deleted sound: drop its cached clips. */
export const forgetClipsOfSound = (soundId: string) => {
  if (!(soundId in known) && !(soundId in loaded)) return;
  const nextKnown = { ...known };
  const nextLoaded = { ...loaded };
  delete nextKnown[soundId];
  delete nextLoaded[soundId];
  known = nextKnown;
  loaded = nextLoaded;
  listeners.forEach(listener => listener());
};

/** Sign-out: these are the signed-out account's clips. */
export const forgetClips = () => {
  activeSubs.forEach(entry => entry.unsub());
  activeSubs.clear();
  known = {};
  loaded = {};
  listeners.forEach(listener => listener());
};
