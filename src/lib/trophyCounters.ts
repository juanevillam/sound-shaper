import {
  incrementTrophyCounters,
  type UserProfile,
} from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { useListeningStore } from '@/store/listening';

/**
 * THE TWO TROPHY TOTALS ARE A PERSON'S, NOT A PHONE'S (gate 2d, 2026-10-16).
 * Minutes listened and clips saved used to live in AsyncStorage alone, so a
 * reinstall or a second device started Listener and Splicer from zero. The
 * fact is on `users/{uid}` now; the two stores are its cache and its buffer.
 *
 * WHEN IT IS SENT. Not on `useListeningTime`'s 5-second blocks — pointed at
 * Firestore that cadence is 720 writes per listening hour — but on the
 * boundaries that end a stretch of listening (pause, sound change, the app
 * going to the background, sign-out) and straight away for a saved clip.
 *
 * THE BUFFER IS EMPTIED WHEN THE WRITE IS ISSUED, not when it is acknowledged.
 * Firestore queues an offline write on disk and sends it when it can, so
 * waiting for the ack would send the same seconds twice; only a REJECTED write
 * puts them back.
 */

/**
 * Held while an account is being deleted. An increment is a `merge`, so one
 * landing after the Firestore sweep would recreate `users/{uid}` with nothing
 * but two counters in it — a document outliving the account it belonged to.
 */
let blocked = false;

export const blockTrophyCounterSync = (block: boolean): void => {
  blocked = block;
};

/**
 * The account whose server totals the cache has taken. Nothing is sent before
 * that: a push ahead of hydration followed by an account with no total yet
 * would have its buffer re-filled with the whole local total, and the seconds
 * sent first would count twice.
 */
let hydratedUid: string | null = null;

/** Sign-out: the next account hydrates afresh. */
export const resetTrophyCounterSync = (): void => {
  hydratedUid = null;
  blocked = false;
};

/** Send whatever the two buffers hold. Fire-and-forget. */
export const pushTrophyCounters = (): void => {
  const uid = useAuthStore.getState().user?.uid;
  const listening = useListeningStore.getState();
  const clips = useClipsSavedStore.getState();
  if (blocked || !uid || uid !== hydratedUid) return;

  const listenedSeconds = listening.unsynced;
  const clipsSaved = clips.unsynced;
  if (listenedSeconds <= 0 && clipsSaved <= 0) return;

  useListeningStore.setState(s => ({ unsynced: s.unsynced - listenedSeconds }));
  useClipsSavedStore.setState(s => ({ unsynced: s.unsynced - clipsSaved }));

  incrementTrophyCounters({ clipsSaved, listenedSeconds, uid }).catch(() => {
    // Rejected (not merely offline — that queues): keep the credit for the
    // next boundary, unless the account changed in the meantime.
    if (useAuthStore.getState().user?.uid !== uid) return;
    useListeningStore.setState(s => ({
      unsynced: s.unsynced + listenedSeconds,
    }));
    useClipsSavedStore.setState(s => ({ unsynced: s.unsynced + clipsSaved }));
  });
};

const afterLocalHydration = (): Promise<void> =>
  Promise.all(
    [useListeningStore, useClipsSavedStore].map(store =>
      store.persist.hasHydrated()
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            const unsubscribe = store.persist.onFinishHydration(() => {
              unsubscribe();
              resolve();
            });
          }),
    ),
  ).then(() => undefined);

/**
 * Take the server's totals as the truth, keeping what this device has not
 * sent yet on top of them — then send it.
 *
 * AN ACCOUNT THE SERVER HAS NO TOTAL FOR adopts this device's: everything it
 * banked before the totals moved server-side becomes the buffer, so the
 * progress made on the phone up to today is uploaded rather than lost. The
 * sign-out reset is what keeps that from crossing accounts — a second
 * account on this phone starts from an empty cache, not from the first one's.
 */
export const hydrateTrophyCounters = async (
  profile: UserProfile,
): Promise<void> => {
  await afterLocalHydration();
  if (useAuthStore.getState().user?.uid !== profile.uid) return;

  const listening = useListeningStore.getState();
  if (profile.listenedSeconds === null) {
    useListeningStore.setState({ unsynced: listening.seconds });
  } else {
    useListeningStore.setState({
      seconds: profile.listenedSeconds + listening.unsynced,
    });
  }

  const clips = useClipsSavedStore.getState();
  if (profile.clipsSaved === null) {
    useClipsSavedStore.setState({ unsynced: clips.count });
  } else {
    useClipsSavedStore.setState({ count: profile.clipsSaved + clips.unsynced });
  }

  hydratedUid = profile.uid;
  pushTrophyCounters();
};
