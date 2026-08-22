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
  SHAPES_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import { reported, reportedOnError } from '@/services/firebase/crashlytics';

// A saved shape is the whole sound config under a name — the EQ curve plus
// speed and keep-pitch — so "my late-night warm" is one tap away. Global to
// the account (shaping isn't per-sound), and personal like everything else.
export type Shape = {
  createdAt: number | null;
  /** Per-band dB in EQ_BANDS order (80 · 250 · 1k · 4k · 12k). */
  gains: number[];
  id: string;
  keepPitch: boolean;
  name: string;
  rate: number;
};

type CreateShapeParams = {
  gains: number[];
  keepPitch: boolean;
  name: string;
  rate: number;
};

type SubscribeToShapesParams = {
  onError: (error: Error) => void;
  onNext: (shapes: Shape[]) => void;
};

const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('shapes: no signed-in user');
  return uid;
};

const shapesCollection = () =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SHAPES_SUBCOLLECTION,
  );

const shapeToModel = (snapshot: QueryDocumentSnapshot): Shape => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;

  return {
    createdAt: createdAt ? createdAt.toMillis() : null,
    gains: (data.gains as number[]) ?? [],
    id: snapshot.id,
    keepPitch: (data.keepPitch as boolean) ?? false,
    name: (data.name as string) ?? '',
    rate: (data.rate as number) ?? 1,
  };
};

/** Live saved shapes, oldest first so the chip row stays stable as you add. */
export const subscribeToShapes = ({
  onError,
  onNext,
}: SubscribeToShapesParams): (() => void) => {
  const shapesQuery = query(shapesCollection(), orderBy('createdAt', 'asc'));

  return onSnapshot(shapesQuery, {
    error: reportedOnError('shapes.subscribeToShapes', onError),
    next: snapshot => onNext(snapshot.docs.map(shapeToModel)),
  });
};

export const createShape = reported(
  'shapes.createShape',
  async ({
    gains,
    keepPitch,
    name,
    rate,
  }: CreateShapeParams): Promise<string> => {
    const docRef = await addDoc(shapesCollection(), {
      createdAt: serverTimestamp(),
      gains,
      keepPitch,
      name,
      rate,
    });

    return docRef.id;
  },
);

export const deleteShape = reported(
  'shapes.deleteShape',
  async (shapeId: string): Promise<void> => {
    await deleteDoc(
      doc(
        getFirestore(),
        USERS_COLLECTION,
        requireUid(),
        SHAPES_SUBCOLLECTION,
        shapeId,
      ),
    );
  },
);
