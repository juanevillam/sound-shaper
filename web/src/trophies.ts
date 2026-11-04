import { useEffect, useSyncExternalStore } from 'react';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';

import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_CLIP_COUNT,
  TROPHY_CONFIGS,
  TROPHY_IDS,
} from '@app/constants/trophies';
import {
  TROPHIES_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@app/services/firebase/collections';
import {
  awardTrophy,
  configureTrophies,
  resetTrophies,
  useTrophyStore,
} from '@app/trophies/store';
import type {
  AwardedTrophy,
  TrophyPersistenceAdapter,
} from '@app/trophies/types';

import { db } from './firebase';
import type { Library } from './library';
import { playerState, subscribePlayer, usePlayer } from './player';

/**
 * THE APP'S TROPHIES ON THE WEB. The engine is the app's own
 * (`src/trophies/store.ts`: idempotent, optimistic, platinum auto-award), and
 * so are the set, the thresholds and the copy. What this file adds is what the
 * app keeps in its services and hooks: the Firestore adapter
 * (`services/firebase/trophies.ts`), the two server-side totals
 * (`lib/trophyCounters.ts`), the listening clock (`hooks/useListeningTime.ts`)
 * and the triggers (`hooks/useTrophyTriggers.ts`).
 */

const adapterFor = (uid: string): TrophyPersistenceAdapter => ({
  load: async () => {
    const snapshot = await getDocs(
      collection(db, USERS_COLLECTION, uid, TROPHIES_SUBCOLLECTION),
    );
    const awarded: Record<string, AwardedTrophy> = {};
    snapshot.docs.forEach(entry => {
      const achievedAt = entry.data().achievedAt as Timestamp | undefined;
      awarded[entry.id] = { achievedAt: achievedAt?.toMillis() ?? Date.now() };
    });
    return awarded;
  },
  // The server's time, not the optimistic one, so a reload shows the
  // canonical date; `merge` keeps a repeat write harmless.
  save: async trophyId => {
    await setDoc(
      doc(db, USERS_COLLECTION, uid, TROPHIES_SUBCOLLECTION, trophyId),
      { achievedAt: serverTimestamp() },
      { merge: true },
    );
  },
});

/* ── The two totals: minutes listened and clips saved ──
 *
 * A PERSON'S, NOT A DEVICE'S: they live on `users/{uid}` as
 * `listenedSeconds` and `clipsSaved`, moved only by `increment`, so a phone
 * and this tab add up instead of overwriting each other. What is held here
 * is the server's figure plus what this tab has not sent yet; it is sent on
 * the boundaries that end a stretch of listening, never per tick.
 */
type Counters = {
  uid: string | null;
  /** The server's totals have been read. Nothing is sent before. */
  hydrated: boolean;
  listened: number;
  clips: number;
  unsyncedListened: number;
  unsyncedClips: number;
};

const EMPTY: Counters = {
  uid: null,
  hydrated: false,
  listened: 0,
  clips: 0,
  unsyncedListened: 0,
  unsyncedClips: 0,
};

let counters: Counters = EMPTY;
/** Held while an account is deleted: a late `merge` would recreate the doc. */
let blocked = false;
const counterListeners = new Set<() => void>();

const setCounters = (patch: Partial<Counters>) => {
  counters = { ...counters, ...patch };
  counterListeners.forEach(listener => listener());
};

const useCounters = () =>
  useSyncExternalStore(
    listener => {
      counterListeners.add(listener);
      return () => counterListeners.delete(listener);
    },
    () => counters,
  );

export const blockTrophySync = (block: boolean) => {
  blocked = block;
};

const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Send what this tab holds. Fire-and-forget; a refusal keeps the credit. */
const push = () => {
  const { uid, hydrated, unsyncedListened, unsyncedClips } = counters;
  if (blocked || !uid || !hydrated) return;

  const listenedSeconds = Math.round(unsyncedListened);
  const clipsSaved = unsyncedClips;
  if (listenedSeconds <= 0 && clipsSaved <= 0) return;

  setCounters({
    unsyncedListened: unsyncedListened - listenedSeconds,
    unsyncedClips: 0,
  });

  setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      ...(listenedSeconds > 0
        ? { listenedSeconds: increment(listenedSeconds) }
        : null),
      ...(clipsSaved > 0 ? { clipsSaved: increment(clipsSaved) } : null),
    },
    { merge: true },
  ).catch(error => {
    console.warn('trophy counters', error);
    if (counters.uid !== uid) return;
    setCounters({
      unsyncedListened: counters.unsyncedListened + listenedSeconds,
      unsyncedClips: counters.unsyncedClips + clipsSaved,
    });
  });
};

