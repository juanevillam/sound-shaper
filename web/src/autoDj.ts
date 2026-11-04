import { useEffect, useSyncExternalStore } from 'react';

import {
  ANALYSIS_SAMPLE_RATE,
  analyzeSamples,
  type SongMap,
} from '@app/lib/autoDj/analysis';
import {
  AUTO_DJ_STYLES,
  nextMoveIndex,
  rng,
  stateAt,
  type AutoDjStyle,
  type DjMove,
} from '@app/lib/autoDj/plan';
import {
  chooseNext,
  joinSegment,
  planSegment,
  type PoolSound,
  type Segment,
} from '@app/lib/autoDj/set';
import type { EffectLevel } from '@app/lib/shapeDsp';

import type { Sound } from './library';
import {
  applyGains,
  cueSound,
  playerState,
  setEcho,
  setKeepPitch,
  setNextRoom,
  setRate,
  subscribePlayer,
  type PlayerState,
} from './player';

/**
 * AUTO DJ ON THE WEB — the app's `store/autoDj.ts`, `lib/autoDj/songMap.ts`
 * and `AutoDjDirector` in one module, over the app's own planner
 * (`lib/autoDj/{analysis,plan,set}.ts`, imported, never copied). Read those
 * for the why; this file only says where the web differs.
 */

// ── The state ──────────────────────────────────────────────────────────────

type Snapshot = {
  gains: number[];
  nextRoom: EffectLevel;
  echo: EffectLevel;
  rate: number;
  keepPitch: boolean;
};

export type AutoDjState = {
  on: boolean;
  status: 'idle' | 'preparing' | 'mixing';
  /** Sounds read so far, out of `total` in the library. */
  ready: number;
  total: number;
  snapshot: Snapshot | null;
};

const IDLE: AutoDjState = {
  on: false,
  status: 'idle',
  ready: 0,
  total: 0,
  snapshot: null,
};

let dj: AutoDjState = IDLE;
const listeners = new Set<() => void>();

const setDj = (patch: Partial<AutoDjState>) => {
  dj = { ...dj, ...patch };
  listeners.forEach(listener => listener());
};

export const useAutoDj = <T>(select: (s: AutoDjState) => T): T =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(dj),
  );

/** On: the person's shape is kept, to be given back from the switch. */
export const startAutoDj = () => {
  if (dj.on) return;
  const { gains, nextRoom, echo, rate, keepPitch } = playerState();
  setDj({
    on: true,
    snapshot: { gains: [...gains], nextRoom, echo, rate, keepPitch },
  });
};

/**
 * Off. From its own switch the shape goes back (`restore`); from any other
 * control the person has taken the controls back, and the sound stays where
 * it is — snapping it back under their hand would undo the move just made.
 */
export const stopAutoDj = ({ restore }: { restore: boolean }) => {
  const { snapshot } = dj;
  setDj(IDLE);
  if (!restore || !snapshot) return;
  const now = playerState();
  applyGains(snapshot.gains);
  if (now.nextRoom !== snapshot.nextRoom) setNextRoom(snapshot.nextRoom);
  if (now.echo !== snapshot.echo) setEcho(snapshot.echo);
  if (now.rate !== snapshot.rate) setRate(snapshot.rate);
  if (now.keepPitch !== snapshot.keepPitch) setKeepPitch(snapshot.keepPitch);
};

/** A control moved by hand: the DJ lets go, the move stands. */
export const byHand =
  <A extends unknown[]>(action: (...args: A) => void) =>
  (...args: A) => {
    if (dj.on) stopAutoDj({ restore: false });
    action(...args);
  };

// ── The song map: decode once, keep the JSON ───────────────────────────────

/**
 * The app decodes the mirrored mp3 at the analysis rate; a browser does the
 * same by decoding through an OfflineAudioContext AT that rate — decodeAudioData
 * resamples to its context's rate. The fetch usually comes out of the service
 * worker's media cache. Maps are small JSON, kept in localStorage.
 */
const MAP_KEY = 'soundshaper.songmap.v1.';
const memory = new Map<string, Promise<SongMap | null>>();

