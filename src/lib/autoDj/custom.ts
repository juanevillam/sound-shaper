// ---------------------------------------------------------------------------
// AUTO DJ — USER-DIRECTED CUSTOM CHOREOGRAPHY.
//
// `classic` stays untouched in `set.ts`. When the user chooses `custom` in
// Settings → DJ Juan, every knob in `AutoDjCustomConfig` directly governs what
// DJ Juan touches and how often:
//   · `pace`      — calm / balanced / lively phrasing and breather length;
//   · `vibe`      — auto / slowed / normal / hyper tempo center;
//   · `eq`        — off / low (presets) / medium (sculpted) / high (-12/+12);
//   · `speed`     — off / low / medium / high speed excursions;
//   · `keepPitch` — auto / on / off;
//   · `nextRoom`  — off / low / medium / high wall depth;
//   · `echo`      — off / low / medium / high echo phrases;
//   · `rewinds`   — off / low / medium / high DJ pull-ups & juggles.
// ---------------------------------------------------------------------------

import {
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  type EffectLevel,
} from '../shapeDsp';

import type { SongMap } from './analysis';
import {
  rng,
  type AutoDjCustomConfig,
  type AutoDjStyle,
  type DjJuggleStep,
  type DjMove,
  type Mix,
} from './plan';
import type { Section } from './sections';

type Curve = number[];

const RATE_MIN = 0.75;
const RATE_MAX = 1.25;
const RATE_STEP = 0.05;

const snapRate = (rate: number): number =>
  Math.round(
    Math.min(
      RATE_MAX,
      Math.max(RATE_MIN, Math.round(rate / RATE_STEP) * RATE_STEP),
    ) * 100,
  ) / 100;

const clampDb = (g: number) =>
  Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(g)));

const preset = (key: string): Curve => [
  ...(EQ_PRESETS.find(p => p.i18nKey === key)?.gains ?? [0, 0, 0, 0, 0]),
];

const FLAT: Curve = [0, 0, 0, 0, 0];
const CLOSED: Curve = [2, 0, -4, -9, -12];

const towards = (from: Curve, to: Curve, k: number): Curve =>
  from.map((g, i) => clampDb(g + (to[i] - g) * k));

const PRESET_KEYS = ['bass', 'vocal', 'warm', 'bright', 'treble'] as const;

/** Medium sculpted curves: richer than presets without hitting ±12 extremes. */
const SCULPTED_CURVES: readonly Curve[] = [
  [6, 3, -2, -4, -6], // warm sub
  [-6, -3, 2, 5, 6], // crisp lift
  [5, 2, -4, 2, 5], // club scoop
  [-6, -4, 5, 4, -5], // radio mid
  [6, 4, 0, -3, -8], // dark velvet
];

/** Musical asymmetric extreme curves (-12 dB to +12 dB) without harsh comb spikes. */
const PEAK_ASYM: readonly Curve[] = [
  [12, 6, -2, -6, -12], // sub-cannon
  [12, 4, -4, 4, 8], // heavy club scoop
  [10, 6, -6, 2, 12], // festival smile
  [-12, -4, 4, 8, 12], // floating air
  [12, 2, -8, -4, 6], // deep punch
  [8, 12, -4, -8, -12], // warm boom
];

const TENSION_ASYM: readonly Curve[] = [
  [-12, -10, 0, 4, 8], // bass-kill
  [-12, -6, 10, 6, -12], // radio / megaphone hook
  [-12, -12, 2, 8, 12], // high-pass float
  [10, 4, -4, -10, -12], // underwater low-pass
  [-10, -2, 8, 12, -6], // vocal spotlight
];

/** Base playback speed for a custom `vibe` preference. */
export function customBaseRate(
  config: AutoDjCustomConfig,
  fallbackRate: number,
): number {
  let base: number;
  if (config.vibe === 'slowed') base = 0.85;
  else if (config.vibe === 'normal') base = 1.0;
  else if (config.vibe === 'hyper') base = 1.15;
  else base = fallbackRate;
  // If user locked Preserve Pitch ON, keep rate >= 0.95 so it never sounds metallic.
  if (config.keepPitch === 'on' && base < 0.95) return 0.95;
  return snapRate(base);
}

