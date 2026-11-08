// ---------------------------------------------------------------------------
// AUTO DJ — THE SET. A DJ does not play whole songs: they play the good part
// of one, take it out with an effect, and bring the next one in where it
// counts (Juan, 2026-11-04). This file decides WHICH sound comes next, WHICH
// part of it, and every move on the controls while it plays. Pure, so it is
// unit-tested; `AutoDjDirector` plays it.
//
// IT IS PLANNED FROM THE SONGS' PARTS (`sections.ts`), NOT FROM A CLOCK.
//   · THE ORDER is planned up front, once the whole library is read
//     (`planOrder`): each sound near the last one's tempo, and the run as a
//     whole shaped like a night — a warm-up, a long peak, a come-down.
//   · THE ENTRY follows where the last sound left the set. When one sound's
//     best part ends, the next comes in ON its best part — straight on the
//     drop, or on the build that throws it open; when one leaves on a
//     breakdown, the next comes in on a build or a verse and climbs. A sound
//     is almost never started from its first bar: a DJ cues the good part,
//     and the best peak is chosen, not the first one.
//   · THE EXIT is where the song itself lets go — the end of the peak, or
//     the first bars of the breakdown after it — so the part you are enjoying
//     always plays out (Juan, 2026-11-04: "me gustaba como estaba pasando y
//     de repente me cambia la canción").
//   · THE MOVES are chosen per part (`choreograph`): a build closes the EQ a
//     beat at a time, comes up behind the wall and pushes the speed; the drop
//     throws it all open on a new curve; a peak gets a flourish on most of
//     its phrase lines; a breakdown goes next door, thins out or sinks; the
//     way out is the wall, a filter sweep, a vinyl brake or a hard cut.
//
// THE CUT IS A RELOAD. The player has one source, so the next sound loads on
// the downbeat where this one ends. The way-out effect is what makes that read
// as a transition rather than a skip, and it is also why Echo can change at a
// cut and nowhere else (its ~200 ms rewire hides inside the load).
// ---------------------------------------------------------------------------

import {
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  type EffectLevel,
} from '../shapeDsp';

import { type SongMap } from './analysis';
import { rng, type AutoDjStyle, type DjMove, type Mix } from './plan';
import {
  findSections,
  hotness,
  peakRuns,
  phraseBars,
  type Section,
} from './sections';

/** How a segment comes in. */
export type Entry = 'drop' | 'walk-in' | 'verse' | 'cut';
/** How a segment goes out. */
export type Exit = 'room' | 'sweep' | 'brake' | 'cut';
/**
 * Where a segment leaves the set: at the top of a PEAK, after the song has
 * begun to FALL, or on a BUILD it never lets land — the chorus kept back for
 * when the set returns to that song, and the next record's drop landing in
 * its place.
 */
export type EndsOn = 'peak' | 'fall' | 'build';
/**
 * Which part of a song a segment plays:
 *   · PEAK    — its best part;
 *   · OPENING — how it starts, its intro or first verse, leaving before the
 *               chorus so the set can come back for it;
 *   · LATER   — a return to a song the set left earlier, from `fromBar` on.
 */
export type Part = 'peak' | 'opening' | 'later';

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
  endsOn: EndsOn;
  part: Part;
  /**
   * Where the set can come back to this sound: the bar it left on, when a
   * peak still lies ahead of it. Undefined when the song is spent.
   */
  resumeBar?: number;
  /** Every move inside the segment, sorted; the first is at `startS`. */
  mix: Mix;
};

export type PoolSound = { soundId: string; map: SongMap };

// --- Speed ----------------------------------------------------------------

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

export const snapRate = (rate: number): number =>
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

// --- The order ------------------------------------------------------------

/**
 * WHERE IN THE NIGHT the run is, 0…1, to how strong a sound it wants, 0…1
 * (as a rank among the library). A warm-up, a long peak, a come-down.
 */
const arcTarget = (t: number): number =>
  t < 0.25 ? 0.3 + t * 1.8 : t < 0.8 ? 0.9 : 0.55;

/**
 * THE ORDER OF A WHOLE RUN THROUGH THE LIBRARY, planned before it starts:
 * every sound in `pool` but `firstId`, each chosen for being near the last
 * one's tempo and for fitting where the run is in its arc — with a little
 * chance in it, so no two runs are the same.
 */