const hydrate = async (uid: string) => {
  const data = (await getDoc(doc(db, USERS_COLLECTION, uid))).data() ?? {};
  if (counters.uid !== uid) return;
  setCounters({
    hydrated: true,
    listened: finite(data.listenedSeconds) + counters.unsyncedListened,
    clips: finite(data.clipsSaved) + counters.unsyncedClips,
  });
  push();
};

/** A clip was saved: the first-clip trophy, and one more toward Splicer. */
export const noteClipSaved = () => {
  awardTrophy(TROPHY_IDS.firstClip);
  setCounters({
    clips: counters.clips + 1,
    unsyncedClips: counters.unsyncedClips + 1,
  });
  push();
};

/* ── The listening clock ──
 *
 * It counts only sound that played: the playhead's own movement while
 * playing, with any jump over two seconds (a seek, a clip, a new sound)
 * dropped rather than banked. Credit reaches the total in five-second
 * blocks — the trophy is measured in minutes — and the server on a boundary.
 */
const MAX_STEP_S = 2;
const COMMIT_S = 5;

const startListeningClock = () => {
  let last: { id: string; position: number } | null = null;
  let pending = 0;
  let wasPlaying = false;
  let lastId: string | null = null;

  const commit = () => {
    if (pending <= 0) return;
    setCounters({
      listened: counters.listened + pending,
      unsyncedListened: counters.unsyncedListened + pending,
    });
    pending = 0;
  };
  const boundary = () => {
    commit();
    push();
  };

  const unsubscribe = subscribePlayer(() => {
    const { current, playing, position } = playerState();
    const id = current?.id ?? null;

    if (id !== lastId || (wasPlaying && !playing)) {
      boundary();
      last = null;
    }
    lastId = id;
    wasPlaying = playing;

    if (!playing || !id) return;
    if (last && last.id === id) {
      const delta = position - last.position;
      if (delta > 0 && delta <= MAX_STEP_S) {
        pending += delta;
        if (pending >= COMMIT_S) commit();
      }
    }
    last = { id, position };
  });

  // A hidden tab may be closed without another word.
  const onHide = () => {
    if (document.visibilityState === 'hidden') boundary();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', boundary);

  return () => {
    boundary();
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', boundary);
  };
};

/**
 * Mount once, in the signed-in app. Points the engine at this account,
 * reads the totals, runs the clock, and awards everything derivable from
 * live state — the app's `useTrophiesSync` and `useTrophyTriggers` in one.
 * Unmounting is signing out: everything resets, so the next account starts
 * clean.
 */
export const useTrophySystem = (uid: string, library: Library) => {
  useEffect(() => {
    counters = { ...EMPTY, uid };
    blocked = false;
    void configureTrophies(TROPHY_CONFIGS, adapterFor(uid));
    hydrate(uid).catch(error => console.warn('trophy counters', error));
    const stopClock = startListeningClock();

    return () => {
      stopClock();
      resetTrophies();
      setCounters(EMPTY);
    };
  }, [uid]);

  const hydrated = useTrophyStore(state => state.hydrated);
  const { hydrated: totals, listened, clips } = useCounters();
  const count = library.state === 'ready' ? library.sounds.length : null;
  // Shaping is anything the Shape summary would print: a curve, a speed,
  // Next Room or Echo.
  const shaped = usePlayer(
    s =>
      s.rate !== 1 ||
      s.nextRoom !== 'off' ||
      s.echo !== 'off' ||
      s.gains.some(gain => gain !== 0),
  );

  useEffect(() => {
    if (!hydrated) return;
    if (count !== null && count >= 1) awardTrophy(TROPHY_IDS.firstSound);
    if (count !== null && count >= LIBRARY_SOUND_COUNT)
      awardTrophy(TROPHY_IDS.library);
    if (totals && clips >= SAVED_CLIP_COUNT) awardTrophy(TROPHY_IDS.savedClips);
    if (totals && listened >= LISTENING_MINUTES * 60)
      awardTrophy(TROPHY_IDS.listening);
    if (shaped) awardTrophy(TROPHY_IDS.firstShape);
  }, [clips, count, hydrated, listened, shaped, totals]);
};
