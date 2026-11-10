import { describe, expect, it } from 'vitest';

import { songOf } from './autoDjSong';
import { AUTO_DJ_STYLES, rng, stateAt } from '../../src/lib/autoDj/plan';
import {
  firstPeakBar,
  joinSegment,
  matchRate,
  planOrder,
  planSegment,
  planSoundSegment,
  tempoDistance,
  transitionFx,
  type PoolSound,
  type Segment,
} from '../../src/lib/autoDj/set';
import { EQ_MAX_DB, EQ_MIN_DB } from '../../src/lib/shapeDsp';

const pool: PoolSound[] = [
  { soundId: 'a', map: songOf(128) },
  { soundId: 'b', map: songOf(126) },
  { soundId: 'c', map: songOf(89) },
  { soundId: 'd', map: songOf(140) },
  { soundId: 'e', map: songOf(0) },
];

const song = pool[0].map;
const BAR = song.beatS * 4;
const bar = (s: number) => (s - song.firstBarS) / BAR;

const segments = (
  opts: Partial<Parameters<typeof planSegment>[0]> = {},
): Segment[] =>
  Array.from({ length: 60 }, (_, i) =>
    planSegment({
      next: pool[0],
      style: AUTO_DJ_STYLES[i % 3],
      seed: i + 1,
      setTempo: 128,
      ...opts,
    }),
  );

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
    expect(matchRate(128, 89, 'club')).toEqual({ rate: 1, matched: false });
    expect(matchRate(0, 120, 'slowed')).toEqual({ rate: 0.85, matched: false });
  });
});