export function planOrder(
  pool: PoolSound[],
  firstId: string | null,
  startTempo: number,
  random: () => number,
): string[] {
  const hot = new Map(pool.map(p => [p.soundId, hotness(findSections(p.map))]));
  const ranked = [...pool].sort(
    (a, b) => (hot.get(a.soundId) ?? 0) - (hot.get(b.soundId) ?? 0),
  );
  const rank = new Map(
    ranked.map((p, i) => [
      p.soundId,
      ranked.length > 1 ? i / (ranked.length - 1) : 0.5,
    ]),
  );
  const left = pool.filter(p => p.soundId !== firstId);
  const total = left.length;
  const order: string[] = [];
  let tempo = startTempo;
  while (left.length) {
    const target = arcTarget(total > 1 ? order.length / (total - 1) : 0.5);
    let best = 0;
    let bestCost = Infinity;
    left.forEach((p, i) => {
      const bpm = p.map.bpm;
      // A sound with no pulse has no tempo to clash with.
      const apart = tempo > 0 && bpm > 0 ? tempoDistance(tempo, bpm) : 0.08;
      const cost =
        apart * 4 +
        Math.abs((rank.get(p.soundId) ?? 0.5) - target) +
        random() * 0.6;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    });
    const [next] = left.splice(best, 1);
    order.push(next.soundId);
    if (next.map.bpm > 0) tempo = next.map.bpm;
  }
  return order;
}

// --- The curves -----------------------------------------------------------

type Curve = number[];

const preset = (key: string): Curve => [
  ...(EQ_PRESETS.find(p => p.i18nKey === key)?.gains ?? [0, 0, 0, 0, 0]),
];

/**
 * The DJ's own curves, beside the presets — whole dB inside the sliders,
 * levelled by the automatic headroom trim like any curve a person drags.
 */
const CUSTOM: Record<string, Curve> = {
  // Kick and air up, the middle scooped: the club sound.
  smile: [4, 1, -2, 1, 3],
  // The low end pushed forward.
  punch: [4, 3, 0, -1, 1],
  // Bass taken out from under it: a breakdown's thin, far sound.
  thin: [-8, -5, 0, 2, 1],
  // Dark and heavy: the top rolled off.
  // A +5 shelf paid 6.5 dB of trim; +3 says "deep" for 2.
  deep: [3, 3, -2, -5, -7],
  // Shimmer on top.
  air: [-2, -1, 0, 2, 5],
};

/** Where a build sweeps TO: the bottom kept, the top pulled right down. */
const CLOSED: Curve = [2, 0, -4, -9, -12];

/**
 * What a HELD wall stands on. The wall is already the filter, and a shaped
 * curve under it pays a headroom trim on top of the wall's own, which put a
 * held Next Room 10–12 dB under an untouched sound — more than the leveller
 * can win back without boosting (`loudness.ts`).
 */
const FLAT: Curve = [0, 0, 0, 0, 0];

const clampDb = (g: number) =>
  Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(g)));

const towards = (from: Curve, to: Curve, k: number): Curve =>
  from.map((g, i) => clampDb(g + (to[i] - g) * k));

/** Each style's palette: which curves it reaches for, part by part. */
type Palette = {
  keepPitch: boolean;
  echo: EffectLevel[];
  peak: string[];
  verse: string[];
  break: string[];
  /** Chance a phrase line inside a peak gets a flourish. */
  flourish: number;
  /** Chance a build pushes the speed up into its drop. */
  push: number;
  /** Chance a four-bar line gets one of Juan's live gestures (`hands`). */
  hands: number;
};

const PALETTES: Record<AutoDjStyle, Palette> = {
  club: {
    // Stated, not left to the person: Club follows a Slowed or a Hyper
    // stretch, which turned pitch preservation off.
    keepPitch: true,
    echo: ['off', 'off', 'off', 'low'],
    peak: ['bass', 'flat', 'smile', 'punch', 'bright'],
    verse: ['flat', 'bass', 'bright', 'vocal'],
    break: ['vocal', 'warm', 'thin'],
    flourish: 0.7,
    push: 0.3,
    hands: 0.55,
  },
  slowed: {
    keepPitch: false,
    // Never past Low: Echo pays its level in trim (`loudness.ts`).
    echo: ['off', 'low', 'low'],
    peak: ['bass', 'deep', 'warm', 'punch'],
    verse: ['warm', 'bass', 'deep'],
    break: ['warm', 'deep', 'thin'],
    flourish: 0.5,
    push: 0.1,
    hands: 0.45,
  },
  hyper: {
    keepPitch: false,
    echo: ['off'],
    peak: ['bright', 'smile', 'punch', 'air', 'bass'],
    verse: ['bright', 'treble', 'air'],
    break: ['vocal', 'treble', 'thin'],
    flourish: 0.85,
    push: 0.55,
    hands: 0.65,
  },
};

/**
 * A preset stays exactly itself, so its name shows in the Shape sheet; the
 * DJ's own curves are nudged a dB here and there, so no two are the same.
 */
const curveOf = (name: string, random: () => number): Curve => {
  const own = CUSTOM[name];
  if (!own) return preset(name);
  return own.map(g => clampDb(g + Math.floor(random() * 3) - 1));
};

// --- The choreography -----------------------------------------------------

/**
 * EVERY MOVE WHILE ONE SEGMENT PLAYS, part by part. The first move is at
 * `startS` and carries the whole state; every other one lands on a bar or a
 * beat inside [startS, endS).
 */
