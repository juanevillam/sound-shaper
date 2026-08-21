import { create } from 'zustand';

import { audioEngine } from '@/lib/audioEngine';
import { type Sound } from '@/services/firebase/sounds';

// Restart-vs-previous threshold: past this many seconds into a sound, the
// "previous" control restarts it instead (the universal music-app idiom).
export const RESTART_THRESHOLD_S = 3;

// Global playback state. WHAT is playing (sound + its playlist queue), the
// user's shaping choices (rate, pitch), and the live transport (position /
// duration / playing) — the last three are fed in by the <AudioEngine> from
// the streaming <Audio> element; every control goes back out through these
// actions, which drive the shared audio graph.
//
// `loadNonce` is bumped whenever a track should (re)load — the <AudioEngine>
// keys its <Audio> on `${sound.id}#${loadNonce}`, so a bump remounts the
// element. This is how a finished sound replays: a plain play() on an ended
// <Audio> does nothing, but a remount streams it fresh.
type PlayerState = {
  current: Sound | null;
  queue: Sound[];
  loadNonce: number;
  /** A (re)load is in flight; ignore the old stream's parting position. */
  pendingStart: boolean;
  // Bumped when a surface wants the full player OPENED (tapping a sound tile
  // plays it and expands the sheet, YT-Music style). The PlayerSheet watches it.
  expandNonce: number;
  // Bumped by the iOS Clips form-sheet's "New clip": the sheet is a separate
  // ROUTE there, so it can't call into PlayerSheet's local framing state — the
  // player watches this nonce instead (same idiom as expandNonce).
  clipFramingNonce: number;
  rate: number;
  // Keep the original pitch while the rate changes (time-stretch). Off =
  // vinyl-style: slower also means deeper.
  keepPitch: boolean;
  // Live transport, mirrored from the <Audio> element.
  position: number;
  duration: number;
  playing: boolean;
  // A clip being replayed: playback auto-pauses at `endS`. Cleared by a manual
  // scrub, a track change, or the clip running out. Keyed by the clip id so
  // the clips list can highlight the active row.
  activeClip: { clipId: string; startS: number; endS: number } | null;
  // Mirror of the PlayerSheet's expanded state, so screens' own Android-back
  // handlers can yield to the sheet's collapse handler.
  sheetExpanded: boolean;
  setSheetExpanded: (sheetExpanded: boolean) => void;

  playSound: (sound: Sound, queue: Sound[]) => void;
  requestExpand: () => void;
  requestClipFraming: () => void;
  /** Jump-play a saved range of the CURRENT sound. */
  playClip: (clipId: string, startMs: number, endMs: number) => void;
  clearActiveClip: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  setKeepPitch: (keepPitch: boolean) => void;
  /** A sound was deleted: drop it from the queue, and if it's loaded, stop. */
  soundDeleted: (soundId: string) => void;
  /** Stop and forget everything (sign-out, account wipe). */
  reset: () => void;

  // --- Fed by the <AudioEngine> --------------------------------------------
  onPosition: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  onEnded: () => void;
};

// A freshly loaded stream always starts at 0, but the OUTGOING <Audio> can
// emit one last position before it unmounts. Below this, a reported time
// counts as "the new stream has actually started".
const START_EPSILON_S = 1;

/**
 * RESTART THE SOUND THAT IS ALREADY LOADED — a seek, not a reload.
 *
 * This is what "previous" does when you are deep into a track, and what a
 * one-sound queue does in either direction. It used to bump `loadNonce`, which
 * tears the `<Audio>` element down and mounts a fresh one — and a fresh remote
 * element is not free: react-native-audio-api probes the URL for byte-range
 * support (a HEAD, or a Range GET where HEAD is blocked) before it can stream,
 * then opens a new connection and rebuilds the EQ graph from scratch. For a
 * track whose bytes are already flowing, all of that buys nothing.
 *
 * A remount is still the right answer for an ENDED element — a plain `play()`
 * on one does nothing, which is the whole reason `loadNonce` exists. This is
 * the other case: the element is alive, so the playhead just moves.
 */
const restartLoaded = (set: (partial: Partial<PlayerState>) => void): void => {
  audioEngine.seek(0);
  audioEngine.play();
  // `pendingStart` for the same reason a reload sets it: a position report can
  // already be in flight from before the seek, and letting it land would put
  // the playhead back where the restart just moved it away from.
  set({ activeClip: null, pendingStart: true, position: 0, playing: true });
};

