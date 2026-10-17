import { excludeFromBackup } from '@modules/audio-session';
import * as FileSystem from 'expo-file-system/legacy';

import { recordError } from '@/services/firebase/crashlytics';

// ---------------------------------------------------------------------------
// THE OFFLINE MIRROR — every sound in the library, on the phone.
//
// The app streamed its audio from Cloudinary and nothing else, so with no
// signal it had no sounds: the library still listed them (Firestore's
// persistence answers from disk) and pressing play reached for a URL that
// could not be fetched. This module is the other half — a plain mirror of the
// mp3s, one file per sound id, written once and read forever after.
//
// WHY THE WHOLE LIBRARY, AUTOMATICALLY (Juan, 2026-09-14, for a trip with no
// signal at all). Apple Music's per-song download arrow is the alternative and
// it was rejected here for the reason a personal app exists: everything in
// this library is the person's own upload, there is nothing in it they did not
// choose to put there, and a control that asks "which of your own sounds do
// you want?" only creates a way to arrive somewhere with the wrong answer. The
// cost is storage — roughly the sum of the uploads — and that is the trade
// this app can afford where a streaming catalogue could not.
//
// IT LIVES IN `documentDirectory`, NOT IN THE CACHE. `cacheDirectory` is
// OS-purgeable, which is precisely the thing a flight cannot rely on — the
// waveform buckets live there because they self-heal in seconds and these do
// not. Apple's data-storage guidance asks that re-downloadable content kept
// there be EXCLUDED FROM BACKUP, and it is: `expo-file-system` exposes no flag
// for it (neither API has one), so `modules/audio-session` sets
// `isExcludedFromBackup` on the directory, once per session, as it is ensured.
// Everything here is a copy of a Cloudinary asset the library re-downloads on
// its own, so an iCloud backup carrying a whole library of mp3s would be
// storage spent on nothing — the restore would download them anyway.
//
// A DOWNLOAD LANDS ATOMICALLY. It is written to a `.part` file and moved into
// place, so a connection that dies mid-file can never leave a truncated mp3
// where a whole one is expected — which would play as a sound that stops
// early, the one failure mode worse than not having the file at all.
// ---------------------------------------------------------------------------

const directory = (): string => `${FileSystem.documentDirectory}offline-audio/`;

/** Where a sound's mirrored audio lives. The id is the whole filename. */
export const offlineAudioPath = (soundId: string): string =>
  `${directory()}${soundId}.mp3`;

const partPath = (soundId: string): string => `${directory()}${soundId}.part`;

let directoryEnsured = false;

const ensureDirectory = async (): Promise<void> => {
  if (directoryEnsured) return;
  await FileSystem.makeDirectoryAsync(directory(), {
    intermediates: true,
  }).catch(() => {});
  // Best-effort: a failure leaves the mirror in the backup, which is where it
  // always was. The attribute sits on the DIRECTORY, so `clearMirror` deleting
  // it is why that resets `directoryEnsured` — a recreated one is re-marked.
  try {
    excludeFromBackup(directory());
  } catch (error) {
    recordError(error, 'offlineAudio.excludeFromBackup');
  }
  directoryEnsured = true;
};

/**
 * ONE DOWNLOAD PER SOUND AT A TIME, AND ONE AT A TIME OVERALL.
 *
 * The in-flight map is `getWaveform`'s idiom — a second caller for the same id
 * joins the first rather than starting a second download of the same file, and
 * a FAILURE is evicted so the next sync pass retries it (offline once is not
 * offline forever).
 *
 * The queue behind it is deliberate too: a first sync of a whole library is
 * tens of files, and firing them together buys nothing on a phone's connection
 * while making every one of them slower to finish. Serial means the sounds
 * become playable in order rather than all at the end.
 *
 * TWO THINGS REORDER OR HOLD THE LINE, and both live here so every caller
 * gets them:
 *
 * - **The sound being STREAMED goes to the front** (`prioritizeMirror`). Its
 *   bytes are crossing the network anyway, and left in grid order its
 *   download would land later while competing with the very stream the
 *   person is listening to.
 * - **Nothing downloads off Wi-Fi** (`setMirrorAllowed`, Juan, 2026-10-17).
 *   A first sync is the whole library — 123 MB for 23 sounds, measured — and
 *   it repeats after every sign-in and reinstall, which is the person's data
 *   plan to spend, not ours. Jobs wait in the line and resume when Wi-Fi
 *   comes back; a file already mid-download finishes, since stopping it would
 *   waste what it has fetched. Streaming is untouched: a sound that is not
 *   mirrored still plays, as it always did.
 */
