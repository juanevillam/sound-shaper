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

import { EFFECT_LEVELS, EQ_PRESETS, type EffectLevel } from '../shapeDsp';

import type { FxName } from './fx';

export type AutoDjStyle = 'club' | 'slowed' | 'hyper';
export const AUTO_DJ_STYLES: readonly AutoDjStyle[] = [
  'club',
  'slowed',
  'hyper',
];

/**
 * DJ Juan profile:
 *   · `classic` — Juan's original DÁKITI-inspired algorithm, untouched;
 *   · `custom`  — user-directed DJ Juan: pick pace, tempo vibe, preserve pitch,
 *                 and how much EQ, speed, Next Room, Echo and rewinds he uses.
 */
export type AutoDjPreset = 'classic' | 'custom';

const isAutoDjPreset = (value: unknown): value is AutoDjPreset =>
  value === 'classic' || value === 'custom';

export type AutoDjPace = 'calm' | 'balanced' | 'lively';
export const AUTO_DJ_PACES: readonly AutoDjPace[] = [
  'calm',
  'balanced',
  'lively',
];

export type AutoDjVibe = 'auto' | 'slowed' | 'normal' | 'hyper';
export const AUTO_DJ_VIBES: readonly AutoDjVibe[] = [
  'auto',
  'slowed',
  'normal',
  'hyper',
];

export type AutoDjPitchPref = 'auto' | 'on' | 'off';
export const AUTO_DJ_PITCH_PREFS: readonly AutoDjPitchPref[] = [
  'auto',
  'on',
  'off',
];

export type AutoDjCustomConfig = {
  pace: AutoDjPace;
  vibe: AutoDjVibe;
  eq: EffectLevel;
  speed: EffectLevel;
  keepPitch: AutoDjPitchPref;
  nextRoom: EffectLevel;
  echo: EffectLevel;
  skips: EffectLevel;
};

export const DEFAULT_AUTO_DJ_CUSTOM: AutoDjCustomConfig = {
  pace: 'balanced',
  vibe: 'auto',
  eq: 'medium',
  speed: 'medium',
  keepPitch: 'auto',
  nextRoom: 'low',
  echo: 'low',
  skips: 'off',
};

export type AutoDjProfile = {
  preset: AutoDjPreset;
  custom: AutoDjCustomConfig;
};

export const DEFAULT_AUTO_DJ_PROFILE: AutoDjProfile = {
  preset: 'classic',
  custom: DEFAULT_AUTO_DJ_CUSTOM,
};

export const sameAutoDjProfile = (
  a: AutoDjProfile,
  b: AutoDjProfile,
): boolean =>
  a.preset === b.preset &&
  a.custom.pace === b.custom.pace &&
  a.custom.vibe === b.custom.vibe &&
  a.custom.eq === b.custom.eq &&
  a.custom.speed === b.custom.speed &&
  a.custom.keepPitch === b.custom.keepPitch &&
  a.custom.nextRoom === b.custom.nextRoom &&
  a.custom.echo === b.custom.echo &&
  a.custom.skips === b.custom.skips;

const isOneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

/** Parse any unknown value (localStorage or Firestore) into a valid `AutoDjProfile`. */
export function parseAutoDjProfile(raw: unknown): AutoDjProfile {
  if (!raw || typeof raw !== 'object') return DEFAULT_AUTO_DJ_PROFILE;
  const parsed = raw as Partial<AutoDjProfile>;
  const preset: AutoDjPreset = isAutoDjPreset(parsed.preset)
    ? parsed.preset
    : 'classic';
  const c = (parsed.custom ?? {}) as Partial<AutoDjCustomConfig>;
  return {
    preset,
    custom: {
      pace: isOneOf(AUTO_DJ_PACES, c.pace)
        ? c.pace
        : DEFAULT_AUTO_DJ_CUSTOM.pace,
      vibe: isOneOf(AUTO_DJ_VIBES, c.vibe)
        ? c.vibe
        : DEFAULT_AUTO_DJ_CUSTOM.vibe,
      eq: isOneOf(EFFECT_LEVELS, c.eq) ? c.eq : DEFAULT_AUTO_DJ_CUSTOM.eq,
      speed: isOneOf(EFFECT_LEVELS, c.speed)
        ? c.speed
        : DEFAULT_AUTO_DJ_CUSTOM.speed,
      keepPitch: isOneOf(AUTO_DJ_PITCH_PREFS, c.keepPitch)
        ? c.keepPitch
        : DEFAULT_AUTO_DJ_CUSTOM.keepPitch,
      nextRoom: isOneOf(EFFECT_LEVELS, c.nextRoom)
        ? c.nextRoom
        : DEFAULT_AUTO_DJ_CUSTOM.nextRoom,
      echo: isOneOf(EFFECT_LEVELS, c.echo)
        ? c.echo
        : DEFAULT_AUTO_DJ_CUSTOM.echo,
      skips: isOneOf(EFFECT_LEVELS, c.skips)
        ? c.skips
        : DEFAULT_AUTO_DJ_CUSTOM.skips,
    },
  };
}

/**
 * Generate a fresh, musical random `AutoDjCustomConfig` — guarantees at least
 * two active controls so a random roll never comes back completely silent/flat.
 */
export function randomizeAutoDjCustom(
  random: () => number = Math.random,
): AutoDjCustomConfig {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const activeLevels: readonly EffectLevel[] = ['low', 'medium', 'high'];
  const config: AutoDjCustomConfig = {
    pace: pick(AUTO_DJ_PACES),
    vibe: pick(AUTO_DJ_VIBES),
    eq: pick(EFFECT_LEVELS),
    speed: pick(EFFECT_LEVELS),
    keepPitch: pick(AUTO_DJ_PITCH_PREFS),
    nextRoom: pick(EFFECT_LEVELS),
    echo: pick(EFFECT_LEVELS),
    skips: pick(EFFECT_LEVELS),
  };
  const keys = ['eq', 'speed', 'nextRoom', 'echo', 'skips'] as const;
  const activeCount = keys.filter(k => config[k] !== 'off').length;
  if (activeCount < 2) {
    config.eq = pick(activeLevels);
    config.speed = pick(activeLevels);
  }
  return config;
}

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

/**
 * One real-time step inside a DJ juggle (rewind, double-back, or forward skip)
 * executed by the director when a move with `juggle` fires. `delayBeats` is
 * measured in musical beats (scaled by the active playback rate at runtime)
 * after the previous step.
 */
export type DjJuggleStep = {
  /** Beats to wait after the previous step before firing this one (0 = now). */
  delayBeats: number;
  /** Target playhead position in seconds (clamped inside the segment). */
  seekToS?: number;
  /** Optional DJ FX flourish fired on this step (e.g. 'zap' on a rewind). */
  fx?: FxName;
} & Partial<DjState>;

export type DjMove = {
  atS: number;
  /** Optional DJ FX flourish fired on this move. */
  fx?: FxName;
  /**
   * One-shot real-time juggle sequence (rewinds / forward skips / pitch
   * ladders). Never emitted in `classic` level; consumed once per segment so
   * rewinding behind `atS` can never re-trigger an infinite loop.
   */
  juggle?: DjJuggleStep[];
} & Partial<DjState>;

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
    const { atS: _at, fx: _fx, juggle: _juggle, ...rest } = move;
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