export function choreograph(opts: {
  map: SongMap;
  sections: Section[];
  style: AutoDjStyle;
  seed: number;
  startS: number;
  endS: number;
  rate: number;
  entry: Entry;
  exit: Exit;
  /** Where a walk-in breaks through the wall: the drop it was cued for. */
  openS?: number;
}): Mix {
  const { map, sections, style, seed, startS, endS, rate, entry, exit } = opts;
  const random = rng(seed ^ 0x5bd1e995);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const chance = (p: number) => random() < p;
  const palette = PALETTES[style];

  const pulse = map.bpm > 0;
  const barS = pulse ? map.beatS * 4 : map.blockS;
  const beatS = barS / 4;
  const barAt = (b: number) => map.firstBarS + b * barS;

  const exitBars = exit === 'cut' ? 0 : exit === 'brake' ? 1 : pick([2, 4]);
  const exitS = Math.max(startS + barS, endS - exitBars * barS);
  const before = (t: number) => t > startS + 1e-6 && t < exitS;

  const moves: DjMove[] = [];
  const at = (atS: number, move: Omit<DjMove, 'atS'>) => {
    if (atS < startS || atS >= endS) return;
    // Under the segment's Echo the wall goes no deeper than Low: each pays
    // its level in trim, and together they sank the set past what the
    // leveller can win back (`loudness.ts`).
    const capped =
      baseEcho !== 'off' &&
      (move.nextRoom === 'medium' || move.nextRoom === 'high')
        ? { ...move, nextRoom: 'low' as const }
        : move;
    moves.push({ atS, ...capped });
  };

  const sectionAt = (t: number) =>
    sections.find(s => barAt(s.start) <= t + 1e-6 && t < barAt(s.end) - 1e-6);
  const curveFor = (s: Section | undefined): Curve => {
    if (s?.kind === 'peak') return curveOf(pick(palette.peak), random);
    if (s?.kind === 'break' || s?.kind === 'outro')
      return curveOf(pick(palette.break), random);
    return curveOf(pick(palette.verse), random);
  };

  let gains = curveFor(sectionAt(startS));
  let current = rate;
  const baseEcho = pick(palette.echo);
  moves.push({
    atS: startS,
    gains,
    nextRoom: 'off',
    echo: baseEcho,
    rate,
    keepPitch: palette.keepPitch,
  });

  // JUAN'S HANDS — the moves of his own DÁKITI session (the demo on
  // juanevillam.com, 2026-11-04), the set's reference for how this app is
  // played live. Read off the recording frame by frame, his hands do four
  // things, and each is one gesture here:
  //   · HOP   — presets flicked through in a burst, a couple of beats each,
  //             landing on the one he keeps;
  //   · TAPE  — the speed walked a twentieth at a time, down to 0.85× or up
  //             to 1.15×, with Preserve Pitch OFF so the key slides with it,
  //             held, and walked back;
  //   · STACK — Next Room climbed Low → Medium → High with Echo under it,
  //             held for bars, then cleared;
  //   · FLIP  — Preserve Pitch toggled off and on over a sped-up stretch,
  //             the voice dropping into the varispeed and back.
  // Every gesture fits inside [lineS, untilS) and leaves the state it found,
  // so a section's own moves stay in charge.
  const stepS = barS <= 2.2 ? barS : 2 * beatS;
  const HOP: readonly string[] = [
    'bass',
    'vocal',
    'treble',
    'warm',
    'bright',
    'flat',
  ];
  const hands = (
    lineS: number,
    untilS: number,
    home: 'peak' | 'verse' | 'break',
  ): number => {
    const room = untilS - lineS;
    const r = random();
    if (r < 0.32) {
      // HOP.
      const n = 3 + Math.floor(random() * 3);
      const each = 2 * beatS;
      if (n * each > room) return lineS;
      let last = '';
      for (let k = 0; k < n - 1; k += 1) {
        const options = HOP.filter(p => p !== last);
        last = pick(options);
        at(lineS + k * each, { gains: preset(last) });
      }
      gains = curveOf(pick(palette[home]), random);
      at(lineS + (n - 1) * each, { gains });
      return lineS + n * each;
    }
    if (r < 0.62 && pulse) {
      // TAPE.
      const down =
        home === 'break' ||
        style === 'slowed' ||
        (style !== 'hyper' && chance(0.5));
      const depth = pick([0.1, 0.15]);
      const target = snapRate(current + (down ? -depth : depth));
      const steps = Math.round(Math.abs(target - current) / RATE_STEP);
      if (!steps) return lineS;
      const hold = pick([1, 2]) * barS;
      const total = 2 * steps * stepS + hold;
      if (total > room) return lineS;
      at(lineS, { keepPitch: false });
      for (let k = 1; k <= steps; k += 1) {
        const v = snapRate(current + (down ? -1 : 1) * k * RATE_STEP);
        at(lineS + (k - 1) * stepS, { rate: v });
      }
      const back = lineS + steps * stepS + hold;
      for (let k = 1; k <= steps; k += 1) {
        const v = snapRate(target + (down ? 1 : -1) * k * RATE_STEP);
        at(back + (k - 1) * stepS, { rate: v });
      }
      const end = back + steps * stepS;
      at(end - stepS, { keepPitch: palette.keepPitch });
      return end;
    }
    if (r < 0.88) {
      // STACK. The echo's rewire mutes ~200 ms, so it changes on the beat
      // BEFORE a line — the drop-out a DJ makes on purpose — never on one.
      const bars = Math.min(8, Math.floor(room / barS));
      if (bars < 4) return lineS;
      // Up a level a bar and down the same way — never a jump in level —
      // on a flat curve, and no deeper than Medium while it is held.
      const shape = gains;
      at(lineS, { gains: FLAT, nextRoom: 'low' });
      const echoed = pulse && baseEcho === 'off' && chance(0.6);
      if (echoed) at(lineS - beatS, { echo: 'low' });
      // With Echo under it the wall stays at Low: the two pay twice.
      if (!echoed) at(lineS + barS, { nextRoom: 'medium' });
      const end = lineS + bars * barS;
      at(end - barS, { nextRoom: 'low' });
      if (echoed) at(end - beatS, { echo: baseEcho });
      at(end, { nextRoom: 'off', gains: shape });
      return end;
    }
    // FLIP — only means anything off 1×.
    if (!pulse || Math.abs(current - 1) < 0.01 || 4 * barS > room) return lineS;
    const own = palette.keepPitch;
    at(lineS, { keepPitch: !own });
    at(lineS + 2 * barS, { keepPitch: own });
    if (chance(0.5)) {
      at(lineS + 3 * barS, { keepPitch: !own });
      at(lineS + 4 * barS - beatS, { keepPitch: own });
    }
    return lineS + 4 * barS;
  };

  // WALKING IN: the sound starts next door and comes through the wall on a
  // bar line — ON THE DROP when it came in over the build, which is the whole
  // point of cueing it there.
  if (entry === 'walk-in') {
    const openAt = opts.openS ?? startS + pick([2, 4]) * barS;
    if (openAt < exitS) {
      // Behind the wall on a flat curve (see FLAT); its own curve comes
      // through the door with it.
      const own = gains;
      gains = FLAT;
      at(startS, { gains, nextRoom: 'medium' });
      at(startS + (openAt - startS) / 2, { nextRoom: 'low' });
      at(openAt, { nextRoom: 'off', gains: own });
    }
  } else if (entry === 'verse' && chance(0.5)) {
    at(startS, { nextRoom: 'medium' });
    at(startS + 2 * barS, { nextRoom: 'off' });
  }

  let pushed = false;
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    const sS = barAt(s.start);
    const eS = barAt(s.end);
    if (eS <= startS || sS >= exitS) continue;
    const next = sections[i + 1];

    // ENTERING THIS PART, when its first bar falls inside the segment.
    if (before(sS)) {
      if (s.kind === 'peak') {
        // THE DROP: everything thrown open on the downbeat, on a new curve.
        gains = curveFor(s);
        const back = pushed ? rate : current;
        pushed = false;
        current =
          style === 'hyper' && chance(0.5) ? snapRate(back + 0.05) : back;
        at(sS, { gains, nextRoom: 'off', rate: current });
      } else if (s.kind === 'break') {
        const r = random();
        if (r < 0.45) {
          gains = FLAT;
          at(sS, { gains, nextRoom: 'low' });
          at(sS + barS, { nextRoom: 'medium' });
        } else if (r < 0.8) {
          gains = curveOf(pick(palette.break), random);
          at(sS, { gains, nextRoom: 'off' });
        } else {
          gains = curveOf('thin', random);
          at(sS, { gains, nextRoom: 'off' });
        }
        // Slowed lets a breakdown sink half a step; the drop brings it back.
        if (style === 'slowed' && chance(0.4)) {
          current = snapRate(rate - 0.05);
          at(sS, { rate: current });
        }
      } else if (s.kind === 'outro') {
        // Walking out of the room.
        const span = Math.min(eS, exitS) - sS;
        gains = FLAT;
        at(sS, { gains, nextRoom: 'low' });
        at(sS + span / 3, { nextRoom: 'medium' });
        at(sS + (2 * span) / 3, { nextRoom: 'high' });
      } else {
        gains = curveFor(s);
        current = rate;
        at(sS, { gains, nextRoom: 'off', rate });
      }
    }

    // THE BUILD INTO THE NEXT PEAK: the last bars of this part close the
    // filter a beat at a time, come up behind the wall, and push the speed.
    if (next?.kind === 'peak' && s.kind !== 'peak') {
      const dropS = barAt(next.start);
      if (dropS > startS && dropS < exitS) {
        const buildBars = Math.min(s.end - s.start, pick([4, 8]));
        const from = Math.max(startS, dropS - buildBars * barS);
        const steps = Math.max(1, Math.round((dropS - from) / beatS));
        const open = gains;
        for (let k = 0; k < steps; k += 1) {
          at(from + k * beatS, {
            gains: towards(open, CLOSED, (k + 1) / steps),
          });
        }
        // A walk-in over this build already has the wall in hand.
        if (entry !== 'walk-in' || opts.openS !== dropS) {
          // Light: the filter is already closing, and the two together
          // sank a build 12 dB under the drop it leads to.
          at(dropS - 2 * barS, { nextRoom: 'low' });
          if (chance(0.4)) at(dropS - barS, { nextRoom: 'medium' });
        }
        if (pulse && chance(palette.push)) {
          at(dropS - 4 * barS, { rate: snapRate(current + 0.05) });
          at(dropS - 2 * barS, { rate: snapRate(current + 0.1) });
          pushed = true;
        }
      }
    }

    // FLOURISHES on the phrase lines inside a peak.
    // The last part of a section that runs into a peak is its build's.
    const untilS = Math.min(
      eS,
      exitS,
      next?.kind === 'peak' ? barAt(next.start) - 8 * barS : eS,
    );

    // JUAN'S HANDS on the four-bar lines of a verse or a breakdown.
    if (pulse && (s.kind === 'verse' || s.kind === 'break')) {
      let busyUntil = 0;
      for (let b = s.start + 4; b < s.end; b += 4) {
        const lineS = barAt(b);
        if (!before(lineS) || lineS < busyUntil - 1e-6) continue;
        if (!chance(palette.hands * 0.8)) continue;
        busyUntil = hands(lineS, untilS, s.kind);
      }
    }

    if (s.kind === 'peak') {
      const size = phraseBars(map);
      let lifted = false;
      let busyUntil = 0;
      for (
        let b = s.start + (pulse ? 4 : size);
        b < s.end;
        b += pulse ? 4 : size
      ) {
        const lineS = barAt(b);
        if (!before(lineS) || lineS + barS > exitS) continue;
        if (lineS < busyUntil - 1e-6) continue;
        if (pulse && chance(palette.hands)) {
          busyUntil = hands(lineS, untilS, 'peak');
          if (busyUntil > lineS) continue;
        }
        if ((b - s.start) % size !== 0) continue;
        if (!chance(palette.flourish)) continue;
        const kind = random();
        if (kind < 0.3) {
          // A new curve for the next phrase.
          gains = curveOf(pick(palette.peak), random);
          at(lineS, { gains });
        } else if (kind < 0.5) {
          // A bar next door, then straight back.
          at(lineS, { nextRoom: pick<EffectLevel>(['low', 'medium']) });
          at(lineS + barS, { nextRoom: 'off' });
        } else if (kind < 0.7) {
          // A tease: the two beats before the line close, and it opens on it.
          at(lineS - 2 * beatS, { gains: towards(gains, CLOSED, 0.55) });
          at(lineS - beatS, { gains: towards(gains, CLOSED, 0.9) });
          at(lineS, { gains });
        } else if (kind < 0.85) {
          // A chop: one bar of the filter slammed shut and open on the beat.
          for (let k = 0; k < 4; k += 1) {
            at(lineS + k * beatS, {
              gains: k % 2 === 0 ? towards(gains, CLOSED, 0.85) : gains,
            });
          }
        } else if (!lifted && pulse) {
          // A lift: the rest of the peak half a step faster.
          lifted = true;
          current = snapRate(current + 0.05);
          at(lineS, { rate: current });
        }
      }
    }
  }

  // THE WAY OUT.
  if (exit === 'room') {
    const span = endS - exitS;
    gains = FLAT;
    at(exitS, { gains, nextRoom: 'low' });
    at(exitS + span / 3, { nextRoom: 'medium' });
    at(exitS + (2 * span) / 3, { nextRoom: 'high' });
    // How Juan's DÁKITI session ends: the record slowed a twentieth at a
    // time, pitch and all, as it goes behind the wall.
    if (pulse && chance(0.5)) {
      at(exitS, { keepPitch: false });
      const steps = Math.max(1, Math.min(4, Math.round(span / stepS)));
      for (let k = 1; k <= steps; k += 1) {
        at(exitS + (k - 1) * (span / steps), {
          rate: snapRate(current - k * RATE_STEP),
        });
      }
    }
  } else if (exit === 'sweep') {
    const steps = Math.max(1, Math.round((endS - exitS) / beatS));
    const open = gains;
    for (let k = 0; k < steps; k += 1) {
      at(exitS + k * beatS, { gains: towards(open, CLOSED, (k + 1) / steps) });
    }
  } else if (exit === 'brake') {
    // A VINYL BRAKE: the record slowed under the hand, pitch and all, over
    // the last bar.
    at(exitS, { keepPitch: false });
    [0.9, 0.85, 0.8, 0.75].forEach((f, k) => {
      at(exitS + k * beatS, { rate: snapRate(current * f) });
    });
  }

  return { style, seed, moves: sortMoves(moves) };
}

