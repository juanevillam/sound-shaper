import { useEffect, useState } from 'react';

/**
 * The clip editor's waveform — the app's `lib/waveform.ts` on the web: RMS
 * buckets at 50ms, normalised so the loudest is 1, decoded once per sound
 * per session. The player streams through a media element that exposes no
 * samples, so the editor fetches the file itself (Cloudinary answers CORS)
 * and decodes it at 8 kHz mono — the buckets keep nothing finer, and a
 * three-minute track is ~1.4M floats instead of ~16M.
 */
export type Waveform = { buckets: Float32Array; bucketMs: number };

const DECODE_SAMPLE_RATE = 8000;
const BUCKET_MS_MIN = 50;
const BUCKET_COUNT_MAX = 12000;

const memory = new Map<string, Promise<Waveform | null>>();
const resolved = new Map<string, Waveform>();

const decode = async (url: string): Promise<Waveform | null> => {
  const response = await fetch(url, { mode: 'cors' });

  if (!response.ok) throw new Error(`waveform ${response.status}`);

  const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
  const audio = await context.decodeAudioData(await response.arrayBuffer());
  const samples = audio.getChannelData(0);
  const durationS = samples.length / audio.sampleRate;
  const bucketMs = Math.max(
    BUCKET_MS_MIN,
    Math.ceil((durationS * 1000) / BUCKET_COUNT_MAX),
  );
  const perBucket = Math.max(
    1,
    Math.round((audio.sampleRate * bucketMs) / 1000),
  );
  const buckets = new Float32Array(Math.ceil(samples.length / perBucket));
  let peak = 0;

  for (let i = 0; i < buckets.length; i += 1) {
    const start = i * perBucket;
    const end = Math.min(start + perBucket, samples.length);
    let sum = 0;
    for (let s = start; s < end; s += 1) sum += samples[s] * samples[s];
    const rms = Math.sqrt(sum / Math.max(end - start, 1));
    buckets[i] = rms;
    if (rms > peak) peak = rms;
  }

  if (peak === 0) return null;
  for (let i = 0; i < buckets.length; i += 1) buckets[i] /= peak;

  return { buckets, bucketMs };
};

/** A failure is evicted so the next opening retries; a success stays. */
const getWaveform = (soundId: string, url: string) => {
  let pending = memory.get(soundId);

  if (!pending) {
    pending = decode(url).then(
      waveform => {
        if (waveform) resolved.set(soundId, waveform);
        else memory.delete(soundId);
        return waveform;
      },
      error => {
        console.warn('waveform', error);
        memory.delete(soundId);
        return null;
      },
    );
    memory.set(soundId, pending);
  }

  return pending;
};

export type WaveformState =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; waveform: Waveform };

export const useWaveform = (soundId: string, url: string): WaveformState => {
  const [value, setValue] = useState<WaveformState>(() => {
    const known = resolved.get(soundId);
    return known ? { state: 'ready', waveform: known } : { state: 'loading' };
  });

  useEffect(() => {
    let live = true;
    const known = resolved.get(soundId);

    if (known) {
      setValue({ state: 'ready', waveform: known });
      return;
    }
    setValue({ state: 'loading' });
    void getWaveform(soundId, url).then(waveform => {
      if (live)
        setValue(waveform ? { state: 'ready', waveform } : { state: 'failed' });
    });
    return () => {
      live = false;
    };
  }, [soundId, url]);

  return value;
};

/** The mean level over [fromS, toS) — how a bar wider than a bucket reads. */
export const levelAt = (waveform: Waveform, fromS: number, toS: number) => {
  const { buckets, bucketMs } = waveform;
  const from = Math.max(0, Math.floor((fromS * 1000) / bucketMs));
  const to = Math.min(
    buckets.length,
    Math.max(from + 1, Math.ceil((toS * 1000) / bucketMs)),
  );
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += buckets[i];
  return to > from ? sum / (to - from) : 0;
};

/** Sign-out: these are the signed-out account's sounds. */
export const forgetWaveforms = () => {
  memory.clear();
  resolved.clear();
};