// The fresh-transport reset a (re)load shares.
const loadReset = (nonce: number) => ({
  activeClip: null,
  position: 0,
  duration: 0,
  loadNonce: nonce + 1,
  pendingStart: true,
});

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  current: null,
  queue: [],
  loadNonce: 0,
  pendingStart: false,
  expandNonce: 0,
  clipFramingNonce: 0,
  rate: 1,
  keepPitch: true,
  position: 0,
  duration: 0,
  playing: false,
  activeClip: null,
  sheetExpanded: false,
  setSheetExpanded: sheetExpanded => set({ sheetExpanded }),

  // Selecting a sound always (re)loads and plays it from the start — the
  // <AudioEngine> plays on load because `playing` is true.
  playSound: (sound, queue) =>
    set(state => ({
      current: sound,
      queue,
      playing: true,
      ...loadReset(state.loadNonce),
    })),

  requestExpand: () => set(state => ({ expandNonce: state.expandNonce + 1 })),

  requestClipFraming: () =>
    set(state => ({ clipFramingNonce: state.clipFramingNonce + 1 })),

  playClip: (clipId, startMs, endMs) => {
    if (!get().current) return;

    set({
      activeClip: { clipId, startS: startMs / 1000, endS: endMs / 1000 },
      playing: true,
    });
    audioEngine.seek(startMs / 1000);
    audioEngine.play();
  },

  clearActiveClip: () => {
    if (get().activeClip) set({ activeClip: null });
  },

  // Pause/resume the loaded sound in place (no reload).
  toggle: () => {
    if (!get().current) return;

    if (get().playing) {
      audioEngine.pause();
      set({ playing: false });
    } else {
      audioEngine.play();
      set({ playing: true });
    }
  },

  // Skipping WRAPS: past the last sound comes the first, and back from the
  // first comes the last. Reaching the end by playing through does not — see
  // `onEnded`.
  next: () => {
    const { current, queue } = get();
    if (!current) return;

    const index = queue.findIndex(sound => sound.id === current.id);
    const nextSound =
      queue.length > 0 ? queue[(index + 1) % queue.length] : undefined;

    if (!nextSound) return;

    set(state => ({
      current: nextSound,
      playing: true,
      ...loadReset(state.loadNonce),
    }));
  },

  previous: () => {
    const { current, queue, position } = get();
    if (!current) return;

    // Deep into a sound, "previous" restarts it — the universal player idiom.
    if (position > RESTART_THRESHOLD_S) {
      restartLoaded(set);
      return;
    }

    const index = queue.findIndex(sound => sound.id === current.id);
    const previousSound =
      queue.length > 0
        ? queue[(index - 1 + queue.length) % queue.length]
        : undefined;

    if (!previousSound) {
      restartLoaded(set);
      return;
    }

    set(state => ({
      current: previousSound,
      playing: true,
      ...loadReset(state.loadNonce),
    }));
  },

  seek: seconds => {
    audioEngine.seek(seconds);
    // A manual scrub ends any clip replay.
    set({ position: seconds, activeClip: null });
  },

  setRate: rate => set({ rate }),

  setKeepPitch: keepPitch => set({ keepPitch }),

  soundDeleted: soundId => {
    const { current, queue } = get();
    const nextQueue = queue.filter(sound => sound.id !== soundId);

    // A queued-but-not-loaded sound vanished: just keep the queue honest.
    if (current?.id !== soundId) {
      set({ queue: nextQueue });
      return;
    }

    // The loaded sound was deleted — stop playback and clear the player so the
    // banner disappears (a deleted sound must not stay playable).
    audioEngine.pause();
    set(state => ({
      queue: nextQueue,
      current: null,
      playing: false,
      activeClip: null,
      position: 0,
      duration: 0,
      loadNonce: state.loadNonce + 1,
    }));
  },

  reset: () => {
    audioEngine.pause();
    set({
      current: null,
      queue: [],
      rate: 1,
      keepPitch: true,
      position: 0,
      duration: 0,
      playing: false,
      activeClip: null,
    });
  },

  // --- Fed by the <AudioEngine> --------------------------------------------
  onPosition: seconds => {
    // Drop the outgoing stream's parting reading: it would undo the reset and
    // make the transport think we are still deep into the previous sound —
    // which turned "previous, previous" into two restarts instead of a step
    // back a track.
    if (get().pendingStart) {
      if (seconds > START_EPSILON_S) return;
      set({ pendingStart: false });
    }

    set({ position: seconds });

    // End an active clip replay: pause at its boundary and park back on the
    // clip start so a plain play replays it.
    const clip = get().activeClip;
    if (clip && get().playing && seconds >= clip.endS) {
      audioEngine.pause();
      audioEngine.seek(clip.startS);
      set({ activeClip: null, playing: false, position: clip.startS });
    }
  },

  setDuration: seconds => {
    if (seconds > 0 && seconds !== get().duration) set({ duration: seconds });
  },

  setPlaying: playing => {
    if (playing !== get().playing) set({ playing });
  },

  // Playing THROUGH the last sound parks it paused rather than looping the
  // library forever; only an explicit skip wraps.
  onEnded: () => {
    const { current, queue } = get();
    if (!current) return;

    const index = queue.findIndex(sound => sound.id === current.id);
    const isLast = index === -1 || index === queue.length - 1;

    if (isLast) {
      audioEngine.pause();
      set(state => ({ playing: false, ...loadReset(state.loadNonce) }));
      return;
    }

    get().next();
  },
}));