function sortMoves(moves: DjMove[]): DjMove[] {
  return moves
    .map((move, order) => ({ move, order }))
    .sort((a, b) => a.move.atS - b.move.atS || a.order - b.order)
    .map(({ move }) => move);
}

// --- Segments -------------------------------------------------------------

/**
 * The longest one sound stays in the set (Juan, 2026-11-07: at 210 s a track
 * with a long reggaeton peak played almost whole, reading as Shaper on one
 * song rather than a DJ cutting between records). A return (`later`) is
 * shorter still, so the second visit is a callback, never another full turn.
 */
const MAX_SEGMENT_S = 72;
const MAX_RETURN_S = 44;
/** The shortest stretch worth bringing a sound in for. */
const MIN_SEGMENT_S = 24;

const barTime = (map: SongMap, bar: number): number =>
  map.firstBarS + bar * (map.bpm > 0 ? map.beatS * 4 : map.blockS);

function pickExit(random: () => number, endsOn: EndsOn): Exit {
  const r = random();
  // Out of a peak a hard cut or a brake lands; after the song has fallen,
  // the softer ways out read better; a build is cut short by closing it
  // down further, which is what the next drop then throws open.
  if (endsOn === 'peak')
    return r < 0.3 ? 'room' : r < 0.55 ? 'sweep' : r < 0.75 ? 'brake' : 'cut';
  if (endsOn === 'build') return r < 0.6 ? 'sweep' : 'room';
  return r < 0.45 ? 'room' : r < 0.85 ? 'sweep' : 'cut';
}

