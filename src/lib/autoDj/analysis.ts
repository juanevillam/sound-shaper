// ---------------------------------------------------------------------------
// AUTO DJ — THE SONG MAP. What the DJ knows about a sound before it plays a
// note of it: the tempo, where the beats and bars fall, and how loud each bar
// is. Pure, so it is unit-tested against synthetic signals; the decode and the
// cache are `songMap.ts`.
//
// IT IS COMPUTED OFFLINE, ONCE PER SOUND, NOT LISTENED TO LIVE, and that is the
// whole design. A live `AnalyserNode` (the one the rejected reactive backdrop
// used) only ever knows the PAST, and the move a DJ is known for — closing the
// sound down through a build and throwing it open on the drop — has to start
// eight bars BEFORE the drop it answers. A decoded file knows the future, and
// its beat grid is exact rather than polled at a JS timer's resolution.
//
// No model and no server: an onset envelope, an autocorrelation for the tempo,
// a comb for the phase. The classic recipe, and enough for music with a steady
// pulse — which is why the Shape sheet says it works best with electronic music
// and reggaeton.
// ---------------------------------------------------------------------------

export type SongMap = {
  /** Bump when the shape changes, so a cached map is never misread. */
  version: 1;
  durationS: number;
  /** 0 when no steady pulse was found — the DJ then moves on time alone. */
  bpm: number;
  /** Seconds per beat (60 / bpm); 0 with no pulse. */
  beatS: number;
  /**
   * The first DOWNBEAT at or after 0 — bar `i` starts at
   * `firstBarS + i * 4 * beatS`. 0 with no pulse.
   */
  firstBarS: number;
  /** 0…1 — how clearly the pulse stood out of the onset envelope. */
  confidence: number;
  /**
   * Loudness per bar, normalised so the song's loud passages sit near 1.
   * With no pulse, per 2-second block instead (see `blockS`).
   */
  bars: number[];
  /** With no pulse, the length of each `bars` block; otherwise 4 × beatS. */
  blockS: number;
};

/** Analysis rate. Enough for a kick and a snare; cheap to walk in JS. */
export const ANALYSIS_SAMPLE_RATE = 11025;
const HOP = 256; // ~23 ms frames at 11025 Hz
const LOW_HZ = 150; // the kick's band
const BPM_MIN = 70;
const BPM_MAX = 180;
/**
 * The prior every tempo tracker carries: autocorrelation scores half and
 * double the true tempo almost as well as the tempo itself, so the tie goes
 * to the octave nearest a typical dance tempo. Wide on purpose — reggaeton's
 * 90–100 and techno's 125–140 both have to win when they are what is there.
 */
const BPM_PRIOR_CENTRE = 115;
const BPM_PRIOR_OCTAVES = 1.0;
/**
 * Below this the pulse is too weak to quantise anything to. MEASURED: white
 * noise reaches 0.17 (the comb tries many candidates and one always catches
 * something), while every track with a real kick in the test set read 0.8–1.
 */
export const MIN_CONFIDENCE = 0.3;
const NO_PULSE_BLOCK_S = 2;

const log = (x: number) => Math.log(x + 1e-9);

/** Frame-level energies: the kick band and the whole signal. */
function frameEnergies(samples: Float32Array, sampleRate: number) {
  const frames = Math.floor(samples.length / HOP);
  const low = new Float32Array(frames);
  const full = new Float32Array(frames);
  const a = 1 - Math.exp((-2 * Math.PI * LOW_HZ) / sampleRate);
  let y = 0;
  for (let f = 0; f < frames; f += 1) {
    let lowSum = 0;
    let fullSum = 0;
    const base = f * HOP;
    for (let i = 0; i < HOP; i += 1) {
      const x = samples[base + i];
      y += a * (x - y);
      lowSum += y * y;
      fullSum += x * x;
    }
    low[f] = lowSum / HOP;
    full[f] = fullSum / HOP;
  }
  return { low, full, frames };
}

/**
 * The onset envelope: how sharply energy ROSE, frame to frame, weighted toward
 * the kick. A moving mean is taken off so a loud passage does not read as one
 * long onset.
 */
function onsetEnvelope(low: Float32Array, full: Float32Array): Float32Array {
  const n = low.length;
  const raw = new Float32Array(n);
  for (let f = 1; f < n; f += 1) {
    const dLow = Math.max(0, log(low[f]) - log(low[f - 1]));
    const dFull = Math.max(0, log(full[f]) - log(full[f - 1]));
    raw[f] = 0.65 * dLow + 0.35 * dFull;
  }
  const window = 11; // ~0.25 s each side
  const out = new Float32Array(n);
  let sum = 0;
  for (let f = 0; f < Math.min(n, window); f += 1) sum += raw[f];
  for (let f = 0; f < n; f += 1) {
    const add = f + window;
    const drop = f - window - 1;
    if (add < n) sum += raw[add];
    if (drop >= 0) sum -= raw[drop];
    const count = Math.min(n - 1, f + window) - Math.max(0, f - window) + 1;
    out[f] = Math.max(0, raw[f] - sum / count);
  }
  return out;
}

