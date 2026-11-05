// ---------------------------------------------------------------------------
// AUTO DJ — THE DJ'S OWN SOUNDS. The riser that climbs into a change, the
// impact that lands on it, the downlifter that falls away after it — the
// synthetic glue every DJ set has between records, and what keeps a cut from
// sounding like a skip (Juan, 2026-11-04: "las canciones entran de repente").
//
// THEY ARE SYNTHESISED, NOT SAMPLED: noise and sine sweeps shaped in plain
// JS, a few hundred milliseconds of work once per session. No asset ships,
// nothing is licensed, and a seed gives each one a slightly different take.
// Pure, so it is unit-tested; `djFx.ts` plays them.
//
// Each comes with `alignS` — the point in it that should land ON the cut:
// the END of anything that rises into a change, the START of anything that
// lands on one.
// ---------------------------------------------------------------------------

import { rng } from './plan';

export type FxName =
  | 'riser'
  | 'reverseCymbal'
  | 'impact'
  | 'downlifter'
  | 'zap';

export type FxSound = {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  durationS: number;
  /** Seconds into the sound that belong on the cut. */
  alignS: number;
};

/** The loudest sample each sound may reach — under the music, not over it. */
export const FX_PEAK: Record<FxName, number> = {
  riser: 0.22,
  reverseCymbal: 0.2,
  impact: 0.45,
  downlifter: 0.2,
  zap: 0.22,
};

/** Sounds that build INTO the cut, and sounds that land ON it. */
export const BEFORE_CUT: FxName[] = ['riser', 'reverseCymbal'];
export const ON_CUT: FxName[] = ['impact', 'downlifter', 'zap'];

const lpAlpha = (hz: number, rate: number) =>
  1 - Math.exp((-2 * Math.PI * hz) / rate);

/** Exponential glide from `a` to `b` as `k` goes 0 → 1. */
const glide = (a: number, b: number, k: number) => a * Math.pow(b / a, k);

function normalise(sound: FxSound, peak: number): FxSound {
  let max = 0;
  for (const ch of [sound.left, sound.right]) {
    for (let i = 0; i < ch.length; i += 1) max = Math.max(max, Math.abs(ch[i]));
  }
  const k = max > 0 ? peak / max : 0;
  for (const ch of [sound.left, sound.right]) {
    for (let i = 0; i < ch.length; i += 1) ch[i] *= k;
  }
  return sound;
}

/** A short fade at each end, so no sound starts or stops on a click. */
function edges(ch: Float32Array, rate: number, inS = 0.004, outS = 0.01) {
  const a = Math.max(1, Math.floor(inS * rate));
  const b = Math.max(1, Math.floor(outS * rate));
  for (let i = 0; i < a && i < ch.length; i += 1) ch[i] *= i / a;
  for (let i = 0; i < b && i < ch.length; i += 1)
    ch[ch.length - 1 - i] *= i / b;
}

/**
 * NOISE SWEPT THROUGH A MOVING BAND — a low-pass and a high-pass riding a
 * cutoff from `fromHz` to `toHz`, the band being the space between them.
 * The heart of the riser and the downlifter.
 */
function sweptNoise(
  length: number,
  rate: number,
  random: () => number,
  fromHz: number,
  toHz: number,
  envelope: (k: number) => number,
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length);
  let low = 0;
  let high = 0;
  for (let i = 0; i < length; i += 1) {
    const k = i / length;
    const hz = glide(fromHz, toHz, k);
    const x = random() * 2 - 1;
    low += lpAlpha(Math.min(rate * 0.45, hz * 2.5), rate) * (x - low);
    high += lpAlpha(hz * 0.5, rate) * (low - high);
    out[i] = (low - high) * envelope(k);
  }
  return out;
}

function riser(rate: number, random: () => number, lengthS: number): FxSound {
  const length = Math.floor(lengthS * rate);
  const env = (k: number) => k * k * (0.3 + 0.7 * k);
  const left = sweptNoise(length, rate, random, 300, 9000, env);
  const right = sweptNoise(length, rate, random, 300, 9000, env);
  // A tone climbing with it, under the noise.
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const k = i / length;
    phase += (2 * Math.PI * glide(180, 1400, k)) / rate;
    const tone = Math.sin(phase) * 0.12 * env(k);
    left[i] += tone;
    right[i] += tone;
  }
  edges(left, rate, 0.004, 0.006);
  edges(right, rate, 0.004, 0.006);
  return { left, right, durationS: lengthS, alignS: lengthS };
}