/**
 * Where a segment that came in at bar `from` leaves, given the peak run it
 * was cued for: the end of that peak — or a phrase into the part after it, so
 * the set sometimes changes record on the way down instead of at the top.
 * `maxS` caps the turn (shorter when returning to a song a second time).
 */
function chooseEnd(
  map: SongMap,
  sections: Section[],
  run: [number, number],
  from: number,
  random: () => number,
  maxS = MAX_SEGMENT_S,
): { end: number; endsOn: EndsOn } {
  const n = map.bars.length;
  const size = phraseBars(map);
  const startS = barTime(map, from);
  const fits = (b: number) => barTime(map, b) - startS <= maxS;
  // One peak section by default; a contiguous second one only when both fit
  // comfortably inside `maxS`. Never chain a separate peak run across a break.
  let last = run[0];
  while (last < run[1] && fits(sections[last + 1].end)) last += 1;

  let end = sections[last].end;
  let endsOn: EndsOn = 'peak';
  const after = sections[last + 1];
  if (after && after.kind !== 'peak' && random() < 0.3) {
    const into = Math.min(after.end, after.start + size);
    if (fits(into)) {
      end = into;
      endsOn = 'fall';
    }
  }
  // The guard: a peak that runs on past the cap leaves on a phrase line.
  while (!fits(end) && end - size > from) end -= size;
  // Too short to be worth it: a phrase further.
  while (barTime(map, end) - startS < MIN_SEGMENT_S && end < n) {
    end = Math.min(n, end + size);
    endsOn = 'fall';
  }
  return { end, endsOn };
}