type MirrorJob = {
  soundId: string;
  audioUrl: string;
  resolve: (uri: string | null) => void;
};

const inFlight = new Map<string, Promise<string | null>>();
const waiting: MirrorJob[] = [];
let running = false;
/** `.part` files something is writing this session — never swept. */
const activeParts = new Set<string>();
/** Off until the network gate has said otherwise — see the note above. */
let allowed = false;

const pump = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    while (allowed && waiting.length > 0) {
      const job = waiting.shift();
      if (!job) break;
      const uri = await download(job.soundId, job.audioUrl).catch(() => null);
      if (!uri) inFlight.delete(job.soundId);
      job.resolve(uri);
    }
  } finally {
    running = false;
  }
};

/** Drop queued jobs (never the one downloading), resolving them as unmirrored. */
const dropWaiting = (keep: (soundId: string) => boolean): void => {
  for (let index = waiting.length - 1; index >= 0; index -= 1) {
    const job = waiting[index];
    if (keep(job.soundId)) continue;
    waiting.splice(index, 1);
    inFlight.delete(job.soundId);
    job.resolve(null);
  }
};

/** The network gate: true on Wi-Fi (or a wired connection), false otherwise. */
export const setMirrorAllowed = (value: boolean): void => {
  allowed = value;
  if (value) void pump();
};

/** Move a queued sound to the front of the line — it is being streamed now. */
export const prioritizeMirror = (soundId: string): void => {
  const index = waiting.findIndex(job => job.soundId === soundId);
  if (index > 0) waiting.unshift(...waiting.splice(index, 1));
};

/**
 * ORPHAN `.part` FILES ARE SWEPT ONCE PER SESSION, off the first listing.
 *
 * A download's `catch` deletes its own `.part`, but a process killed
 * mid-download never reaches it, and the next attempt at that sound only
 * overwrites the file if it ever runs — a sound deleted meanwhile leaves its
 * half-file forever. They sit in `documentDirectory`, which is permanent
 * storage, so they are not free. The first pass lists the directory before it
 * queues anything; a `.part` something is writing right now (a seed, or a
 * download already under way) is in `activeParts` and is never touched.
 */
let partsSwept = false;

const sweepOrphanParts = async (names: string[]): Promise<void> => {
  await Promise.all(
    names
      .filter(name => name.endsWith('.part'))
      .map(name => `${directory()}${name}`)
      .filter(path => !activeParts.has(path))
      .map(path =>
        FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}),
      ),
  );
};

/** The sound ids that already have a whole file on disk. */
export const listMirrored = async (): Promise<string[]> => {
  const names = await FileSystem.readDirectoryAsync(directory()).catch(
    () => [] as string[],
  );

  if (!partsSwept) {
    partsSwept = true;
    await sweepOrphanParts(names);
  }

  return names
    .filter(name => name.endsWith('.mp3'))
    .map(name => name.slice(0, -'.mp3'.length));
};

/**
 * Mirror one sound, or hand back the file that is already there. Resolves to
 * the local `file://` uri, or null when there is nothing to fetch (no url),
 * when the fetch fails and when the job is dropped — the caller treats all
 * three as "still streaming". Off Wi-Fi it stays pending until the gate opens.
 */
export const mirrorSound = (
  soundId: string,
  audioUrl: string,
): Promise<string | null> => {
  if (!soundId || !audioUrl) return Promise.resolve(null);

  const existing = inFlight.get(soundId);
  if (existing) return existing;

  const promise = new Promise<string | null>(resolve => {
    waiting.push({ soundId, audioUrl, resolve });
  });

  inFlight.set(soundId, promise);
  void pump();

  return promise;
};

/**
 * SEED THE MIRROR FROM A FILE ALREADY ON THE PHONE — a fresh upload's own
 * picked copy. The mirror used to download every new upload straight back
 * from Cloudinary, bytes the phone had just sent up. Nothing here touches the
 * network, so it is not held behind the Wi-Fi gate.
 *
 * Same atomic landing as a download (`.part`, then moved), and it takes the
 * sound's place in the line: a queued download of it is resolved by the seed
 * rather than run, and a seed that fails puts that job back, so the normal
 * path is what a failure leaves. A download already running for the sound is
 * left to finish; nothing is seeded under it.
 */
