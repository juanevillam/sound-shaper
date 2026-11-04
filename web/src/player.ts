import { useSyncExternalStore } from 'react';

import { audioEngine } from '@app/lib/audioEngine';
import {
  isRepeatMode,
  nextClip,
  type ClipRange,
  type RepeatMode,
} from '@app/lib/clipQueue';
import { RATE_MAX, RATE_MIN, snapRate } from '@app/lib/player';
import { EQ_PRESETS, type EffectLevel } from '@app/lib/shapeDsp';

import { forgetClips, getClipsOfSounds, knownClips } from './clips';
import type { Sound } from './library';
import { asHandle, type AudioTagHandle } from './shims/audio-api';
import { forgetWaveforms } from './waveform';

/**
 * THE WEB'S PLAYER STORE — the app's `store/player.ts` and `store/shaper.ts`
 * in one small module, driving the app's own `audioEngine`. One media element
 * per sound, as the app has one <Audio> per load: `createMediaElementSource`
 * takes an element once, and the engine builds a fresh graph for each.
 */
export type PlayerState = {
  /** The library, in grid order — what next and previous walk. */
  queue: Sound[];
  current: Sound | null;
  /** True once `current` has been loaded into an element. */
  loaded: boolean;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  keepPitch: boolean;
  gains: number[];
  echo: EffectLevel;
  nextRoom: EffectLevel;
  /** The clip that is sounding, or parked on: its end stops or repeats. */
  activeClip: (ClipRange & { soundId: string; once?: boolean }) | null;
  repeat: RepeatMode;
  /** Bumps on every load — how Auto DJ tells its own cuts from a person's. */
  loadNonce: number;
};

const REPEAT_KEY = 'soundshaper.clipRepeat';

const storedRepeat = (): RepeatMode => {
  try {
    const value = localStorage.getItem(REPEAT_KEY);
    return isRepeatMode(value) ? value : 'off';
  } catch {
    return 'off';
  }
};

const FLAT = EQ_PRESETS[0].gains;

const initial: PlayerState = {
  queue: [],
  current: null,
  loaded: false,
  playing: false,
  position: 0,
  duration: 0,
  rate: 1,
  keepPitch: true,
  gains: [...FLAT],
  echo: 'off',
  nextRoom: 'off',
  activeClip: null,
  repeat: 'off',
  loadNonce: 0,
};

let state: PlayerState = { ...initial, repeat: storedRepeat() };
const listeners = new Set<() => void>();
let element: AudioTagHandle | null = null;
let frame = 0;

const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePlayer = <T>(select: (s: PlayerState) => T): T =>
  useSyncExternalStore(subscribe, () => select(state));

/** For watchers outside React — the trophies' listening clock. */
export const subscribePlayer = subscribe;
export const playerState = () => state;

