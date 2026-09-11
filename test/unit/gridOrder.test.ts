import { describe, expect, it } from 'vitest';

import {
  byGridOrder,
  initialPositions,
  needsPositionRepair,
  positionBetween,
  positionForMove,
  renormalized,
} from '../../src/lib/gridOrder';

describe('positionBetween', () => {
  it('seeds an empty library', () => {
    expect(positionBetween(null, null)).toBe(0);
  });

  it('appends past the last entry and prepends before the first', () => {
    expect(positionBetween(4, null)).toBe(5);
    expect(positionBetween(null, 4)).toBe(3);
  });

  it('splits the gap between two neighbours', () => {
    expect(positionBetween(0, 1)).toBe(0.5);
    expect(positionBetween(0, 0.5)).toBe(0.25);
    expect(positionBetween(-3, 5)).toBe(1);
  });

  it('refuses a backwards pair rather than guessing', () => {
    expect(positionBetween(9, 4)).toBeNull();
    expect(positionBetween(2, 2)).toBeNull();
  });

  it('always lands STRICTLY between, so repeated splits keep the order', () => {
    let low = 0;
    const high = 1;

    for (let round = 0; round < 40; round += 1) {
      const middle = positionBetween(low, high);
      expect(middle).not.toBeNull();
      expect(middle as number).toBeGreaterThan(low);
      expect(middle as number).toBeLessThan(high);
      low = middle as number;
    }
  });

  it('reports exhaustion instead of silently collapsing a gap', () => {
    // Drive one gap to the floor of float64 and confirm the failure is
    // announced. This is the case the whole `null` contract exists for — a
    // silent collapse would put two tiles on one position and scramble them.
    let low = 0;
    const high = 1;
    let exhaustedAfter = -1;

    for (let round = 0; round < 200; round += 1) {
      const middle = positionBetween(low, high);
      if (middle === null) {
        exhaustedAfter = round;
        break;
      }
      low = middle;
    }

    expect(exhaustedAfter).toBeGreaterThan(40);
    expect(exhaustedAfter).toBeLessThan(80);
  });

  it('is exact at large magnitudes, where a fixed epsilon would not be', () => {
    // A pair a thousand apart out at 1e12 has plenty of room; an epsilon test
    // tuned near zero would happily call this exhausted.
    const middle = positionBetween(1e12, 1e12 + 1000);
    expect(middle).toBe(1e12 + 500);
  });
});

describe('positionForMove', () => {
  const ordered = (...positions: Array<number | null>) =>
    positions.map(position => ({ position }));

  it('reads the neighbours either side of the landed tile', () => {
    // Moved tile sits at index 1; its bounds are 0 and 2.
    expect(positionForMove(ordered(0, 99, 2), 1)).toBe(1);
  });

  it('appends when the tile landed last', () => {
    expect(positionForMove(ordered(0, 1, 99), 2)).toBe(2);
  });

  it('prepends when the tile landed first', () => {
    expect(positionForMove(ordered(99, 4, 5), 0)).toBe(3);
  });

  it('seeds when the tile is the only one', () => {
    expect(positionForMove(ordered(99), 0)).toBe(0);
  });

  it('signals a repair when the neighbours have no room left', () => {
    // Two ADJACENT float64 values — nothing is representable between them, so
    // this is the exhaustion case arriving through `positionForMove` rather
    // than through `positionBetween` directly. JS has no `nextafter`, and
    // `x + EPSILON * x` lands two ULPs up (which IS splittable, and said so
    // when this test first tried it), so step the bit pattern by one.
    const nextUp = (value: number): number => {
      const bytes = new ArrayBuffer(8);
      const asFloat = new Float64Array(bytes);
      const asBits = new BigUint64Array(bytes);
      asFloat[0] = value;
      asBits[0] += 1n;

      return asFloat[0];
    };

    const low = 0.1;
    const high = nextUp(low);
    expect(high).toBeGreaterThan(low);
    expect(positionForMove(ordered(low, 99, high), 1)).toBeNull();
  });
});

describe('byGridOrder', () => {
  const entry = (
    id: string,
    position: number | null,
    createdAt: number | null,
  ) => ({ createdAt, id, position });

  it('orders by position', () => {
    const sorted = byGridOrder([
      entry('c', 2, 0),
      entry('a', 0, 0),
      entry('b', 1, 0),
    ]);
    expect(sorted.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps negative positions in front, so a prepend actually prepends', () => {
    const sorted = byGridOrder([entry('a', 0, 0), entry('new', -1, 0)]);
    expect(sorted.map(item => item.id)).toEqual(['new', 'a']);
  });

  it('puts unpositioned sounds last, newest first, never dropping them', () => {
    // The pre-feature documents: no position, previously ordered createdAt
    // desc. They must keep that order and stay visible.
    const sorted = byGridOrder([
      entry('older', null, 100),
      entry('positioned', 5, 0),
      entry('newer', null, 300),
    ]);
    expect(sorted.map(item => item.id)).toEqual([
      'positioned',
      'newer',
      'older',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [entry('b', 1, 0), entry('a', 0, 0)];
    byGridOrder(input);
    expect(input.map(item => item.id)).toEqual(['b', 'a']);
  });
});

describe('initialPositions / renormalized', () => {
  it('spaces a fresh list evenly', () => {
    expect(initialPositions(4)).toEqual([0, 1, 2, 3]);
    expect(initialPositions(0)).toEqual([]);
  });

  it('re-spaces an exhausted order while preserving it', () => {
    const repaired = renormalized([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(repaired).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ]);
  });

  it('leaves room to split again after a repair', () => {
    const repaired = renormalized([{ id: 'a' }, { id: 'b' }]);
    expect(
      positionBetween(repaired[0].position, repaired[1].position),
    ).not.toBeNull();
  });
});

describe('needsPositionRepair', () => {
  const at = (...positions: Array<number | null>) =>
    positions.map(position => ({ position }));

  it('passes a clean, distinct order', () => {
    expect(needsPositionRepair(at(0, 1, 2))).toBe(false);
    expect(needsPositionRepair(at(-4, 0.5, 900))).toBe(false);
    expect(needsPositionRepair([])).toBe(false);
  });

  it('catches a missing position', () => {
    expect(needsPositionRepair(at(0, null, 2))).toBe(true);
  });

  it('catches a DUPLICATE, which is the one that broke the real library', () => {
    // Two sounds on 6 and nothing on 2 — the exact state the first backfill
    // left behind. A tile can never be dropped between the twins, because
    // `positionBetween` refuses a pair that is not strictly increasing.
    expect(needsPositionRepair(at(0, 1, 3, 4, 5, 6, 6, 7))).toBe(true);
    expect(positionBetween(6, 6)).toBeNull();
  });

  it('a repaired order passes, and is still splittable', () => {
    const damaged = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const repaired = renormalized(damaged);
    expect(needsPositionRepair(repaired)).toBe(false);
  });
});
