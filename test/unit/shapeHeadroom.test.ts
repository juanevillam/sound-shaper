import { describe, expect, it } from 'vitest';

import { headroomTrimDb } from '@/lib/eqResponse';
import {
  ECHO_DELAY_SECONDS,
  ECHO_FEEDBACK,
  ECHO_TAIL_FLOOR,
  ECHO_TRIM_DB,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  NEXT_ROOM_DEPTH_DB,
  NEXT_ROOM_SHELF_HZ,
  NEXT_ROOM_TRIM_DB,
} from '@/lib/shapeDsp';

/**
 * EVERY SHAPE COMBINATION STAYS UNDER FULL SCALE, AND EVERY FILTER SETTLES.
 *
 * This exists because the same defect shipped three times in two days, each
 * time from a claim that sounded obviously true (2026-09-16/17):
 *
 *  1. "A wet/dry bus can't clip if the wet is quiet" — Next Room shipped with
 *     +4 dB of make-up over a +3 dB shelf and modelled at +7.0 dB peak.
 *  2. "A low-pass can only attenuate, so this chain cannot clip" — false in the
 *     band the effect keeps. Filtering rotates PHASE, which changes the crest
 *     factor, so sample peak can exceed the magnitude response. Measured +0.76
 *     dB on a limited bass master; Juan heard it as "rocky".
 *  3. "Parked at Nyquist the bypass measures -0.00 dB" — true, and irrelevant.
 *     That filter has poles ON the unit circle and rings forever on any
 *     discontinuity. Juan heard it whenever another app made a sound.
 *
 * All three passed a magnitude check and all three were wrong, so this asserts
 * the two things a magnitude check cannot see: the SAMPLE PEAK of real signals
 * through the whole chain, and the POLE RADIUS of every filter in it.
 *
 * All three also belonged to a wall built out of LOW-PASSES, which is gone: it
 * is three high shelves now, so "off" is those shelves at 0 dB and there is no
 * parking spot, no type flip and no deferred timer left to get wrong. The
 * assertions stayed, because what they check is the wall's CONTRACT — an exact
 * identity when off, poles that settle, and (added with the shelves) the SHAPE
 * that separates a wall from a tone control.
 *
 * It models the graph rather than running it, the same way `eqResponse` is
 * modelled — an offline Direct Form 1 biquad matching the library's own
 * `BiquadFilterNode.cpp`, which sees every sample where a polled analyser on
 * device would see about a fifth of them.
 *
 * WHAT IT CANNOT CATCH, so nobody reads a green run as "the audio is fine":
 * real-time behaviour. Dropouts, thread-pool stalls and session interruptions
 * are timing, not arithmetic. `ConvolverNode` blocks the render thread in
 * `threadPool_->wait()`, and no offline model will ever show that.
 */

const SR = 48000;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

const peaking = (hz: number, q: number, gainDb: number): Biquad => {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * hz) / SR;
  const cw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cw) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cw) / a0,
    a2: (1 - alpha / A) / a0,
  };
};

const shelf = (hz: number, gainDb: number, high: boolean): Biquad => {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * hz) / SR;
  const cw = Math.cos(w);
  const alpha = (Math.sin(w) / 2) * Math.sqrt((A + 1 / A) * (1 / 1 - 1) + 2);
  const t = 2 * Math.sqrt(A) * alpha;
  const sign = high ? 1 : -1;
  const a0 = A + 1 - sign * (A - 1) * cw + t;
  return {
    b0: (A * (A + 1 + sign * (A - 1) * cw + t)) / a0,
    b1: (sign * -2 * A * (A - 1 + sign * (A + 1) * cw)) / a0,
    b2: (A * (A + 1 + sign * (A - 1) * cw - t)) / a0,
    a1: (sign * 2 * (A - 1 - sign * (A + 1) * cw)) / a0,
    a2: (A + 1 - sign * (A - 1) * cw - t) / a0,
  };
};

/** The cascade's magnitude at `hz`, in dB. */
const magDb = (filters: Biquad[], hz: number): number => {
  const w = (2 * Math.PI * hz) / SR;
  let total = 0;
  for (const c of filters) {
    const nr = c.b0 + c.b1 * Math.cos(-w) + c.b2 * Math.cos(-2 * w);
    const ni = c.b1 * Math.sin(-w) + c.b2 * Math.sin(-2 * w);
    const dr = 1 + c.a1 * Math.cos(-w) + c.a2 * Math.cos(-2 * w);
    const di = c.a1 * Math.sin(-w) + c.a2 * Math.sin(-2 * w);
    total += 20 * Math.log10(Math.hypot(nr, ni) / Math.hypot(dr, di));
  }
  return total;
};