/** Allowed playback speed pool given `vibe`, `speed` intensity, and `keepPitch`. */
function buildRatePool(config: AutoDjCustomConfig, baseRate: number): number[] {
  if (config.speed === 'off') return [baseRate];
  const minByPitch = config.keepPitch === 'on' ? 0.95 : RATE_MIN;
  let lo: number;
  let hi: number;
  if (config.vibe === 'slowed') {
    lo =
      config.speed === 'high' ? 0.75 : config.speed === 'medium' ? 0.8 : 0.85;
    hi = config.speed === 'high' ? 1.0 : 0.95;
  } else if (config.vibe === 'hyper') {
    lo = config.speed === 'high' ? 1.0 : 1.05;
    hi =
      config.speed === 'high' ? 1.25 : config.speed === 'medium' ? 1.2 : 1.15;
  } else if (config.vibe === 'normal') {
    const span =
      config.speed === 'high' ? 0.15 : config.speed === 'medium' ? 0.1 : 0.05;
    lo = 1 - span;
    hi = 1 + span;
  } else {
    // auto
    const span =
      config.speed === 'high' ? 0.25 : config.speed === 'medium' ? 0.15 : 0.1;
    lo = 1 - span;
    hi = 1 + span;
  }
  lo = Math.max(minByPitch, lo);
  hi = Math.min(RATE_MAX, Math.max(lo, hi));
  const pool: number[] = [];
  const startStep = Math.round(snapRate(lo) / RATE_STEP);
  const endStep = Math.round(snapRate(hi) / RATE_STEP);
  for (let step = startStep; step <= endStep; step += 1) {
    const r = snapRate(step * RATE_STEP);
    if (!pool.includes(r)) pool.push(r);
  }
  return pool.length ? pool : [baseRate];
}

const MAX_ROOM_DEPTH: Record<EffectLevel, EffectLevel[]> = {
  off: ['off'],
  low: ['low'],
  medium: ['low', 'medium'],
  high: ['low', 'medium', 'high'],
};

const MAX_ECHO_DEPTH: Record<EffectLevel, EffectLevel[]> = {
  off: ['off'],
  low: ['low'],
  medium: ['low', 'medium'],
  high: ['low', 'medium', 'high'],
};

/**
 * Choreograph a segment driven strictly by `config` (`AutoDjCustomConfig`).
 */
