import { describe, expect, it } from 'vitest';

import { songOf } from './autoDjSong';
import {
  DJ_TARGET_DB,
  djLevelDb,
  stateLoudnessDb,
} from '../../src/lib/autoDj/loudness';
import { AUTO_DJ_STYLES, stateAt } from '../../src/lib/autoDj/plan';
import { planSegment } from '../../src/lib/autoDj/set';

const FLAT = [0, 0, 0, 0, 0];

describe('stateLoudnessDb', () => {
  it('reads an untouched sound as 0 dB', () => {
    expect(
      stateLoudnessDb({ gains: FLAT, nextRoom: 'off', echo: 'off' }),
    ).toBeCloseTo(0, 5);
  });

  it('puts the shaped presets within a dB and a half of each other', () => {
    const presets = [
      [3, 2, 0, -1, -2],
      [-4, -2, 2, 3, -2],
      [-2, -2, 0, 1, 4],
      [2, 2, -1, -3, -5],
      [-3, -2, 2, 4, 2],
    ].map(gains => stateLoudnessDb({ gains, nextRoom: 'off', echo: 'off' }));
    expect(Math.max(...presets) - Math.min(...presets)).toBeLessThan(1.5);
  });

  it('grows quieter with each wall level and each echo level', () => {
    const wall = (['off', 'low', 'medium', 'high'] as const).map(nextRoom =>
      stateLoudnessDb({ gains: FLAT, nextRoom, echo: 'off' }),
    );
    const echo = (['off', 'low', 'medium', 'high'] as const).map(e =>
      stateLoudnessDb({ gains: FLAT, nextRoom: 'off', echo: e }),
    );
    for (const xs of [wall, echo])
      xs.slice(1).forEach((x, i) => expect(x).toBeLessThan(xs[i]));
  });
});

describe('djLevelDb', () => {
  it('only ever takes level away', () => {
    expect(
      djLevelDb({ gains: FLAT, nextRoom: 'off', echo: 'off' }),
    ).toBeCloseTo(DJ_TARGET_DB, 5);
    expect(djLevelDb({ gains: FLAT, nextRoom: 'high', echo: 'high' })).toBe(0);
  });

  it('keeps a whole set within a few dB of the target most of the time', () => {
    let quiet = 0;
    let total = 0;
    for (let i = 0; i < 60; i += 1) {
      const seg = planSegment({
        next: { soundId: 'a', map: songOf(128) },
        style: AUTO_DJ_STYLES[i % 3],
        seed: i + 1,
        setTempo: 128,
      });
      for (let t = seg.startS; t < seg.endS; t += 0.5) {
        const played = Math.min(
          DJ_TARGET_DB,
          stateLoudnessDb(stateAt(seg.mix, t)),
        );
        total += 1;
        if (played < DJ_TARGET_DB - 3) quiet += 1;
      }
    }
    expect(quiet / total).toBeLessThan(0.12);
  });
});
