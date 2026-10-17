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
  rate: number;
  /**
   * Keep the original pitch while the rate changes (time-stretch). Off =
   * vinyl-style: slower also means deeper.
   *
   * IT DEFAULTS TO ON, the way every Apple speed control works (Podcasts,
   * Music, Voice Memos): a constant key is what changing the speed is expected
   * to sound like, and turning pitch preservation OFF is the deliberate
   * varispeed choice. The three engine paths are `chooseFillMode()` in
   * react-native-audio-api's `AudioFileSourceNode`: on at 1× is a PASSTHROUGH
   * (nothing is processed), off is a RESAMPLE (varispeed), and on at any other
   * rate is the time-stretcher.
   *
   * The default was OFF from 2026-08-21 to 2026-08-22 because the library's
   * stretcher was its own WSOLA, voice-grade, and on music every grain splice
   * was audible ("rocky, as in stones"). `patches/react-native-audio-api/`
   * replaces that stretcher with a phase vocoder (Signalsmith Stretch), which
   * is what made this default supportable — if that patch is ever retired
   * without an upstream fix, this default goes back with it.
   *
   * Flipping the switch AUTOMATICALLY at rate ≠ 1 was proposed while the
   * stretcher was broken and stays rejected
   * (`docs/rejected-experiments.md`): it turns the setting off exactly where
   * it is the only thing that does anything, a shape would store a choice
   * nobody made, and the way back is ambiguous.
   */
  keepPitch: boolean;
  // Live transport, mirrored from the <Audio> element.
  position: number;
  duration: number;
  playing: boolean;
  /**
   * Bumped whenever the playhead JUMPS rather than ticks — a scrub, a clip
   * start, a boundary park, a restart. The Now Playing bridge keys its
   * elapsed-time pushes off this, because iOS interpolates the lock-screen
   * playhead itself from one (elapsedTime, rate) pair: the 10Hz position
   * tick must never re-publish the info dictionary, only discontinuities.
   */
  seekNonce: number;
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
  /** Jump-play a saved range of the CURRENT sound. */
  playClip: (clipId: string, startMs: number, endMs: number) => void;
  /** Follow a live end-cap edit while the editor's preview is sounding. */
  retargetClipEnd: (endS: number) => void;
  toggle: () => void;
  /** Stop playback in place, idempotent — entering clip framing uses it. */
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  setKeepPitch: (keepPitch: boolean) => void;
  /** A sound was deleted: drop it from the queue, and if it's loaded, stop. */
  soundDeleted: (soundId: string) => void;
  /** Re-point the loaded sound and the queue at a fresh library snapshot. */
  syncLibrary: (sounds: Sound[]) => void;
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
const restartLoaded = (
  set: (partial: Partial<PlayerState>) => void,
  positionNowS: number,
): void => {
  // The no-op-seek trap `playClip` documents: parked AT zero (a fresh load,
  // or a clip whose start is 0 parked by its boundary), an unguarded seek(0)
  // leaves `pendingOffloadedSeeks` standing and the play() below starts
  // nothing.
  if (positionNowS > 0.05) audioEngine.seek(0);
  audioEngine.play();
  // `pendingStart` for the same reason a reload sets it: a position report can
  // already be in flight from before the seek, and letting it land would put
  // the playhead back where the restart just moved it away from.
  set({
    activeClip: null,
    pendingStart: true,
    position: 0,
    playing: true,
    seekNonce: nextSeekNonce(),
  });
};

/**
 * Field-wise, because Firestore hands back NEW objects on every snapshot. A
 * reference check would call every snapshot a change and re-render the whole
 * player each time anything anywhere in the library moved.
 */
const sameSound = (a: Sound, b: Sound): boolean =>
  a.id === b.id &&
  a.album === b.album &&
  a.artist === b.artist &&
  a.artPublicId === b.artPublicId &&
  a.artUrl === b.artUrl &&
  a.audioPublicId === b.audioPublicId &&
  a.audioUrl === b.audioUrl &&
  a.createdAt === b.createdAt &&
  a.durationMs === b.durationMs &&
  a.name === b.name &&
  a.releaseYear === b.releaseYear &&
  a.updatedAt === b.updatedAt;

/**
 * See `seekNonce` — every discontinuous playhead move stamps a fresh value.
 * A module counter rather than `state.seekNonce + 1` so `restartLoaded`,
 * which only receives the partial `set`, can stamp one too.
 */
let seekNonceCounter = 0;
const nextSeekNonce = () => ++seekNonceCounter;

