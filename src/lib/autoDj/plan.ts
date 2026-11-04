// ---------------------------------------------------------------------------
// AUTO DJ — THE MIX. Given a sound's map (`analysis.ts`), a style and a seed,
// lay out every move the DJ will make, as a timeline. Pure, so it is
// unit-tested; `AutoDjDirector` plays the timeline against the transport.
//
// A MIX IS DATA, NOT A RUNNING PROCESS. That is what makes the three things the
// feature needs cheap: starting mid-sound or after a scrub is a fold of the
// timeline up to the playhead (`stateAt`), a different seed is a different mix
// of the same sound (so a second play of a song is never the same set), and
// keeping a mix someone liked is keeping its seed and style.
//
// WHAT A DJ DOES HERE, in this app's controls:
//   · a BUILD closes the sound down — the EQ sweeps toward a dark, thin curve
//     a step per beat, and the wall of Next Room comes up — and the DROP throws
//     it all open on the downbeat;
//   · a BREAK goes somewhere else — next door, or a different curve;
//   · in long steady passages, a phrase boundary may get a flourish;
//   · the style sets the base: Club at the song's own speed, Slowed down and
//     pitched down, Hyper up and pitched up.
//
// ECHO IS SET ONCE PER SOUND, NEVER MID-SOUND. Every Echo change rewires the
// convolver under an ~200 ms mute (see `applyEcho` in `audioEngine.ts`), and a
// hole in the music on a downbeat is the opposite of a DJ move.
// ---------------------------------------------------------------------------

import {
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  type EffectLevel,
} from '../shapeDsp';

import { type SongMap } from './analysis';

export type AutoDjStyle = 'club' | 'slowed' | 'hyper';
export const AUTO_DJ_STYLES: readonly AutoDjStyle[] = [
  'club',
  'slowed',
  'hyper',
];

/** Everything the DJ may move. `keepPitch` undefined = the person's own. */
export type DjState = {
  gains: number[];
  nextRoom: EffectLevel;
  echo: EffectLevel;
  rate: number;
  keepPitch?: boolean;
};

export type DjMove = { atS: number } & Partial<DjState>;

export type Mix = {
  style: AutoDjStyle;
  seed: number;
  /** Sorted by `atS`; the first is at 0 and carries the whole base state. */
  moves: DjMove[];
};

type PresetKey = 'flat' | 'bass' | 'vocal' | 'treble' | 'warm' | 'bright';

type StyleSpec = {
  rate: number[];
  dropRate?: number[];
  keepPitch?: boolean;
  echo: EffectLevel;
  base: PresetKey[];
  drop: PresetKey[];
  break: PresetKey[];
  breakRoom: EffectLevel[];
  /** Chance a phrase boundary in a steady passage gets a flourish. */
  flourish: number;
};

const STYLES: Record<AutoDjStyle, StyleSpec> = {
  club: {
    rate: [1],
    // Stated, not left to the person: in a set Club follows a Slowed or a
    // Hyper stretch, which turned pitch preservation off.
    keepPitch: true,
    echo: 'off',
    base: ['flat', 'bass', 'bright'],
    drop: ['bass', 'bass', 'flat'],
    break: ['vocal', 'warm'],
    breakRoom: ['low', 'medium'],
    flourish: 0.55,
  },
  slowed: {
    rate: [0.85, 0.9],
    keepPitch: false,
    echo: 'low',
    base: ['warm', 'bass'],
    drop: ['bass', 'warm'],
    break: ['warm', 'vocal'],
    breakRoom: ['medium', 'high'],
    flourish: 0.3,
  },
  hyper: {
    rate: [1.1],
    dropRate: [1.15, 1.2],
    keepPitch: false,
    echo: 'off',
    base: ['bright', 'treble', 'bass'],
    drop: ['bass', 'bright'],
    break: ['vocal', 'treble'],
    breakRoom: ['low', 'medium'],
    flourish: 0.65,
  },
};

