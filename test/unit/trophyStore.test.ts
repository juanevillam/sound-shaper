import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrophyStore } from '../../src/trophies/store';
import {
  type AwardedTrophy,
  type TrophyConfig,
  type TrophyPersistenceAdapter,
} from '../../src/trophies/types';

const CONFIGS: TrophyConfig[] = [
  { id: 'first', tier: 'bronze' },
  { id: 'second', tier: 'silver' },
  { id: 'platinum', tier: 'platinum' },
];

/** An in-memory adapter whose `load` the test can hold open. */
const adapter = (loaded: Record<string, AwardedTrophy> = {}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => (release = resolve));
  const save = vi.fn<TrophyPersistenceAdapter['save']>(async () => {});
  const a: TrophyPersistenceAdapter & { save: typeof save } = {
    load: async () => {
      await gate;
      return loaded;
    },
    save,
  };
  return { adapter: a, release, save };
};

const state = () => useTrophyStore.getState();
const queued = () => state().queue.map(entry => entry.id);

describe('the trophy engine', () => {
  beforeEach(() => state().reset());

  it('awards once, however many times it is asked', async () => {
    const { adapter: a, release, save } = adapter();
    release();
    await state().configure(CONFIGS, a);

    state().award('first');
    state().award('first');

    expect(Object.keys(state().awarded)).toEqual(['first']);
    expect(queued()).toEqual(['first']);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('ignores an id that is not configured', async () => {
    const { adapter: a, release, save } = adapter();
    release();
    await state().configure(CONFIGS, a);

    state().award('nope');
    expect(state().awarded).toEqual({});
    expect(save).not.toHaveBeenCalled();
  });

  it('auto-awards the platinum right after the last objective', async () => {
    const { adapter: a, release, save } = adapter();
    release();
    await state().configure(CONFIGS, a);

    state().award('first');
    expect(state().awarded.platinum).toBeUndefined();
    state().award('second');

    expect(queued()).toEqual(['first', 'second', 'platinum']);
    expect(save.mock.calls.map(call => call[0])).toEqual([
      'first',
      'second',
      'platinum',
    ]);
  });

  it('buffers awards made before hydration and replays them once', async () => {
    const { adapter: a, release } = adapter({ first: { achievedAt: 1 } });
    const configuring = state().configure(CONFIGS, a);

    state().award('first'); // already earned on the server
    state().award('second');
    state().award('second');
    expect(state().buffered).toEqual(['first', 'second']);
    expect(queued()).toEqual([]);

    release();
    await configuring;

    expect(state().buffered).toEqual([]);
    // `first` was loaded, so only `second` pops — and completes the platinum.
    expect(queued()).toEqual(['second', 'platinum']);
    expect(state().awarded.first).toEqual({ achievedAt: 1 });
  });

  it('heals a platinum whose write was lost', async () => {
    const {
      adapter: a,
      release,
      save,
    } = adapter({
      first: { achievedAt: 1 },
      second: { achievedAt: 2 },
    });
    release();
    await state().configure(CONFIGS, a);

    expect(queued()).toEqual(['platinum']);
    expect(save).toHaveBeenCalledWith('platinum', expect.any(Number));
  });

  it('pops nothing on a plain hydration', async () => {
    const { adapter: a, release } = adapter({ first: { achievedAt: 1 } });
    release();
    await state().configure(CONFIGS, a);
    expect(queued()).toEqual([]);
  });

  it('lets a newer configure win over a slower one', async () => {
    const older = adapter({ first: { achievedAt: 1 } });
    const newer = adapter({});
    const first = state().configure(CONFIGS, older.adapter);
    const second = state().configure(CONFIGS, newer.adapter);

    newer.release();
    await second;
    older.release();
    await first;

    expect(state().adapter).toBe(newer.adapter);
    expect(state().awarded).toEqual({});
  });

  it('treats a failed load as nothing earned', async () => {
    const failing: TrophyPersistenceAdapter = {
      load: async () => {
        throw new Error('offline');
      },
      save: async () => {},
    };
    await state().configure(CONFIGS, failing);
    expect(state().hydrated).toBe(true);
    expect(state().awarded).toEqual({});
  });
});