export function choreographCustom(opts: {
  map: SongMap;
  sections: Section[];
  style: AutoDjStyle;
  config: AutoDjCustomConfig;
  seed: number;
  startS: number;
  endS: number;
  rate: number;
  entry: 'drop' | 'walk-in' | 'verse' | 'cut';
  exit: 'room' | 'sweep' | 'brake' | 'cut';
  openS?: number;
  single?: boolean;
}): Mix {
  const {
    map,
    sections,
    style,
    config,
    seed,
    startS,
    endS,
    entry,
    exit,
    single = false,
  } = opts;

  const baseRate = customBaseRate(config, opts.rate);
  const random = rng(seed ^ 0x6b2f5a91);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const chance = (p: number) => random() < p;
  const fxIf = <T>(fx: T): T | undefined => (single ? undefined : fx);

  const pulse = map.bpm > 0;
  const barS = pulse ? map.beatS * 4 : map.blockS;
  const beatS = barS / 4;
  const barAt = (b: number) => map.firstBarS + b * barS;

  const exitBars = exit === 'cut' ? 0 : exit === 'brake' ? 1 : 2;
  const exitS = Math.max(startS + barS, endS - exitBars * barS);
  const before = (t: number) => t > startS + 1e-6 && t < exitS;

  const ratePool = buildRatePool(config, baseRate);
  const pickRate = (avoid?: number): number => {
    if (config.speed === 'off' || ratePool.length <= 1) return baseRate;
    const minDiff = config.speed === 'high' ? 0.1 : 0.05;
    const candidates = ratePool.filter(
      r => avoid === undefined || Math.abs(r - avoid) >= minDiff - 1e-4,
    );
    return pick(candidates.length ? candidates : ratePool);
  };

  const resolveKeepPitch = (r: number, preferOff = false): boolean => {
    if (config.keepPitch === 'on') return true;
    if (config.keepPitch === 'off') return false;
    if (r < 0.95 - 1e-4) return false;
    return preferOff ? false : chance(0.55);
  };

  const pickCurve = (tension = false): Curve => {
    if (config.eq === 'off') return FLAT;
    if (config.eq === 'low') {
      return preset(pick(PRESET_KEYS));
    }
    if (config.eq === 'medium') {
      return chance(0.55)
        ? pick(SCULPTED_CURVES).map(g =>
            clampDb(g + Math.floor(random() * 3) - 1),
          )
        : preset(pick(PRESET_KEYS));
    }
    // high: bold asymmetric -12/+12 curves
    const pool = tension ? TENSION_ASYM : PEAK_ASYM;
    const base = pick(pool);
    return base.map(g =>
      g === EQ_MIN_DB || g === EQ_MAX_DB
        ? g
        : clampDb(g + Math.floor(random() * 3) - 1),
    );
  };

  const moves: DjMove[] = [];
  let runningRate = baseRate;
  let runningKeepPitch = resolveKeepPitch(baseRate);
  const at = (atS: number, move: Omit<DjMove, 'atS'>) => {
    if (atS < startS || atS >= endS) return;
    const nextMove: Omit<DjMove, 'atS'> = { ...move };
    if (config.eq === 'off' && nextMove.gains) {
      delete nextMove.gains;
    }
    if (
      config.nextRoom === 'off' &&
      nextMove.nextRoom &&
      nextMove.nextRoom !== 'off'
    ) {
      delete nextMove.nextRoom;
    }
    if (config.echo === 'off' && nextMove.echo && nextMove.echo !== 'off') {
      delete nextMove.echo;
    }
    if (config.speed === 'off' && nextMove.rate !== undefined) {
      nextMove.rate = baseRate;
    }
    const nextRate = nextMove.rate ?? runningRate;
    const nextKeepPitch =
      nextMove.keepPitch !== undefined ? nextMove.keepPitch : runningKeepPitch;
    if (config.keepPitch === 'on') {
      if (nextMove.rate !== undefined && nextMove.rate < 0.95) {
        nextMove.rate = 0.95;
      }
      if (nextMove.keepPitch === false) nextMove.keepPitch = true;
    } else if (config.keepPitch === 'off') {
      if (nextMove.keepPitch === true) nextMove.keepPitch = false;
    } else if (nextRate < 0.95 - 1e-4 && nextKeepPitch) {
      nextMove.keepPitch = false;
    }
    runningRate = nextMove.rate ?? nextRate;
    runningKeepPitch =
      nextMove.keepPitch !== undefined ? nextMove.keepPitch : runningKeepPitch;
    moves.push({ atS, ...nextMove });
  };

  let gains = pickCurve();
  let current = baseRate;
  const baseEcho: EffectLevel =
    config.echo !== 'off' &&
    !single &&
    chance(config.echo === 'high' ? 0.35 : 0.2)
      ? pick(MAX_ECHO_DEPTH[config.echo])
      : 'off';
  const initialKeepPitch = resolveKeepPitch(baseRate);
  runningRate = baseRate;
  runningKeepPitch = initialKeepPitch;

  moves.push({
    atS: startS,
    gains,
    nextRoom: 'off',
    echo: baseEcho,
    rate: baseRate,
    keepPitch: initialKeepPitch,
  });

  // Entry
  if (config.nextRoom !== 'off') {
    if (entry === 'walk-in') {
      const openAt = opts.openS ?? startS + 2 * barS;
      if (openAt < exitS) {
        const own = gains;
        const startWall = config.nextRoom === 'low' ? 'low' : 'medium';
        at(startS, { gains: FLAT, nextRoom: startWall });
        if (startWall === 'medium') {
          at(startS + (openAt - startS) / 2, { nextRoom: 'low' });
        }
        at(openAt, { nextRoom: 'off', gains: own });
      }
    } else if (entry === 'verse' && chance(0.35)) {
      at(startS, { nextRoom: 'low' });
      at(startS + 2 * barS, { nextRoom: 'off', gains: pickCurve() });
    }
  }

  /**
   * Forward-only DJ skip (NEVER rewinds behind `lineS`):
   *   0 · CLEAN SKIP AHEAD — jumps forward 2 or 4 bars onto a fresh curve/speed;
   *   1 · DOUBLE HOP AHEAD (`medium`/`high`) — jumps forward 2 bars behind a
   *       tension filter/wall for 2 bars, then hops forward another 2–4 bars
   *       wide open onto a full curve!
   */
  const buildSkip = (
    lineS: number,
  ): { steps: DjJuggleStep[]; resumeAt: number } | null => {
    const maxTarget = exitS - 2 * barS;
    if (lineS + 2 * barS >= maxTarget) return null;

    const steps: DjJuggleStep[] = [];
    const allowDouble =
      (config.skips === 'medium' || config.skips === 'high') &&
      lineS + 6 * barS < maxTarget;
    const doubleHop =
      allowDouble && chance(config.skips === 'high' ? 0.55 : 0.35);

    if (!doubleHop) {
      const jumpBars = lineS + 4 * barS < maxTarget ? pick([2, 4]) : 2;
      const targetS = lineS + jumpBars * barS;
      const newRate = pickRate(current);
      steps.push({
        delayBeats: 0,
        seekToS: targetS,
        rate: newRate,
        keepPitch: resolveKeepPitch(newRate, config.speed !== 'off'),
        gains: config.eq === 'off' ? undefined : pickCurve(false),
        nextRoom: 'off',
        fx: fxIf('downlifter'),
      });
      return { steps, resumeAt: targetS + 4 * barS };
    }

    // DOUBLE HOP AHEAD: hop +2 bars behind tension EQ/room -> after 2 bars hop +2/+4 bars wide open
    const hop1 = lineS + 2 * barS;
    const hop2 = Math.min(maxTarget, hop1 + pick([2, 4]) * barS);
    const r1 = pickRate(current);
    const r2 = pickRate(r1);
    steps.push({
      delayBeats: 0,
      seekToS: hop1,
      rate: r1,
      keepPitch: resolveKeepPitch(r1, config.speed !== 'off'),
      gains: config.eq === 'off' ? undefined : pickCurve(true),
      nextRoom:
        config.nextRoom === 'off'
          ? 'off'
          : pick(MAX_ROOM_DEPTH[config.nextRoom]),
    });
    steps.push({
      delayBeats: 8,
      seekToS: hop2,
      rate: r2,
      keepPitch: resolveKeepPitch(r2),
      gains: config.eq === 'off' ? undefined : pickCurve(false),
      nextRoom: 'off',
      fx: fxIf('downlifter'),
    });
    return { steps, resumeAt: hop2 + 4 * barS };
  };

  // Weighted gesture pool built purely from enabled user controls
  type Gesture = 'eq' | 'speed' | 'room' | 'echo' | 'skip';
  const weightOf = (lvl: EffectLevel): number =>
    lvl === 'off' ? 0 : lvl === 'low' ? 1 : lvl === 'medium' ? 2 : 3;

  let lastGesture: Gesture | null = null;
  let skipsUsed = 0;
  const maxSkips =
    config.skips === 'off'
      ? 0
      : config.skips === 'low'
        ? single
          ? 2
          : 1
        : config.skips === 'medium'
          ? single
            ? 3
            : 1
          : single
            ? 5
            : 2;

  const pickGesture = (canSkip: boolean): Gesture | null => {
    const entries: [Gesture, number][] = [
      ['eq', weightOf(config.eq)],
      ['speed', pulse ? weightOf(config.speed) : 0],
      ['room', weightOf(config.nextRoom)],
      ['echo', pulse ? weightOf(config.echo) : 0],
      ['skip', canSkip ? weightOf(config.skips) : 0],
    ];
    const active = entries.filter(([, w]) => w > 0);
    if (!active.length) return null;
    const filtered =
      active.length > 1 ? active.filter(([g]) => g !== lastGesture) : active;
    const totalW = filtered.reduce((acc, [, w]) => acc + w, 0);
    let roll = random() * totalW;
    for (const [g, w] of filtered) {
      roll -= w;
      if (roll <= 0) return g;
    }
    return filtered[filtered.length - 1][0];
  };

  const holdBarsBase =
    config.pace === 'calm' ? 8 : config.pace === 'balanced' ? 6 : 4;

  const performChapter = (lineS: number, untilS: number): number => {
    const room = untilS - lineS;
    const canSkip =
      pulse &&
      skipsUsed < maxSkips &&
      lineS - startS >= 4 * barS &&
      lineS + 4 * barS < exitS - 2 * barS;

    const gesture = pickGesture(canSkip);
    if (!gesture) return lineS + 4 * barS;
    lastGesture = gesture;

    if (gesture === 'eq') {
      const teaseBars = config.pace === 'lively' ? 2 : 4;
      if (room >= (teaseBars + 4) * barS && config.eq !== 'low') {
        at(lineS, { gains: pickCurve(true), nextRoom: 'off' });
        gains = pickCurve(false);
        at(lineS + teaseBars * barS, {
          gains,
          fx: fxIf('downlifter'),
        });
        return lineS + (teaseBars + 4) * barS;
      }
      gains = pickCurve(false);
      at(lineS, { gains, nextRoom: 'off' });
      return lineS + holdBarsBase * barS;
    }

    if (gesture === 'speed') {
      const targetRate = pickRate(current);
      const holdBars = Math.min(
        holdBarsBase,
        Math.max(4, Math.floor(room / barS) - 2),
      );
      gains = pickCurve(false);
      at(lineS, {
        rate: targetRate,
        keepPitch: resolveKeepPitch(targetRate, config.speed !== 'low'),
        ...(config.eq !== 'off' ? { gains } : {}),
      });
      at(lineS + holdBars * barS, {
        rate: current,
        keepPitch: resolveKeepPitch(current),
        ...(config.eq !== 'off' ? { gains: pickCurve(false) } : {}),
      });
      return lineS + (holdBars + 2) * barS;
    }

    if (gesture === 'room') {
      const wall = pick(MAX_ROOM_DEPTH[config.nextRoom]);
      const wallBars = wall === 'high' ? 1 : 2;
      at(lineS, {
        ...(config.eq !== 'off' ? { gains: FLAT } : {}),
        nextRoom: wall === 'low' ? 'low' : 'low',
      });
      if (wall !== 'low' && wallBars >= 2) {
        at(lineS + barS, { nextRoom: wall });
      } else if (wall === 'high') {
        at(lineS, { nextRoom: 'high' });
      }
      gains = pickCurve(false);
      at(lineS + wallBars * barS, {
        nextRoom: 'off',
        ...(config.eq !== 'off' ? { gains } : {}),
        fx: fxIf('downlifter'),
      });
      return lineS + (wallBars + 4) * barS;
    }

    if (gesture === 'echo') {
      const echoLvl = pick(MAX_ECHO_DEPTH[config.echo]);
      const echoBars = config.pace === 'calm' ? 4 : 2;
      if (lineS - beatS > startS) {
        at(lineS - beatS, { echo: echoLvl });
      }
      if (lineS + echoBars * barS - beatS < untilS) {
        at(lineS + echoBars * barS - beatS, { echo: baseEcho });
      }
      return lineS + (echoBars + 4) * barS;
    }

    // skip (forward-only, never rewinds)
    const built = buildSkip(lineS);
    if (!built) return lineS + 4 * barS;
    skipsUsed += 1;
    at(lineS, { juggle: built.steps });
    return Math.min(untilS, Math.max(lineS + 4 * barS, built.resumeAt));
  };

  // Pace controls breather & step cadence
  const breatherBars =
    config.pace === 'calm' ? 4 : config.pace === 'balanced' ? 2 : 1;
  const fireOdds =
    config.pace === 'calm' ? 0.55 : config.pace === 'balanced' ? 0.75 : 0.9;

  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    const sS = barAt(s.start);
    const eS = barAt(s.end);
    if (eS <= startS || sS >= exitS) continue;
    const next = sections[i + 1];

    let buildFromS = eS;
    const dropS =
      next?.kind === 'peak' && s.kind !== 'peak' ? barAt(next.start) : -1;
    const hasBuild = dropS > startS && dropS < exitS;
    if (hasBuild) {
      const buildBars = Math.min(s.end - s.start, 4);
      buildFromS = Math.max(startS, dropS - buildBars * barS);
    }
    const untilS = Math.min(eS, exitS, buildFromS);

    if (before(sS) && sS - startS >= barS - 1e-6) {
      if (s.kind === 'peak') {
        gains = pickCurve(false);
        current =
          config.speed !== 'off' && chance(config.speed === 'high' ? 0.45 : 0.2)
            ? pickRate(baseRate)
            : baseRate;
        at(sS, {
          ...(config.eq !== 'off' ? { gains } : {}),
          nextRoom: 'off',
          rate: current,
          keepPitch: resolveKeepPitch(current),
          fx: chance(0.4) ? fxIf('downlifter') : undefined,
        });
      } else if (s.kind === 'break') {
        gains = pickCurve(true);
        at(sS, {
          ...(config.eq !== 'off' ? { gains } : {}),
          ...(config.nextRoom !== 'off' && chance(0.4)
            ? { nextRoom: 'low' as const }
            : { nextRoom: 'off' as const }),
        });
      } else {
        gains = pickCurve(false);
        current = baseRate;
        at(sS, {
          ...(config.eq !== 'off' ? { gains } : {}),
          nextRoom: 'off',
          rate: baseRate,
          keepPitch: resolveKeepPitch(baseRate),
        });
      }
    }

    let busyUntil = sS + 2 * barS;
    const stepBars = config.pace === 'lively' ? 2 : 4;
    for (let b = s.start + stepBars; b < s.end; b += stepBars) {
      const lineS = barAt(b);
      if (!before(lineS) || lineS + 2 * barS > untilS) continue;
      if (lineS < busyUntil - 1e-6) continue;
      if (!single && !chance(fireOdds)) continue;
      busyUntil = performChapter(lineS, untilS) + breatherBars * barS;
    }

    // Smooth build into drop (only touches controls the user enabled)
    if (hasBuild) {
      if (config.eq !== 'off') {
        const from = buildFromS;
        const barsInBuild = Math.max(1, Math.round((dropS - from) / barS));
        const open = gains;
        for (let k = 0; k < barsInBuild; k += 1) {
          at(from + k * barS, {
            gains: towards(open, CLOSED, (k + 1) / barsInBuild),
          });
        }
      }
      if (config.nextRoom !== 'off') {
        at(dropS - barS, {
          nextRoom: 'low',
          fx: fxIf('reverseCymbal'),
        });
      }
    }
  }

  // Exit (honors disabled controls!)
  if (exit === 'room' && config.nextRoom !== 'off') {
    const span = endS - exitS;
    at(exitS, {
      ...(config.eq !== 'off' ? { gains: FLAT } : {}),
      nextRoom: 'low',
    });
    if (config.nextRoom !== 'low') {
      at(exitS + span / 2, { nextRoom: 'medium' });
    }
  } else if (exit === 'sweep' && config.eq !== 'off') {
    const steps = Math.max(1, Math.round((endS - exitS) / beatS));
    const open = gains;
    for (let k = 0; k < steps; k += 1) {
      at(exitS + k * beatS, {
        gains: towards(open, CLOSED, (k + 1) / steps),
      });
    }
  } else if (exit === 'brake' && config.speed !== 'off') {
    at(exitS, { keepPitch: resolveKeepPitch(current, true) });
    [0.9, 0.85, 0.8, 0.75].forEach((f, k) => {
      at(exitS + k * beatS, { rate: snapRate(current * f) });
    });
  }

  // Sort & merge moves at identical timestamps
  const sorted = moves
    .map((move, order) => ({ move, order }))
    .sort((a, b) => a.move.atS - b.move.atS || a.order - b.order)
    .map(({ move }) => move);
  const merged: DjMove[] = [];
  for (const move of sorted) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(move.atS - last.atS) < 1e-6) {
      Object.assign(last, move, { atS: last.atS });
    } else {
      merged.push({ ...move });
    }
  }
  let r = baseRate;
  let kp = initialKeepPitch;
  for (const move of merged) {
    if (move.rate !== undefined) r = move.rate;
    if (move.keepPitch !== undefined) kp = move.keepPitch;
    if (config.keepPitch === 'on') {
      if (move.rate !== undefined && move.rate < 0.95) move.rate = 0.95;
      if (move.keepPitch === false) move.keepPitch = true;
      kp = true;
    } else if (config.keepPitch === 'off') {
      if (move.keepPitch === true) move.keepPitch = false;
      kp = false;
    } else if (r < 0.95 - 1e-4 && kp) {
      move.keepPitch = false;
      kp = false;
    }
  }

  return { style, seed, moves: merged };
}
