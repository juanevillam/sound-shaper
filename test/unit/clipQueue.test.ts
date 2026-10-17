import { describe, expect, it } from 'vitest';

import {
  isRepeatMode,
  nextClip,
  type ClipRange,
  type NextClipParams,
} from '../../src/lib/clipQueue';

const clip = (id: string, startS: number, endS = startS + 10): ClipRange => ({
  endMs: endS * 1000,
  id,
  startMs: startS * 1000,
});

// Three sounds in grid order; `b` has no clips at all.
const a1 = clip('a1', 10);
const a2 = clip('a2', 40);
const a3 = clip('a3', 90);
const c1 = clip('c1', 5);
const c2 = clip('c2', 60);

const library = ['a', 'b', 'c'];
const clipsBySound = { a: [a1, a2, a3], b: [], c: [c1, c2] };

const next = (patch: Partial<NextClipParams>) =>
  nextClip({
    clipsBySound,
    current: a1,
    libraryOrder: library,
    mode: 'off',
    soundId: 'a',
    ...patch,
  });

describe('isRepeatMode', () => {
  it('accepts the four modes and nothing else', () => {
    expect(['off', 'clip', 'sound', 'all'].every(isRepeatMode)).toBe(true);
    expect(isRepeatMode('one')).toBe(false);
    expect(isRepeatMode(undefined)).toBe(false);
  });
});

describe('off', () => {
  it('plays nothing next', () => {
    expect(next({ mode: 'off' })).toBeNull();
  });
});

describe('this clip', () => {
  it('repeats the clip that ran out', () => {
    expect(next({ mode: 'clip', current: a2 })).toEqual({
      clip: a2,
      soundId: 'a',
    });
  });

  it('stops once the clip has been deleted', () => {
    expect(
      next({ mode: 'clip', current: a2, clipsBySound: { a: [a1, a3] } }),
    ).toBeNull();
  });

  it('keeps the range going when the sound’s clips are not loaded', () => {
    expect(next({ mode: 'clip', clipsBySound: {} })).toEqual({
      clip: a1,
      soundId: 'a',
    });
  });
});

describe("this sound's clips", () => {
  it('moves to the next clip in sheet order', () => {
    expect(next({ mode: 'sound', current: a1 })?.clip).toBe(a2);
    expect(next({ mode: 'sound', current: a2 })?.clip).toBe(a3);
  });

  it('wraps from the last clip to the first', () => {
    expect(next({ mode: 'sound', current: a3 })).toEqual({
      clip: a1,
      soundId: 'a',
    });
  });

  it('loops a single clip', () => {
    expect(
      next({
        mode: 'sound',
        current: c1,
        soundId: 'x',
        clipsBySound: { x: [c1] },
      }),
    ).toEqual({ clip: c1, soundId: 'x' });
  });

  it('continues after a deleted clip from where it started', () => {
    // a2 (40s) is gone; the next row after 40s is a3.
    expect(
      next({ mode: 'sound', current: a2, clipsBySound: { a: [a1, a3] } })?.clip,
    ).toBe(a3);
  });

  it('wraps after a deleted last clip', () => {
    expect(
      next({ mode: 'sound', current: a3, clipsBySound: { a: [a1, a2] } })?.clip,
    ).toBe(a1);
  });

  it('stops when the sound has no clips left', () => {
    expect(next({ mode: 'sound', clipsBySound: { a: [] } })).toBeNull();
  });

  it('never leaves the sound', () => {
    expect(next({ mode: 'sound', current: a3 })?.soundId).toBe('a');
  });
});

describe('all clips', () => {
  it('moves to the next clip of the same sound first', () => {
    expect(next({ mode: 'all', current: a1 })).toEqual({
      clip: a2,
      soundId: 'a',
    });
  });

  it('skips a sound with no clips on the way to the next sound', () => {
    expect(next({ mode: 'all', current: a3 })).toEqual({
      clip: c1,
      soundId: 'c',
    });
  });

  it('treats a sound whose clips are unknown as having none', () => {
    expect(
      next({
        mode: 'all',
        current: a3,
        clipsBySound: { a: [a1, a2, a3], c: [c1] },
      })?.soundId,
    ).toBe('c');
  });

  it('wraps from the end of the library to the first sound with clips', () => {
    expect(next({ mode: 'all', current: c2, soundId: 'c' })).toEqual({
      clip: a1,
      soundId: 'a',
    });
  });

  it('loops one sound when it is the only one with clips', () => {
    expect(
      next({
        mode: 'all',
        current: a3,
        clipsBySound: { a: [a1, a2, a3], b: [], c: [] },
      }),
    ).toEqual({ clip: a1, soundId: 'a' });
  });

  it('loops a single clip in a library with no other clips', () => {
    expect(
      next({
        mode: 'all',
        current: c1,
        soundId: 'c',
        clipsBySound: { c: [c1] },
      }),
    ).toEqual({ clip: c1, soundId: 'c' });
  });

  it('continues after a deleted current clip', () => {
    expect(
      next({
        mode: 'all',
        current: a2,
        clipsBySound: { ...clipsBySound, a: [a1, a3] },
      })?.clip,
    ).toBe(a3);
    expect(
      next({
        mode: 'all',
        current: a3,
        clipsBySound: { ...clipsBySound, a: [a1, a2] },
      }),
    ).toEqual({ clip: c1, soundId: 'c' });
  });

  it('walks from the front when the current sound left the library', () => {
    expect(
      next({ mode: 'all', current: a3, libraryOrder: ['b', 'c'] }),
    ).toEqual({ clip: c1, soundId: 'c' });
  });

  it('plays nothing when nothing anywhere has a clip', () => {
    expect(
      next({ mode: 'all', clipsBySound: { a: [], b: [], c: [] } }),
    ).toBeNull();
  });
});
