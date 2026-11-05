// ---------------------------------------------------------------------------
// AUTO DJ — ONE LEVEL FOR THE WHOLE SET. Every DJ move changes how loud the
// sound is: a shaped curve pays its headroom trim, the Next Room wall takes
// the middle and the top away, Echo pays its own trim. Measured against an
// untouched sound (K-weighted, pink noise), a set swung across 16 dB — Bass
// under Room High under Echo High against a flat drop — so the person turned
// it up for the quiet stretch and was blasted when it opened (Juan,
// 2026-11-04).
//
// THE LEVELLER ONLY EVER TAKES LEVEL AWAY. Every state is brought down to
// `DJ_TARGET_DB`, never boosted toward it: each trim in the chain was sized so
// its own peak cannot clip, and make-up gain on top of a trim would undo that.
// So the target sits at the level of the DJ's usual sustained states (a
// shaped curve, a wall over a flat curve), and the choreography keeps away
// from the states that would fall far under it — a held wall stands on a flat
// curve, and Echo goes no further than Low (`set.ts`).
//
// An estimate, not a meter: the curve's magnitude response weighted by an
// approximate K-weighting over a pink spectrum, plus each trim, plus the
// echo's added energy. Ranking states against each other is all it is for.
// Pure, so it is unit-tested.
// ---------------------------------------------------------------------------

import { type DjState } from './plan';
import {
  coefficientsFor,
  headroomTrimDb,
  magnitudeAt,
  type Coefficients,
} from '../eqResponse';
import {
  ECHO_LEVELS,
  EQ_BANDS,
  NEXT_ROOM_LEVELS,
  NEXT_ROOM_SHELF_HZ,
} from '../shapeDsp';

/** Where the set sits, in dB under an untouched sound. */
export const DJ_TARGET_DB = -7.5;

const SAMPLE_RATE = 48000;
const POINTS = 160;
const LOW_HZ = 20;
const HIGH_HZ = 20000;

/** Approximate K-weighting: the ear's bass roll-off and presence lift. */
const kWeight = (hz: number): number => {
  const r = Math.pow(hz / 60, 4);
  const highPass = Math.sqrt(r / (1 + r));
  const lift = Math.pow(10, 4 / 20);
  const shelf =
    hz >= 2000 ? lift : 1 + (lift - 1) * Math.max(0, (hz - 500) / 1500);
  return highPass * shelf;
};

const SWEEP = Array.from(
  { length: POINTS },
  (_, i) => LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, i / (POINTS - 1)),
);
const WEIGHTS = SWEEP.map(hz => kWeight(hz) ** 2);
const WEIGHT_SUM = WEIGHTS.reduce((a, b) => a + b, 0);

const cache = new Map<string, number>();

/** How loud `state` plays, in dB against the same sound untouched. */
export function stateLoudnessDb(
  state: Pick<DjState, 'gains' | 'nextRoom' | 'echo'>,
): number {
  const key = `${state.gains.join(',')}|${state.nextRoom}|${state.echo}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const nyquist = SAMPLE_RATE / 2;
  const filters: Coefficients[] = EQ_BANDS.map((band, i) =>
    coefficientsFor(band, state.gains[i] ?? 0, nyquist),
  );
  let trimDb = headroomTrimDb(EQ_BANDS, state.gains, SAMPLE_RATE);
  if (state.nextRoom !== 'off') {
    const wall = NEXT_ROOM_LEVELS[state.nextRoom];
    for (const hz of NEXT_ROOM_SHELF_HZ) {
      filters.push(
        coefficientsFor({ hz, type: 'highshelf' }, wall.depthDb, nyquist),
      );
    }
    trimDb += wall.trimDb;
  }
  if (state.echo !== 'off') {
    const { feedback, trimDb: echoTrim } = ECHO_LEVELS[state.echo];
    // The repeats add their energy: 1 + f² + f⁴ + … of the dry sound.
    trimDb += echoTrim + 10 * Math.log10(1 / (1 - feedback * feedback));
  }

  let power = 0;
  SWEEP.forEach((hz, i) => {
    let m = 1;
    for (const c of filters) m *= magnitudeAt(c, hz / nyquist);
    power += WEIGHTS[i] * m * m;
  });
  const db = 10 * Math.log10(power / WEIGHT_SUM) + trimDb;
  if (cache.size > 500) cache.clear();
  cache.set(key, db);
  return db;
}

/** The leveller's setting for `state`: down to the target, never up. */
export const djLevelDb = (
  state: Pick<DjState, 'gains' | 'nextRoom' | 'echo'>,
): number => Math.min(0, DJ_TARGET_DB - stateLoudnessDb(state));
