import {
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';

import { audioEngine } from './audioEngine';
import { synthFx, type FxName } from './autoDj/fx';

// ---------------------------------------------------------------------------
// AUTO DJ'S SOUNDS, PLAYED. Each one is a buffer source of its own wired
// straight to the context's destination, BESIDE the music's chain rather than
// in it — a node with two INPUTS mixes them, which is safe here; it is a node
// with two OUTPUTS that this library cannot do (see `buildGraph`). Being
// outside the chain is also what lets an impact ring on across a cut: the
// music's graph is torn down and rebuilt under it, and it keeps sounding.
// ---------------------------------------------------------------------------

/** Takes of each sound, made once per session and reused. */
const TAKES = 3;
const cache = new Map<string, AudioBuffer>();
const live = new Set<{ source: AudioBufferSourceNode; level: GainNode }>();

function bufferFor(name: FxName, lengthS?: number): AudioBuffer {
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
}

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
      if (-startIn >= buffer.duration) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // At the set's level: the sounds were tuned against untouched music,
      // and the leveller has taken the music down (`setLevelDb`).
      const level = ctx.createGain();
      level.gain.value = audioEngine.levelLinear();
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
      else source.start(ctx.currentTime, -startIn);
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
