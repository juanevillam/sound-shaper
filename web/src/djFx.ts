import downlifterUrl from '@app/../assets/sounds/dj-downlifter.mp3';
import reverseCymbalUrl from '@app/../assets/sounds/dj-reverse-cymbal.mp3';
import riserUrl from '@app/../assets/sounds/dj-riser.mp3';
import zapUrl from '@app/../assets/sounds/dj-zap.mp3';
import { audioEngine } from '@app/lib/audioEngine';
import { synthFx, type FxName } from '@app/lib/autoDj/fx';

/**
 * AUTO DJ'S SOUNDS, PLAYED — the app's `lib/djFx.ts` on the browser's own
 * Web Audio. Sourced from Kenney's Sci-Fi Sounds pack
 * (https://kenney.nl/assets/sci-fi-sounds, CC0), shaped and layered for DJ
 * transitions (`assets/sounds/dj-*.mp3`), with `lib/autoDj/fx.ts` as the
 * instant synchronous fallback before the first fetch finishes decoding.
 *
 * Each is a buffer source wired straight to the destination, BESIDE the
 * music's chain, so a transition sound rings on across a cut while the
 * music's graph is torn down and rebuilt under it.
 */

const URLS: Record<FxName, string> = {
  riser: riserUrl,
  reverseCymbal: reverseCymbalUrl,
  downlifter: downlifterUrl,
  zap: zapUrl,
};

const sampleBuffers: Partial<Record<FxName, AudioBuffer>> = {};
const decoding: Partial<Record<FxName, Promise<AudioBuffer>>> = {};

const preloadSample = (name: FxName): void => {
  if (sampleBuffers[name] || decoding[name]) return;
  const ctx = audioEngine.getContext();
  const p = fetch(URLS[name])
    .then(res => res.arrayBuffer())
    .then(bytes => ctx.decodeAudioData(bytes))
    .then(buf => {
      sampleBuffers[name] = buf;
      return buf;
    });
  decoding[name] = p;
  p.catch(() => {
    if (decoding[name] === p) delete decoding[name];
  });
};

export const preloadDjFx = (): void => {
  (Object.keys(URLS) as FxName[]).forEach(preloadSample);
};

/** Takes of each fallback sound, made once per session and reused. */
const TAKES = 3;
const cache = new Map<string, AudioBuffer>();
const live = new Set<{ source: AudioBufferSourceNode; level: GainNode }>();

const fallbackBuffer = (name: FxName, lengthS?: number): AudioBuffer => {
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
      preloadDjFx();
      const ctx = audioEngine.getContext();
      const sampled = sampleBuffers[name];
      const buffer = sampled ?? fallbackBuffer(name, lengthS);
      const isBefore = name === 'riser' || name === 'reverseCymbal';
      const rate =
        sampled && isBefore && lengthS && lengthS > 0.15
          ? Math.max(0.5, Math.min(2.2, buffer.duration / lengthS))
          : 1;
      const playDuration = buffer.duration / rate;
      const align = isBefore ? playDuration : 0;
      const startIn = cutInS - align;
      if (-startIn >= playDuration) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (rate !== 1) source.playbackRate.value = rate;
      const level = ctx.createGain();
      level.gain.value = audioEngine.levelLinear();
      source.connect(level);
      level.connect(ctx.destination);
      const entry = { source, level };
      source.onended = () => {
        live.delete(entry);
        source.disconnect();
        level.disconnect();
      };
      if (startIn >= 0) source.start(ctx.currentTime + startIn);
      else source.start(ctx.currentTime, -startIn * rate);
      live.add(entry);
    } catch {
      // A missing flourish is never worth an error in the music.
    }
  },

  /** Silence everything in flight — a pause, a scrub, Auto DJ switched off. */
  stopAll(): void {
    for (const { source, level } of live) {
      try {
        source.stop();
        source.disconnect();
        level.disconnect();
      } catch {
        // Already finished.
      }
    }
    live.clear();
  },
};
