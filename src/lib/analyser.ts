import { audioEngine } from './audioEngine';

/**
 * Read-only acoustic sampler over the shared `AudioContext` post-DSP tap.
 *
 * Pure array arithmetic — zero allocations inside `requestAnimationFrame`,
 * zero React state updates on the main tree, matching `web/src/analyser.ts`.
 */

const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;
const MIN_DB = -84;
const MAX_DB = -10;
const DB_SPAN = MAX_DB - MIN_DB;

const freqScratch = new Float32Array(BIN_COUNT);
const waveScratch = new Float32Array(FFT_SIZE);

/**
 * Per-frame cache so multiple scopes (`EqScope`, `EchoScope`, `NextRoomScope`,
 * `ClipEditor`) ticking inside the same `requestAnimationFrame` batch share a
 * single `getFloatTimeDomainData` + `getFloatFrequencyData` + log-binning pass
 * instead of reading the native `AnalyserNode` 3–4 times per frame.
 */
const FRAME_WINDOW_MS = 4;
let lastWaveStamp = -Infinity;
let lastRms = 0;
let lastFreqStamp = -Infinity;
let lastSpecStamp = -Infinity;
let lastSpecKey = '';
let lastSpecCache = new Float32Array(0);

export type AudioSample = {
  active: boolean;
  /** Instantaneous post-DSP RMS amplitude, 0..1. */
  rms: number;
};

/**
 * Sample the post-DSP `AnalyserNode` into an optional caller-owned
 * `spectrumOut` buffer (log-spaced 0..1 magnitude across `[fLo, fHi]` Hz).
 */
export function sampleAudio(
  spectrumOut?: Float32Array,
  fLo = 20,
  fHi = 20000,
): AudioSample {
  const tap = audioEngine.getAudioTap?.();
  if (!tap || tap.context.state !== 'running') {
    spectrumOut?.fill(0);
    return { active: false, rms: 0 };
  }

  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const { analyser, context } = tap;

  if (now - lastWaveStamp > FRAME_WINDOW_MS) {
    analyser.getFloatTimeDomainData(waveScratch);
    let sumSq = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const s = waveScratch[i];
      sumSq += s * s;
    }
    lastRms = Math.sqrt(sumSq / FFT_SIZE);
    lastWaveStamp = now;
  }
  const rms = lastRms;

  if (spectrumOut && spectrumOut.length > 0) {
    const n = spectrumOut.length;
    const specKey = `${n}:${fLo}:${fHi}`;
    if (
      now - lastSpecStamp <= FRAME_WINDOW_MS &&
      lastSpecKey === specKey &&
      lastSpecCache.length === n
    ) {
      spectrumOut.set(lastSpecCache);
      return { active: rms > 0.0002, rms };
    }

    if (now - lastFreqStamp > FRAME_WINDOW_MS) {
      analyser.getFloatFrequencyData(freqScratch);
      lastFreqStamp = now;
    }

    const sr = context.sampleRate || 48000;
    const nyquist = sr / 2;
    const hi = Math.min(fHi, nyquist * 0.98);
    const ratio = hi / fLo;
    const hzToBin = FFT_SIZE / sr;

    for (let i = 0; i < n; i += 1) {
      const f0 = fLo * Math.pow(ratio, i / n);
      const f1 = fLo * Math.pow(ratio, (i + 1) / n);
      const b0 = f0 * hzToBin;
      const b1 = f1 * hzToBin;

      let magDb = MIN_DB;
      if (b1 - b0 < 1.25) {
        const bc = Math.sqrt(f0 * f1) * hzToBin;
        const lo = Math.max(1, Math.min(BIN_COUNT - 2, Math.floor(bc)));
        const frac = bc - lo;
        magDb = freqScratch[lo] * (1 - frac) + freqScratch[lo + 1] * frac;
      } else {
        const start = Math.max(1, Math.floor(b0));
        const end = Math.min(BIN_COUNT - 1, Math.ceil(b1));
        let peak = -160;
        let mean = 0;
        let count = 0;
        for (let b = start; b <= end; b += 1) {
          const v = freqScratch[b];
          if (v > peak) peak = v;
          mean += v;
          count += 1;
        }
        magDb = count > 0 ? peak * 0.65 + (mean / count) * 0.35 : MIN_DB;
      }

      const norm = Number.isFinite(magDb) ? (magDb - MIN_DB) / DB_SPAN : 0;
      spectrumOut[i] = Math.max(0, Math.min(1, norm));
    }

    if (lastSpecCache.length !== n) {
      lastSpecCache = new Float32Array(n);
    }
    lastSpecCache.set(spectrumOut);
    lastSpecKey = specKey;
    lastSpecStamp = now;
  }

  return { active: rms > 0.0002, rms };
}

/**
 * Compressor-shaped envelope (~120 ms attack, ~420 ms release).
 * Prevents transient strobing (docs/rejected-experiments.md).
 */
export function stepEnvelope(
  current: number,
  target: number,
  dtSeconds: number,
  attackS = 0.12,
  releaseS = 0.42,
): number {
  const tau = target > current ? attackS : releaseS;
  const alpha = 1 - Math.exp(-Math.max(0, dtSeconds) / tau);
  return current + (target - current) * alpha;
}
