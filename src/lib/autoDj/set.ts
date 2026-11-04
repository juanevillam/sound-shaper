// ---------------------------------------------------------------------------
// AUTO DJ — THE SET. A DJ does not play whole songs: they play a stretch of
// one, take it out with an effect, and bring the next one in on a downbeat
// (Juan, 2026-11-04 — "con partes de todas las canciones"). This file decides
// WHICH stretch of WHICH sound comes next, and how the set gets from one to
// the other. Pure, so it is unit-tested; `AutoDjDirector` plays it.
//
// THE SET IS BUILT ONE SEGMENT AHEAD, NOT ALL AT ONCE. The library is analysed
// in the background while the first segment plays, so the pool grows as the
// set goes; a person can also pick a sound by hand at any moment, and the set
// simply carries on from there. So the planner answers one question at a time
// — "given where the set is, what comes next?" — and a segment is data
// (`Segment`), exactly as a single sound's mix is.
//
// WHAT A SEGMENT IS:
//   · a stretch of a sound between two BAR LINES, 16–32 bars (about 30–70 s);
//   · it usually comes in ON A DROP — the classic cut — or on a loud phrase,
//     walking in from next door;
//   · its rate is chosen to keep the set's tempo steady (`matchRate`), with
//     half- and double-time counted as the same tempo, so 89 BPM reggaeton
//     sits next to 128 BPM techno only when the speed slider can bridge them;
//   · inside it, the sound's own mix plays (`planMix` — builds, drops,
//     breaks), and its last bars carry the way OUT: the wall of Next Room
//     coming up, or the EQ closing down, before the cut.
//
// THE CUT IS A RELOAD. The player has one source, so the next sound loads on
// the downbeat where this one ends. The way-out effect is what makes that read
// as a transition rather than a skip, and it is also why Echo can change at a
// cut and nowhere else (its ~200 ms rewire hides inside the load).
// ---------------------------------------------------------------------------

import { EQ_MAX_DB, EQ_MIN_DB, type EffectLevel } from '../shapeDsp';

import { type SongMap } from './analysis';
import {
  findDrops,
  planMix,
  rng,
  stateAt,
  type AutoDjStyle,
  type DjMove,
  type Mix,
} from './plan';

/** How a segment comes in. */
export type Entry = 'drop' | 'walk-in' | 'cut';
/** How a segment goes out. */
export type Exit = 'room' | 'sweep' | 'cut';

export type Segment = {
  soundId: string;
  /** Sound time, on a bar line (or the playhead, for a segment joined late). */
  startS: number;
  /** Sound time, on a bar line — where the next segment cuts in. */
  endS: number;
  rate: number;
  /** The set's tempo after this segment, 0 when it has no pulse. */
  tempo: number;
  entry: Entry;
  exit: Exit;
  /** Every move inside the segment, sorted; the first is at `startS`. */
  mix: Mix;
};

export type PoolSound = { soundId: string; map: SongMap };

/** Where the speed slider can take a sound, and the step it moves in. */
const RATE_MIN = 0.75;
const RATE_MAX = 1.25;
const RATE_STEP = 0.05;

/** The base speed each style plays at, before tempo matching. */
const STYLE_RATE: Record<AutoDjStyle, number> = {
  club: 1,
  slowed: 0.85,
  hyper: 1.1,
};

/**
 * How far from its style's own speed a sound may be pushed to keep the set's
 * tempo. Beyond this the set lets the tempo go and cuts hard instead — a DJ
 * dragging a track 20% off its speed to beatmatch is worse than a clean cut.
 */
const MATCH_REACH = 0.1;

const snapRate = (rate: number): number =>
  Math.round(
    Math.min(
      RATE_MAX,
      Math.max(RATE_MIN, Math.round(rate / RATE_STEP) * RATE_STEP),
    ) * 100,
  ) / 100;

/**
 * THE SPEED THAT PUTS `bpm` ON THE SET'S TEMPO, or the style's own speed when
 * it cannot get there. Half- and double-time are the same tempo to a dancer,
 * so 89 against 178 is a match at 1×.
 */
export function matchRate(
  setTempo: number,
  bpm: number,
  style: AutoDjStyle,
): { rate: number; matched: boolean } {
  const base = STYLE_RATE[style];
  if (setTempo <= 0 || bpm <= 0) return { rate: base, matched: false };
  let best = Infinity;
  for (const folded of [bpm / 2, bpm, bpm * 2]) {
    const r = setTempo / folded;
    if (Math.abs(Math.log(r)) < Math.abs(Math.log(best))) best = r;
  }
  if (Math.abs(best - base) > MATCH_REACH)
    return { rate: base, matched: false };
  return { rate: snapRate(best), matched: true };
}