/** |z| of the poles. At 1.0 the filter never settles — see the docblock. */
const poleRadius = (c: Biquad): number => {
  const disc = c.a1 * c.a1 - 4 * c.a2;
  if (disc >= 0) {
    return Math.max(
      Math.abs((-c.a1 + Math.sqrt(disc)) / 2),
      Math.abs((-c.a1 - Math.sqrt(disc)) / 2),
    );
  }
  return Math.sqrt(Math.abs(c.a2));
};

const run = (x: Float32Array, c: Biquad): Float32Array => {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const input = x[i];
    const out = c.b0 * input + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[i] = out;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = out;
  }
  return y;
};

const gain = (x: Float32Array, g: number): Float32Array =>
  x.map(v => v * g) as Float32Array;

/** Sparse tap-delay — what the echo impulse response does, exactly. */
const taps = (
  x: Float32Array,
  delayS: number,
  feedback: number,
  floor: number,
) => {
  const list: { offset: number; amp: number }[] = [{ offset: 0, amp: 1 }];
  let amp = feedback;
  let n = 1;
  while (amp > floor) {
    list.push({ offset: Math.round(delayS * n * SR), amp });
    amp *= feedback;
    n += 1;
  }
  const out = new Float32Array(x.length + list[list.length - 1].offset);
  for (const tap of list) {
    for (let i = 0; i < x.length; i += 1) out[i + tap.offset] += x[i] * tap.amp;
  }
  return out;
};

const peak = (x: Float32Array): number => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return m;
};
const db = (v: number): number => 20 * Math.log10(v);
const linear = (d: number): number => Math.pow(10, d / 20);

// THE REAL CONSTANTS, IMPORTED — never restated. They were restated in the
// first draft, because reaching for them dragged React Native into vitest;
// `shapeDsp.ts` exists so this file can import the numbers the app actually
// ships. A test holding its own copy of the values passes forever while the app
// drifts away from it, which is worse than no test.

/** Signals at a modern master's 0 dBFS — the case that actually clips. */
const signals = (): Record<string, Float32Array> => {
  const n = SR * 3;
  const pink = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < n; i += 1) {
    const w = rand();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    pink[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + w * 0.1848) * 0.2));
  }
  const bass = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    bass[i] =
      Math.tanh(
        6 *
          (Math.sin(2 * Math.PI * 90 * t) +
            0.7 * Math.sin(2 * Math.PI * 180 * t) +
            0.4 * Math.sin(2 * Math.PI * 55 * t)),
      ) * 0.999;
  }
  const square = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    square[i] = Math.sign(Math.sin((2 * Math.PI * 100 * i) / SR)) * 0.999;
  }
  return { pink, bass, square };
};

const bandFilters = (gains: number[]): Biquad[] =>
  EQ_BANDS.map((band, i) => {
    if (band.type === 'lowshelf') return shelf(band.hz, gains[i], false);
    if (band.type === 'highshelf') return shelf(band.hz, gains[i], true);
    return peaking(band.hz, band.q ?? 1, gains[i]);
  });

/** The wall — every shelf at the same gain, 0 dB being the exact bypass. */
const wallFilters = (depthDb: number): Biquad[] =>
  NEXT_ROOM_SHELF_HZ.map(hz => shelf(hz, depthDb, true));

/** The whole chain, exactly as `buildGraph` wires it. */
const chain = (
  x: Float32Array,
  gains: number[],
  nextRoom: boolean,
  echo: boolean,
): Float32Array => {
  let out = gain(x, linear(headroomTrimDb(EQ_BANDS, gains, SR)));
  for (const f of bandFilters(gains)) out = run(out, f);

  // OFF is every shelf at 0 dB — an exact identity, so the wall contributes
  // nothing at all rather than "almost nothing". Modelling it as a parked
  // low-pass is what hid 0.87 dB of overshoot in the default state.
  for (const w of wallFilters(nextRoom ? NEXT_ROOM_DEPTH_DB : 0))
    out = run(out, w);
  out = gain(out, nextRoom ? linear(NEXT_ROOM_TRIM_DB) : 1);

  if (echo) {
    out = taps(out, ECHO_DELAY_SECONDS, ECHO_FEEDBACK, ECHO_TAIL_FLOOR);
    out = gain(out, linear(ECHO_TRIM_DB));
  }
  return out;
};

/** Curves worth sweeping: the presets, flat, and the two extremes. */
const CURVES: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0],
  bass: [3, 2, 0, -1, -2],
  vocal: [-4, -2, 2, 3, -2],
  treble: [-2, -2, 0, 1, 4],
  warm: [2, 2, -1, -3, -5],
  bright: [-3, -2, 2, 4, 2],
  allMax: EQ_BANDS.map(() => EQ_MAX_DB),
  allMin: EQ_BANDS.map(() => EQ_MIN_DB),
  seesaw: [EQ_MAX_DB, EQ_MIN_DB, EQ_MAX_DB, EQ_MIN_DB, EQ_MAX_DB],
};