/**
 * Where a build sweeps TO: the bottom kept, the top pulled right down — the
 * filter-closing sound, in five bands. Whole dB, inside the slider range.
 */
const CLOSED: number[] = [2, 0, -4, -9, -12];

const presetGains = (key: PresetKey): number[] => [
  ...(EQ_PRESETS.find(p => p.i18nKey === key)?.gains ?? [0, 0, 0, 0, 0]),
];

/** mulberry32 — small, fast, and the same sequence for the same seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerpGains = (from: number[], to: number[], k: number): number[] =>
  from.map((g, i) =>
    Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(g + (to[i] - g) * k))),
  );

const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Bars where the music comes back in hard after something quieter. */
export function findDrops(bars: number[]): number[] {
  const drops: number[] = [];
  for (let i = 4; i < bars.length - 1; i += 1) {
    const after = mean(bars.slice(i, i + 2));
    const before = mean(bars.slice(i - 4, i));
    if (after >= 0.75 && before <= after * 0.62) {
      if (!drops.length || i - drops[drops.length - 1] >= 8) drops.push(i);
    }
  }
  return drops;
}

/** Runs of at least four quiet bars, as [start, end) — the breaks. */
export function findBreaks(bars: number[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= bars.length; i += 1) {
    const quiet = i < bars.length && bars[i] < 0.55;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      if (i - start >= 4) out.push([start, i]);
      start = -1;
    }
  }
  return out;
}

