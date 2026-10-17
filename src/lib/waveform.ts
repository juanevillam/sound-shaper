import * as FileSystem from 'expo-file-system/legacy';
import { decodeAudioData } from 'react-native-audio-api';

import { offlineAudioPath } from './offlineAudio';

// The clip editor's waveform — RMS buckets decoded ONCE per sound, ever.
//
// RESTORED FROM f5b4117 (2026-08-26). The pipeline was deleted with the
// waveform trim strip, whose rejection was about the PLAYER CONSOLE — a
// second track-shaped surface beside the slider. It returns for the
// dedicated Voice Memos-style clip editor (Juan's direction), which has no
// competing progress surface; see docs/rejected-experiments.md's postscript.
//
// Playback never holds PCM: the player streams the mp3 through a media
// element, which exposes no bytes. So the editor's waveform is its own
// pipeline — download the file to cache, decode it NATIVELY by path
// (`decodeAudioData` with a local path hits `decodeWithFilePath`; handing it
// the https URL instead would pull the whole mp3 across the JS bridge as an
// ArrayBuffer), bucket it, persist the buckets, delete the mp3.
//
// DECODED AT 8 kHz ON PURPOSE. The decoder resamples to whatever rate it is
// given, the buckets keep none of the detail above what a 4-per-second bar
// can draw, and 8 kHz mono makes a 3-minute track ~1.4M floats instead of
// ~16M.
//
// A resolved failure is EVICTED from the in-flight map so the next clip-mode
// entry retries (offline once ≠ offline forever); a success stays for the
// session and the JSON on disk covers the sessions after it.
//
// A SUCCESS IS ALSO KEPT RESOLVED, beside the promise, so a caller can read it
// SYNCHRONOUSLY (`peekWaveform`). A promise that has already settled still
// hands its value over a microtask later, which is a whole render: reopening
// the clip editor on a sound it had already decoded stood the bone for one
// frame and then faded the bars in over it, as if the decode had just landed.
// Only successes go in — a failure is never cached, here or in the promise map.

export type Waveform = {
  /** RMS per bucket, normalized so the loudest bucket is 1. */
  buckets: number[];
  bucketMs: number;
};

/** Bumps when the bucket shape changes, so stale JSON is never read. */
const CACHE_VERSION = 'v2';
const DECODE_SAMPLE_RATE = 8000;
/**
 * 20 buckets per second — the strip needed only 4, but the editor's ZOOMED
 * view draws ~100pt per second and a 250ms bucket is a 25pt slab there.
 * 50ms puts a bar every 5pt at that scale, which is Voice Memos' density.
 * The cap bounds a pathological file: past ten minutes the buckets widen
 * instead of the JSON growing without limit (12000 × ~6 bytes ≈ 70KB).
 */
const BUCKET_MS_MIN = 50;
const BUCKET_COUNT_MAX = 12000;

const memory = new Map<string, Promise<Waveform | null>>();
const resolved = new Map<string, Waveform>();

const cacheDir = () => `${FileSystem.cacheDirectory}waveforms/`;
const bucketsPath = (soundId: string) =>
  `${cacheDir()}${CACHE_VERSION}-${soundId}.json`;

/**
 * A VERSION BUMP HAS TO TAKE THE OLD ENTRIES WITH IT.
 *
 * The key carries `CACHE_VERSION` so stale buckets can never be READ, which was
 * the correctness half and was always right. The other half was missing: the
 * superseded files just stayed. Found on device — the cache directory held
 * `v1-1otjN10UymuRzSUF7hFC.json` and `v1-smExU3E7bAdVhFkCZ7hS.json` sitting
 * beside their v2 replacements, stranded by the 250 → 50ms bucket change, and
 * nothing would ever have removed them. A derived cache that only grows is a
 * defect even when every entry in it is unreadable.
 *
 * Once per session, lazily, off the first `getWaveform` — the clip editor is
 * the only caller, so an app that never opens it pays nothing. Fire-and-forget:
 * a failed sweep just means the files are still there next time.
 */
let pruned = false;
const pruneStaleVersions = async (): Promise<void> => {
  const names = await FileSystem.readDirectoryAsync(cacheDir()).catch(
    () => [] as string[],
  );

  await Promise.all(
    names
      // `.json` only — an in-flight `<soundId>.mp3` belongs to a decode that
      // is still running, and its own `finally` deletes it.
      .filter(name => name.endsWith('.json'))
      .filter(name => !name.startsWith(`${CACHE_VERSION}-`))
      .map(name =>
        FileSystem.deleteAsync(`${cacheDir()}${name}`, {
          idempotent: true,
        }).catch(() => {}),
      ),
  );
};

/**
 * Forget one sound's buckets — its document is gone, so they can never be
 * asked for again. Both halves: the JSON on disk and the session's in-memory
 * promise, since a re-uploaded file would be a NEW document with a new id and
 * must never resolve to the deleted one's shape.
 *
 * NOT wired into the account-deletion sweep, deliberately. That path deletes
 * sound documents directly rather than through `deleteSound`, and once the
 * account is gone the leftovers are unreachable JSON in an OS-purgeable cache
 * directory keyed by ids that can never recur — growing a destructive path to
 * chase them would cost more than it saves.
 */
export function forgetWaveform(soundId: string): void {
  memory.delete(soundId);
  resolved.delete(soundId);
  FileSystem.deleteAsync(bucketsPath(soundId), { idempotent: true }).catch(
    () => {},
  );
}