const readCached = (soundId: string): SongMap | null => {
  try {
    const raw = localStorage.getItem(MAP_KEY + soundId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SongMap;
    return parsed.version === 1 && Array.isArray(parsed.bars) ? parsed : null;
  } catch {
    return null;
  }
};

const compute = async (sound: Sound): Promise<SongMap | null> => {
  const cached = readCached(sound.id);
  if (cached) return cached;

  const bytes = await (
    await fetch(sound.audioUrl, { mode: 'cors', credentials: 'omit' })
  ).arrayBuffer();
  const buffer = await new OfflineAudioContext(
    1,
    1,
    ANALYSIS_SAMPLE_RATE,
  ).decodeAudioData(bytes);
  const map = analyzeSamples(buffer.getChannelData(0), buffer.sampleRate);
  try {
    localStorage.setItem(MAP_KEY + sound.id, JSON.stringify(map));
  } catch {
    // Full or private: the map lives for this visit.
  }
  return map;
};

const getSongMap = (sound: Sound): Promise<SongMap | null> => {
  const inFlight = memory.get(sound.id);
  if (inFlight) return inFlight;
  const promise = compute(sound).catch(() => null);
  void promise.then(map => {
    if (!map) memory.delete(sound.id);
  });
  memory.set(sound.id, promise);
  return promise;
};

/** Sign-out: off, and nothing of the last account's library kept. */
export const resetAutoDj = () => {
  setDj(IDLE);
  memory.clear();
  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith(MAP_KEY))
      .forEach(key => localStorage.removeItem(key));
  } catch {
    // Nothing stored.
  }
};

export const forgetSongMap = (soundId: string) => {
  memory.delete(soundId);
  try {
    localStorage.removeItem(MAP_KEY + soundId);
  } catch {
    // Nothing stored.
  }
};

// ── The director ───────────────────────────────────────────────────────────

const LOOKAHEAD_S = 0.35;
const JUMP_S = 1;
const CUE_LEAD_S = 0.12;

