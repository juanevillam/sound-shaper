import { create } from 'zustand';

import { audioPlayer } from '@/lib/player';
import { type Song } from '@/services/firebase/songs';

// Restart-vs-previous threshold: past this many seconds into a song, the
// "previous" control restarts it instead (the universal music-app idiom).
const RESTART_THRESHOLD_S = 3;

// Global playback state: WHAT is playing (song + its playlist queue) and the
// user's sound-shaping choices (rate, pitch retention). The live transport
// state (position/duration/playing) is NOT mirrored here — components read it
// straight off the shared player with `useAudioPlayerStatus(audioPlayer)`.
type PlayerState = {
  current: Song | null;
  queue: Song[];
  playlistId: string | null;
  rate: number;
  // Keep the original pitch while the rate changes (time-stretch). Off =
  // vinyl-style: slower also means deeper.
  keepPitch: boolean;
  // A clip being replayed: playback auto-pauses at `endS`. Cleared by a manual
  // scrub, a track change, or the clip running out. Keyed by the clip id so
  // the clips list can highlight the active row.
  activeClip: { clipId: string; startS: number; endS: number } | null;
  // Mirror of the PlayerSheet's expanded state, so screens' own Android-back
  // handlers can yield to the sheet's collapse handler.
  sheetExpanded: boolean;
  setSheetExpanded: (sheetExpanded: boolean) => void;
  playSong: (song: Song, queue: Song[], playlistId: string) => void;
  /** Jump-play a saved range of the CURRENT song. */
  playClip: (clipId: string, startMs: number, endMs: number) => void;
  clearActiveClip: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  setRate: (rate: number) => void;
  setKeepPitch: (keepPitch: boolean) => void;
  /** Stop and forget everything (sign-out, account wipe). */
  reset: () => void;
};

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  current: null,
  queue: [],
  playlistId: null,
  rate: 1,
  keepPitch: true,
  activeClip: null,
  sheetExpanded: false,
  setSheetExpanded: sheetExpanded => set({ sheetExpanded }),

  playSong: (song, queue, playlistId) => {
    const { current, rate, keepPitch } = get();

    // Tapping the already-loaded song toggles instead of restarting it.
    if (current?.id === song.id) {
      get().toggle();
      // The queue may still have changed (reorder, added songs).
      set({ queue, playlistId });
      return;
    }

    set({ current: song, queue, playlistId, activeClip: null });
    audioPlayer.replace({ uri: song.audioUrl });
    // Rate/pitch are per-listener settings, not per-song — they persist
    // across track changes, so re-apply them to the fresh source.
    audioPlayer.shouldCorrectPitch = keepPitch;
    audioPlayer.setPlaybackRate(rate);
    audioPlayer.play();
  },

  playClip: (clipId, startMs, endMs) => {
    if (!get().current) return;

    set({
      activeClip: { clipId, startS: startMs / 1000, endS: endMs / 1000 },
    });
    audioPlayer.seekTo(startMs / 1000);
    audioPlayer.play();
  },

  clearActiveClip: () => {
    if (get().activeClip) set({ activeClip: null });
  },

  toggle: () => {
    if (!get().current) return;

    if (audioPlayer.playing) audioPlayer.pause();
    else audioPlayer.play();
  },

  next: () => {
    const { current, queue, playlistId } = get();
    if (!current || !playlistId) return;

    const index = queue.findIndex(song => song.id === current.id);
    const nextSong = index >= 0 ? queue[index + 1] : undefined;

    if (nextSong) {
      // Bypass the same-song toggle: always a fresh load.
      set({ current: nextSong, activeClip: null });
      audioPlayer.replace({ uri: nextSong.audioUrl });
      audioPlayer.shouldCorrectPitch = get().keepPitch;
      audioPlayer.setPlaybackRate(get().rate);
      audioPlayer.play();
    } else {
      // End of the playlist: stop, parked at the start of the last song.
      audioPlayer.pause();
      audioPlayer.seekTo(0);
    }
  },

  previous: () => {
    const { current, queue } = get();
    if (!current) return;

    // Deep into a song, "previous" restarts it.
    if (audioPlayer.currentTime > RESTART_THRESHOLD_S) {
      audioPlayer.seekTo(0);
      return;
    }

    const index = queue.findIndex(song => song.id === current.id);
    const previousSong = index > 0 ? queue[index - 1] : undefined;

    if (!previousSong) {
      audioPlayer.seekTo(0);
      return;
    }

    set({ current: previousSong, activeClip: null });
    audioPlayer.replace({ uri: previousSong.audioUrl });
    audioPlayer.shouldCorrectPitch = get().keepPitch;
    audioPlayer.setPlaybackRate(get().rate);
    audioPlayer.play();
  },

  setRate: rate => {
    set({ rate });
    audioPlayer.setPlaybackRate(rate);
  },

  setKeepPitch: keepPitch => {
    set({ keepPitch });
    audioPlayer.shouldCorrectPitch = keepPitch;
    // Re-assert the rate so the pitch mode change takes effect immediately.
    audioPlayer.setPlaybackRate(get().rate);
  },

  reset: () => {
    // Pause + rewind, but DON'T `replace(null)`: the native module rejects a
    // null source at runtime (crashed sign-out). Clearing `current` already
    // hides every player surface, and the next playSong replaces the source.
    audioPlayer.pause();
    audioPlayer.seekTo(0);
    set({
      current: null,
      queue: [],
      playlistId: null,
      rate: 1,
      keepPitch: true,
      activeClip: null,
    });
  },
}));

// Transport watcher (lives here, not lib/player, so the store→lib import
// stays one-directional):
// - auto-advance when a song runs out;
// - end an active clip replay: pause at its boundary (the 250ms status
//   cadence overshoots by at most a beat) and park back on the clip start so
//   a plain play replays it.
audioPlayer.addListener('playbackStatusUpdate', status => {
  const store = usePlayerStore.getState();

  if (status.didJustFinish) {
    store.next();
    return;
  }

  const clip = store.activeClip;
  if (clip && status.playing && status.currentTime >= clip.endS) {
    audioPlayer.pause();
    audioPlayer.seekTo(clip.startS);
    store.clearActiveClip();
  }
});