export function planMix(map: SongMap, style: AutoDjStyle, seed: number): Mix {
  const spec = STYLES[style];
  const random = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const chance = (p: number) => random() < p;

  const moves: DjMove[] = [];
  let gains = presetGains(pick(spec.base));
  const baseRate = pick(spec.rate);

  moves.push({
    atS: 0,
    gains,
    nextRoom: 'off',
    echo: spec.echo,
    rate: baseRate,
    ...(spec.keepPitch === undefined ? {} : { keepPitch: spec.keepPitch }),
  });

  const { bars } = map;
  const pulse = map.bpm > 0;
  const blockS = map.blockS;
  const barAt = (i: number) => map.firstBarS + i * blockS;
  const beatS = pulse ? map.beatS : blockS / 4;

  // Which bars already carry a move, so flourishes keep their distance.
  const busy = new Set<number>();
  const mark = (from: number, to: number) => {
    for (let i = from; i <= to; i += 1) busy.add(i);
  };

  if (!pulse) {
    // NO STEADY PULSE — nothing to quantise to, so gentle moves on a slow
    // clock: a new curve, or a short visit next door, every 12–20 seconds.
    let i = 6 + Math.floor(random() * 4);
    while (i < bars.length - 2) {
      if (chance(0.5)) {
        const next = presetGains(pick(spec.base));
        moves.push({ atS: barAt(i), gains: next });
        gains = next;
      } else {
        moves.push({ atS: barAt(i), nextRoom: pick(spec.breakRoom) });
        moves.push({ atS: barAt(i + 2), nextRoom: 'off' });
      }
      i += 6 + Math.floor(random() * 4);
    }
    return finish(style, seed, moves);
  }

  const drops = findDrops(bars);
  const breaks = findBreaks(bars);

  // An INTRO that starts quiet and leads into a drop starts next door.
  if (breaks.length && breaks[0][0] === 0 && drops.length) {
    moves.push({ atS: 0, nextRoom: 'low' });
  }

  // BREAKS first — builds and drops are laid over them and win where they meet.
  for (const [start, end] of breaks) {
    if (start === 0) continue;
    if (chance(0.7)) {
      moves.push({ atS: barAt(start), nextRoom: pick(spec.breakRoom) });
    } else {
      const next = presetGains(pick(spec.break));
      moves.push({ atS: barAt(start), gains: next });
    }
    const leadsIntoDrop = drops.some(d => d >= end - 1 && d <= end + 1);
    if (!leadsIntoDrop) {
      moves.push({
        atS: barAt(end),
        nextRoom: 'off',
        gains: presetGains(pick(spec.base)),
      });
    }
    mark(start, end);
  }

  let previousDrop = -Infinity;
  for (const drop of drops) {
    const wanted = pick([4, 8]);
    const length = Math.max(
      2,
      Math.min(wanted, drop - Math.max(0, previousDrop + 2)),
    );
    const start = drop - length;
    const steps = length * 4;
    const from = gains;
    for (let s = 0; s < steps; s += 1) {
      moves.push({
        atS: barAt(start) + s * beatS,
        gains: lerpGains(from, CLOSED, (s + 1) / steps),
      });
    }
    if (length >= 2 && chance(0.5)) {
      moves.push({ atS: barAt(drop - 2), nextRoom: 'low' });
    }
    if (chance(0.75)) moves.push({ atS: barAt(drop - 1), nextRoom: 'medium' });

    const opened = presetGains(pick(spec.drop));
    moves.push({
      atS: barAt(drop),
      gains: opened,
      nextRoom: 'off',
      ...(spec.dropRate ? { rate: pick(spec.dropRate) } : {}),
    });
    gains = opened;
    mark(start, drop + 3);
    previousDrop = drop;
  }

  // A drop's raised rate comes back to the base at the next break.
  if (spec.dropRate) {
    for (const [start] of breaks) {
      if (drops.some(d => d < start))
        moves.push({ atS: barAt(start), rate: baseRate });
    }
  }

  // FLOURISHES on phrase boundaries in steady, loud passages.
  const phraseOffset = drops.length ? drops[0] % 8 : 0;
  for (let b = phraseOffset; b < bars.length - 8; b += 8) {
    if (b < 4 || busy.has(b) || busy.has(b + 7) || bars[b] < 0.6) continue;
    if (!chance(spec.flourish)) continue;
    const kind = random();
    if (kind < 0.4) {
      // A new curve for the next phrase.
      const next = presetGains(pick(spec.base));
      moves.push({ atS: barAt(b), gains: next });
    } else if (kind < 0.7) {
      // Two bars next door, then back.
      moves.push({ atS: barAt(b), nextRoom: pick(spec.breakRoom) });
      moves.push({ atS: barAt(b + 2), nextRoom: 'off' });
    } else {
      // A tease: the last two beats of the phrase close down, and open again
      // on the next downbeat — a drop in miniature.
      const at = barAt(b + 7) + 2 * beatS;
      moves.push({ atS: at, gains: lerpGains(gains, CLOSED, 0.5) });
      moves.push({ atS: at + beatS, gains: lerpGains(gains, CLOSED, 0.85) });
      moves.push({ atS: barAt(b + 8), gains });
    }
    mark(b, b + 7);
  }

  // An OUTRO that fades walks out of the room.
  const n = bars.length;
  if (n > 8 && mean(bars.slice(n - 4)) < mean(bars.slice(n - 8, n - 4)) * 0.8) {
    if (chance(0.6)) moves.push({ atS: barAt(n - 4), nextRoom: 'low' });
  }

  return finish(style, seed, moves);
}

function finish(style: AutoDjStyle, seed: number, moves: DjMove[]): Mix {
  const sorted = moves
    .map((move, order) => ({ move, order }))
    .sort((a, b) => a.move.atS - b.move.atS || a.order - b.order)
    .map(({ move }) => ({ ...move, atS: Math.max(0, move.atS) }));
  return { style, seed, moves: sorted };
}

/** The whole state the mix has reached by `atS` — a fold of its moves. */
export function stateAt(mix: Mix, atS: number): DjState {
  const state: DjState = {
    gains: [0, 0, 0, 0, 0],
    nextRoom: 'off',
    echo: 'off',
    rate: 1,
  };
  for (const move of mix.moves) {
    if (move.atS > atS) break;
    const { atS: _at, ...rest } = move;
    Object.assign(state, rest);
  }
  return state;
}

/** Index of the first move strictly after `atS`. */
export function nextMoveIndex(mix: Mix, atS: number): number {
  let lo = 0;
  let hi = mix.moves.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mix.moves[mid].atS <= atS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