const applyMove = (move: Partial<DjMove>) => {
  const now = playerState();
  if (move.gains && move.gains.some((g, i) => g !== now.gains[i]))
    applyGains(move.gains);
  if (move.nextRoom !== undefined && move.nextRoom !== now.nextRoom)
    setNextRoom(move.nextRoom);
  if (move.echo !== undefined && move.echo !== now.echo) setEcho(move.echo);
  if (move.rate !== undefined && move.rate !== now.rate) setRate(move.rate);
  if (move.keepPitch !== undefined && move.keepPitch !== now.keepPitch)
    setKeepPitch(move.keepPitch);
};

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/** The app's director, line for line where it can be — see AutoDjDirector. */
const direct = (): (() => void) => {
  let cancelled = false;
  const maps = new Map<string, SongMap>();
  const failed = new Set<string>();
  const played = new Set<string>();
  const random = rng(freshSeed());
  let setTempo = 0;

  let mood: AutoDjStyle = 'club';
  let moodLeft = 1;
  const nextStyle = (): AutoDjStyle => {
    if (moodLeft <= 0) {
      const r = random();
      const options = AUTO_DJ_STYLES.filter(m => m !== mood);
      mood =
        r < 0.5 && mood !== 'club'
          ? 'club'
          : options[Math.floor(random() * options.length)];
      moodLeft = 1 + Math.floor(random() * 3);
    }
    moodLeft -= 1;
    return mood;
  };

  let segment: Segment | null = null;
  let landed = false;
  let upNext: Segment | null = null;
  let cued: Segment | null = null;
  let next = 0;
  let lastPosition = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** The library, in grid order — the player's queue. */
  const library = (): Sound[] => playerState().queue;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };

  const publishProgress = () => {
    const sounds = library();
    const done = sounds.filter(s => maps.has(s.id) || failed.has(s.id));
    setDj({ ready: done.length, total: sounds.length });
  };

  const pool = (): PoolSound[] =>
    library().flatMap(s => {
      const map = maps.get(s.id);
      return map ? [{ soundId: s.id, map }] : [];
    });

  const foldTo = (position: number) => {
    if (!segment) return;
    clearTimers();
    const at = Math.max(position, segment.startS);
    applyMove(stateAt(segment.mix, at));
    next = nextMoveIndex(segment.mix, at);
    lastPosition = position;
  };

  const chooseUpNext = () => {
    if (!segment || upNext || cued) return;
    const candidate = chooseNext(
      pool(),
      played,
      segment.soundId,
      setTempo,
      random,
    );
    if (!candidate) return;
    upNext = planSegment({
      next: candidate,
      style: nextStyle(),
      seed: Math.floor(random() * 2 ** 31),
      setTempo,
    });
  };

  const begin = (seg: Segment, position: number) => {
    segment = seg;
    landed = true;
    setTempo = seg.tempo;
    played.add(seg.soundId);
    setDj({ status: 'mixing' });
    foldTo(position);
    chooseUpNext();
  };

  const join = () => {
    const { current, position } = playerState();
    if (!current) return;
    const map = maps.get(current.id);
    if (!map) return;
    begin(
      joinSegment({
        sound: { soundId: current.id, map },
        style: nextStyle(),
        seed: Math.floor(random() * 2 ** 31),
        atS: position,
        setTempo,
      }),
      position,
    );
  };

  const cue = () => {
    if (!upNext) return;
    const target = upNext;
    upNext = null;
    const sound = library().find(s => s.id === target.soundId);
    if (!sound) {
      chooseUpNext();
      return;
    }
    clearTimers();
    cued = target;
    segment = null;
    applyMove(stateAt(target.mix, target.startS));
    void cueSound(sound, target.startS);
  };

  let pumping = false;
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    try {
      while (!cancelled) {
        const { current } = playerState();
        const todo = [current, ...library()].find(
          (s): s is Sound => !!s && !maps.has(s.id) && !failed.has(s.id),
        );
        if (!todo) break;
        const map = await getSongMap(todo);
        if (cancelled) return;
        if (map) maps.set(todo.id, map);
        else failed.add(todo.id);
        publishProgress();
        if (!segment && !cued) join();
        else chooseUpNext();
      }
    } finally {
      pumping = false;
    }
  };

  const onPosition = (position: number, playing: boolean) => {
    if (!segment) return;
    if (!landed) {
      if (position < segment.startS - 0.3) return;
      landed = true;
      foldTo(position);
      return;
    }
    const jumped =
      position < lastPosition - 0.05 || position - lastPosition > JUMP_S;
    if (jumped) foldTo(position);
    lastPosition = position;
    if (!playing) return;

    if (upNext && position >= segment.endS - CUE_LEAD_S) {
      cue();
      return;
    }

    const { rate } = playerState();
    const { moves } = segment.mix;
    while (next < moves.length) {
      const move = moves[next];
      const ahead = move.atS - position;
      if (ahead > LOOKAHEAD_S) break;
      next += 1;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          if (!cancelled) applyMove(move);
        },
        Math.max(0, (ahead / rate) * 1000),
      );
      timers.add(timer);
    }
  };

  let previous: PlayerState = playerState();
  const unsubscribe = subscribePlayer(() => {
    const state = playerState();
    const before = previous;
    previous = state;

    if (state.loadNonce !== before.loadNonce) {
      clearTimers();
      if (cued && state.current?.id === cued.soundId) {
        const seg = cued;
        cued = null;
        segment = seg;
        landed = false;
        setTempo = seg.tempo;
        played.add(seg.soundId);
        next = nextMoveIndex(seg.mix, seg.startS);
        lastPosition = seg.startS;
        chooseUpNext();
        return;
      }
      cued = null;
      segment = null;
      upNext = null;
      if (state.current) {
        if (maps.has(state.current.id))
          queueMicrotask(() => {
            if (!cancelled && !segment && !cued) join();
          });
        else void pump();
      }
      return;
    }
    if (state.position !== before.position)
      onPosition(state.position, state.playing);
    if (!state.playing && before.playing) {
      clearTimers();
      if (segment) next = nextMoveIndex(segment.mix, state.position);
    }
  });

  setDj({ status: 'preparing' });
  publishProgress();
  void pump();

  return () => {
    cancelled = true;
    clearTimers();
    unsubscribe();
    setDj({ ready: 0, total: 0 });
  };
};

/** Mount once in the signed-in app: the DJ runs whatever is open. */
export const useAutoDjDirector = () => {
  const on = useAutoDj(s => s.on);
  useEffect(() => (on ? direct() : undefined), [on]);
  // Signing out (unmounting) leaves nothing on.
  useEffect(() => resetAutoDj, []);
};
