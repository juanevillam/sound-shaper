import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Clip } from '../../src/services/firebase/clips';
import { type Sound } from '../../src/services/firebase/sounds';

// The store drives the shared audio graph; here that graph is three spies.
const engine = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(),
  seek: vi.fn(),
}));
vi.mock('@/lib/audioEngine', () => ({ audioEngine: engine }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

// The other sounds' clips, as Firestore would answer them, and the service's
// session cache over them.
const remote = vi.hoisted(() => ({
  cache: new Map<string, Clip[]>(),
  clips: {} as Record<string, Clip[]>,
}));
vi.mock('@/services/firebase/analytics', () => ({ track: vi.fn() }));
vi.mock('@/services/firebase/clips', () => ({
  cachedClipsOfSound: (id: string) => remote.cache.get(id),
  getClipsOfSounds: async (ids: string[]) => {
    for (const id of ids) remote.cache.set(id, remote.clips[id] ?? []);
    return Object.fromEntries(ids.map(id => [id, remote.cache.get(id)]));
  },
}));

const { usePlayerStore } = await import('../../src/store/player');
const { useClipRepeatStore } = await import('../../src/store/clipRepeat');
const { useClipsStore } = await import('../../src/store/clips');
const { useSoundsStore } = await import('../../src/store/sounds');

const sound = (id: string, patch: Partial<Sound> = {}): Sound => ({
  album: '',
  artist: '',
  artPublicId: '',
  artUrl: '',
  audioPublicId: `audio-${id}`,
  audioUrl: `https://example.invalid/${id}.mp3`,
  createdAt: 1,
  durationMs: null,
  id,
  name: id.toUpperCase(),
  position: null,
  releaseYear: null,
  updatedAt: 1,
  ...patch,
});

const state = () => usePlayerStore.getState();
const ids = (sounds: Sound[]) => sounds.map(s => s.id);

describe('syncLibrary', () => {
  beforeEach(() => {
    state().reset();
    vi.clearAllMocks();
  });

  it('does nothing while nothing is loaded', () => {
    state().syncLibrary([sound('a')]);
    expect(state().current).toBeNull();
  });

  it('refreshes the playing copy when the document is edited', () => {
    const a = sound('a');
    state().playSound(a, [a, sound('b')]);

    state().syncLibrary([sound('a', { name: 'Renamed' }), sound('b')]);

    expect(state().current?.name).toBe('Renamed');
    expect(state().queue[0].name).toBe('Renamed');
  });

  it('keeps the same objects when a snapshot changes nothing', () => {
    const a = sound('a');
    const queue = [a, sound('b')];
    state().playSound(a, queue);

    // Firestore hands back new objects every time; field-equal is unchanged.
    state().syncLibrary([sound('a'), sound('b')]);

    expect(state().current).toBe(a);
    expect(state().queue).toBe(queue);
  });

  it('prunes a deleted sound from the queue without touching playback', () => {
    const a = sound('a');
    state().playSound(a, [a, sound('b'), sound('c')]);

    state().syncLibrary([sound('a'), sound('c')]);

    expect(ids(state().queue)).toEqual(['a', 'c']);
    expect(state().current?.id).toBe('a');
    expect(state().playing).toBe(true);
    expect(engine.pause).not.toHaveBeenCalled();
  });

  it('tears playback down when the playing sound is deleted elsewhere', () => {
    const a = sound('a');
    state().playSound(a, [a, sound('b')]);
    const nonce = state().loadNonce;

    state().syncLibrary([sound('b')]);

    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(state().current).toBeNull();
    expect(state().playing).toBe(false);
    expect(ids(state().queue)).toEqual(['b']);
    expect(state().loadNonce).toBe(nonce + 1);
  });
});

describe('soundDeleted', () => {
  beforeEach(() => {
    state().reset();
    vi.clearAllMocks();
  });

  it('only prunes the queue for a sound that is not loaded', () => {
    const a = sound('a');
    state().playSound(a, [a, sound('b')]);

    state().soundDeleted('b');

    expect(ids(state().queue)).toEqual(['a']);
    expect(state().current?.id).toBe('a');
    expect(engine.pause).not.toHaveBeenCalled();
  });

  it('takes the same teardown as a remote delete for the loaded sound', () => {
    const a = sound('a');
    state().playSound(a, [a, sound('b')]);

    state().soundDeleted('a');

    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(state().current).toBeNull();
    expect(ids(state().queue)).toEqual(['b']);
  });
});

describe('playSound', () => {
  beforeEach(() => state().reset());

  it('seeds the duration from the banked value', () => {
    const a = sound('a', { durationMs: 189_000 });
    state().playSound(a, [a]);
    expect(state().duration).toBe(189);
    expect(state().position).toBe(0);
    expect(state().playing).toBe(true);
  });
});

const clip = (id: string, startS: number, endS: number): Clip => ({
  createdAt: 1,
  endMs: endS * 1000,
  id,
  label: '',
  startMs: startS * 1000,
});

describe('repeat', () => {
  const a = sound('a');
  const b = sound('b');
  const c = sound('c');
  const a1 = clip('a1', 10, 20);
  const a2 = clip('a2', 40, 50);
  const c1 = clip('c1', 30, 35);

  // Play `a`, let its stream start, then play one of its clips.
  const startClip = (target: Clip) => {
    state().playSound(a, [a, b, c]);
    state().onPosition(0);
    state().playClip(target.id, target.startMs, target.endMs);
    state().onPosition(target.startMs / 1000);
    vi.clearAllMocks();
  };

  beforeEach(() => {
    state().reset();
    remote.cache.clear();
    remote.clips = { b: [], c: [c1] };
    useSoundsStore.setState({ sounds: [a, b, c] });
    useClipsStore.getState().clear();
    useClipsStore.getState().setClips('a', [a1, a2]);
    vi.clearAllMocks();
  });

  it('off parks the clip on its start, as before', () => {
    useClipRepeatStore.getState().setMode('off');
    startClip(a1);

    state().onPosition(20.05);

    expect(engine.pause).toHaveBeenCalled();
    expect(engine.seek).toHaveBeenCalledWith(10);
    expect(state().playing).toBe(false);
    expect(state().activeClip).toBeNull();
  });

  it('this clip loops, and ignores the report from before the jump', () => {
    useClipRepeatStore.getState().setMode('clip');
    startClip(a1);

    state().onPosition(20.05);
    // The engine has not caught up yet: still past the end.
    state().onPosition(20.15);

    expect(engine.seek).toHaveBeenCalledTimes(1);
    expect(engine.seek).toHaveBeenCalledWith(10);
    expect(engine.pause).not.toHaveBeenCalled();
    expect(state().playing).toBe(true);
    expect(state().activeClip?.clipId).toBe('a1');
    expect(state().position).toBe(10);

    state().onPosition(10.1);
    expect(state().position).toBe(10.1);
  });

  it("this sound's clips moves on, then wraps", () => {
    useClipRepeatStore.getState().setMode('sound');
    startClip(a1);

    state().onPosition(20.05);
    expect(state().activeClip?.clipId).toBe('a2');
    expect(engine.seek).toHaveBeenLastCalledWith(40);

    state().onPosition(40.1);
    state().onPosition(50.05);
    expect(state().activeClip?.clipId).toBe('a1');
    expect(state().current?.id).toBe('a');
  });

  it('all clips crosses to the next sound with clips once it loads', async () => {
    useClipRepeatStore.getState().setMode('all');
    startClip(a2);
    // `playClip` asked for the other sounds' clips; let it land.
    await Promise.resolve();

    const nonce = state().loadNonce;
    state().onPosition(50.05);

    expect(state().current?.id).toBe('c');
    expect(state().loadNonce).toBe(nonce + 1);
    expect(state().activeClip).toBeNull();
    expect(state().pendingClip?.clipId).toBe('c1');
    expect(ids(state().queue)).toEqual(['a', 'b', 'c']);

    state().onLoaded();

    expect(engine.seek).toHaveBeenCalledWith(30);
    expect(state().activeClip?.clipId).toBe('c1');
    expect(state().pendingClip).toBeNull();
    expect(state().pendingStart).toBe(false);
  });

  it('all clips waits for clips it has not read yet', async () => {
    useClipRepeatStore.getState().setMode('all');
    startClip(a2);
    remote.cache.clear();

    state().onPosition(50.05);
    // Still sounding past the boundary while the read is out.
    expect(engine.pause).not.toHaveBeenCalled();
    expect(state().current?.id).toBe('a');

    await Promise.resolve();
    await Promise.resolve();
    expect(state().pendingClip?.clipId).toBe('c1');
  });

  it('a scrub ends the run', () => {
    useClipRepeatStore.getState().setMode('clip');
    startClip(a1);

    state().seek(15);
    state().onPosition(20.05);

    expect(state().activeClip).toBeNull();
    expect(engine.seek).not.toHaveBeenCalledWith(10);
  });

  it('pause keeps the run, and resume carries on', () => {
    useClipRepeatStore.getState().setMode('clip');
    startClip(a1);

    state().toggle();
    state().toggle();
    state().onPosition(20.05);

    expect(state().activeClip?.clipId).toBe('a1');
    expect(engine.seek).toHaveBeenCalledWith(10);
  });

  it('a load paused before it lands drops the clip it was carrying', async () => {
    useClipRepeatStore.getState().setMode('all');
    startClip(a2);
    await Promise.resolve();
    state().onPosition(50.05);

    state().pause();
    state().onLoaded();

    expect(engine.seek).not.toHaveBeenCalled();
    expect(state().pendingClip).toBeNull();
    expect(state().activeClip).toBeNull();
  });

  it('the clip editor preview never repeats', () => {
    useClipRepeatStore.getState().setMode('clip');
    state().playSound(a, [a]);
    state().onPosition(0);
    state().playClip('preview', 10_000, 20_000);
    state().onPosition(10);

    state().onPosition(20.05);

    expect(state().playing).toBe(false);
    expect(state().activeClip).toBeNull();
  });
});
