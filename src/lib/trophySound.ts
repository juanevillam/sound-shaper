import { type AudioBuffer } from 'react-native-audio-api';

import { audioEngine } from '@/lib/audioEngine';
import { usePlayerStore } from '@/store/player';

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
 */
type Variant = 'normal' | 'platinum';

const SOURCES: Record<Variant, number> = {
  normal: require('../../assets/sounds/trophy.mp3'),
  platinum: require('../../assets/sounds/trophy-platinum.mp3'),
};
const VOLUME: Record<Variant, number> = { normal: 0.7, platinum: 0.9 };

// Long enough for the song's own pause to land before the chime starts, and
// a beat of silence after it before the song comes back.
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Play an unlock chime, pausing the song around it. Fire-and-forget: any
 * failure leaves the unlock silent (the haptic still lands) and the song as
 * it was.
 */
export const playTrophySound = async (variant: Variant): Promise<void> => {
  const player = usePlayerStore.getState();
  // Only a song that is actually playing is paused — and only THAT song,
  // still paused, is resumed: anything the person does meanwhile wins.
  const pausedId = player.current && player.playing ? player.current.id : null;

  try {
    const buffer = await bufferFor(variant);
    const ctx = audioEngine.getContext();

    if (pausedId) {
      player.pause();
      await wait(LEAD_IN_MS);
    }

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
    await wait(TAIL_MS);
  } catch {
    // Silent unlock; fall through to put the song back.
  }

  if (!pausedId) return;

  const now = usePlayerStore.getState();
  if (now.current?.id === pausedId && !now.playing) now.toggle();
};
