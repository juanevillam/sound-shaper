import { describe, expect, it } from 'vitest';

import { type SongMap } from '../../src/lib/autoDj/analysis';
import {
  AUTO_DJ_STYLES,
  findBreaks,
  findDrops,
  nextMoveIndex,
  planMix,
  stateAt,
} from '../../src/lib/autoDj/plan';
import { EQ_MAX_DB, EQ_MIN_DB } from '../../src/lib/shapeDsp';

const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// Intro (8 quiet) · verse (16 loud) · break (8 quiet) · drop (16 loud) · outro.
const bars = [
  ...Array(8).fill(0.3),
  ...Array(16).fill(0.9),
  ...Array(8).fill(0.35),
  ...Array(16).fill(1),
  ...Array(4).fill(0.6),
];

const map: SongMap = {
  version: 1,
  durationS: bars.length * BAR,
  bpm: BPM,
  beatS: BEAT,
  firstBarS: 0.2,
  confidence: 0.8,
  bars,
  blockS: BAR,
};

describe('sections', () => {
  it('finds the drops where the music comes back in', () => {
    expect(findDrops(bars)).toEqual([8, 32]);
  });

  it('finds the breaks', () => {
    expect(findBreaks(bars)).toEqual([
      [0, 8],
      [24, 32],
    ]);
  });
});

describe('planMix', () => {
  it('is the same mix for the same seed, and a different one for another', () => {
    const a = planMix(map, 'club', 1);
    expect(planMix(map, 'club', 1)).toEqual(a);
    const others = [2, 3, 4, 5, 6].map(
      seed => planMix(map, 'club', seed).moves,
    );
    expect(
      others.some(m => JSON.stringify(m) !== JSON.stringify(a.moves)),
    ).toBe(true);
  });

  it.each(AUTO_DJ_STYLES)('%s opens the sound on each drop downbeat', style => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const mix = planMix(map, style, seed);
      for (const drop of [8, 32]) {
        const at = map.firstBarS + drop * BAR;
        const before = stateAt(mix, at - 0.01);
        const after = stateAt(mix, at);
        // Closed down going in: the top band well below the bottom.
        expect(before.gains[4]).toBeLessThan(before.gains[0] - 6);
        expect(after.nextRoom).toBe('off');
        expect(after.gains[4]).toBeGreaterThan(before.gains[4]);
      }
    }
  });

  it('only ever asks for values the controls can show', () => {
    for (const style of AUTO_DJ_STYLES) {
      for (let seed = 1; seed <= 30; seed += 1) {
        for (const move of planMix(map, style, seed).moves) {
          for (const g of move.gains ?? []) {
            expect(Number.isInteger(g)).toBe(true);
            expect(g).toBeGreaterThanOrEqual(EQ_MIN_DB);
            expect(g).toBeLessThanOrEqual(EQ_MAX_DB);
          }
          if (move.rate !== undefined) {
            expect(move.rate).toBeGreaterThanOrEqual(0.75);
            expect(move.rate).toBeLessThanOrEqual(1.25);
          }
        }
      }
    }
  });

  it('never moves Echo after the start — a rewire mutes the music', () => {
    for (const style of AUTO_DJ_STYLES) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const late = planMix(map, style, seed).moves.filter(
          m => m.atS > 0 && m.echo !== undefined,
        );
        expect(late).toEqual([]);
      }
    }
  });

  it('starts from the base state and keeps moves sorted', () => {
    const mix = planMix(map, 'slowed', 9);
    expect(mix.moves[0].atS).toBe(0);
    expect(stateAt(mix, 0).rate).toBeLessThan(1);
    expect(stateAt(mix, 0).keepPitch).toBe(false);
    for (let i = 1; i < mix.moves.length; i += 1) {
      expect(mix.moves[i].atS).toBeGreaterThanOrEqual(mix.moves[i - 1].atS);
    }
    expect(nextMoveIndex(mix, -1)).toBe(0);
    expect(nextMoveIndex(mix, 1e9)).toBe(mix.moves.length);
  });

  it('plans gently on a sound with no pulse', () => {
    const flat: SongMap = {
      ...map,
      bpm: 0,
      beatS: 0,
      firstBarS: 0,
      blockS: 2,
      bars: Array(90).fill(0.7),
    };
    const mix = planMix(flat, 'club', 4);
    expect(mix.moves.length).toBeGreaterThan(3);
    const gaps = mix.moves
      .slice(1)
      .map((m, i) => m.atS - mix.moves[i].atS)
      .filter(gap => gap > 0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(4);
  });
});
