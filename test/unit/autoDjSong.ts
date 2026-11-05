import { type SongMap } from '../../src/lib/autoDj/analysis';

/** A part of a synthetic song: bars, loudness, bass, brightness. */
type Part = [bars: number, energy: number, bass: number, bright: number];

/**
 * A song map built part by part, the way the analyser would read a dance
 * track: intro · verse · build · DROP · break · build · BIGGER DROP · outro.
 */
export const PARTS: Part[] = [
  [8, 0.35, 0.3, 0.4],
  [16, 0.7, 0.8, 0.5],
  [8, 0.6, 0.4, 0.9],
  [16, 1, 1, 0.7],
  [8, 0.4, 0.2, 0.5],
  [8, 0.6, 0.4, 0.95],
  [16, 1.1, 1, 0.75],
  [8, 0.4, 0.5, 0.4],
];

export function songOf(bpm: number, parts: Part[] = PARTS): SongMap {
  const bars: number[] = [];
  const bass: number[] = [];
  const bright: number[] = [];
  for (const [n, e, b, h] of parts) {
    bars.push(...Array<number>(n).fill(e));
    bass.push(...Array<number>(n).fill(b));
    bright.push(...Array<number>(n).fill(h));
  }
  const beatS = bpm > 0 ? 60 / bpm : 0;
  const blockS = bpm > 0 ? beatS * 4 : 2;
  const firstBarS = bpm > 0 ? 0.2 : 0;
  return {
    version: 2,
    durationS: firstBarS + bars.length * blockS + 1,
    bpm,
    beatS,
    firstBarS,
    confidence: bpm > 0 ? 0.8 : 0,
    bars,
    bass,
    bright,
    blockS,
  };
}
