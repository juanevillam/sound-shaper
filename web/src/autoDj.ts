import { useEffect, useSyncExternalStore } from 'react';

import { audioEngine } from '@app/lib/audioEngine';
import {
  ANALYSIS_SAMPLE_RATE,
  analyzeSamples,
  type SongMap,
} from '@app/lib/autoDj/analysis';
import { djLevelDb } from '@app/lib/autoDj/loudness';
import {
  AUTO_DJ_STYLES,
  DEFAULT_AUTO_DJ_CUSTOM,
  DEFAULT_AUTO_DJ_PROFILE,
  DJ_FOCUS_RANK,
  moveFocus,
  nextMoveIndex,
  parseAutoDjProfile,
  randomizeAutoDjCustom,
  rng,
  sameAutoDjProfile,
  stateAt,
  type AutoDjCustomConfig,
  type AutoDjMode,
  type AutoDjProfile,
  type AutoDjStyle,
  type DjFocus,
  type DjJuggleStep,
  type DjMove,
} from '@app/lib/autoDj/plan';
import {
  firstPeakBar,
  joinSegment,
  planOrder,
  planSegment,
  planSoundSegment,
  transitionFx,
  type Part,
  type PoolSound,
  type Segment,
  type TransitionFx,
} from '@app/lib/autoDj/set';
import type { EffectLevel } from '@app/lib/shapeDsp';
import { USERS_COLLECTION } from '@app/services/firebase/collections';
import { doc, setDoc } from 'firebase/firestore';

import { djFx, preloadDjFx } from './djFx';
import { auth, db } from './firebase';
import type { Sound } from './library';
import {
  applyGains,
  cueSound,
  playSound,
  playerState,
  seek,
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

const profileCacheKey = (uid: string) => `soundshaper.autoDjProfile.${uid}`;

const readCachedProfile = (uid: string): AutoDjProfile => {
  try {
    const raw = localStorage.getItem(profileCacheKey(uid));
    return raw ? parseAutoDjProfile(JSON.parse(raw)) : DEFAULT_AUTO_DJ_PROFILE;
  } catch {
    return DEFAULT_AUTO_DJ_PROFILE;
  }
};

const writeCachedProfile = (uid: string, profile: AutoDjProfile) => {
  try {
    localStorage.setItem(profileCacheKey(uid), JSON.stringify(profile));
  } catch {
    // Private browsing or quota full: keep in memory for this visit.
  }
};

export type AutoDjState = {
  on: boolean;
  mode: AutoDjMode;
  profile: AutoDjProfile;
  status: 'idle' | 'preparing' | 'mixing';
  /** The section of the Shape panel the DJ most recently changed. */
  focus: DjFocus | null;
  /** Sounds read so far, out of `total` in the library. */
  ready: number;
  total: number;
  snapshot: Snapshot | null;
};

const IDLE_BASE: Omit<AutoDjState, 'profile'> = {
  on: false,
  mode: 'off',
  status: 'idle',
  focus: null,
  ready: 0,
  total: 0,
  snapshot: null,
};

let dj: AutoDjState = { ...IDLE_BASE, profile: DEFAULT_AUTO_DJ_PROFILE };
const listeners = new Set<() => void>();

export const autoDjState = (): AutoDjState => dj;

const setDj = (patch: Partial<AutoDjState>) => {
  dj = { ...dj, ...patch };
  listeners.forEach(listener => listener());
};

/** Seed DJ Juan profile from per-uid localStorage cache while Firestore loads. */
export const hydrateAutoDjProfile = (uid: string) => {
  const cached = readCachedProfile(uid);
  if (!sameAutoDjProfile(dj.profile, cached)) setDj({ profile: cached });
};

/** Sync incoming `users/{uid}.autoDjProfile` snapshot without triggering spurious restarts. */
export const syncAutoDjProfileFromAccount = (uid: string, raw: unknown) => {
  const parsed = parseAutoDjProfile(raw);
  writeCachedProfile(uid, parsed);
  if (!sameAutoDjProfile(dj.profile, parsed)) setDj({ profile: parsed });
};

const persistProfile = (profile: AutoDjProfile) => {
  const uid = auth.currentUser?.uid;
  if (uid) {
    writeCachedProfile(uid, profile);
    void setDoc(
      doc(db, USERS_COLLECTION, uid),
      { autoDjProfile: profile },
      { merge: true },
    ).catch(error => console.warn('autoDjProfile', error));
  }
};

export const patchAutoDjCustom = (patch: Partial<AutoDjCustomConfig>) => {
  const profile: AutoDjProfile = {
    preset: 'custom',
    custom: { ...dj.profile.custom, ...patch },
  };
  persistProfile(profile);
  setDj({ profile });
};

export const randomizeAutoDjProfile = () => {
  const profile: AutoDjProfile = {
    preset: 'custom',
    custom: randomizeAutoDjCustom(),
  };
  persistProfile(profile);
  setDj({ profile });
};

export const resetAutoDjProfile = () => {
  const profile: AutoDjProfile = {
    preset: 'classic',
    custom: { ...DEFAULT_AUTO_DJ_CUSTOM },
  };
  persistProfile(profile);
  setDj({ profile });
};

export const useAutoDj = <T>(select: (s: AutoDjState) => T): T =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(dj),
  );