function reverseCymbal(
  rate: number,
  random: () => number,
  lengthS: number,
): FxSound {
  const length = Math.floor(lengthS * rate);
  const make = () => {
    const out = new Float32Array(length);
    let low = 0;
    const a = lpAlpha(5000, rate);
    for (let i = 0; i < length; i += 1) {
      const x = random() * 2 - 1;
      low += a * (x - low);
      // High-passed noise, swelling the way a cymbal decays, backwards.
      out[i] = (x - low) * Math.exp(5 * (i / length - 1));
    }
    edges(out, rate, 0.004, 0.012);
    return out;
  };
  return { left: make(), right: make(), durationS: lengthS, alignS: lengthS };
}

function impact(rate: number, random: () => number): FxSound {
  const lengthS = 2;
  const length = Math.floor(lengthS * rate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let phase = 0;
  let burstL = 0;
  let burstR = 0;
  let tailL = 0;
  let tailR = 0;
  const aBurst = lpAlpha(2500, rate);
  const aTail = lpAlpha(700, rate);
  for (let i = 0; i < length; i += 1) {
    const t = i / rate;
    // The boom: a sine falling from 90 to 38 Hz.
    phase += (2 * Math.PI * glide(90, 38, Math.min(1, t / 0.4))) / rate;
    const boom = Math.sin(phase) * Math.exp(-t / 0.45);
    // The hit: a short burst of dark noise.
    burstL += aBurst * (random() * 2 - 1 - burstL);
    burstR += aBurst * (random() * 2 - 1 - burstR);
    const hit = Math.exp(-t / 0.035);
    // The air it leaves behind.
    tailL += aTail * (random() * 2 - 1 - tailL);
    tailR += aTail * (random() * 2 - 1 - tailR);
    const tail = 0.35 * Math.exp(-t / 0.6);
    left[i] = boom + burstL * hit * 1.6 + tailL * tail;
    right[i] = boom + burstR * hit * 1.6 + tailR * tail;
  }
  edges(left, rate, 0.003, 0.02);
  edges(right, rate, 0.003, 0.02);
  return { left, right, durationS: lengthS, alignS: 0 };
}

function downlifter(rate: number, random: () => number): FxSound {
  const lengthS = 2;
  const length = Math.floor(lengthS * rate);
  const env = (k: number) => Math.pow(1 - k, 2) * Math.min(1, k * 40);
  const left = sweptNoise(length, rate, random, 7000, 150, env);
  const right = sweptNoise(length, rate, random, 7000, 150, env);
  edges(left, rate);
  edges(right, rate);
  return { left, right, durationS: lengthS, alignS: 0 };
}

function zap(rate: number): FxSound {
  const lengthS = 0.35;
  const length = Math.floor(lengthS * rate);
  const left = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const k = i / length;
    phase += (2 * Math.PI * glide(2400, 70, Math.pow(k, 0.6))) / rate;
    left[i] = Math.sin(phase) * Math.exp(-k * 3);
  }
  edges(left, rate, 0.002, 0.02);
  return { left, right: left.slice(), durationS: lengthS, alignS: 0 };
}

/**
 * One take of one sound. `lengthS` stretches the ones that rise into a cut
 * (the riser to a bar or two of the music, the reverse cymbal to a beat or
 * two); the ones that land on it have their own length.
 */
export function synthFx(
  name: FxName,
  sampleRate: number,
  seed: number,
  lengthS?: number,
): FxSound {
  const random = rng(seed);
  const sound =
    name === 'riser'
      ? riser(sampleRate, random, lengthS ?? 3)
      : name === 'reverseCymbal'
        ? reverseCymbal(sampleRate, random, lengthS ?? 1.5)
        : name === 'impact'
          ? impact(sampleRate, random)
          : name === 'downlifter'
            ? downlifter(sampleRate, random)
            : zap(sampleRate);
  return normalise(sound, FX_PEAK[name]);
}