/** How far apart two tempos are, in octaves, folding half/double time. */
export function tempoDistance(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0.5;
  const d = Math.abs(Math.log2(a / b)) % 1;
  return Math.min(d, 1 - d);
}

/**
 * PICK THE NEXT SOUND: among those not yet played, one of the three closest
 * in tempo, at random — the set flows instead of lurching, and is still never
 * the same twice. With everything played the set starts over.
 */
export function chooseNext(
  pool: PoolSound[],
  played: ReadonlySet<string>,
  currentId: string | null,
  setTempo: number,
  random: () => number,
): PoolSound | null {
  let fresh = pool.filter(
    p => !played.has(p.soundId) && p.soundId !== currentId,
  );
  if (!fresh.length) fresh = pool.filter(p => p.soundId !== currentId);
  if (!fresh.length) return null;
  const ranked = [...fresh].sort(
    (a, b) =>
      tempoDistance(setTempo, a.map.bpm) - tempoDistance(setTempo, b.map.bpm),
  );
  const top = ranked.slice(0, Math.min(3, ranked.length));
  return top[Math.floor(random() * top.length)];
}

const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** A segment's length in bars, for this style. */
const lengths: Record<AutoDjStyle, number[]> = {
  club: [16, 24, 32],
  slowed: [16, 24],
  hyper: [16, 16, 24],
};

/** Bars of the way out, at the end of a segment. */
const EXIT_BARS = [2, 4];

/**
 * WHERE IN A SOUND THE SET TAKES ITS STRETCH. On a drop when it has one —
 * a DJ's cut lands on the drop — otherwise on the loudest phrase.
 * Returns bar indices [start, end).
 */
export function chooseWindow(
  map: SongMap,
  style: AutoDjStyle,
  random: () => number,
): { start: number; end: number; entry: Entry } {
  const n = map.bars.length;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  // A sound with no pulse is measured in 2 s blocks, not bars: 16 blocks is
  // ~32 s, which is the same stretch of time.
  const wanted = map.bpm > 0 ? pick(lengths[style]) : pick([16, 20]);
  const len = Math.min(wanted, n);
  if (n <= len) return { start: 0, end: n, entry: 'cut' };

  const drops = map.bpm > 0 ? findDrops(map.bars).filter(d => d < n - 8) : [];
  if (drops.length && random() < 0.75) {
    const start = pick(drops);
    return { start, end: Math.min(n, start + len), entry: 'drop' };
  }

  // The loudest phrase-aligned windows, one of the top three.
  const step = map.bpm > 0 ? 8 : 4;
  const candidates: { start: number; loud: number }[] = [];
  for (let s = 0; s + len <= n; s += step) {
    candidates.push({ start: s, loud: mean(map.bars.slice(s, s + len)) });
  }
  candidates.sort((a, b) => b.loud - a.loud);
  const { start } = pick(candidates.slice(0, 3));
  return { start, end: start + len, entry: 'walk-in' };
}

const CLOSED: number[] = [2, 0, -4, -9, -12];

const towards = (from: number[], to: number[], k: number): number[] =>
  from.map((g, i) =>
    Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(g + (to[i] - g) * k))),
  );

/**
 * THE MOVES INSIDE ONE SEGMENT. The sound's own mix (`planMix`) between
 * `startS` and the way out, with its speeds rescaled onto the segment's rate,
 * then the entry and the exit laid over it.
 */
export function segmentMix(opts: {
  map: SongMap;
  style: AutoDjStyle;
  seed: number;
  startS: number;
  endS: number;
  rate: number;
  entry: Entry;
  exit: Exit;
  exitBars: number;
}): Mix {
  const { map, style, seed, startS, endS, rate, entry, exit, exitBars } = opts;
  const full = planMix(map, style, seed);
  const baseRate = full.moves[0].rate ?? 1;
  const scale = (r: number) => snapRate((r / baseRate) * rate);

  const barS = map.bpm > 0 ? map.beatS * 4 : map.blockS;
  const beatS = barS / 4;
  const exitS = Math.max(startS + barS, endS - exitBars * barS);

  // The state the sound's own mix has reached where the segment comes in.
  // Echo is set here and only here — the reload hides its rewire.
  const entering = stateAt(full, startS);
  const moves: DjMove[] = [
    {
      atS: startS,
      ...entering,
      rate: scale(entering.rate),
      // A cut lands OPEN: whatever build the sound's own mix was in the
      // middle of is not what a set comes in on.
      ...(entry === 'drop' || entry === 'cut' ? { nextRoom: 'off' } : {}),
    },
  ];

  for (const move of full.moves) {
    if (move.atS <= startS || move.atS >= exitS) continue;
    const { echo: _echo, ...rest } = move;
    moves.push(
      rest.rate === undefined ? rest : { ...rest, rate: scale(rest.rate) },
    );
  }

  // WALKING IN: the sound starts next door and comes through the wall on a
  // bar line, two or four bars in.
  if (entry === 'walk-in') {
    const inBars = (seed & 1) === 0 ? 2 : 4;
    const openAt = startS + inBars * barS;
    if (openAt < exitS) {
      moves.push({ atS: startS, nextRoom: 'high' });
      moves.push({ atS: startS + (inBars / 2) * barS, nextRoom: 'medium' });
      moves.push({ atS: openAt, nextRoom: 'off' });
    }
  }

  // THE WAY OUT.
  const at = stateAt({ style, seed, moves: sortMoves(moves) }, exitS);
  if (exit === 'room') {
    const levels: EffectLevel[] = ['low', 'medium', 'high'];
    const span = endS - exitS;
    levels.forEach((level, i) => {
      moves.push({ atS: exitS + (span * i) / levels.length, nextRoom: level });
    });
  } else if (exit === 'sweep') {
    const steps = Math.max(1, Math.round((endS - exitS) / beatS));
    for (let s = 0; s < steps; s += 1) {
      moves.push({
        atS: exitS + s * beatS,
        gains: towards(at.gains, CLOSED, (s + 1) / steps),
      });
    }
  }

  return { style, seed, moves: sortMoves(moves) };
}