/**
 * Forget EVERY sound's buckets — the sign-out wipe (`useAuthListener`). The
 * JSON on disk is a picture of the signed-out account's sounds, filed under
 * that account's document ids, and the session maps hold the same thing in
 * memory; a device-local cache is not a device-local fact, so both go, the
 * way the offline mirror does. Fire-and-forget: the next session decodes what
 * it opens.
 */
export function clearWaveforms(): Promise<void> {
  memory.clear();
  resolved.clear();
  return FileSystem.deleteAsync(cacheDir(), { idempotent: true }).catch(
    () => {},
  );
}

/**
 * The buckets this session already decoded (or read from disk) for a sound,
 * or `undefined` — synchronous, so a surface can stand on its first frame what
 * it already has. It never starts work and never reports a failure.
 */
export function peekWaveform(soundId: string): Waveform | undefined {
  return resolved.get(soundId);
}

export function getWaveform(
  soundId: string,
  audioUrl: string,
): Promise<Waveform | null> {
  if (!pruned) {
    pruned = true;
    void pruneStaleVersions();
  }

  const inFlight = memory.get(soundId);
  if (inFlight) return inFlight;

  const promise = compute(soundId, audioUrl)
    .catch(() => null)
    .then(waveform => {
      // Checked against the map so a `forgetWaveform` that landed while this
      // was in flight is not undone by its late resolution.
      if (!waveform) memory.delete(soundId);
      else if (memory.get(soundId) === promise) resolved.set(soundId, waveform);
      return waveform;
    });
  memory.set(soundId, promise);
  return promise;
}

async function compute(
  soundId: string,
  audioUrl: string,
): Promise<Waveform | null> {
  await FileSystem.makeDirectoryAsync(cacheDir(), {
    intermediates: true,
  }).catch(() => {});

  const jsonPath = bucketsPath(soundId);
  const cached = await readCached(jsonPath);
  if (cached) return cached;

  /**
   * THE OFFLINE MIRROR ALREADY HAS THE FILE, USUALLY — every sound in the
   * library is on the phone (`lib/offlineAudio.ts`), so the decode reads that
   * copy instead of pulling the mp3 down a second time. It also makes the clip
   * editor work with no signal, which the download below never could.
   *
   * The borrowed file is NOT OURS TO DELETE, which is what the two paths below
   * separate: only a file this function fetched is removed afterwards.
   */
  const mirrored = offlineAudioPath(soundId);
  const mirroredInfo = await FileSystem.getInfoAsync(mirrored);
  const borrowed = mirroredInfo.exists && (mirroredInfo.size ?? 0) > 0;
  const mp3Path = borrowed ? mirrored : `${cacheDir()}${soundId}.mp3`;

  try {
    if (!borrowed) await FileSystem.downloadAsync(audioUrl, mp3Path);
    const buffer = await decodeAudioData(mp3Path, DECODE_SAMPLE_RATE);
    const waveform = bucketize(
      buffer.getChannelData(0),
      buffer.sampleRate,
      buffer.duration,
    );
    if (!waveform) return null;
    // WRITTEN BESIDE, THEN MOVED INTO PLACE — the offline mirror's own rule. A
    // process killed mid-write used to leave a truncated JSON under the real
    // name, and `readCached` is what now survives one; this stops making them.
    const tempPath = `${jsonPath}.tmp`;
    await FileSystem.writeAsStringAsync(tempPath, JSON.stringify(waveform));
    await FileSystem.deleteAsync(jsonPath, { idempotent: true });
    await FileSystem.moveAsync({ from: tempPath, to: jsonPath });
    return waveform;
  } finally {
    if (!borrowed)
      FileSystem.deleteAsync(mp3Path, { idempotent: true }).catch(() => {});
  }
}

/**
 * The buckets on disk, or `null` when there are none worth trusting.
 *
 * A FILE THAT DOES NOT PARSE IS DELETED, so the caller decodes again. It used
 * to throw out of `compute`, which `getWaveform` turned into a failure — and
 * since the file was still there next time, that sound's waveform failed for
 * good. A corrupt cache entry is a miss, never a verdict.
 */
async function readCached(jsonPath: string): Promise<Waveform | null> {
  const info = await FileSystem.getInfoAsync(jsonPath);
  if (!info.exists) return null;
  try {
    const parsed = JSON.parse(
      await FileSystem.readAsStringAsync(jsonPath),
    ) as Waveform;
    if (Array.isArray(parsed.buckets) && parsed.buckets.length > 0) {
      return parsed;
    }
  } catch {
    await FileSystem.deleteAsync(jsonPath, { idempotent: true }).catch(
      () => {},
    );
  }
  return null;
}

function bucketize(
  samples: Float32Array,
  sampleRate: number,
  durationS: number,
): Waveform | null {
  if (samples.length === 0 || durationS <= 0) return null;

  const bucketMs = Math.max(
    BUCKET_MS_MIN,
    Math.ceil((durationS * 1000) / BUCKET_COUNT_MAX),
  );
  const samplesPerBucket = Math.max(
    1,
    Math.round((sampleRate * bucketMs) / 1000),
  );
  const count = Math.ceil(samples.length / samplesPerBucket);

  const buckets = new Array<number>(count);
  let peak = 0;
  for (let i = 0; i < count; i += 1) {
    const start = i * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, samples.length);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += samples[j] * samples[j];
    const rms = Math.sqrt(sum / Math.max(end - start, 1));
    buckets[i] = rms;
    if (rms > peak) peak = rms;
  }
  if (peak === 0) return null;

  for (let i = 0; i < count; i += 1) {
    buckets[i] = Math.round((buckets[i] / peak) * 1000) / 1000;
  }
  return { bucketMs, buckets };
}
