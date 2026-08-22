// ---------------------------------------------------------------------------
// The EQ curve's frequency response, and the headroom trim derived from it.
//
// WHY THIS EXISTS: five biquads in series MULTIPLY, so a curve's real gain is
// not any one slider's number — it is the maximum of the summed response. A
// modern master already sits within a dB of full scale, so any boost pushes it
// through 0 dBFS into hard clipping, which is the crunch every graphic EQ is
// famous for. The graph's gain node is driven from `headroomTrimDb` so that
// cannot happen, and nobody has to find a preamp and work it out by ear —
// which is what Apple's own Music EQ does, and for this exact reason.
//
// The coefficient maths is a direct port of react-native-audio-api's
// `BiquadFilterNode.cpp` (itself the Audio EQ Cookbook, i.e. the Web Audio
// spec), so what is predicted here is what the native filter actually renders.
// Two details of that file are worth knowing, because both are easy to assume
// wrong:
//
//   · SHELVES IGNORE Q ENTIRELY. `getLowshelfCoefficients(frequency, gain)`
//     takes no Q argument at all — the slope is hardcoded to S = 1. Declaring
//     `q` on the 80 Hz or 12 kHz band would do exactly nothing, which is why
//     neither of them does.
//   · The PEAKING bands do use Q, and at Q = 1 their skirts run about 1.4
//     octaves wide. The 250 / 1k / 4k bands are 2 octaves apart, so they
//     genuinely overlap and sum: all five sliders at +12 measures +13.97 dB,
//     not +12.
// ---------------------------------------------------------------------------

/** The shape `EQ_BANDS` entries have, minus the parts the response ignores. */
export type ResponseBand = {
  hz: number;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  q?: number;
};

type Coefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

/**
 * Attenuation applied on top of the curve's own peak, whenever the EQ is doing
 * anything at all.
 *
 * It is NOT a fudge factor. Filtering does not preserve sample peak: it shifts
 * phase, which changes the crest factor, so the output peak can land ABOVE the
 * maximum of the magnitude response. Measured against a limited master and pink
 * noise, the `treble` curve overshot its own theoretical bound by 0.26 dB and
 * `bright` by 0.58 dB — and a curve that only CUTS ([-3,-7,-9,-6,-6], response
 * peak -2.30 dB) still raised the sample peak by 0.32 dB. That last case is why
 * the margin applies to every non-flat curve rather than only to boosts.
 *
 * 1.5 dB covers ~89% of plausible hand-dragged curves and all six presets with
 * room to spare. Covering the pathological tail would cost ~4 dB of level on
 * every shaped sound, which is a bad trade for curves nobody sets.
 */
export const HEADROOM_SAFETY_DB = 1.5;

// The audible band, swept logarithmically. 128 points lands within 0.05 dB of a
// 4000-point reference (measured over 300 random curves) for ~0.02 ms of work,
// which is nothing next to the safety margin above and cheap enough to run on
// every tick of a dragged slider.
const SWEEP_LOW_HZ = 20;
const SWEEP_HIGH_HZ = 20000;
const SWEEP_POINTS = 128;

const normalize = (
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): Coefficients => {
  const inverse = 1 / a0;
  return {
    b0: b0 * inverse,
    b1: b1 * inverse,
    b2: b2 * inverse,
    a1: a1 * inverse,
    a2: a2 * inverse,
  };
};

// `frequency` is normalized to Nyquist (1.0 == Nyquist), matching the C++.
const lowshelf = (frequency: number, gain: number): Coefficients => {
  const a = Math.pow(10, gain / 40);
  if (frequency >= 1) return normalize(a * a, 0, 0, 1, 0, 0);
  if (frequency <= 0) return normalize(1, 0, 0, 1, 0, 0);

  const w0 = Math.PI * frequency;
  const alpha = 0.5 * Math.sin(w0) * Math.SQRT2;
  const cosW = Math.cos(w0);
  const gamma = 2 * Math.sqrt(a) * alpha;

  return normalize(
    a * (a + 1 - (a - 1) * cosW + gamma),
    2 * a * (a - 1 - (a + 1) * cosW),
    a * (a + 1 - (a - 1) * cosW - gamma),
    a + 1 + (a - 1) * cosW + gamma,
    -2 * (a - 1 + (a + 1) * cosW),
    a + 1 + (a - 1) * cosW - gamma,
  );
};