// The playhead follows the element every frame while it plays, so the
// scrubber moves smoothly rather than in timeupdate's four steps a second.
const follow = () => {
  cancelAnimationFrame(frame);
  const tick = () => {
    if (element) set({ position: element.currentTime });
    const clip = state.activeClip;
    if (
      clip &&
      element &&
      !clipEnding &&
      element.currentTime * 1000 >= clip.endMs
    )
      void clipEnded(clip);
    if (state.playing) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
};

const release = () => {
  cancelAnimationFrame(frame);
  if (!element) return;
  element.pause();
  element.removeAttribute('src');
  element.load();
  element = null;
  audioEngine.registerHandle(null);
  audioEngine.teardownGraph();
};

const load = (sound: Sound) => {
  release();

  const el = asHandle(new Audio());

  // Cloudinary answers CORS, and Web Audio may only read a cross-origin
  // stream the page asked for anonymously.
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.src = sound.audioUrl;
  el.playbackRate = state.rate;
  el.preservesPitch = state.keepPitch;
  el.addEventListener('play', () => {
    set({ playing: true });
    follow();
  });
  el.addEventListener('pause', () => set({ playing: false }));
  el.addEventListener('loadedmetadata', () =>
    set({ duration: Number.isFinite(el.duration) ? el.duration : 0 }),
  );
  el.addEventListener('ended', () => step(1));

  audioEngine.registerHandle(el);
  audioEngine.buildGraph(el);
  audioEngine.apply(state.gains, state.nextRoom, state.echo);
  element = el;
  set({
    current: sound,
    loaded: true,
    position: 0,
    duration: (sound.durationMs ?? 0) / 1000,
    loadNonce: state.loadNonce + 1,
  });
};

/**
 * Load `sound` and start it at `startS` — how Auto DJ cuts to the next
 * stretch of its set. Leaves the queue alone, as the app's `cueSound` does.
 */
export const cueSound = async (sound: Sound, startS: number) => {
  set({ activeClip: null });
  load(sound);
  if (element) element.currentTime = startS;
  set({ position: startS });
  await start();
};

/** Keep the queue in step with the library, as the app's `syncLibrary` does. */
export const syncLibrary = (sounds: Sound[]) => {
  const current = state.current
    ? (sounds.find(s => s.id === state.current?.id) ?? null)
    : null;

  // The playing sound was deleted elsewhere: stop rather than play a ghost.
  if (state.current && !current) {
    release();
    set({
      queue: sounds,
      current: sounds[0] ?? null,
      loaded: false,
      playing: false,
      position: 0,
    });
    return;
  }

  // Nothing chosen yet: the banner parks on the first sound, as the app's
  // idle banner does.
  set({ queue: sounds, current: current ?? sounds[0] ?? null });
};

const start = async () => {
  // A browser starts its audio context only from a gesture — the tap that
  // got here.
  await audioEngine.getContext().resume();
  await element?.play().catch(() => set({ playing: false }));
};

export const playSound = async (sound: Sound): Promise<void> => {
  if (state.loaded && state.current?.id === sound.id) return toggle();
  set({ activeClip: null });
  load(sound);
  await start();
};

export const pause = () => element?.pause();

/** Load a sound without playing it — the editor needs its element to scrub. */
export const cue = (sound: Sound) => {
  if (!state.loaded || state.current?.id !== sound.id) {
    set({ activeClip: null });
    load(sound);
  }
};

export const toggle = async (): Promise<void> => {
  if (!state.current) return;
  if (!state.loaded) return playSound(state.current);
  if (state.playing) element?.pause();
  else {
    // A clip parked on its start plays again from there, as the app's does.
    const clip = state.activeClip;
    if (clip && element && element.currentTime * 1000 >= clip.endMs - 50)
      element.currentTime = clip.startMs / 1000;
    await start();
  }
};

const step = (by: 1 | -1) => {
  const { queue, current } = state;

  if (!queue.length) return;

  const index = queue.findIndex(s => s.id === current?.id);
  const next = queue[(index + by + queue.length) % queue.length];

  set({ activeClip: null });
  load(next);
  void start();
};

export const next = () => step(1);

/** Previous restarts the sound past its first three seconds, as Music does. */
export const previous = () => {
  if (element && element.currentTime > 3) return seek(0);
  step(-1);
};

export const seek = (seconds: number) => {
  if (!element) return;
  // A scrub is a manual move, and a manual move ends a clip run.
  set({ activeClip: null });
  element.currentTime = seconds;
  set({ position: seconds });
};

// ── The Shape ───────────────────────────────────────────────────────────

export const presetOf = (gains: number[]): string =>
  EQ_PRESETS.find(p => p.gains.every((g, i) => g === gains[i]))?.i18nKey ??
  'custom';

export const setPreset = (key: string) => {
  const preset = EQ_PRESETS.find(p => p.i18nKey === key);

  if (!preset) return;
  audioEngine.apply(preset.gains);
  set({ gains: [...preset.gains] });
};

/** A whole curve at once — Auto DJ's lever, one push for five bands. */
export const applyGains = (gains: number[]) => {
  audioEngine.apply(gains);
  set({ gains: [...gains] });
};

export const setBand = (index: number, db: number) => {
  audioEngine.setBandGain(index, db);
  set({ gains: state.gains.map((g, i) => (i === index ? db : g)) });
};

export const setRate = (rate: number) => {
  const snapped = Math.min(RATE_MAX, Math.max(RATE_MIN, snapRate(rate)));

  if (element) element.playbackRate = snapped;
  set({ rate: snapped });
};

export const setKeepPitch = (keepPitch: boolean) => {
  if (element) element.preservesPitch = keepPitch;
  set({ keepPitch });
};

export const setEcho = (level: EffectLevel) => {
  audioEngine.setEcho(level);
  set({ echo: level });
};

export const setNextRoom = (level: EffectLevel) => {
  audioEngine.setNextRoom(level);
  set({ nextRoom: level });
};

// ── Clips ───────────────────────────────────────────────────────────────

let clipEnding = false;

/** Move the playhead without ending a run — the editor's scrub and skips. */
export const scrubTo = (seconds: number) => {
  if (!element) return;
  element.currentTime = seconds;
  set({ position: seconds });
};

/** Play a clip: from its start, to its end, then whatever Repeat says. */
export const playClip = async (
  soundId: string,
  clip: ClipRange,
  /**
   * The editor's preview: `from` starts inside the range (the playhead, when
   * it sits there), and `once` ignores Repeat — a range being framed plays
   * once and parks on its start, whatever the Clips sheet is set to.
   */
  { from, once }: { from?: number; once?: boolean } = {},
) => {
  const sound = state.queue.find(s => s.id === soundId);

  if (!sound) return;
  if (!state.loaded || state.current?.id !== soundId) load(sound);
  const at = from ?? clip.startMs / 1000;
  if (element) element.currentTime = at;
  set({
    activeClip: {
      soundId,
      id: clip.id,
      startMs: clip.startMs,
      endMs: clip.endMs,
      once,
    },
    position: at,
  });
  await start();
};

const clipEnded = async (
  clip: ClipRange & { soundId: string; once?: boolean },
) => {
  clipEnding = true;
  try {
    const libraryOrder = state.queue.map(s => s.id);
    const clipsBySound =
      state.repeat === 'all' && !clip.once
        ? await getClipsOfSounds(libraryOrder)
        : knownClips();
    const upcoming = nextClip({
      clipsBySound,
      current: clip,
      libraryOrder,
      mode: clip.once ? 'off' : state.repeat,
      soundId: clip.soundId,
    });

    // The run may have been ended by hand while the lists were read.
    if (state.activeClip?.id !== clip.id) return;

    if (!upcoming) {
      // Off: the clip played once and parks on its start, ready to replay.
      element?.pause();
      if (element) element.currentTime = clip.startMs / 1000;
      set({ position: clip.startMs / 1000 });
      return;
    }

    await playClip(upcoming.soundId, upcoming.clip);
  } finally {
    clipEnding = false;
  }
};

export const setRepeat = (repeat: RepeatMode) => {
  try {
    localStorage.setItem(REPEAT_KEY, repeat);
  } catch {
    // Private mode: the choice lasts for this visit.
  }
  set({ repeat });
};

/**
 * Everything the player holds belongs to the person signed in, so signing
 * out stops the sound and forgets the shape — the app's sign-out resets.
 */
export const resetPlayer = () => {
  release();
  audioEngine.apply(FLAT, 'off', 'off');
  forgetClips();
  forgetWaveforms();
  try {
    localStorage.removeItem(REPEAT_KEY);
  } catch {
    // Nothing stored.
  }
  set({ ...initial, loadNonce: state.loadNonce + 1 });
};
