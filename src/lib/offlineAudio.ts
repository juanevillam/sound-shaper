import * as FileSystem from 'expo-file-system/legacy';

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
// not. Apple's data-storage guidance asks that re-downloadable content be
// marked excluded from backup instead, and `expo-file-system` exposes no flag
// for it (neither API has one), so the mirror is backed up. Worth revisiting
// if a large library ever makes an iCloud backup conspicuous; not worth a
// native module today.
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
 */
const inFlight = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

/** The sound ids that already have a whole file on disk. */
export const listMirrored = async (): Promise<string[]> => {
  const names = await FileSystem.readDirectoryAsync(directory()).catch(
    () => [] as string[],
  );

  return names
    .filter(name => name.endsWith('.mp3'))
    .map(name => name.slice(0, -'.mp3'.length));
};

/**
 * Mirror one sound, or hand back the file that is already there. Resolves to
 * the local `file://` uri, or null when there is nothing to fetch (no url) and
 * when the fetch fails — the caller treats both as "still streaming".
 */
export const mirrorSound = (
  soundId: string,
  audioUrl: string,
): Promise<string | null> => {
  if (!soundId || !audioUrl) return Promise.resolve(null);

  const existing = inFlight.get(soundId);
  if (existing) return existing;

  const promise = queue
    .catch(() => {})
    .then(() => download(soundId, audioUrl))
    .catch(() => null)
    .then(uri => {
      if (!uri) inFlight.delete(soundId);
      return uri;
    });

  inFlight.set(soundId, promise);
  queue = promise;

  return promise;
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
  }
};

/**
 * Forget one sound's audio — its document is gone, so nothing can ask for it
 * again. Both halves, exactly as `forgetWaveform` does it: the file, and the
 * session's in-memory promise, since a re-uploaded file would be a NEW
 * document with a new id and must never resolve to the deleted one's bytes.
 */
export const removeMirroredSound = (soundId: string): void => {
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
  inFlight.clear();
  directoryEnsured = false;
  await FileSystem.deleteAsync(directory(), { idempotent: true }).catch(
    () => {},
  );
};

/** Files under ids the library no longer holds — a sound deleted elsewhere. */
export const pruneMirror = async (keepIds: Set<string>): Promise<void> => {
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
