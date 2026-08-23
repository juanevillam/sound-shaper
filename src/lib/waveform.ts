import * as FileSystem from 'expo-file-system/legacy';
import { decodeAudioData } from 'react-native-audio-api';

// The trim strip's waveform — RMS buckets decoded ONCE per sound, ever.
//
// Playback never holds PCM: the player streams the mp3 through a media
// element, which exposes no bytes. So the strip's waveform is its own
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

export type Waveform = {
  /** RMS per bucket, normalized so the loudest bucket is 1. */
  buckets: number[];
  bucketMs: number;
};

/** Bumps when the bucket shape changes, so stale JSON is never read. */
const CACHE_VERSION = 'v1';
const DECODE_SAMPLE_RATE = 8000;
/** 4 buckets per second, capped so a very long file stays bounded. */
const BUCKET_MS_MIN = 250;
const BUCKET_COUNT_MAX = 1200;

const memory = new Map<string, Promise<Waveform | null>>();

const cacheDir = () => `${FileSystem.cacheDirectory}waveforms/`;
const bucketsPath = (soundId: string) =>
  `${cacheDir()}${CACHE_VERSION}-${soundId}.json`;

export function getWaveform(
  soundId: string,
  audioUrl: string,
): Promise<Waveform | null> {
  const inFlight = memory.get(soundId);
  if (inFlight) return inFlight;

  const promise = compute(soundId, audioUrl)
    .catch(() => null)
    .then(waveform => {
      if (!waveform) memory.delete(soundId);
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
  const cached = await FileSystem.getInfoAsync(jsonPath);
  if (cached.exists) {
    const parsed = JSON.parse(
      await FileSystem.readAsStringAsync(jsonPath),
    ) as Waveform;
    if (Array.isArray(parsed.buckets) && parsed.buckets.length > 0) {
      return parsed;
    }
  }

  const mp3Path = `${cacheDir()}${soundId}.mp3`;
  try {
    await FileSystem.downloadAsync(audioUrl, mp3Path);
    const buffer = await decodeAudioData(mp3Path, DECODE_SAMPLE_RATE);
    const waveform = bucketize(
      buffer.getChannelData(0),
      buffer.sampleRate,
      buffer.duration,
    );
    if (!waveform) return null;
    await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(waveform));
    return waveform;
  } finally {
    FileSystem.deleteAsync(mp3Path, { idempotent: true }).catch(() => {});
  }
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
