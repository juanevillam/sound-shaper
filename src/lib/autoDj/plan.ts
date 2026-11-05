// ---------------------------------------------------------------------------
// AUTO DJ — THE MIX AS DATA. The types every part of Auto DJ shares, and the
// two reads the director makes of a timeline. What goes INTO a timeline is
// `set.ts`; what it is built from is `sections.ts`.
//
// A MIX IS DATA, NOT A RUNNING PROCESS. That is what makes starting mid-sound
// or after a scrub cheap — a fold of the timeline up to the playhead
// (`stateAt`) — and makes a different seed a different mix of the same sound,
// so a second play of a song is never the same set.
//
// ECHO CHANGES ON THE LAST BEAT OF A BAR, NEVER ON A DOWNBEAT. Every Echo
// change rewires the convolver under an ~200 ms mute (see `applyEcho` in
// `audioEngine.ts`). On a downbeat that is a hole in the music; on the beat
// before one it is the drop-out a DJ makes on purpose. Juan's own session
// changes Echo live (2026-11-04), so the set does too — at a cut, or there.
// ---------------------------------------------------------------------------

import { type EffectLevel } from '../shapeDsp';

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
  /** Sorted by `atS`; the first carries the whole state it starts from. */
  moves: DjMove[];
};

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
