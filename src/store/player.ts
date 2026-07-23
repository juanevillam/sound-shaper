import { create } from 'zustand';

import { audioEngine } from '@/lib/audioEngine';
import { type Song } from '@/services/firebase/songs';

// Restart-vs-previous threshold: past this many seconds into a song, the
// "previous" control restarts it instead (the universal music-app idiom).
const RESTART_THRESHOLD_S = 3;

// Global playback state. WHAT is playing (song + its playlist queue), the
// user's shaping choices (rate, pitch), and the live transport (position /
// duration / playing) — the last three are fed in by the <AudioEngine> from
// the streaming <Audio> element; every control goes back out through these
// actions, which drive the shared audio graph.
//
// `loadNonce` is bumped whenever a track should (re)load — the <AudioEngine>
// keys its <Audio> on `${song.id}#${loadNonce}`, so a bump remounts the
// element. This is how a finished song replays: a plain play() on an ended
// <Audio> does nothing, but a remount streams it fresh.
type PlayerState = {
  current: Song | null;
  queue: Song[];
  loadNonce: number;
  // Bumped when a surface wants the full player OPENED (tapping a song tile
  // plays it and expands the sheet, YT-Music style). The PlayerSheet watches it.
  expandNonce: number;
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

  playSong: (song: Song, queue: Song[]) => void;
  requestExpand: () => void;
  /** Jump-play a saved range of the CURRENT song. */
  playClip: (clipId: string, startMs: number, endMs: number) => void;
  clearActiveClip: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  setKeepPitch: (keepPitch: boolean) => void;
  /** A song was deleted: drop it from the queue, and if it's loaded, stop. */
  songDeleted: (songId: string) => void;
  /** Stop and forget everything (sign-out, account wipe). */
  reset: () => void;

  // --- Fed by the <AudioEngine> --------------------------------------------
  onPosition: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  onEnded: () => void;
};

// The fresh-transport reset a (re)load shares.
const loadReset = (nonce: number) => ({
  activeClip: null,
  position: 0,
  duration: 0,
  loadNonce: nonce + 1,
});

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  current: null,
  queue: [],
  loadNonce: 0,
  expandNonce: 0,
  rate: 1,
  keepPitch: true,
  position: 0,
  duration: 0,
  playing: false,
  activeClip: null,
  sheetExpanded: false,
  setSheetExpanded: sheetExpanded => set({ sheetExpanded }),

  // Selecting a song always (re)loads and plays it from the start — the
  // <AudioEngine> plays on load because `playing` is true.
  playSong: (song, queue) =>
    set(state => ({
      current: song,
      queue,
      playing: true,
      ...loadReset(state.loadNonce),
    })),

  requestExpand: () => set(state => ({ expandNonce: state.expandNonce + 1 })),

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

  // Pause/resume the loaded song in place (no reload).
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

  next: () => {
    const { current, queue } = get();
    if (!current) return;

    const index = queue.findIndex(song => song.id === current.id);
    const nextSong = index >= 0 ? queue[index + 1] : undefined;

    if (nextSong) {
      set(state => ({
        current: nextSong,
        playing: true,
        ...loadReset(state.loadNonce),
      }));
    } else {
      // End of the playlist: reload the last track parked + paused, so the
      // play button can replay it.
      audioEngine.pause();
      set(state => ({ playing: false, ...loadReset(state.loadNonce) }));
    }
  },

  previous: () => {
    const { current, queue, position } = get();
    if (!current) return;

    const index = queue.findIndex(song => song.id === current.id);
    const previousSong = index > 0 ? queue[index - 1] : undefined;

    // Deep into a song (or no earlier track) → restart the current one.
    if (position > RESTART_THRESHOLD_S || !previousSong) {
      set(state => ({ playing: true, ...loadReset(state.loadNonce) }));
      return;
    }

    set(state => ({
      current: previousSong,
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

  songDeleted: songId => {
    const { current, queue } = get();
    const nextQueue = queue.filter(song => song.id !== songId);

    // A queued-but-not-loaded song vanished: just keep the queue honest.
    if (current?.id !== songId) {
      set({ queue: nextQueue });
      return;
    }

    // The loaded song was deleted — stop playback and clear the player so the
    // banner disappears (a deleted song must not stay playable).
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

  onEnded: () => get().next(),
}));
