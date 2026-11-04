import { useEffect, useState } from 'react';

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
import { byGridOrder } from '@app/lib/gridOrder';

import { db } from './firebase';

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

  useEffect(
    () =>
      onSnapshot(
        query(
          collection(db, USERS_COLLECTION, uid, SOUNDS_SUBCOLLECTION),
          orderBy('createdAt', 'desc'),
        ),
        snapshot =>
          setLibrary({
            state: 'ready',
            sounds: byGridOrder(
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
            ),
          }),
        error => {
          console.warn('library', error);
          setLibrary({ state: 'error' });
        },
      ),
    [uid],
  );

  return library;
};

/**
 * Where the person parked the add tile — `users/{uid}.addTilePosition`, the
 * app's own field. `null` until somebody moves it, which puts it first.
 */
export const useAddTilePosition = (uid: string): number | null => {
  const [position, setPosition] = useState<number | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, USERS_COLLECTION, uid),
        snapshot => setPosition(finite(snapshot.data()?.addTilePosition)),
        error => console.warn('add tile position', error),
      ),
    [uid],
  );

  return position;
};