// The fresh-transport reset a (re)load shares. Duration SEEDS from the
// sound's banked value (see `Sound.durationMs`) instead of zeroing — the
// engine's own report still lands over it and wins — so skipping between
// known sounds never flashes the scrubber's `-:--` placeholder.
const loadReset = (nonce: number, sound?: Sound | null) => ({
  activeClip: null,
  position: 0,
  duration: sound?.durationMs ? sound.durationMs / 1000 : 0,
  loadNonce: nonce + 1,
  pendingStart: true,
});

/**
 * THE TEARDOWN A VANISHED SOUND GETS, WHOEVER NOTICED IT GO.
 *
 * It was inline in `soundDeleted` while a tap in this app's own editor was the
 * only way a sound could disappear. It is shared now because there is a SECOND
 * road: the library listener, carrying a delete made on another device signed
 * into the same account. Both have to end in the same place — playback
 * stopped, the banner gone, the queue honest — or the two roads drift.
 */
const clearedForMissing = (
  state: PlayerState,
  queue: Sound[],
): Partial<PlayerState> => ({
  queue,
  current: null,
  playing: false,
  activeClip: null,
  position: 0,
  duration: 0,
  loadNonce: state.loadNonce + 1,
});

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  current: null,
  queue: [],
  loadNonce: 0,
  pendingStart: false,
  expandNonce: 0,
  rate: 1,
  keepPitch: true,
  position: 0,
  duration: 0,
  playing: false,
  seekNonce: 0,
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
      ...loadReset(state.loadNonce, sound),
    })),

  requestExpand: () => set(state => ({ expandNonce: state.expandNonce + 1 })),

  playClip: (clipId, startMs, endMs) => {
    if (!get().current) return;

    const startS = startMs / 1000;
    /**
     * READ BEFORE THE OPTIMISTIC WRITE. The no-op-seek guard below compares
     * against where the ENGINE's playhead is, and the store's last engine
     * report is the best statement of that — but the optimistic `set` under
     * this line overwrites it with `startS` itself, so a guard that reads
     * `get().position` AFTER the set compares `startS` to `startS` and never
     * seeks at all. That shipped: play a clip, pause, scrub away, play the
     * clip again — it lit up as selected while the engine kept playing from
     * the scrub position (Juan, on device, 2026-08-26).
     */
    const enginePositionS = get().position;
    set({
      activeClip: { clipId, startS, endS: endMs / 1000 },
      playing: true,
      // Optimistic: the engine reports the sought position ~100ms later, and
      // both the scrubber and the Now Playing bridge want the jump now.
      position: startS,
      seekNonce: nextSeekNonce(),
    });
    /**
     * NEVER SEEK TO WHERE THE PLAYHEAD ALREADY IS. A no-op seek is not a
     * no-op in the engine: `seekToTime` increments the decoder's
     * `pendingOffloadedSeeks` and the render path outputs silence until the
     * daemon resolves it — and a seek to the position it is already at can
     * leave that count standing, so the following `play()` starts nothing
     * and playback dies silently. Found in the clip editor (2026-08-26):
     * every press whose start WAS the playhead — resuming a parked preview,
     * pressing play right after entering — did exactly nothing, while the
     * same press after moving the playhead worked. This is also the shape of
     * the on-device "press play and the clip doesn't react" reports.
     */
    if (Math.abs(enginePositionS - startS) > 0.05) audioEngine.seek(startS);
    audioEngine.play();
  },

  /**
   * A LIVE EDIT OF THE END CAP MOVES A SOUNDING PREVIEW'S STOP. The boundary
   * is armed with the range at the moment play was pressed, so dragging the
   * cap outward while listening still stopped at the stale edge — the one
   * moment the person is demonstrably watching that edge. Dragging it back
   * past the playhead makes the boundary fire on the next tick, which is
   * also right: the selection no longer contains the playhead. Preview only:
   * a SAVED clip's replay means the stored range, not the trimmer's.
   */
  retargetClipEnd: endS => {
    const clip = get().activeClip;
    if (clip?.clipId === 'preview') set({ activeClip: { ...clip, endS } });
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

  /**
   * ENTERING CLIP FRAMING USES THIS. Framing starts quiet: the song stops on
   * the way in — which is what Photos and Voice Memos do when you open their
   * trimmer, and what keeps the transport's glyph honest (a play glyph over
   * audible sound is a lie, and the alternative — leaving the song running —
   * made the first press pause the SONG instead of previewing the clip).
   * Sound DURING framing is then the person's own doing: the preview, or
   * plain playback scrubbed to and started by hand now that the scrubber
   * stays live in the mode.
   */
  pause: () => {
    if (!get().playing) return;
    audioEngine.pause();
    set({ playing: false });
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
      ...loadReset(state.loadNonce, nextSound),
    }));
  },

  previous: () => {
    const { current, queue, position } = get();
    if (!current) return;

    // Deep into a sound, "previous" restarts it — the universal player idiom.
    if (position > RESTART_THRESHOLD_S) {
      restartLoaded(set, position);
      return;
    }

    const index = queue.findIndex(sound => sound.id === current.id);
    const previousSound =
      queue.length > 0
        ? queue[(index - 1 + queue.length) % queue.length]
        : undefined;

    if (!previousSound) {
      restartLoaded(set, position);
      return;
    }

    set(state => ({
      current: previousSound,
      playing: true,
      ...loadReset(state.loadNonce, previousSound),
    }));
  },

  seek: seconds => {
    // Same no-op-seek trap `playClip` documents. This one is reachable from
    // a scrub released on the second it started on, and from a ±15 skip
    // already clamped at either edge — paused, each left the engine's
    // pending-seek count standing and the next play started nothing.
    if (Math.abs(get().position - seconds) > 0.05) audioEngine.seek(seconds);
    // A manual scrub ends any clip replay.
    set({ position: seconds, activeClip: null, seekNonce: nextSeekNonce() });
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
    set(state => clearedForMissing(state, nextQueue));
  },

  /**
   * THIS STORE HOLDS A COPY OF THE DOCUMENTS, AND SOMETHING HAS TO REFRESH IT.
   *
   * `current` and `queue` are snapshots taken at `playSound`, so they froze the
   * moment playback started. Deletion was the only library change anyone had
   * wired up (`soundDeleted`); an EDIT reached nothing. Rename the playing
   * sound or change its cover and the banner kept the old ones until it was
   * re-picked — which on home meant the grid tile and the banner directly over
   * it naming the same sound differently.
   *
   * The banked duration was the same bug wearing a second hat: `AudioEngine`
   * decides whether to write `durationMs` by reading `current.durationMs`, and
   * a frozen copy never learns that the write landed, so skipping away and
   * back re-wrote it on every load. `bankSoundDuration` says "once"; this is
   * what makes that true.
   *
   * A SOUND MISSING FROM THE SNAPSHOT IS A DELETION, AND IT USED TO BE
   * IGNORED HERE.
   *
   * This block used to `return` on a missing sound, on the reading that
   * tearing playback down was `soundDeleted`'s job. That was true of the only
   * deletion anyone had wired — a tap in this app's own editor — and it left
   * the other one with no road at all: delete a sound from a SECOND device on
   * the same account and the snapshot is the only thing that ever says so.
   *
   * Measured on a Galaxy A54 against a throwaway document deleted from an iOS
   * client (2026-09-11): the grid dropped the tile, and the player carried on
   * from a `404` — transport live, Shape/Clips/Edit live, audio still
   * streaming, because the Cloudinary asset outlives the document (the known
   * orphan gap). The queue kept it too, so seven `next` presses wrapped the
   * library and landed back on the deleted sound.
   *
   * There is no snapshot that legitimately omits a sound that still exists —
   * the listener carries the WHOLE collection with no limit — so a removal
   * here is the real thing.
   */
  syncLibrary: sounds => {
    const { current, queue } = get();
    if (!current) return;

    const bySoundId = new Map(sounds.map(sound => [sound.id, sound]));

    // The queue drops what the library no longer holds and refreshes the rest,
    // rather than keeping a stale copy with `?? queued` — that fallback is
    // what let a deleted sound stay reachable by skipping.
    const nextQueue = queue.flatMap(queued => {
      const fresh = bySoundId.get(queued.id);
      return fresh ? [fresh] : [];
    });

    const freshCurrent = bySoundId.get(current.id);

    if (!freshCurrent) {
      audioEngine.pause();
      set(state => clearedForMissing(state, nextQueue));
      return;
    }

    const changed =
      !sameSound(current, freshCurrent) ||
      // Length first: once the queue has shrunk the index-wise compare below
      // is lining up different sounds.
      nextQueue.length !== queue.length ||
      nextQueue.some((sound, index) => !sameSound(sound, queue[index]));

    if (!changed) return;

    set({ current: freshCurrent, queue: nextQueue });
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
      set({
        activeClip: null,
        playing: false,
        position: clip.startS,
        seekNonce: nextSeekNonce(),
      });
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
      set(state => ({
        playing: false,
        ...loadReset(state.loadNonce, current),
      }));
      return;
    }

    get().next();
  },
}));
