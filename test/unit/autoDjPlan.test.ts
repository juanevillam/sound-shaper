import { describe, expect, it } from 'vitest';

import {
  findDrops,
  nextMoveIndex,
  stateAt,
  type Mix,
} from '../../src/lib/autoDj/plan';

const bars = [
  ...Array(8).fill(0.3),
  ...Array(16).fill(0.9),
  ...Array(8).fill(0.35),
  ...Array(16).fill(1),
  ...Array(4).fill(0.6),
];

describe('findDrops', () => {
  it('finds the drops where the music comes back in', () => {
    expect(findDrops(bars)).toEqual([8, 32]);
  });
});

describe('stateAt', () => {
  const mix: Mix = {
    style: 'club',
    seed: 1,
    moves: [
      { atS: 2, gains: [1, 1, 1, 1, 1], nextRoom: 'off', echo: 'low', rate: 1 },
      { atS: 5, nextRoom: 'medium' },
      { atS: 9, rate: 1.1, gains: [0, 0, 0, 0, 0] },
    ],
  };

  it('folds every move up to the playhead', () => {
    expect(stateAt(mix, 6)).toEqual({
      gains: [1, 1, 1, 1, 1],
      nextRoom: 'medium',
      echo: 'low',
      rate: 1,
    });
    expect(stateAt(mix, 9).rate).toBe(1.1);
  });

  it('finds the next move after a time', () => {
    expect(nextMoveIndex(mix, 0)).toBe(0);
    expect(nextMoveIndex(mix, 5)).toBe(2);
    expect(nextMoveIndex(mix, 1e9)).toBe(3);
  });
});