export const seedMirror = (
  soundId: string,
  localUri: string,
): Promise<string | null> => {
  if (!soundId || !localUri) return Promise.resolve(null);

  const previous = inFlight.get(soundId);
  const index = waiting.findIndex(job => job.soundId === soundId);
  // Running, or already mirrored this session: nothing to seed.
  if (previous && index === -1) return previous;
  const job = index === -1 ? undefined : waiting.splice(index, 1)[0];

  const promise = place(soundId, localUri)
    .catch(() => null)
    .then(uri => {
      if (uri) {
        job?.resolve(uri);
      } else if (job && previous) {
        // Hand the sound back to the download it displaced.
        waiting.unshift(job);
        inFlight.set(soundId, previous);
        void pump();
      } else {
        inFlight.delete(soundId);
      }
      return uri;
    });

  inFlight.set(soundId, promise);
  return promise;
};

/** Copy a local file into the mirror through its `.part`, atomically. */
const place = async (
  soundId: string,
  localUri: string,
): Promise<string | null> => {
  await ensureDirectory();

  const target = offlineAudioPath(soundId);
  const present = await FileSystem.getInfoAsync(target);
  if (present.exists && (present.size ?? 0) > 0) return target;

  const part = partPath(soundId);
  activeParts.add(part);
  try {
    await FileSystem.copyAsync({ from: localUri, to: part });
    const copied = await FileSystem.getInfoAsync(part);
    if (!copied.exists || (copied.size ?? 0) === 0) throw new Error('empty');
    await FileSystem.moveAsync({ from: part, to: target });
    return target;
  } catch {
    await FileSystem.deleteAsync(part, { idempotent: true }).catch(() => {});
    return null;
  } finally {
    activeParts.delete(part);
  }
};

const download = async (
  soundId: string,
  audioUrl: string,
): Promise<string | null> => {
  await ensureDirectory();

  const target = offlineAudioPath(soundId);
  const present = await FileSystem.getInfoAsync(target);
  if (present.exists && (present.size ?? 0) > 0) return target;

  const part = partPath(soundId);
  activeParts.add(part);
  try {
    const result = await FileSystem.downloadAsync(audioUrl, part);
    // A 404 or a Cloudinary error page is a successful HTTP round trip and a
    // useless file: taking only 2xx keeps an error body out of the mirror,
    // where it would look exactly like a downloaded sound.
    if (result.status < 200 || result.status > 299) throw new Error('http');

    await FileSystem.moveAsync({ from: part, to: target });
    return target;
  } catch {
    await FileSystem.deleteAsync(part, { idempotent: true }).catch(() => {});
    return null;
  } finally {
    activeParts.delete(part);
  }
};

/**
 * Forget one sound's audio — its document is gone, so nothing can ask for it
 * again. Both halves, exactly as `forgetWaveform` does it: the file, and the
 * session's in-memory promise, since a re-uploaded file would be a NEW
 * document with a new id and must never resolve to the deleted one's bytes.
 */
export const removeMirroredSound = (soundId: string): void => {
  dropWaiting(id => id !== soundId);
  inFlight.delete(soundId);
  void FileSystem.deleteAsync(offlineAudioPath(soundId), {
    idempotent: true,
  }).catch(() => {});
};

/**
 * Drop the whole mirror — the account signed out, so these files belong to
 * nobody on this device any more. Same rule as the persisted trophy counters
 * `useAuthListener` resets: a device-local cache is not a device-local FACT.
 * The next session re-mirrors what it finds, which is the correct cost.
 */
export const clearMirror = async (): Promise<void> => {
  dropWaiting(() => false);
  inFlight.clear();
  directoryEnsured = false;
  await FileSystem.deleteAsync(directory(), { idempotent: true }).catch(
    () => {},
  );
};

/** Files under ids the library no longer holds — a sound deleted elsewhere. */
export const pruneMirror = async (keepIds: Set<string>): Promise<void> => {
  dropWaiting(soundId => keepIds.has(soundId));
  const mirrored = await listMirrored();

  await Promise.all(
    mirrored
      .filter(soundId => !keepIds.has(soundId))
      .map(async soundId => {
        inFlight.delete(soundId);
        await FileSystem.deleteAsync(offlineAudioPath(soundId), {
          idempotent: true,
        }).catch(() => {});
      }),
  );
};
