import { isOtherAudioPlaying } from '@modules/audio-session';
import { type AudioBuffer } from 'react-native-audio-api';

import { audioEngine } from '@/lib/audioEngine';
import { usePlayerStore } from '@/store/player';
import { useTrophyStore } from '@/trophies';

/**
 * THE TROPHY UNLOCK SOUND — and the song steps aside for it (Juan,
 * 2026-10-16). This app shipped silent trophies on purpose, a haptic only,
 * because a jingle over what someone is listening to is the one place a
 * trophy must not intrude. Juan wanted the unlock HEARD, so the song pauses,
 * the chime plays, and the song picks up where it was.
 *
 * IT PLAYS THROUGH THE ENGINE'S OWN AudioContext, never expo-audio. Topper's
 * chime (`apps/topper/src/lib/trophySound.ts`) switches the session to
 * `.ambient` so it can mix over other apps' music; here that would pull the
 * session out of the `playback` category the player lives on — background
 * audio, the Lock Screen player — so the chime shares the player's session
 * instead. Same two files as Topper's, one family of sounds.
 *
 * IT SOUNDS UNLESS ANOTHER APP IS PLAYING (Juan, 2026-10-16). With nothing
 * playing, the chime plays. With one of our songs playing, the song steps
 * aside for it. With another app's audio playing — Music, Spotify — it stays
 * silent and the haptic carries the unlock: the `playback` category does not
 * mix, so a chime would stop that app's song for good. iOS answers that
 * question directly (`AVAudioSession.isOtherAudioPlaying`, read through the
 * local `audio-session` module). It first shipped sounding ONLY over our own
 * song, which left the common unlocks — an upload, a saved clip, both made
 * with nothing playing — silent.
 *
 * ONE PAUSE PER RUN OF UNLOCKS. Trophies often land together (a first upload
 * earns several) and the overlay shows them one banner at a time; pausing and
 * resuming around each chime made the song stutter once per banner. The song
 * is held from the first chime to the last and comes back once.
 */
type Variant = 'normal' | 'platinum';

const SOURCES: Record<Variant, number> = {
  normal: require('../../assets/sounds/trophy.mp3'),
  platinum: require('../../assets/sounds/trophy-platinum.mp3'),
};
const VOLUME: Record<Variant, number> = { normal: 0.7, platinum: 0.9 };

// A beat before the first chime, for the song's pause to land, and one after
// the last before the song comes back.
const LEAD_IN_MS = 120;
const TAIL_MS = 250;

const buffers: Partial<Record<Variant, Promise<AudioBuffer>>> = {};

const bufferFor = (variant: Variant): Promise<AudioBuffer> => {
  buffers[variant] ??= audioEngine
    .getContext()
    .decodeAudioData(SOURCES[variant]);
  return buffers[variant];
};

/** Decode both chimes ahead of the first unlock, so it plays on time. */
export const preloadTrophySounds = (): void => {
  bufferFor('normal').catch(() => {});
  bufferFor('platinum').catch(() => {});
};

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

// How long a held song waits for the next queued banner before coming back
// anyway — longer than a platinum banner stays up (5.4s), so it only fires
// when the overlay stops pulling (held by a form sheet) mid-run.
const HOLD_GRACE_MS = 6000;

/** The sound paused for the current run of chimes, if any. */
let heldId: string | null = null;
/** Chimes play one after another, never over each other. */
let chain: Promise<void> = Promise.resolve();
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

const chime = async (variant: Variant): Promise<void> => {
  const buffer = await bufferFor(variant);
  const ctx = audioEngine.getContext();

  await audioEngine.activateSession();
  if (ctx.state === 'suspended') await ctx.resume();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = VOLUME[variant];
  source.connect(gain);
  gain.connect(ctx.destination);

  await new Promise<void>(resolve => {
    source.onEnded = () => resolve();
    source.start();
  });
};

// Put the held song back — only THAT song, still paused: anything the person
// did meanwhile wins.
const release = () => {
  releaseTimer = null;
  const id = heldId;
  heldId = null;
  const now = usePlayerStore.getState();
  if (id && now.current?.id === id && !now.playing) now.toggle();
};

/**
 * Play an unlock chime — over silence, or holding our own song across the
 * whole run of unlocks.
 * Fire-and-forget: any failure leaves that unlock silent (the haptic still
 * lands) and the song comes back as usual.
 */
export const playTrophySound = (variant: Variant): void => {
  const player = usePlayerStore.getState();

  // The person resumed between two banners: the run is theirs now.
  if (heldId && player.playing) heldId = null;

  if (!heldId) {
    if (player.current && player.playing) {
      heldId = player.current.id;
      player.pause();
      // Long enough for the song's own pause to land before the chime starts.
      chain = wait(LEAD_IN_MS);
    } else if (isOtherAudioPlaying()) {
      // Someone else's music: taking the session would stop it.
      return;
    }
  }

  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  chain = chain
    .then(() => chime(variant))
    .catch(() => {})
    .then(() => wait(TAIL_MS))
    .then(() => {
      if (!heldId) return;
      // The showing banner is still the queue's head; anything behind it is
      // another chime on its way, so the song stays held for it.
      if (useTrophyStore.getState().queue.length > 1) {
        releaseTimer = setTimeout(release, HOLD_GRACE_MS);
      } else {
        release();
      }
    });
};
