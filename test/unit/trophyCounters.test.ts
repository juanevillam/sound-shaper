import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => void memory.set(key, value),
    removeItem: async (key: string) => void memory.delete(key),
  },
}));

const increment = vi.fn<(args: unknown) => Promise<void>>();
vi.mock('@/services/firebase/users', () => ({
  incrementTrophyCounters: (args: unknown) => increment(args),
}));

const {
  blockTrophyCounterSync,
  hydrateTrophyCounters,
  pushTrophyCounters,
  resetTrophyCounterSync,
} = await import('../../src/lib/trophyCounters');
const { useAuthStore } = await import('../../src/store/auth');
const { useClipsSavedStore } = await import('../../src/store/clipsSaved');
const { useListeningStore } = await import('../../src/store/listening');

const UID = 'person-a';

const profile = (
  listenedSeconds: number | null,
  clipsSaved: number | null,
  uid = UID,
) => ({
  addTilePosition: null,
  clipsSaved,
  createdAt: null,
  displayName: null,
  listenedSeconds,
  photoUrl: null,
  uid,
  updatedAt: null,
});

const signIn = (uid = UID) =>
  useAuthStore.getState().setUser({
    displayName: null,
    email: null,
    photoUrl: null,
    uid,
  });

/**
 * THE TROPHY TOTALS ARE SENT AS INCREMENTS, ONCE EACH. The failure this
 * guards is counting a person's listening twice (or not at all) across the
 * move from the phone to Firestore.
 */
describe('trophyCounters', () => {
  beforeEach(() => {
    increment.mockReset();
    increment.mockResolvedValue(undefined);
    resetTrophyCounterSync();
    useListeningStore.getState().reset();
    useClipsSavedStore.getState().reset();
    signIn();
  });

  it('sends nothing before the server totals are taken', () => {
    useListeningStore.getState().add(30);
    pushTrophyCounters();
    expect(increment).not.toHaveBeenCalled();
  });

  it('uploads a device total the server has never seen, once', async () => {
    useListeningStore.getState().add(600);
    useClipsSavedStore.getState().saved();
    // Pushed early, before hydration: must not be sent, or it counts twice.
    pushTrophyCounters();

    await hydrateTrophyCounters(profile(null, null));

    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith({
      clipsSaved: 1,
      listenedSeconds: 600,
      uid: UID,
    });
    expect(useListeningStore.getState().unsynced).toBe(0);
    expect(useListeningStore.getState().seconds).toBe(600);
  });

  it('takes the server total and keeps the unsent part on top', async () => {
    useListeningStore.getState().add(20);
    await hydrateTrophyCounters(profile(1000, 4));

    expect(useListeningStore.getState().seconds).toBe(1020);
    expect(useClipsSavedStore.getState().count).toBe(4);
    expect(increment).toHaveBeenCalledWith({
      clipsSaved: 0,
      listenedSeconds: 20,
      uid: UID,
    });
  });

  it('sends only what accrued since the last push', async () => {
    await hydrateTrophyCounters(profile(0, 0));
    useListeningStore.getState().add(5);
    pushTrophyCounters();
    useListeningStore.getState().add(7);
    pushTrophyCounters();

    expect(
      increment.mock.calls.map(
        ([args]) => (args as { listenedSeconds: number }).listenedSeconds,
      ),
    ).toEqual([5, 7]);
  });

  it('puts a rejected write back for the next boundary', async () => {
    await hydrateTrophyCounters(profile(0, 0));
    increment.mockRejectedValueOnce(new Error('permission-denied'));
    useListeningStore.getState().add(9);
    pushTrophyCounters();
    await Promise.resolve();
    await Promise.resolve();

    expect(useListeningStore.getState().unsynced).toBe(9);
  });

  it('sends nothing while an account is being deleted', async () => {
    await hydrateTrophyCounters(profile(0, 0));
    blockTrophyCounterSync(true);
    useListeningStore.getState().add(9);
    pushTrophyCounters();

    expect(increment).not.toHaveBeenCalled();
  });

  it('ignores a profile that belongs to an account no longer signed in', async () => {
    signIn('person-b');
    await hydrateTrophyCounters(profile(500, 2, UID));

    expect(useListeningStore.getState().seconds).toBe(0);
    useListeningStore.getState().add(3);
    pushTrophyCounters();
    expect(increment).not.toHaveBeenCalled();
  });
});