/**
 * PROGRAM MATERIAL GATES; A SQUARE WAVE REPORTS.
 *
 * `pink` and `bass` are what a modern master looks like — limited, flat-topped,
 * sitting at 0 dBFS — and nothing may overshoot on them at all. A full-scale
 * 100 Hz square is not music, and gating on it would force exactly the
 * over-attenuation this repo has already refused: `eqResponse`'s own notes say
 * the 1.5 dB margin covers "~89% of plausible hand-dragged curves, not all of
 * them", that a pathological one can still overshoot by ~1 dB, and that the
 * answer if it ever matters is a waveshaper, NOT more trim. So the square is
 * held to that stated residual instead — loose enough to permit the known gap,
 * tight enough that a regression of the +7 dB kind still fails here.
 */
const PROGRAM_BUDGET_DB = 0;
const PATHOLOGICAL_BUDGET_DB = 1.5;

describe('shape headroom — no combination clips', () => {
  const sigs = signals();
  const budget = (name: string) =>
    name === 'square' ? PATHOLOGICAL_BUDGET_DB : PROGRAM_BUDGET_DB;

  for (const [curveName, gains] of Object.entries(CURVES)) {
    for (const nextRoom of [false, true]) {
      for (const echo of [false, true]) {
        const label = `${curveName} · room:${nextRoom ? 'on' : 'off'} · echo:${echo ? 'on' : 'off'}`;
        it(`stays under 0 dBFS — ${label}`, () => {
          for (const [signalName, x] of Object.entries(sigs)) {
            const out = peak(chain(x, gains, nextRoom, echo));
            const overshoot = db(out) - db(peak(x));
            expect(
              overshoot,
              `${label} on ${signalName} overshot by ${overshoot.toFixed(2)} dB`,
            ).toBeLessThanOrEqual(budget(signalName));
          }
        });
      }
    }
  }
});

describe('shape stability — every filter settles', () => {
  // A magnitude response cannot see this, and shipping a filter with poles on
  // the unit circle is what made another app's notification audible as
  // interference inside ours.
  const MAX_POLE_RADIUS = 0.995;

  it('the OFF wall is an EXACT identity, not merely a flat one', () => {
    for (const c of wallFilters(0)) {
      // numerator === denominator, so H(z) = 1 at every frequency.
      expect(c.b0).toBe(1);
      expect(c.b1).toBe(c.a1);
      expect(c.b2).toBe(c.a2);
      expect(poleRadius(c)).toBeLessThan(MAX_POLE_RADIUS);
    }
  });

  it('every wall shelf settles at the shipped depth', () => {
    for (const c of wallFilters(NEXT_ROOM_DEPTH_DB)) {
      expect(poleRadius(c)).toBeLessThan(MAX_POLE_RADIUS);
    }
  });

  it('the wall passes the bottom at unity', () => {
    // The thump is the whole reason the effect reads as a room rather than as
    // a tone control, and it is the one thing three cutoffs never broke.
    const wall = wallFilters(NEXT_ROOM_DEPTH_DB);
    expect(Math.abs(magDb(wall, 60))).toBeLessThan(0.2);
    expect(Math.abs(magDb(wall, 125))).toBeLessThan(0.5);
  });

  it('the wall takes the MIDRANGE, which is what says "not in this room"', () => {
    // 2200 Hz left 1 kHz at -0.4 dB, which is why it read as a telephone
    // rather than as distance. Anything shallower than -8 here is that bug.
    expect(magDb(wallFilters(NEXT_ROOM_DEPTH_DB), 1000)).toBeLessThan(-8);
  });

  it('the top end lands on a FLOOR, not a cliff — the mass law, not a cutoff', () => {
    // This is the property a cascade of low-passes cannot have at any cutoff,
    // and the one that lets the words survive while the illusion holds: a real
    // partition leaks, so the air arrives quietly instead of not at all.
    const wall = wallFilters(NEXT_ROOM_DEPTH_DB);
    expect(magDb(wall, 12000)).toBeGreaterThan(-40);
    // Flat across the top two octaves — a cliff keeps falling, a floor does not.
    expect(Math.abs(magDb(wall, 16000) - magDb(wall, 6000))).toBeLessThan(2.5);
  });

  it('every EQ band settles at every extreme', () => {
    for (const gains of Object.values(CURVES)) {
      for (const f of bandFilters(gains)) {
        expect(poleRadius(f)).toBeLessThan(MAX_POLE_RADIUS);
      }
    }
  });
});