function sortMoves(moves: DjMove[]): DjMove[] {
  return moves
    .map((move, order) => ({ move, order }))
    .sort((a, b) => a.move.atS - b.move.atS || a.order - b.order)
    .map(({ move }) => move);
}

/** The time of a bar line, in sound time. */
const barTime = (map: SongMap, bar: number): number =>
  map.firstBarS + bar * (map.bpm > 0 ? map.beatS * 4 : map.blockS);

/**
 * THE NEXT SEGMENT OF THE SET: `next` brought in after a segment that left the
 * set at `setTempo`.
 */
export function planSegment(opts: {
  next: PoolSound;
  style: AutoDjStyle;
  seed: number;
  setTempo: number;
}): Segment {
  const { next, style, seed, setTempo } = opts;
  const random = rng(seed);
  const { map } = next;
  const window = chooseWindow(map, style, random);
  const { rate, matched } = matchRate(setTempo, map.bpm, style);
  const exit = pickExit(random);
  const exitBars = EXIT_BARS[Math.floor(random() * EXIT_BARS.length)];
  const startS = barTime(map, window.start);
  const endS = Math.min(map.durationS, barTime(map, window.end));
  // A tempo that could not be matched is a hard cut, whatever the window said.
  const entry: Entry =
    matched || window.entry !== 'walk-in' ? window.entry : 'cut';
  return {
    soundId: next.soundId,
    startS,
    endS,
    rate,
    tempo: map.bpm > 0 ? map.bpm * rate : setTempo,
    entry,
    exit,
    mix: segmentMix({
      map,
      style,
      seed,
      startS,
      endS,
      rate,
      entry,
      exit,
      exitBars,
    }),
  };
}

/**
 * THE SEGMENT A SET STARTS WITH, or the one a sound picked by hand becomes:
 * the sound plays on from where it is, to the end of a phrase at least
 * `minS` later. No cut on the way in — it is already sounding.
 */
export function joinSegment(opts: {
  sound: PoolSound;
  style: AutoDjStyle;
  seed: number;
  atS: number;
  setTempo: number;
  minS?: number;
}): Segment {
  const { sound, style, seed, atS, setTempo, minS = 40 } = opts;
  const random = rng(seed);
  const { map } = sound;
  const n = map.bars.length;
  const phrase = map.bpm > 0 ? 8 : 4;
  const offset = map.bpm > 0 ? (findDrops(map.bars)[0] ?? 0) % phrase : 0;
  let end = n;
  for (let b = offset; b <= n; b += phrase) {
    if (barTime(map, b) >= atS + minS) {
      end = b;
      break;
    }
  }
  const { rate } = matchRate(setTempo, map.bpm, style);
  const exit = pickExit(random);
  const exitBars = EXIT_BARS[Math.floor(random() * EXIT_BARS.length)];
  const endS = Math.min(map.durationS, barTime(map, end));
  return {
    soundId: sound.soundId,
    startS: atS,
    endS,
    rate,
    tempo: map.bpm > 0 ? map.bpm * rate : setTempo,
    entry: 'cut',
    exit,
    mix: segmentMix({
      map,
      style,
      seed,
      startS: atS,
      endS,
      rate,
      entry: 'cut',
      exit,
      exitBars,
    }),
  };
}

function pickExit(random: () => number): Exit {
  const r = random();
  return r < 0.45 ? 'room' : r < 0.85 ? 'sweep' : 'cut';
}
