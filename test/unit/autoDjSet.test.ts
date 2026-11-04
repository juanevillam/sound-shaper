import { describe, expect, it } from 'vitest';

import { type SongMap } from '../../src/lib/autoDj/analysis';
import { rng, stateAt } from '../../src/lib/autoDj/plan';
import {
  chooseNext,
  chooseWindow,
  joinSegment,
  matchRate,
  planSegment,
  tempoDistance,
  type PoolSound,
} from '../../src/lib/autoDj/set';

const song = (bpm: number, firstBarS = 0.2): SongMap => {
  const bars = [
    ...Array(8).fill(0.3),
    ...Array(16).fill(0.9),
    ...Array(8).fill(0.35),
    ...Array(16).fill(1),
    ...Array(8).fill(0.6),
  ];
  const beatS = bpm > 0 ? 60 / bpm : 0;
  const blockS = bpm > 0 ? beatS * 4 : 2;
  return {
    version: 1,
    durationS: firstBarS + bars.length * blockS + 1,
    bpm,
    beatS,
    firstBarS,
    confidence: bpm > 0 ? 0.8 : 0,
    bars,
    blockS,
  };
};

const pool: PoolSound[] = [
  { soundId: 'a', map: song(128) },
  { soundId: 'b', map: song(126) },
  { soundId: 'c', map: song(89) },
  { soundId: 'd', map: song(140) },
  { soundId: 'e', map: song(0) },
];

describe('tempo', () => {
  it('counts half and double time as the same tempo', () => {
    expect(tempoDistance(128, 64)).toBeCloseTo(0);
    expect(tempoDistance(89, 178)).toBeCloseTo(0);
    expect(tempoDistance(120, 128)).toBeLessThan(0.1);
  });

  it('matches a close tempo inside the slider, and lets a far one go', () => {
    const close = matchRate(128, 124, 'club');
    expect(close.matched).toBe(true);
    expect(close.rate).toBe(1.05);
    // 89 folds to 178 or 89: 128 is too far from either for a club set.
    expect(matchRate(128, 89, 'club')).toEqual({ rate: 1, matched: false });
    expect(matchRate(0, 120, 'slowed')).toEqual({ rate: 0.85, matched: false });
  });
});

describe('chooseNext', () => {
  it('never repeats a sound until every one has played', () => {
    const random = rng(3);
    const played = new Set<string>(['a']);
    let current = 'a';
    for (let i = 0; i < pool.length - 1; i += 1) {
      const next = chooseNext(pool, played, current, 128, random);
      expect(next).not.toBeNull();
      expect(played.has(next!.soundId)).toBe(false);
      played.add(next!.soundId);
      current = next!.soundId;
    }
    expect(played.size).toBe(pool.length);
    expect(chooseNext(pool, played, current, 128, random)).not.toBeNull();
  });
});

describe('segments', () => {
  it('cut on bar lines, inside the sound', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const p of pool) {
        const seg = planSegment({
          next: p,
          style: 'club',
          seed,
          setTempo: 128,
        });
        const barS = p.map.bpm > 0 ? p.map.beatS * 4 : p.map.blockS;
        const bars = (t: number) => (t - p.map.firstBarS) / barS;
        const at = bars(seg.startS);
        expect(Math.abs(at - Math.round(at))).toBeLessThan(1e-6);
        expect(seg.endS).toBeGreaterThan(seg.startS + 8 * barS - 1e-6);
        expect(seg.endS).toBeLessThanOrEqual(p.map.durationS);
        expect(seg.mix.moves[0].atS).toBe(seg.startS);
        for (const move of seg.mix.moves) {
          expect(move.atS).toBeGreaterThanOrEqual(seg.startS);
          expect(move.atS).toBeLessThan(seg.endS);
        }
      }
    }
  });

  it('take the window on a drop most of the time', () => {
    const random = rng(11);
    const entries = Array.from(
      { length: 50 },
      () => chooseWindow(song(128), 'club', random).entry,
    );
    expect(entries.filter(e => e === 'drop').length).toBeGreaterThan(25);
  });

  it('come in open on a drop, and go out closed or next door', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const seg = planSegment({
        next: pool[0],
        style: 'hyper',
        seed,
        setTempo: 128,
      });
      if (seg.entry === 'drop') {
        expect(stateAt(seg.mix, seg.startS).nextRoom).toBe('off');
      }
      const last = stateAt(seg.mix, seg.endS - 0.01);
      if (seg.exit === 'room') expect(last.nextRoom).toBe('high');
      if (seg.exit === 'sweep') {
        expect(last.gains[4]).toBeLessThan(last.gains[0] - 6);
      }
    }
  });

  it('never move Echo inside a segment', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const seg = planSegment({
        next: pool[1],
        style: 'slowed',
        seed,
        setTempo: 120,
      });
      const late = seg.mix.moves.filter(
        m => m.atS > seg.startS && m.echo !== undefined,
      );
      expect(late).toEqual([]);
    }
  });

  it('play a joined sound on from the playhead to a phrase end', () => {
    const seg = joinSegment({
      sound: pool[0],
      style: 'club',
      seed: 5,
      atS: 13.7,
      setTempo: 0,
    });
    expect(seg.startS).toBe(13.7);
    expect(seg.endS).toBeGreaterThanOrEqual(13.7 + 40);
    expect(seg.mix.moves[0].atS).toBe(13.7);
  });
});