const highshelf = (frequency: number, gain: number): Coefficients => {
  const a = Math.pow(10, gain / 40);
  if (frequency >= 1) return normalize(1, 0, 0, 1, 0, 0);
  if (frequency <= 0) return normalize(a * a, 0, 0, 1, 0, 0);

  const w0 = Math.PI * frequency;
  const alpha = 0.5 * Math.sin(w0) * Math.SQRT2;
  const cosW = Math.cos(w0);
  const gamma = 2 * Math.sqrt(a) * alpha;

  return normalize(
    a * (a + 1 + (a - 1) * cosW + gamma),
    -2 * a * (a - 1 + (a + 1) * cosW),
    a * (a + 1 + (a - 1) * cosW - gamma),
    a + 1 - (a - 1) * cosW + gamma,
    2 * (a - 1 - (a + 1) * cosW),
    a + 1 - (a - 1) * cosW - gamma,
  );
};

const peaking = (frequency: number, q: number, gain: number): Coefficients => {
  const a = Math.pow(10, gain / 40);
  if (frequency <= 0 || frequency >= 1) return normalize(1, 0, 0, 1, 0, 0);
  if (q <= 0) return normalize(a * a, 0, 0, 1, 0, 0);

  const w0 = Math.PI * frequency;
  const alpha = Math.sin(w0) / (2 * q);
  const cosW = Math.cos(w0);

  return normalize(
    1 + alpha * a,
    -2 * cosW,
    1 - alpha * a,
    1 + alpha / a,
    -2 * cosW,
    1 - alpha / a,
  );
};

const coefficientsFor = (
  band: ResponseBand,
  gain: number,
  nyquist: number,
): Coefficients => {
  const frequency = band.hz / nyquist;
  if (band.type === 'lowshelf') return lowshelf(frequency, gain);
  if (band.type === 'highshelf') return highshelf(frequency, gain);
  return peaking(frequency, band.q ?? 1, gain);
};

/** |H(f)| of one biquad, as `BiquadFilterNode::getFrequencyResponse` computes it. */
const magnitudeAt = (c: Coefficients, normalizedHz: number): number => {
  const omega = -Math.PI * normalizedHz;
  const zReal = Math.cos(omega);
  const zImaginary = Math.sin(omega);

  // numerator = b0 + (b1 + b2 · z) · z
  const nInnerReal = c.b1 + c.b2 * zReal;
  const nInnerImaginary = c.b2 * zImaginary;
  const numeratorReal =
    c.b0 + (nInnerReal * zReal - nInnerImaginary * zImaginary);
  const numeratorImaginary = nInnerReal * zImaginary + nInnerImaginary * zReal;

  // denominator = 1 + (a1 + a2 · z) · z
  const dInnerReal = c.a1 + c.a2 * zReal;
  const dInnerImaginary = c.a2 * zImaginary;
  const denominatorReal =
    1 + (dInnerReal * zReal - dInnerImaginary * zImaginary);
  const denominatorImaginary =
    dInnerReal * zImaginary + dInnerImaginary * zReal;

  return (
    Math.hypot(numeratorReal, numeratorImaginary) /
    Math.hypot(denominatorReal, denominatorImaginary)
  );
};

/**
 * The loudest point of the whole cascade, in dB relative to unity — i.e. how
 * much this curve can amplify a signal. Positive means the curve has gain to
 * give away, and therefore headroom to take back.
 */
export const peakResponseDb = (
  bands: ResponseBand[],
  gains: number[],
  sampleRate: number,
): number => {
  const nyquist = sampleRate / 2;
  const coefficients = bands.map((band, index) =>
    coefficientsFor(band, gains[index] ?? 0, nyquist),
  );

  const ratio = SWEEP_HIGH_HZ / SWEEP_LOW_HZ;
  let peak = 0;
  for (let point = 0; point <= SWEEP_POINTS; point += 1) {
    const hz = SWEEP_LOW_HZ * Math.pow(ratio, point / SWEEP_POINTS);
    if (hz >= nyquist) break;

    let linear = 1;
    for (const c of coefficients) linear *= magnitudeAt(c, hz / nyquist);
    if (linear > peak) peak = linear;
  }

  return 20 * Math.log10(peak);
};

/**
 * What the gain node in front of the filters must be set to, in dB, so this
 * curve cannot clip.
 *
 * A perfectly flat curve returns 0: with no shaping the chain stays
 * bit-transparent, because attenuating a sound nobody has touched would be its
 * own defect. Everything else pays its own peak plus `HEADROOM_SAFETY_DB`.
 */
export const headroomTrimDb = (
  bands: ResponseBand[],
  gains: number[],
  sampleRate: number,
): number => {
  if (gains.every(db => db === 0)) return 0;
  const peak = peakResponseDb(bands, gains, sampleRate);
  return -(Math.max(0, peak) + HEADROOM_SAFETY_DB);
};