/** The first bar of a song's first peak — where its opening runs up to. */
export function firstPeakBar(map: SongMap): number {
  const sections = findSections(map);
  const run = peakRuns(sections).sort((x, y) => x[0] - y[0])[0];
  return run ? sections[run[0]].start : 0;
}

/** Where the set can come back to a song it leaves at bar `end`. */
function resumeFrom(
  map: SongMap,
  sections: Section[],
  end: number,
): number | undefined {
  const ahead = peakRuns(sections).some(([a]) => sections[a].start >= end);
  return ahead && end <= map.bars.length - 16 ? end : undefined;
}

/**
 * THE NEXT SEGMENT OF THE SET: a part of `next`, brought in after a segment
 * that left the set at `setTempo` and `after` — on a peak, falling, or on a
 * build the next drop should answer. `finale` plays the sound out to its end:
 * the last record of a run.
 */
export function planSegment(opts: {
  next: PoolSound;
  style: AutoDjStyle;
  seed: number;
  setTempo: number;
  after?: EndsOn;
  part?: Part;
  /** For `later`: the bar the set left this song on. */
  fromBar?: number;
  finale?: boolean;
}): Segment {
  const {
    next,
    style,
    seed,
    setTempo,
    after = 'peak',
    fromBar = 0,
    finale = false,
  } = opts;
  const random = rng(seed);
  const { map } = next;
  const sections = findSections(map);
  const n = map.bars.length;
  const size = phraseBars(map);
  let part: Part = opts.part ?? 'peak';

  const byPosition = peakRuns(sections).sort((x, y) => x[0] - y[0]);
  const firstPeak = byPosition[0] ? sections[byPosition[0][0]].start : 0;
  // An opening needs something before the chorus to play.
  if (part === 'opening' && firstPeak < 16) part = 'peak';

  let from: number;
  let end: number;
  let endsOn: EndsOn;
  let entry: Entry;
  let openBar: number | undefined;

  if (part === 'opening') {
    // HOW THE SONG STARTS: its intro now and then — a long one only from
    // its last phrase — otherwise straight in on its first verse.
    const intro = sections[0];
    const verse = sections.find(s => s.start > 0 && s.start < firstPeak);
    if (intro.kind !== 'intro' || !verse || random() < 0.3) {
      from = intro.end - intro.start >= 16 ? intro.end - size : 0;
    } else {
      from = verse.start;
    }
    entry = 'verse';
    // OUT ON THE BUILD, the chorus kept back — or, less often, through it.
    if (random() < 0.65 && firstPeak - from >= 12) {
      end = firstPeak;
      endsOn = 'build';
    } else {
      ({ end, endsOn } = chooseEnd(map, sections, byPosition[0], from, random));
    }
  } else {
    // PEAK, or LATER: a peak to aim for — the best of them, or for a return
    // the first one still ahead of where the set left the song.
    const ahead = byPosition.filter(([a]) => sections[a].start >= fromBar);
    const runs =
      part === 'later' && ahead.length
        ? [ahead[0], ...ahead.slice(1)]
        : peakRuns(sections);
    const chosen =
      part === 'peak' && runs.length > 1 && random() < 0.35
        ? runs[1 + Math.floor(random() * (runs.length - 1))]
        : runs[0];
    // A LONG PEAK — a song that stays up for minutes, as a lot of reggaeton
    // does — is cued at one of its own sections, not always its first: that
    // first one is often the song's opening bar.
    let first = chosen[0];
    if (
      part === 'peak' &&
      chosen[1] > chosen[0] &&
      (sections[chosen[0]].start === 0 || random() < 0.5)
    ) {
      first = chosen[0] + 1 + Math.floor(random() * (chosen[1] - chosen[0]));
    }
    const run: [number, number] = [first, chosen[1]];
    const peak = sections[first];
    // What leads into it, when that is a different part (not more peak).
    const lead =
      sections[first - 1]?.kind === 'peak' ? undefined : sections[first - 1];

    // WHERE IN IT: on the drop, on the build before it, or a part earlier —
    // weighted by how the last sound left. A build left hanging is answered
    // by a drop almost every time.
    const r = random();
    const dropOdds = after === 'build' ? 0.9 : after === 'peak' ? 0.6 : 0.15;
    const wantDrop = r < dropOdds;
    const wantBuild = !wantDrop && r < dropOdds + (1 - dropOdds) * 0.65;
    from = peak.start;
    entry = 'drop';
    if (part === 'later' && fromBar > 0 && lead && lead.start >= fromBar) {
      // A return picks the song up where it was left, when that is close.
      if (random() < 0.5) {
        from = Math.max(fromBar, lead.start);
        entry = 'verse';
      }
    }
    if (entry === 'drop' && !wantDrop && lead && lead.start > 0) {
      if (wantBuild || lead.kind === 'build') {
        from = Math.max(lead.start, peak.start - size);
        entry = 'walk-in';
        openBar = peak.start;
      } else {
        from = lead.start;
        entry = 'verse';
      }
    } else if (
      entry === 'drop' &&
      peak.end - peak.start >= 2 * size &&
      random() < 0.25
    ) {
      // Halfway into a long drop: the cut lands in the middle of it.
      from = peak.start + size;
    }
    ({ end, endsOn } = chooseEnd(
      map,
      sections,
      run,
      from,
      random,
      part === 'later' ? MAX_RETURN_S : MAX_SEGMENT_S,
    ));
  }

  const { rate, matched } = matchRate(setTempo, map.bpm, style);
  // A tempo that could not be matched is a hard cut, whatever was planned.
  if (!matched && entry === 'walk-in' && openBar !== undefined) {
    from = openBar;
    entry = 'drop';
    openBar = undefined;
  }
  if (n <= 16) {
    from = 0;
    entry = 'cut';
    openBar = undefined;
  } else if (from === 0 && part !== 'opening') {
    // Never the song's first bar, unless it is the song's opening on purpose.
    from = Math.min(size, n - 16);
    entry = 'cut';
  }
  if (finale) {
    end = n;
    endsOn = 'fall';
  }
  if (end <= from) end = Math.min(n, from + size);

  const exit: Exit = finale ? 'cut' : pickExit(random, endsOn);
  const startS = barTime(map, from);
  const endS = Math.min(map.durationS, barTime(map, end));
  return {
    soundId: next.soundId,
    startS,
    endS,
    rate,
    tempo: map.bpm > 0 ? map.bpm * rate : setTempo,
    entry,
    exit,
    endsOn,
    part,
    // A song that already came back (`later`) is spent — never a third turn.
    resumeBar:
      finale || part === 'later' ? undefined : resumeFrom(map, sections, end),
    mix: choreograph({
      map,
      sections,
      style,
      seed,
      startS,
      endS,
      rate,
      entry,
      exit,
      openS: openBar === undefined ? undefined : barTime(map, openBar),
    }),
  };
}