/** Linear-interpolated read, 0 outside the array. */
const at = (env: Float32Array, x: number): number => {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= env.length) return 0;
  const t = x - i;
  return env[i] * (1 - t) + env[i + 1] * t;
};

/** How much onset lands on a grid of `period` frames starting at `phase`. */
const combScore = (env: Float32Array, period: number, phase: number) => {
  let sum = 0;
  let count = 0;
  for (let x = phase; x < env.length - 1; x += period) {
    sum += at(env, x);
    count += 1;
  }
  return count ? sum / count : 0;
};

const bestPhase = (env: Float32Array, period: number) => {
  let best = 0;
  let bestScore = -1;
  const steps = Math.max(8, Math.ceil(period * 2));
  for (let s = 0; s < steps; s += 1) {
    const phase = (s / steps) * period;
    const score = combScore(env, period, phase);
    if (score > bestScore) {
      bestScore = score;
      best = phase;
    }
  }
  return { phase: best, score: bestScore };
};

/**
 * A [1 2 1] blur, twice. An onset is one frame wide, and a tempo whose period
 * falls BETWEEN two integer lags (140 BPM is 18.46 frames) lands on neither, so
 * its slower octave — 36.9, almost whole — won. Measured on a synthetic 140.
 * Widening each spike lets both neighbours of a fractional lag see it.
 */
function blur(env: Float32Array): Float32Array {
  let cur = env;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Float32Array(cur.length);
    for (let f = 0; f < cur.length; f += 1) {
      next[f] =
        0.25 * (cur[f - 1] ?? 0) + 0.5 * cur[f] + 0.25 * (cur[f + 1] ?? 0);
    }
    cur = next;
  }
  return cur;
}

const tempoPrior = (bpm: number): number => {
  const octaves = Math.log2(bpm / BPM_PRIOR_CENTRE) / BPM_PRIOR_OCTAVES;
  return Math.exp(-0.5 * octaves * octaves);
};

/**
 * CANDIDATE PERIODS, not a verdict. The autocorrelation's peaks say which lags
 * repeat; which of them is THE beat is decided against the whole track by the
 * comb (`analyzeSamples`). Taking the autocorrelation's top peak outright was
 * the first version, and on real music it read a reggaeton at double time
 * (178 for ~89) and missed another's pulse entirely.
 */
function candidatePeriods(raw: Float32Array, frameRate: number): number[] {
  const env = blur(raw);
  const minLag = Math.floor((frameRate * 60) / BPM_MAX);
  const maxLag = Math.ceil((frameRate * 60) / BPM_MIN);
  const n = env.length;
  const ac = new Float32Array(maxLag + 2);
  for (
    let lag = Math.max(1, minLag - 1);
    lag <= maxLag + 1 && lag < n;
    lag += 1
  ) {
    let sum = 0;
    for (let f = 0; f + lag < n; f += 1) sum += env[f] * env[f + lag];
    ac[lag] = sum / (n - lag);
  }

  const peaks: { lag: number; value: number }[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
      // Parabolic refinement to a fractional lag.
      const l = ac[lag - 1];
      const c = ac[lag];
      const r = ac[lag + 1];
      const denom = l - 2 * c + r;
      const shift = denom !== 0 ? (0.5 * (l - r)) / denom : 0;
      peaks.push({ lag: lag + Math.max(-0.5, Math.min(0.5, shift)), value: c });
    }
  }
  peaks.sort((a, b) => b.value - a.value);

  const minPeriod = (frameRate * 60) / BPM_MAX;
  const maxPeriod = (frameRate * 60) / BPM_MIN;
  const out: number[] = [];
  for (const { lag } of peaks.slice(0, 5)) {
    // Each peak and its octaves: the comb, not the peak height, decides.
    for (const p of [lag, lag * 2, lag / 2]) {
      if (p >= minPeriod && p <= maxPeriod) out.push(p);
    }
  }
  return out;
}

/**
 * Fine-tune the period against the WHOLE track: a lag that is off by a
 * hundredth of a frame drifts a full beat over three minutes, and the comb is
 * what notices.
 */
