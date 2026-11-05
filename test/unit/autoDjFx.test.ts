import { describe, expect, it } from 'vitest';

import { FX_PEAK, synthFx, type FxName } from '../../src/lib/autoDj/fx';

const RATE = 48000;
const NAMES: FxName[] = [
  'riser',
  'reverseCymbal',
  'impact',
  'downlifter',
  'zap',
];

const peak = (xs: Float32Array) =>
  xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('synthFx', () => {
  it.each(NAMES)('%s stays under its level, with clean edges', name => {
    const fx = synthFx(name, RATE, 1);
    expect(Math.max(peak(fx.left), peak(fx.right))).toBeGreaterThan(
      FX_PEAK[name] * 0.99,
    );
    for (const ch of [fx.left, fx.right]) {
      expect(ch.length).toBe(Math.floor(fx.durationS * RATE));
      expect(peak(ch)).toBeLessThanOrEqual(FX_PEAK[name] + 1e-6);
      expect(Math.abs(ch[0])).toBeLessThan(0.01);
      expect(Math.abs(ch[ch.length - 1])).toBeLessThan(0.01);
    }
  });

  it('builds into the cut, or lands on it', () => {
    const riser = synthFx('riser', RATE, 2, 2.5);
    expect(riser.durationS).toBe(2.5);
    expect(riser.alignS).toBe(2.5);
    // Louder at the end than at the start.
    const n = riser.left.length;
    expect(peak(riser.left.subarray(n - RATE / 4))).toBeGreaterThan(
      peak(riser.left.subarray(0, RATE / 4)) * 4,
    );
    const impact = synthFx('impact', RATE, 2);
    expect(impact.alignS).toBe(0);
    expect(peak(impact.left.subarray(0, RATE / 4))).toBeGreaterThan(
      peak(impact.left.subarray(RATE)) * 4,
    );
  });

  it('is the same take for the same seed', () => {
    expect(synthFx('riser', RATE, 5).left).toEqual(
      synthFx('riser', RATE, 5).left,
    );
  });
});
