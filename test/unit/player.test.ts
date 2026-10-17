import { describe, expect, it } from 'vitest';

import {
  formatTime,
  RATE_LAST_STOP,
  RATE_MAX,
  RATE_MIN,
  RATE_SLIDER_STEPS,
  rateLabel,
  rateToStop,
  snapRate,
  stopToRate,
} from '../../src/lib/player';

describe('formatTime', () => {
  it('writes m:ss with a padded second', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(61)).toBe('1:01');
    expect(formatTime(600)).toBe('10:00');
  });

  it('floors to the second rather than rounding', () => {
    expect(formatTime(142.99)).toBe('2:22');
  });

  it('never prints a negative time', () => {
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('the rate stops', () => {
  it('are eleven, 0.75 to 1.25', () => {
    expect(RATE_LAST_STOP).toBe(10);
    // Compose counts the stops between the two ends.
    expect(RATE_SLIDER_STEPS).toBe(9);
  });

  it('round-trip exactly through their indices', () => {
    for (let stop = 0; stop <= RATE_LAST_STOP; stop++)
      expect(rateToStop(stopToRate(stop))).toBe(stop);
    expect(stopToRate(0)).toBe(RATE_MIN);
    expect(stopToRate(5)).toBe(1);
    expect(stopToRate(RATE_LAST_STOP)).toBe(RATE_MAX);
  });

  it('land on the exact number the label prints, not float drift', () => {
    // 19 × 0.05 is 0.9500000000000001 in floating point.
    expect(19 * 0.05).not.toBe(0.95);
    expect(snapRate(0.95)).toBe(0.95);
    expect(snapRate(0.7000000000000001 + 0.25)).toBe(0.95);
    expect(stopToRate(4)).toBe(0.95);
    // `rate === 1` is what the trophy trigger and the shape summary test.
    expect(snapRate(0.9999999)).toBe(1);
    expect(stopToRate(5) === 1).toBe(true);
  });

  it('snap to the nearest stop and clamp to the range', () => {
    expect(snapRate(1.07)).toBe(1.05);
    expect(snapRate(1.08)).toBe(1.1);
    expect(snapRate(0.1)).toBe(RATE_MIN);
    expect(snapRate(3)).toBe(RATE_MAX);
  });

  it('read a fractional slider index as its nearest stop', () => {
    expect(stopToRate(4.6)).toBe(1);
  });
});

describe('rateLabel', () => {
  it("follows the app's language for the decimal separator", () => {
    expect(rateLabel(1.25, 'en')).toBe('1.25×');
    expect(rateLabel(1.25, 'es')).toBe('1,25×');
    expect(rateLabel(1.25, 'zh')).toBe('1.25×');
  });

  it('prints a whole rate without decimals', () => {
    expect(rateLabel(1, 'en')).toBe('1×');
  });
});
