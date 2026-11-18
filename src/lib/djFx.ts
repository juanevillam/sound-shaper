import {
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';

import { audioEngine } from './audioEngine';
import { FX_PEAK, synthFx, type FxName } from './autoDj/fx';

// ---------------------------------------------------------------------------
// AUTO DJ'S SOUNDS, PLAYED. Each one is a buffer source of its own wired
// straight to the context's destination, BESIDE the music's chain rather than
// in it — a node with two INPUTS mixes them, which is safe here; it is a node
// with two OUTPUTS that this library cannot do (see `buildGraph`). Being
// outside the chain is also what lets an impact ring on across a cut: the
// music's graph is torn down and rebuilt under it, and it keeps sounding.
//
// Sourced from Kenney's Sci-Fi Sounds pack (https://kenney.nl/assets/sci-fi-sounds,
// CC0), shaped and layered for DJ transitions (`assets/sounds/dj-*.mp3`).
// `riser` and `reverseCymbal` scale their `playbackRate` so they end on the
// cut at the music's bar length (`lengthS`), while `synthFx` remains the
// synchronous fallback if a sample has not finished decoding yet.
// ---------------------------------------------------------------------------

const SOURCES: Record<FxName, number> = {
  riser: require('../../assets/sounds/dj-riser.mp3'),
  reverseCymbal: require('../../assets/sounds/dj-reverse-cymbal.mp3'),
  downlifter: require('../../assets/sounds/dj-downlifter.mp3'),
  zap: require('../../assets/sounds/dj-zap.mp3'),
};

const sampleBuffers: Partial<Record<FxName, AudioBuffer>> = {};
const decoding: Partial<Record<FxName, Promise<AudioBuffer>>> = {};

function preloadSample(name: FxName): void {
  if (sampleBuffers[name] || decoding[name]) return;
  try {
    const p = audioEngine.getContext().decodeAudioData(SOURCES[name]);
    decoding[name] = p;
    p.then(buf => {
      sampleBuffers[name] = buf;
    }).catch(() => {
      if (decoding[name] === p) delete decoding[name];
    });
  } catch {
    // Context not ready yet; decoded on next play.
  }
}

export function preloadDjFx(): void {
  (Object.keys(SOURCES) as FxName[]).forEach(preloadSample);
}

/** Takes of each fallback sound, made once per session and reused. */
const TAKES = 3;
const cache = new Map<string, AudioBuffer>();
const live = new Set<{ source: AudioBufferSourceNode; level: GainNode }>();

function fallbackBuffer(name: FxName, lengthS?: number): AudioBuffer {
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
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return buffer;
}

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
      // At the set's level: the sounds were tuned against untouched music,
      // and the leveller has taken the music down (`setLevelDb`).
      const level = ctx.createGain();
      level.gain.value =
        audioEngine.levelLinear() * (sampled ? 1 : FX_PEAK[name] / 0.25);
      source.connect(level);
      level.connect(ctx.destination);
      const entry = { source, level };
      source.onEnded = () => {
        live.delete(entry);
        source.disconnect();
        level.disconnect();
      };
      live.add(entry);
      if (startIn >= 0) source.start(ctx.currentTime + startIn);
      else source.start(ctx.currentTime, -startIn * rate);
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