function refinePeriod(env: Float32Array, period: number) {
  let best = { period, ...bestPhase(env, period) };
  for (let k = -20; k <= 20; k += 1) {
    if (k === 0) continue;
    const p = period * (1 + k * 0.0005);
    const r = bestPhase(env, p);
    if (r.score > best.score) best = { period: p, ...r };
  }
  return best;
}

const percentile = (values: number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

/** Mean RMS of `full` over [startS, endS), per block. */
function blockLoudness(
  full: Float32Array,
  frameRate: number,
  starts: number[],
  lengthS: number,
): number[] {
  const raw = starts.map(start => {
    const a = Math.max(0, Math.floor(start * frameRate));
    const b = Math.min(full.length, Math.floor((start + lengthS) * frameRate));
    if (b <= a) return 0;
    let sum = 0;
    for (let f = a; f < b; f += 1) sum += full[f];
    return Math.sqrt(sum / (b - a));
  });
  const ref = percentile(raw, 0.9) || 1;
  return raw.map(v => Math.round((v / ref) * 1000) / 1000);
}

/**
 * The map for one decoded, mono signal. `samples` should be at
 * `ANALYSIS_SAMPLE_RATE`, but any rate works — the frame rate is derived.
 */
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
): SongMap {
  const durationS = samples.length / sampleRate;
  const frameRate = sampleRate / HOP;
  const { low, full, frames } = frameEnergies(samples, sampleRate);

  const noPulse = (): SongMap => {
    const starts: number[] = [];
    for (let s = 0; s < durationS; s += NO_PULSE_BLOCK_S) starts.push(s);
    return {
      version: 1,
      durationS,
      bpm: 0,
      beatS: 0,
      firstBarS: 0,
      confidence: 0,
      bars: blockLoudness(full, frameRate, starts, NO_PULSE_BLOCK_S),
      blockS: NO_PULSE_BLOCK_S,
    };
  };

  if (frames < frameRate * 8) return noPulse();

  const env = onsetEnvelope(low, full);
  const candidates = candidatePeriods(env, frameRate);
  if (!candidates.length) return noPulse();

  // HOW FAR THE GRID STANDS OUT OF THE ENVELOPE AS A WHOLE. Best-phase
  // against mean-phase was tried first and white noise scored 0.42 on it —
  // the comb always finds SOME phase that catches noise peaks. Against the
  // envelope's own mean, noise sits near 1× and a beat several times over.
  let envSum = 0;
  for (let f = 0; f < env.length; f += 1) envSum += env[f];
  const envMean = envSum / env.length || 1e-9;

  let best: { period: number; phase: number; ratio: number } | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const fit = refinePeriod(env, candidate);
    const ratio = fit.score / envMean;
    const score = ratio * tempoPrior((frameRate * 60) / fit.period);
    if (score > bestScore) {
      bestScore = score;
      best = { period: fit.period, phase: fit.phase, ratio };
    }
  }
  if (!best) return noPulse();
  const { period, phase, ratio } = best;
  const confidence = Math.max(0, Math.min(1, (ratio - 1.5) / 4.5));
  if (confidence < MIN_CONFIDENCE) return { ...noPulse(), confidence };

  const beatS = period / frameRate;
  const beatPhaseS = phase / frameRate;

  // WHICH BEAT OF FOUR IS THE ONE: the beat where the kick band rises most is
  // the downbeat in nearly all dance music. Crude, and good enough to put
  // section changes on bar lines.
  const lowOnset = new Float32Array(frames);
  for (let f = 1; f < frames; f += 1) {
    // LINEAR, not log: every kick rises out of near-silence, so in log terms
    // they all rise alike and the accented one cannot win (measured: the bar
    // landed three beats late). The linear rise keeps the accent.
    lowOnset[f] = Math.max(0, low[f] - low[f - 1]);
  }
  let downbeat = 0;
  let downbeatScore = -1;
  for (let b = 0; b < 4; b += 1) {
    const s = combScore(lowOnset, period * 4, phase + b * period);
    if (s > downbeatScore) {
      downbeatScore = s;
      downbeat = b;
    }
  }

  const barS = beatS * 4;
  let firstBarS = beatPhaseS + downbeat * beatS;
  firstBarS -= Math.floor(firstBarS / barS) * barS;

  const starts: number[] = [];
  for (let s = firstBarS; s < durationS; s += barS) starts.push(s);

  return {
    version: 1,
    durationS,
    bpm: Math.round((60 / beatS) * 100) / 100,
    beatS,
    firstBarS,
    confidence: Math.round(confidence * 1000) / 1000,
    bars: blockLoudness(full, frameRate, starts, barS),
    blockS: barS,
  };
}
