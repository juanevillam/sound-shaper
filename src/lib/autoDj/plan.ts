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

import { EQ_PRESETS, type EffectLevel } from '../shapeDsp';

export type AutoDjStyle = 'club' | 'slowed' | 'hyper';
export const AUTO_DJ_STYLES: readonly AutoDjStyle[] = [
  'club',
  'slowed',
  'hyper',
];

/**
 * How DJ Juan plays: off, mixing only the playing sound in a loop (`sound`),
 * or cutting the whole library together as a set (`all`).
 */
export type AutoDjMode = 'off' | 'sound' | 'all';
export const AUTO_DJ_MODES: readonly AutoDjMode[] = ['off', 'sound', 'all'];

export const isAutoDjMode = (value: unknown): value is AutoDjMode =>
  typeof value === 'string' &&
  (AUTO_DJ_MODES as readonly string[]).includes(value);

/**
 * Which section of the Shape sheet a move is touching — what the open sheet
 * scrolls to so the person can see DJ Juan's hands on the controls.
 */
export type DjFocus =
  | 'presets'
  | 'eq'
  | 'speed'
  | 'keepPitch'
  | 'echo'
  | 'nextRoom';

/**
 * Priority rank for focus holds (higher = rarer effect that should not be
 * yanked away mid-gesture by a beat-by-beat EQ sweep).
 */
export const DJ_FOCUS_RANK: Record<DjFocus, number> = {
  eq: 0,
  presets: 1,
  speed: 2,
  keepPitch: 3,
  echo: 4,
  nextRoom: 5,
};

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

const isPresetCurve = (gains: number[]): boolean =>
  EQ_PRESETS.some(p => p.gains.every((g, i) => g === gains[i]));

/**
 * WHICH SECTION OF THE SHAPE SHEET A MOVE IS ABOUT, IN PRIORITY ORDER.
 *
 * A single beat can touch more than one control — a `STACK` flattens the EQ
 * only to make headroom for `Next Room`, and its end turns `Next Room` off to
 * bring the EQ curve back. A control moving to an ACTIVE (non-default) setting
 * outranks one returning to default; within each tier, the rarer spatial and
 * varispeed effects (`nextRoom` > `echo` > `keepPitch` > `speed` > `presets` >
 * `eq`) win over the curve.
 */
export function moveFocus(
  before: DjState,
  move: Partial<DjMove>,
): DjFocus | null {
  const active: DjFocus[] = [];
  const reset: DjFocus[] = [];

  if (move.nextRoom !== undefined && move.nextRoom !== before.nextRoom) {
    if (move.nextRoom !== 'off') active.push('nextRoom');
    else reset.push('nextRoom');
  }
  if (move.echo !== undefined && move.echo !== before.echo) {
    if (move.echo !== 'off') active.push('echo');
    else reset.push('echo');
  }
  if (
    move.keepPitch !== undefined &&
    move.keepPitch !== (before.keepPitch ?? true)
  ) {
    if (!move.keepPitch) active.push('keepPitch');
    else reset.push('keepPitch');
  }
  if (move.rate !== undefined && Math.abs(move.rate - before.rate) > 1e-4) {
    if (Math.abs(move.rate - 1) > 1e-4) active.push('speed');
    else reset.push('speed');
  }
  if (move.gains && move.gains.some((g, i) => g !== before.gains[i])) {
    const target: DjFocus = isPresetCurve(move.gains) ? 'presets' : 'eq';
    if (move.gains.some(g => g !== 0)) active.push(target);
    else reset.push(target);
  }

  return active[0] ?? reset[0] ?? null;
}

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
