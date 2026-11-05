import { audioEngine } from '@app/lib/audioEngine';
import { synthFx, type FxName } from '@app/lib/autoDj/fx';

/**
 * AUTO DJ'S SOUNDS, PLAYED — the app's `lib/djFx.ts` on the browser's own
 * Web Audio. The sounds themselves are the app's (`lib/autoDj/fx.ts`, pure,
 * imported); only the playing differs, because the browser names the end
 * event `onended` where react-native-audio-api names it `onEnded`.
 *
 * Each is a buffer source wired straight to the destination, BESIDE the
 * music's chain, so an impact rings on across a cut while the music's graph
 * is torn down and rebuilt under it.
 */

/** Takes of each sound, made once per session and reused. */
const TAKES = 3;
const cache = new Map<string, AudioBuffer>();
const live = new Set<AudioBufferSourceNode>();

const bufferFor = (name: FxName, lengthS?: number): AudioBuffer => {
  const ctx = audioEngine.getContext();
  const take = Math.floor(Math.random() * TAKES);
  const key = `${name}:${take}:${lengthS?.toFixed(2) ?? ''}:${ctx.sampleRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sound = synthFx(name, ctx.sampleRate, take + 1, lengthS);
  const buffer = ctx.createBuffer(2, sound.left.length, ctx.sampleRate);
  buffer.copyToChannel(sound.left, 0);
  buffer.copyToChannel(sound.right, 1);
  cache.set(key, buffer);
  // A riser's length follows the music's tempo, so keep the cache small.
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return buffer;
};

export const djFx = {
  /**
   * Play `name` so its cue point lands `cutInS` seconds from now: a riser
   * ENDS there, an impact STARTS there. Late is played from where it would
   * have been, never shifted.
   */
  play(name: FxName, cutInS: number, lengthS?: number): void {
    try {
      const ctx = audioEngine.getContext();
      const buffer = bufferFor(name, lengthS);
      const align =
        name === 'riser' || name === 'reverseCymbal' ? buffer.duration : 0;
      const startIn = cutInS - align;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        live.delete(source);
        source.disconnect();
      };
      if (startIn >= 0) source.start(ctx.currentTime + startIn);
      else if (-startIn < buffer.duration)
        source.start(ctx.currentTime, -startIn);
      else return;
      live.add(source);
    } catch {
      // A missing flourish is never worth an error in the music.
    }
  },

  /** Silence everything in flight — a pause, a scrub, Auto DJ switched off. */
  stopAll(): void {
    for (const source of live) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already finished.
      }
    }
    live.clear();
  },
};