describe('planOrder', () => {
  it('plans every other sound exactly once', () => {
    const order = planOrder(pool, 'a', 128, rng(3));
    expect([...order].sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('is a different run for a different seed', () => {
    const runs = new Set(
      Array.from({ length: 12 }, (_, i) =>
        planOrder(pool, 'a', 128, rng(i + 1)).join(),
      ),
    );
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe('planSegment', () => {
  it('cues the good part, never the first bar of the song', () => {
    for (const seg of segments()) {
      expect(bar(seg.startS)).toBeGreaterThan(0.5);
      // On a drop, a phrase into one, or the build before one.
      expect([24, 32, 40, 56, 64, 72]).toContain(Math.round(bar(seg.startS)));
    }
  });

  it('cues the bigger drop more often than the first', () => {
    const late = segments().filter(s => bar(s.startS) >= 56).length;
    expect(late).toBeGreaterThan(30);
  });

  it('leaves where the song lets go, never inside a drop', () => {
    for (const seg of segments()) {
      // End of a drop, a phrase into the part after, or the song's end.
      expect([48, 56, 80, 88]).toContain(Math.round(bar(seg.endS)));
      expect(seg.endsOn).toBe(
        [48, 80].includes(Math.round(bar(seg.endS))) ? 'peak' : 'fall',
      );
    }
  });

  it('comes in on the drop more often after a peak than after a fall', () => {
    const drops = (after: 'peak' | 'fall' | 'build') =>
      segments({ after }).filter(s => s.entry === 'drop').length;
    expect(drops('peak')).toBeGreaterThan(drops('fall'));
    expect(drops('build')).toBeGreaterThan(drops('peak'));
  });

  it('opens the wall on the drop when walking in over the build', () => {
    let seen = 0;
    for (const seg of segments()) {
      if (seg.entry !== 'walk-in') continue;
      seen += 1;
      const dropS = seg.startS + 8 * BAR;
      expect(stateAt(seg.mix, seg.startS).nextRoom).not.toBe('off');
      expect(stateAt(seg.mix, dropS - 0.01).nextRoom).not.toBe('off');
      expect(stateAt(seg.mix, dropS).nextRoom).toBe('off');
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('closes the filter through a build it plays', () => {
    for (const seg of segments()) {
      for (const drop of [32, 64]) {
        const dropS = song.firstBarS + drop * BAR;
        if (dropS <= seg.startS + BAR || dropS >= seg.endS - 4 * BAR) continue;
        const going = stateAt(seg.mix, dropS - 0.01);
        expect(going.gains[4]).toBeLessThan(going.gains[0] - 6);
        const open = stateAt(seg.mix, dropS);
        expect(open.gains[4]).toBeGreaterThan(going.gains[4]);
      }
    }
  });

  it('plays the controls, more than a move a phrase', () => {
    const segs = segments();
    const perPhrase =
      segs.reduce(
        (n, s) => n + s.mix.moves.length / ((s.endS - s.startS) / (8 * BAR)),
        0,
      ) / segs.length;
    expect(perPhrase).toBeGreaterThan(1);
  });

  it('only asks for values the controls can show', () => {
    for (const seg of [
      ...segments(),
      ...segments({ after: 'fall' }),
      ...segments({ part: 'opening' }),
    ]) {
      expect(seg.mix.moves[0].atS).toBe(seg.startS);
      for (const move of seg.mix.moves) {
        expect(move.atS).toBeGreaterThanOrEqual(seg.startS);
        expect(move.atS).toBeLessThan(seg.endS);
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
  });

  it('brakes like a record: slower every beat, pitch and all', () => {
    const brakes = segments().filter(s => s.exit === 'brake');
    expect(brakes.length).toBeGreaterThan(0);
    for (const seg of brakes) {
      const last = stateAt(seg.mix, seg.endS - 0.01);
      expect(last.keepPitch).toBe(false);
      expect(last.rate).toBeLessThan(
        stateAt(seg.mix, seg.endS - BAR - 0.01).rate,
      );
    }
  });

  it('plays the last record of a run out to its end', () => {
    const seg = planSegment({
      next: pool[0],
      style: 'club',
      seed: 4,
      setTempo: 128,
      finale: true,
    });
    expect(seg.endS).toBeCloseTo(song.firstBarS + 88 * BAR);
  });

  it('handles a sound with no pulse', () => {
    const seg = planSegment({
      next: pool[4],
      style: 'club',
      seed: 2,
      setTempo: 128,
    });
    expect(seg.endS).toBeGreaterThan(seg.startS + 20);
  });
});

describe('joinSegment', () => {
  it('plays on from the playhead through the next drop', () => {
    const seg = joinSegment({
      sound: pool[0],
      style: 'club',
      seed: 5,
      atS: 13.7,
      setTempo: 0,
    });
    expect(seg.startS).toBe(13.7);
    expect(seg.endS).toBeGreaterThanOrEqual(13.7 + 40);
    expect([48, 56, 80, 88]).toContain(Math.round(bar(seg.endS)));
    expect(seg.mix.moves[0].atS).toBe(13.7);
  });
});

describe('a song that stays loud from the first bar', () => {
  const loud: PoolSound = {
    soundId: 'loud',
    map: songOf(95, [
      [32, 1, 1, 0.6],
      [32, 0.95, 0.95, 0.65],
      [24, 1, 1, 0.6],
      [8, 0.4, 0.5, 0.4],
    ]),
  };

  it('is still not started from its first bar', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const seg = planSegment({
        next: loud,
        style: 'club',
        seed,
        setTempo: 95,
      });
      expect(seg.startS).toBeGreaterThan(loud.map.firstBarS + 1);
      expect(seg.endS).toBeGreaterThan(seg.startS + 20);
    }
  });
});

describe('openings and returns', () => {
  it('opens a song on its first parts and leaves before the chorus', () => {
    expect(firstPeakBar(song)).toBe(32);
    let onBuild = 0;
    for (const seg of segments({ part: 'opening' })) {
      expect(seg.part).toBe('opening');
      expect(bar(seg.startS)).toBeLessThan(32);
      if (seg.endsOn === 'build') {
        onBuild += 1;
        expect(Math.round(bar(seg.endS))).toBe(32);
        // The chorus is still ahead, so the set can come back for it.
        expect(seg.resumeBar).toBe(32);
      }
    }
    expect(onBuild).toBeGreaterThan(20);
  });

  it('comes back for a song from where it left it, shorter and never a third time', () => {
    for (const seg of segments({ part: 'later', fromBar: 48 })) {
      expect(bar(seg.startS)).toBeGreaterThanOrEqual(47.5);
      expect(Math.round(bar(seg.endS))).toBeGreaterThan(56);
      expect(seg.endS - seg.startS).toBeLessThanOrEqual(44 + 1e-6);
      expect(seg.resumeBar).toBeUndefined();
    }
  });

  it('caps a long reggaeton-style peak so a song never plays almost whole', () => {
    const longPeak: PoolSound = {
      soundId: 'reggaeton',
      map: songOf(92, [
        [8, 0.35, 0.3, 0.4],
        [32, 0.95, 0.95, 0.6],
        [32, 1, 1, 0.65],
        [32, 0.92, 0.9, 0.6],
        [8, 0.3, 0.3, 0.35],
      ]),
    };
    for (let seed = 1; seed <= 30; seed += 1) {
      const seg = planSegment({
        next: longPeak,
        style: 'club',
        seed,
        setTempo: 92,
      });
      expect(seg.endS - seg.startS).toBeLessThanOrEqual(72 + 1e-6);
    }
  });

  it('opens straight on the best part when there is nothing before it', () => {
    const seg = planSegment({
      next: {
        soundId: 'x',
        map: songOf(128, [
          [8, 1, 1, 0.6],
          [24, 0.4, 0.3, 0.5],
          [16, 1, 1, 0.6],
        ]),
      },
      style: 'club',
      seed: 3,
      setTempo: 128,
      part: 'opening',
    });
    expect(seg.part).toBe('peak');
  });
});

describe('transitionFx', () => {
  const segs = segments();

  it('never lets a record simply appear', () => {
    const random = rng(9);
    for (let i = 0; i + 1 < segs.length; i += 1) {
      const fx = transitionFx(segs[i], segs[i + 1], random, BAR);
      expect(fx.before ?? fx.on).toBeDefined();
      if (fx.beforeS !== undefined) {
        expect(fx.beforeS).toBeGreaterThanOrEqual(1);
        expect(fx.beforeS).toBeLessThanOrEqual(6);
      }
    }
  });

  it('rises into the drop a build was left hanging for', () => {
    const opening = segments({ part: 'opening' }).find(
      s => s.endsOn === 'build',
    )!;
    const drop = segs.find(s => s.entry === 'drop')!;
    const random = rng(2);
    const rising = Array.from(
      { length: 20 },
      () => transitionFx(opening, drop, random, BAR).before,
    ).filter(Boolean).length;
    expect(rising).toBeGreaterThan(15);
  });
});

describe("Juan's hands — the live gestures from his DÁKITI session", () => {
  const all = segments();
  const moves = all.flatMap(s => s.mix.moves.map(m => ({ s, m })));

  it('walks the speed a twentieth at a time and never past the slider', () => {
    for (const { m } of moves) {
      if (m.rate === undefined) continue;
      expect(m.rate).toBeGreaterThanOrEqual(0.75);
      expect(m.rate).toBeLessThanOrEqual(1.25);
      expect(Math.round(m.rate * 100) % 5).toBe(0);
    }
  });

  it('turns Preserve Pitch off somewhere across a set, and back', () => {
    const club = all.filter(s => s.mix.style === 'club');
    const offs = club.flatMap(s =>
      s.mix.moves.filter(m => m.keepPitch === false),
    );
    expect(offs.length).toBeGreaterThan(0);
  });

  it('flicks presets in bursts', () => {
    const bursty = all.some(s => {
      const g = s.mix.moves.filter(m => m.gains);
      return g.some(
        (m, i) =>
          i + 2 < g.length && g[i + 2].atS - m.atS <= 4 * (BAR / 4) + 1e-6,
      );
    });
    expect(bursty).toBe(true);
  });

  it('only changes Echo off a downbeat once a segment is playing', () => {
    for (const s of all) {
      const [first, ...rest] = s.mix.moves;
      expect(first.echo).toBeDefined();
      for (const m of rest) {
        if (m.echo === undefined) continue;
        const beat = Math.round((m.atS - song.firstBarS) / (BAR / 4));
        expect(((beat % 4) + 4) % 4).toBe(3);
      }
    }
  });

  it('leaves a played segment back on its own speed at its peak entries', () => {
    for (const s of all) {
      const state = stateAt(s.mix, s.endS - 1e-3);
      expect(state.rate).toBeGreaterThanOrEqual(0.75);
    }
  });
});

describe('planSoundSegment ("This Sound" mode)', () => {
  it('plays the sound through to its end and exercises every control group', () => {
    const seg = planSoundSegment({
      sound: { soundId: 'dakiti', map: song },
      style: 'club',
      seed: 42,
      atS: 0,
    });
    expect(seg.soundId).toBe('dakiti');
    expect(seg.startS).toBe(0);
    expect(seg.endS).toBeGreaterThanOrEqual(song.durationS - BAR);
    expect(seg.resumeBar).toBeUndefined();

    // Every control family gets moved across a single-sound mix.
    const changedGains = seg.mix.moves.some(
      m => m.gains && m.gains.some(g => g !== 0),
    );
    const changedRate = seg.mix.moves.some(
      m => m.rate !== undefined && Math.abs(m.rate - 1) > 1e-3,
    );
    const changedPitch = seg.mix.moves.some(m => m.keepPitch === false);
    const changedEcho = seg.mix.moves.some(
      m => m.echo !== undefined && m.echo !== 'off',
    );
    const changedRoom = seg.mix.moves.some(
      m => m.nextRoom !== undefined && m.nextRoom !== 'off',
    );
    expect(changedGains).toBe(true);
    expect(changedRate).toBe(true);
    expect(changedPitch).toBe(true);
    expect(changedEcho).toBe(true);
    expect(changedRoom).toBe(true);

    // Never leaves a 10s dead stretch with nothing moving.
    let maxGap = 0;
    for (let i = 1; i < seg.mix.moves.length; i += 1) {
      maxGap = Math.max(
        maxGap,
        seg.mix.moves[i].atS - seg.mix.moves[i - 1].atS,
      );
    }
    expect(maxGap).toBeLessThan(8);
  });
});