/**
 * THE SEGMENT A SET STARTS WITH, or the one a sound picked by hand becomes:
 * the sound plays on from where it is, through its next peak, to where it
 * falls — at least `minS` later. No cut on the way in: it is already playing.
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
  const sections = findSections(map);
  const n = map.bars.length;
  const size = phraseBars(map);
  const barS = map.bpm > 0 ? map.beatS * 4 : map.blockS;
  const here = Math.max(0, Math.floor((atS - map.firstBarS) / barS));

  // The first peak that ends far enough ahead.
  const run = peakRuns(sections)
    .sort((x, y) => x[0] - y[0])
    .find(([, b]) => barTime(map, sections[b].end) >= atS + minS);
  let end = n;
  let endsOn: EndsOn = 'fall';
  if (run) {
    ({ end, endsOn } = chooseEnd(
      map,
      sections,
      run,
      Math.max(here, sections[run[0]].start),
      random,
    ));
  } else {
    // No peak left ahead: the next phrase line at least `minS` away.
    for (let b = here + size; b <= n; b += size) {
      if (barTime(map, b) >= atS + minS) {
        end = b;
        break;
      }
    }
  }

  const { rate } = matchRate(setTempo, map.bpm, style);
  const exit = pickExit(random, endsOn);
  const endS = Math.min(map.durationS, barTime(map, end));
  return {
    soundId: sound.soundId,
    startS: atS,
    endS,
    rate,
    tempo: map.bpm > 0 ? map.bpm * rate : setTempo,
    entry: 'cut',
    exit,
    endsOn,
    part: 'peak',
    resumeBar: resumeFrom(map, sections, end),
    mix: choreograph({
      map,
      sections,
      style,
      seed,
      startS: atS,
      endS,
      rate,
      entry: 'cut',
      exit,
    }),
  };
}

// --- Between records ------------------------------------------------------

export type TransitionFx = {
  /** Rises INTO the cut, ending on it. */
  before?: 'riser' | 'reverseCymbal';
  /** How long the riser runs, in seconds of the outgoing music. */
  beforeS?: number;
  /** Lands ON the cut. */
  on?: 'impact' | 'downlifter' | 'zap';
  /** How long the incoming sound fades in over. */
  fadeInS: number;
};

