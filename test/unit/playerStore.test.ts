import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Sound } from '../../src/services/firebase/sounds';

// The store drives the shared audio graph; here that graph is three spies.
const engine = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(),
  seek: vi.fn(),
}));
vi.mock('@/lib/audioEngine', () => ({ audioEngine: engine }));

const { usePlayerStore } = await import('../../src/store/player');

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
