import { useEffect, useRef, useState } from 'react';

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';

import {
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@app/services/firebase/collections';
import { byGridOrder, needsPositionRepair } from '@app/lib/gridOrder';

import { db } from './firebase';
import { syncLibrary } from './player';
import { backfillSoundPositions } from './sounds';

/** The fields the web reads of the app's `Sound` (services/firebase/sounds.ts). */
export type Sound = {
  artist: string;
  artUrl: string;
  audioUrl: string;
  createdAt: number | null;
  durationMs: number | null;
  id: string;
  name: string;
  position: number | null;
};

export type Library =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; sounds: Sound[] };

const millis = (value: unknown) =>
  value ? (value as Timestamp).toMillis() : null;

const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The library, live, in the person's own hand order — the app's listener. */
export const useLibrary = (uid: string): Library => {
  const [library, setLibrary] = useState<Library>({ state: 'loading' });
  const repairing = useRef(false);

  useEffect(
    () =>
      onSnapshot(
        query(
          collection(db, USERS_COLLECTION, uid, SOUNDS_SUBCOLLECTION),
          orderBy('createdAt', 'desc'),
        ),
        snapshot => {
          const sounds = byGridOrder(
            snapshot.docs.map(d => {
              const data = d.data();

              return {
                artist: (data.artist as string) ?? '',
                artUrl: (data.artUrl as string) ?? '',
                audioUrl: (data.audioUrl as string) ?? '',
                createdAt: millis(data.createdAt),
                durationMs: finite(data.durationMs),
                id: d.id,
                name: (data.name as string) ?? '',
                position: finite(data.position),
              };
            }),
          );

          syncLibrary(sounds);
          setLibrary({ state: 'ready', sounds });

          if (
            !repairing.current &&
            !snapshot.metadata.fromCache &&
            sounds.length > 0 &&
            needsPositionRepair(sounds)
          ) {
            repairing.current = true;
            backfillSoundPositions(sounds)
              .catch(error => console.warn('repair positions', error))
              .finally(() => {
                repairing.current = false;
              });
          }
        },
        error => {
          console.warn('library', error);
          setLibrary({ state: 'error' });
        },
      ),
    [uid],
  );

  return library;
};

const addTileCacheKey = (uid: string) => `soundshaper.addTilePos.${uid}`;

const readCachedAddTilePos = (uid: string): number | null => {
  try {
    const raw = localStorage.getItem(addTileCacheKey(uid));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

/**
 * Where the person parked the add tile — `users/{uid}.addTilePosition`, the
 * app's own field. `null` until somebody moves it, which puts it first.
 */
export const useAddTilePosition = (uid: string): number | null => {
  const [position, setPosition] = useState<number | null>(() =>
    readCachedAddTilePos(uid),
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, USERS_COLLECTION, uid),
        snapshot => {
          const next = finite(snapshot.data()?.addTilePosition);
          setPosition(next);
          try {
            if (next === null) localStorage.removeItem(addTileCacheKey(uid));
            else localStorage.setItem(addTileCacheKey(uid), String(next));
          } catch {
            // Ignore storage errors.
          }
        },
        error => console.warn('add tile position', error),
      ),
    [uid],
  );

  return position;
};