/** On/Off/Mode: the person's shape is kept, to be given back when switched off. */
export const setAutoDjMode = (mode: AutoDjMode) => {
  if (mode === 'off') {
    stopAutoDj({ restore: true });
    return;
  }
  const { gains, nextRoom, echo, rate, keepPitch } = playerState();
  setDj({
    on: true,
    mode,
    focus: null,
    snapshot:
      dj.on && dj.snapshot
        ? dj.snapshot
        : { gains: [...gains], nextRoom, echo, rate, keepPitch },
  });
};

/**
 * Off. From its own switch the shape goes back (`restore`); from any other
 * control the person has taken the controls back, and the sound stays where
 * it is — snapping it back under their hand would undo the move just made.
 */
export const stopAutoDj = ({ restore }: { restore: boolean }) => {
  const { snapshot } = dj;
  setDj(IDLE_BASE);
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
 * resamples to its context's rate. Each sound is fetched once, then its map
 * — small JSON — is kept in localStorage.
 */
const MAP_KEY = 'soundshaper.songmap.v2.';
const memory = new Map<string, Promise<SongMap | null>>();

/**
 * A versioned cache has to DELETE what it superseded, not only refuse to read
 * it — once per visit, as the app's `songMap.ts` does.
 */
let pruned = false;
const pruneOnce = () => {
  if (pruned) return;
  pruned = true;
  try {
    Object.keys(localStorage)
      .filter(
        key =>
          key.startsWith('soundshaper.songmap.') && !key.startsWith(MAP_KEY),
      )
      .forEach(key => localStorage.removeItem(key));
  } catch {
    // Nothing stored.
  }
};

const readCached = (soundId: string): SongMap | null => {
  pruneOnce();
  try {
    const raw = localStorage.getItem(MAP_KEY + soundId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SongMap;
    return parsed.version === 2 &&
      Array.isArray(parsed.bars) &&
      Array.isArray(parsed.bass) &&
      Array.isArray(parsed.bright)
      ? parsed
      : null;
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
  return analyzeSamples(buffer.getChannelData(0), buffer.sampleRate);
};

const getSongMap = (sound: Sound): Promise<SongMap | null> => {
  const inFlight = memory.get(sound.id);
  if (inFlight) return inFlight;
  const promise = compute(sound).catch(() => null);
  void promise.then(map => {
    if (memory.get(sound.id) !== promise) return;
    if (!map) {
      memory.delete(sound.id);
      return;
    }
    try {
      localStorage.setItem(MAP_KEY + sound.id, JSON.stringify(map));
    } catch {
      // Full or private: the map lives for this visit.
    }
  });
  memory.set(sound.id, promise);
  return promise;
};

/** Sign-out: off, and nothing of the last account's library kept. */
export const resetAutoDj = () => {
  setDj({ ...IDLE_BASE, profile: DEFAULT_AUTO_DJ_PROFILE });
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
const FOCUS_HOLD_MS = 3200;
const LEVEL_RAMP_S = 0.35;
const LEVEL_ENTER_S = 1.5;
let lastFocusAt = 0;
let levelRampS = LEVEL_ENTER_S;

const applyMove = (move: Partial<DjMove>) => {
  const now = playerState();
  const nextFocus = moveFocus(
    {
      gains: now.gains,
      nextRoom: now.nextRoom,
      echo: now.echo,
      rate: now.rate,
      keepPitch: now.keepPitch,
    },
    move,
  );
  if (move.gains && move.gains.some((g, i) => g !== now.gains[i]))
    applyGains(move.gains);
  if (move.nextRoom !== undefined && move.nextRoom !== now.nextRoom)
    setNextRoom(move.nextRoom);
  if (move.echo !== undefined && move.echo !== now.echo) setEcho(move.echo);
  if (move.rate !== undefined && move.rate !== now.rate) setRate(move.rate);
  if (move.keepPitch !== undefined && move.keepPitch !== now.keepPitch)
    setKeepPitch(move.keepPitch);
  if (nextFocus) {
    const cur = dj.focus;
    const nowMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const holdCurrent =
      cur !== null &&
      cur !== nextFocus &&
      DJ_FOCUS_RANK[cur] >= DJ_FOCUS_RANK[nextFocus] &&
      nowMs - lastFocusAt < FOCUS_HOLD_MS;
    if (!holdCurrent) {
      if (dj.focus !== nextFocus) setDj({ focus: nextFocus });
      lastFocusAt = nowMs;
    }
  }
  const after = playerState();
  audioEngine.setLevelDb(
    djLevelDb({
      gains: after.gains,
      nextRoom: after.nextRoom,
      echo: after.echo,
    }),
    levelRampS,
  );
  levelRampS = LEVEL_RAMP_S;
};

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/** The app's director, line for line where it can be — see AutoDjDirector. */
const direct = (
  mode: 'sound' | 'all',
  profile: AutoDjProfile,
): (() => void) => {
  const singleSound = mode === 'sound';
  let cancelled = false;
  const maps = new Map<string, SongMap>();
  const failed = new Set<string>();
  const played = new Set<string>();
  const random = rng(freshSeed());
  lastFocusAt = 0;

  let setTempo = 0;
  let firstJoin = true;

  // Starting DJ Juan (or switching between This Sound and All Sounds) rewinds
  // the current sound to 0:00 so the mix starts from the beginning.
  const initial = playerState();
  if (initial.current) {
    if (initial.loaded) {
      seek(0);
      if (!initial.playing) void playSound(initial.current);
    } else {
      void playSound(initial.current);
    }
  }

  /**
   * THE SET'S MOOD — Club, Slowed or Hyper — is the DJ's to choose, not a
   * setting (Juan, 2026-11-04: Auto DJ is on or off, and the set is a
   * combination of them). A mood holds for one to three segments and then
   * moves on, so a set has passages rather than a coin flip per song; Club
   * is the home it comes back to most.
   */
  let mood: AutoDjStyle = 'club';
  // The sound already playing is joined in Club, before the first change.
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
  /** The segment sounding now. */
  let segment: Segment | null = null;
  /** Whether the playhead has reached `segment` yet after its cue. */
  let landed = false;
  /** The segment the set cuts to next. */
  let upNext: Segment | null = null;
  /** The run through the library, planned once it is all read. */
  let order: string[] = [];
  /** Songs left with a peak still ahead: where, and how many cuts ago. */
  const returns = new Map<string, { bar: number; at: number }>();
  /** Songs that already returned once this pass — never a third play. */
  const returned = new Set<string>();
  let cuts = 0;
  let lastReturnCut = -10;
  /** The glue chosen for the cut into `upNext`, and whether it rose yet. */
  let fx: TransitionFx | null = null;
  let rose = false;
  /** A cue in flight: the segment whose sound is loading. */
  let cued: Segment | null = null;
  let next = 0;
  let lastPosition = 0;
  /** True while a real-time juggle sequence is driving seek/shape steps. */
  let juggling = false;
  /** Move indices whose one-shot `juggle` already fired in the current segment. */
  const firedJuggles = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** The library, in grid order — the player's queue. */
  const library = (): Sound[] => playerState().queue;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    juggling = false;
  };

  const publishProgress = () => {
    if (singleSound) {
      setDj({ ready: 0, total: 0 });
      return;
    }
    const sounds = library();
    const done = sounds.filter(s => maps.has(s.id) || failed.has(s.id));
    setDj({ ready: done.length, total: sounds.length });
  };

  const pool = (): PoolSound[] =>
    library().flatMap(s => {
      const map = maps.get(s.id);
      return map ? [{ soundId: s.id, map }] : [];
    });

  /** Bring the transport onto `segment` at `position`. */
  const foldTo = (position: number) => {
    if (!segment) return;
    clearTimers();
    const at = Math.max(position, segment.startS);
    applyMove(stateAt(segment.mix, at));
    next = nextMoveIndex(segment.mix, at);
    lastPosition = position;
  };

  const allRead = () =>
    library().every(s => maps.has(s.id) || failed.has(s.id));

  /** Plan the run from `fromId`: what has not played yet, else everything. */
  const planRun = (fromId: string | null) => {
    const all = pool();
    const fresh = all.filter(p => !played.has(p.soundId));
    if (fresh.filter(p => p.soundId !== fromId).length === 0) {
      played.clear();
      returned.clear();
    }
    const base = fresh.filter(p => p.soundId !== fromId).length ? fresh : all;
    order = planOrder(base, fromId, setTempo, random);
  };

  const barOf = (seg: Segment): number => {
    const map = maps.get(seg.soundId);
    if (!map) return 2;
    return map.bpm > 0 ? map.beatS * 4 : map.blockS;
  };

  const setUpNext = (seg: Segment | null) => {
    upNext = seg;
    rose = false;
    // Transition sound FX (riser/downlifter/zap/reverseCymbal) only glue cuts
    // between different songs in `all` mode — never in single-sound mode.
    fx =
      !singleSound && seg && segment
        ? transitionFx(segment, seg, random, barOf(segment))
        : null;
  };

  const chooseUpNext = () => {
    if (!segment || upNext || cued) return;
    if (singleSound) {
      const map = maps.get(segment.soundId);
      if (!map) return;
      setUpNext(
        planSoundSegment({
          sound: { soundId: segment.soundId, map },
          style: nextStyle(),
          seed: Math.floor(random() * 2 ** 31),
          atS: 0,
          profile,
        }),
      );
      return;
    }
    const all = pool();
    if (all.length < 2) return;
    const plan = (
      nextId: string | undefined,
      part: Part,
      fromBar = 0,
      finale = false,
    ) => {
      const nextSound = all.find(p => p.soundId === nextId);
      if (!nextSound || !segment) return;
      setUpNext(
        planSegment({
          next: nextSound,
          style: nextStyle(),
          seed: Math.floor(random() * 2 ** 31),
          setTempo,
          after: segment.endsOn,
          part,
          fromBar,
          finale,
          profile,
        }),
      );
    };

    if (allRead()) {
      // Drop what left the library or played since the plan was made.
      order = order.filter(
        id => id !== segment?.soundId && maps.has(id) && !played.has(id),
      );
      // A RETURN: a song the set left at least 3 cuts ago, picked up on a
      // later part for a shorter second turn — and at most once every 5
      // cuts (1–2 times in 10 songs; Juan, 2026-11-07).
      const waiting = [...returns.entries()].filter(
        ([id, r]) =>
          id !== segment?.soundId &&
          maps.has(id) &&
          !returned.has(id) &&
          cuts - r.at >= 3,
      );
      if (
        waiting.length &&
        cuts - lastReturnCut >= 5 &&
        (!order.length || random() < 0.22)
      ) {
        const [id, r] = waiting.sort((x, y) => x[1].at - y[1].at)[0];
        returns.delete(id);
        returned.add(id);
        lastReturnCut = cuts;
        const last = !order.length && returns.size === 0;
        plan(id, 'later', r.bar, last);
        return;
      }
      if (!order.length) planRun(segment.soundId);
      const nextId = order.shift();
      const map = nextId ? maps.get(nextId) : undefined;
      // A NEW SONG: in on its opening a quarter of the time, when it has
      // one worth playing; otherwise on its best part.
      const opening = !!map && firstPeakBar(map) >= 16 && random() < 0.25;
      plan(
        nextId,
        opening ? 'opening' : 'peak',
        0,
        !order.length && returns.size === 0,
      );
      return;
    } else {
      // Still reading: the best of what is read, without a plan to keep.
      const fresh = all.filter(
        p => p.soundId !== segment?.soundId && !played.has(p.soundId),
      );
      const nextId = planOrder(
        fresh.length ? fresh : all,
        segment.soundId,
        setTempo,
        random,
      )[0];
      plan(nextId, 'peak');
    }
  };

  const begin = (seg: Segment, position: number) => {
    segment = seg;
    landed = true;
    firedJuggles.clear();
    setTempo = seg.tempo;
    played.add(seg.soundId);
    setDj({ status: 'mixing' });
    foldTo(position);
    chooseUpNext();
  };

  /** Make the playing sound the set's segment, from the start on entry. */
  const join = () => {
    const now = playerState();
    const { current } = now;
    if (!current) return;
    const map = maps.get(current.id);
    if (!map) return; // read first; `pump` joins when it lands
    const isEntry = firstJoin;
    const startFromTop = singleSound || isEntry;
    firstJoin = false;
    if (!isEntry && startFromTop && now.position > 0.35) {
      seek(0);
    }
    const atS = startFromTop ? 0 : now.position;
    const seed = Math.floor(random() * 2 ** 31);
    begin(
      singleSound
        ? planSoundSegment({
            sound: { soundId: current.id, map },
            style: nextStyle(),
            seed,
            atS: 0,
            profile,
          })
        : joinSegment({
            sound: { soundId: current.id, map },
            style: nextStyle(),
            seed,
            atS,
            setTempo,
            profile,
          }),
      atS,
    );
  };

  /** Cut to `upNext`. */
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
    // The song being left waits for the set to come back for its later
    // parts — only on its first visit, mainly after an opening (where the
    // chorus was held back), and at most two waiting at a time.
    const leaving = segment;
    if (
      leaving?.resumeBar !== undefined &&
      leaving.part !== 'later' &&
      !returned.has(leaving.soundId) &&
      (leaving.part === 'opening' || random() < 0.15)
    ) {
      returns.set(leaving.soundId, { bar: leaving.resumeBar, at: cuts });
      if (returns.size > 2) returns.delete(returns.keys().next().value!);
    }
    returns.delete(target.soundId);
    cuts += 1;
    cued = target;
    segment = null;
    // The hit lands on the cut and the next sound eases in under it.
    const { rate } = playerState();
    if (fx?.on) djFx.play(fx.on, CUE_LEAD_S / rate);
    audioEngine.fadeInNextLoad(fx?.fadeInS ?? 0.03);
    fx = null;
    // The incoming state goes on as the cut is made, so the next sound
    // starts already shaped — including Echo, whose rewire the load hides.
    applyMove(stateAt(target.mix, target.startS));
    void cueSound(sound, target.startS);
  };

  /** Read the library (or just the playing sound in `sound` mode), one at a time. */
  let pumping = false;
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    try {
      while (!cancelled) {
        const { current } = playerState();
        const candidates = singleSound ? [current] : [current, ...library()];
        const todo = candidates.find(
          (s): s is Sound => !!s && !maps.has(s.id) && !failed.has(s.id),
        );
        if (!todo) break;
        const map = await getSongMap(todo);
        if (cancelled) return;
        if (map) maps.set(todo.id, map);
        else failed.add(todo.id);
        publishProgress();
        if (!segment && !cued) join();
        else if (!singleSound && allRead() && !order.length) {
          // The whole library is read: plan the run, and re-pick what
          // comes next from it unless the cut is already on its way.
          planRun(segment?.soundId ?? null);
          if (!cued) setUpNext(null);
          chooseUpNext();
        } else chooseUpNext();
      }
    } finally {
      pumping = false;
    }
  };

  /**
   * Execute a one-shot real-time juggle sequence (rewinds, multi-rewinds with
   * pitch changes, forward skips). While running, `juggling` stays true so
   * DJ-issued seeks do not trigger manual-scrub resets.
   */
  const runJuggle = (steps: DjJuggleStep[], beatS: number) => {
    if (!steps.length || !segment) return;
    clearTimers();
    juggling = true;

    const runStep = (idx: number) => {
      if (cancelled || !segment || !playerState().playing) {
        juggling = false;
        return;
      }
      const step = steps[idx];
      applyMove(step);
      if (!singleSound && step.fx) {
        djFx.play(
          step.fx,
          0,
          step.fx === 'reverseCymbal' ? beatS * 2 : undefined,
        );
      }
      if (step.seekToS !== undefined) {
        const clamped = Math.max(
          segment.startS,
          Math.min(segment.endS - 0.25, step.seekToS),
        );
        lastPosition = clamped;
        seek(clamped);
      }
      const nextIdx = idx + 1;
      if (nextIdx >= steps.length) {
        juggling = false;
        const pos = playerState().position;
        lastPosition = pos;
        next = nextMoveIndex(segment.mix, pos);
        return;
      }
      const nextStep = steps[nextIdx];
      const activeRate = Math.max(0.5, playerState().rate);
      const delayMs = Math.max(
        40,
        ((nextStep.delayBeats * beatS) / activeRate) * 1000,
      );
      const timer = setTimeout(() => {
        timers.delete(timer);
        runStep(nextIdx);
      }, delayMs);
      timers.add(timer);
    };

    runStep(0);
  };

  const onPosition = (position: number, playing: boolean) => {
    if (!segment) return;
    // After a cue, the reports before the new sound lands belong to the
    // reset, not to the segment.
    if (!landed) {
      if (position < segment.startS - 0.3) return;
      landed = true;
      foldTo(position);
      return;
    }
    if (juggling) {
      lastPosition = position;
      if (playing && upNext && position >= segment.endS - CUE_LEAD_S) {
        cue();
      }
      return;
    }
    const jumped =
      position < lastPosition - 0.05 || position - lastPosition > JUMP_S;
    if (jumped) {
      djFx.stopAll();
      rose = false;
      foldTo(position);
    }
    lastPosition = position;
    if (!playing) return;

    if (upNext && position >= segment.endS - CUE_LEAD_S) {
      cue();
      return;
    }

    const { rate } = playerState();
    // THE RISE INTO THE CUT, started so it ends exactly on it.
    if (upNext && fx?.before && fx.beforeS && !rose) {
      const toCut = (segment.endS - position) / rate;
      const lengthS = Math.round((fx.beforeS / rate) * 20) / 20;
      if (toCut <= lengthS + 0.2 && toCut > 0.05) {
        rose = true;
        djFx.play(fx.before, toCut, lengthS);
      }
    }
    const { moves } = segment.mix;
    const barS = barOf(segment);
    const beatS = barS / 4;
    while (next < moves.length) {
      const moveIdx = next;
      const move = moves[moveIdx];
      const ahead = move.atS - position;
      if (ahead > LOOKAHEAD_S) break;
      next += 1;
      const delayMs = Math.max(0, (ahead / rate) * 1000);
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (cancelled) return;
        if (move.juggle && !firedJuggles.has(moveIdx)) {
          firedJuggles.add(moveIdx);
          runJuggle(move.juggle, beatS);
          return;
        }
        applyMove(move);
        if (!singleSound && move.fx) {
          djFx.play(
            move.fx,
            0,
            move.fx === 'reverseCymbal' ? barS / 2 : undefined,
          );
        }
      }, delayMs);
      timers.add(timer);
    }
  };

  let before: PlayerState = playerState();
  const unsubscribe = subscribePlayer(() => {
    const state = playerState();
    const previous = before;
    before = state;
    if (state.loadNonce !== previous.loadNonce) {
      clearTimers();
      if (cued && state.current?.id === cued.soundId) {
        // The cut the set asked for.
        const seg = cued;
        cued = null;
        segment = seg;
        landed = false;
        firedJuggles.clear();
        setTempo = seg.tempo;
        played.add(seg.soundId);
        next = nextMoveIndex(seg.mix, seg.startS);
        lastPosition = seg.startS;
        chooseUpNext();
        return;
      }
      // A load the set did not ask for: join it once it is playing, and
      // plan the rest of the run from there.
      cued = null;
      segment = null;
      setUpNext(null);
      djFx.stopAll();
      order = [];
      if (state.current) {
        if (maps.has(state.current.id)) {
          // Join on the next tick, once the new stream reports.
          queueMicrotask(() => {
            if (!cancelled && !segment && !cued) join();
          });
        } else {
          void pump();
        }
      }
      return;
    }
    if (state.position !== previous.position) {
      onPosition(state.position, state.playing);
    }
    // A pause stops the clock; whatever was on a timer would land late.
    if (!state.playing && previous.playing) {
      clearTimers();
      djFx.stopAll();
      rose = false;
      if (segment) next = nextMoveIndex(segment.mix, state.position);
    }
  });

  setDj({ status: 'preparing' });
  preloadDjFx();
  publishProgress();
  void pump();

  return () => {
    cancelled = true;
    clearTimers();
    djFx.stopAll();
    if (!dj.on) {
      audioEngine.setLevelDb(0, LEVEL_ENTER_S);
      levelRampS = LEVEL_ENTER_S;
    }
    unsubscribe();
    setDj({ ready: 0, total: 0 });
  };
};

/** Mount once in the signed-in app: the DJ runs whatever is open. */
export const useAutoDjDirector = () => {
  const mode = useAutoDj(s => s.mode);
  const profile = useAutoDj(s => s.profile);
  useEffect(
    () => (mode !== 'off' ? direct(mode, profile) : undefined),
    [mode, profile],
  );
  // Signing out (unmounting) leaves nothing on.
  useEffect(() => resetAutoDj, []);
};
