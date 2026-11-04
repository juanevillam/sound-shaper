import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_SAMPLE_RATE,
  analyzeSamples,
} from '../../src/lib/autoDj/analysis';

const SR = ANALYSIS_SAMPLE_RATE;

/**
 * A synthetic track: a decaying 60 Hz kick on every beat, a hat on the
 * off-beats, an accent on each downbeat, and a loudness envelope per bar.
 */
function track(opts: {
  bpm: number;
  bars: number;
  offsetS?: number;
  loudness?: (bar: number) => number;
  seed?: number;
}): Float32Array {
  const { bpm, bars, offsetS = 0, loudness = () => 1 } = opts;
  const beatS = 60 / bpm;
  const length = Math.ceil((offsetS + bars * 4 * beatS + 1) * SR);
  const out = new Float32Array(length);
  let noise = opts.seed ?? 1;
  const rand = () => {
    noise = (noise * 16807) % 2147483647;
    return noise / 2147483647 - 0.5;
  };
  for (let b = 0; b < bars * 4; b += 1) {
    const bar = Math.floor(b / 4);
    const gain = loudness(bar) * (b % 4 === 0 ? 1 : 0.7);
    const start = Math.round((offsetS + b * beatS) * SR);
    for (let i = 0; i < SR * 0.15 && start + i < length; i += 1) {
      const t = i / SR;
      out[start + i] +=
        gain * Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 25);
    }
    const hat = Math.round((offsetS + (b + 0.5) * beatS) * SR);
    for (let i = 0; i < SR * 0.03 && hat + i < length; i += 1) {
      out[hat + i] += 0.15 * loudness(bar) * rand() * Math.exp(-(i / SR) * 120);
    }
  }
  return out;
}

describe('analyzeSamples', () => {
  it.each([128, 95, 140, 100])('finds %d BPM', bpm => {
    const map = analyzeSamples(track({ bpm, bars: 32 }), SR);
    expect(map.bpm).toBeGreaterThan(bpm * 0.99);
    expect(map.bpm).toBeLessThan(bpm * 1.01);
    expect(map.confidence).toBeGreaterThan(0.2);
  });

  it('puts the first bar on the downbeat', () => {
    const offsetS = 0.37;
    const map = analyzeSamples(track({ bpm: 128, bars: 32, offsetS }), SR);
    const barS = (60 / 128) * 4;
    const expected = offsetS % barS;
    // Within one analysis frame (~23 ms).
    expect(Math.abs(map.firstBarS - expected)).toBeLessThan(0.03);
  });

  it('measures each bar, so a break and a drop are visible', () => {
    // 8 loud, 8 quiet (the break), 8 loud (the drop).
    const loudness = (bar: number) => (bar >= 8 && bar < 16 ? 0.25 : 1);
    const map = analyzeSamples(track({ bpm: 128, bars: 24, loudness }), SR);
    const breakBars = map.bars.slice(9, 15);
    const dropBars = map.bars.slice(17, 23);
    expect(Math.max(...breakBars)).toBeLessThan(0.4);
    expect(Math.min(...dropBars)).toBeGreaterThan(0.8);
  });

  it('reports no pulse for noise, in time blocks', () => {
    let s = 7;
    const noise = new Float32Array(SR * 30).map(() => {
      s = (s * 16807) % 2147483647;
      return (s / 2147483647 - 0.5) * 0.5;
    });
    const map = analyzeSamples(noise, SR);
    expect(map.bpm).toBe(0);
    expect(map.blockS).toBe(2);
    expect(map.bars.length).toBe(15);
  });
});
