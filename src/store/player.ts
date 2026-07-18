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
  playSong: (song: Song, queue: Song[], playlistId: string) => void;
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

  playSong: (song, queue, playlistId) => {
    const { current, rate, keepPitch } = get();

    // Tapping the already-loaded song toggles instead of restarting it.
    if (current?.id === song.id) {
      get().toggle();
      // The queue may still have changed (reorder, added songs).
      set({ queue, playlistId });
      return;
    }

    set({ current: song, queue, playlistId });
    audioPlayer.replace({ uri: song.audioUrl });
    // Rate/pitch are per-listener settings, not per-song — they persist
    // across track changes, so re-apply them to the fresh source.
    audioPlayer.shouldCorrectPitch = keepPitch;
    audioPlayer.setPlaybackRate(rate);
    audioPlayer.play();
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
      set({ current: nextSong });
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

    set({ current: previousSong });
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
    audioPlayer.pause();
    audioPlayer.replace(null);
    set({
      current: null,
      queue: [],
      playlistId: null,
      rate: 1,
      keepPitch: true,
    });
  },
}));

// Auto-advance: when a song runs out, move to the next in its queue. Lives
// here (not lib/player) so the store→lib import stays one-directional.
audioPlayer.addListener('playbackStatusUpdate', status => {
  if (status.didJustFinish) usePlayerStore.getState().next();
});