/**
 * THE GLUE BETWEEN TWO SEGMENTS, chosen from how one leaves and the other
 * comes in: a build cut short rises into the next drop and lands with a hit;
 * a filter sweep or the wall rises too; a brake lands with a boom; a drop is
 * hit, a walk-in is not (the wall opening is its own arrival), and a verse
 * slides in on a downlifter. Every cut gets SOMETHING: a record must never
 * simply appear (Juan, 2026-11-04).
 */
export function transitionFx(
  from: Segment,
  to: Segment,
  random: () => number,
  barS: number,
): TransitionFx {
  const fx: TransitionFx = { fadeInS: 0.03 };
  const riseOdds =
    from.endsOn === 'build'
      ? 0.95
      : from.exit === 'sweep' || from.exit === 'room'
        ? 0.6
        : from.exit === 'cut'
          ? 0.35
          : 0;
  if (random() < riseOdds) {
    if (random() < 0.65) {
      fx.before = 'riser';
      fx.beforeS = (random() < 0.5 ? 2 : 4) * barS;
    } else {
      fx.before = 'reverseCymbal';
      fx.beforeS = barS / 2;
    }
  }
  if (to.entry === 'drop' || to.entry === 'cut' || from.exit === 'brake') {
    fx.on = random() < 0.75 ? 'impact' : 'zap';
  } else if (to.entry === 'verse') {
    fx.on = random() < 0.7 ? 'downlifter' : undefined;
    fx.fadeInS = 0.35;
  } else {
    // A walk-in: the wall is the arrival; a downlifter now and then.
    fx.on = random() < 0.3 ? 'downlifter' : undefined;
    fx.fadeInS = 0.2;
  }
  if (!fx.before && !fx.on) fx.on = 'downlifter';
  // A riser's length is the music's: never more than ~6 s, never under 1.
  if (fx.beforeS !== undefined)
    fx.beforeS = Math.max(1, Math.min(6, fx.beforeS));
  return fx;
}
