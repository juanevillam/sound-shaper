import { create } from 'zustand';

import {
  type AwardedTrophy,
  type QueuedTrophy,
  type TrophyConfig,
  type TrophyPersistenceAdapter,
} from './types';

const nowMs = () => Date.now();

type TrophyState = {
  /** Display-ordered configs (the app's array, verbatim). */
  configs: TrophyConfig[];
  /** id → config lookup. */
  byId: Record<string, TrophyConfig>;
  adapter: TrophyPersistenceAdapter | null;
  /** id → award record. The local cache and source of truth for the UI. */
  awarded: Record<string, AwardedTrophy>;
  /** False until `load` resolves; gates derived triggers and buffers awards. */
  hydrated: boolean;
  /** Awards requested before hydration; replayed once `load` resolves. */
  buffered: string[];
  /** Unlocks waiting to pop, in order (consumed by `TrophyOverlay`). */
  queue: QueuedTrophy[];
  /**
   * Point the engine at an app's trophy set + persistence and hydrate the
   * awarded cache. Silent: hydration never enqueues popups (only fresh awards
   * do). Re-callable on account switch — pass a fresh adapter; call `reset`
   * first to clear the previous user.
   */
  configure: (
    configs: TrophyConfig[],
    adapter: TrophyPersistenceAdapter,
  ) => Promise<void>;
  /**
   * Earn a trophy. Idempotent (a no-op if already awarded), optimistic (updates
   * the cache + enqueues the popup synchronously, persists in the background),
   * and self-completing (awarding the last non-platinum trophy auto-awards
   * platinum right after). Buffered until hydration so an early trigger isn't
   * lost.
   */
  award: (id: string) => void;
  /** Drop the head of the popup queue (the overlay calls this when one finishes). */
  dequeue: () => void;
  /**
   * DEV ONLY — pop a trophy's banner WITHOUT awarding it.
   *
   * `award` is idempotent by design (the one guard that makes the engine safe
   * to call from anywhere), so it can never replay a trophy the person has
   * already earned — which is exactly what reviewing the banner, its sound and
   * its haptic needs. This enqueues straight onto the popup queue and touches
   * nothing else: no `awarded` entry, no adapter write, no platinum check. The
   * real trophy state is left exactly as it was.
   *
   * It goes through the SAME queue the real unlock uses, so the overlay's
   * `onShow` (sound + haptic), its sequencing and its suspend-while-a-sheet-is-
   * up behaviour are all the production ones.
   */
  replay: (id: string) => void;
  /** Clear all state on sign-out, so the next user starts clean. */
  reset: () => void;
};

export const useTrophyStore = create<TrophyState>()((set, get) => {
  // The award routine, factored out so the platinum check can recurse and the
  // hydration flush can replay buffered ids through the exact same path.
  const award = (id: string) => {
    const state = get();

    if (!state.hydrated) {
      if (!state.buffered.includes(id))
        set({ buffered: [...state.buffered, id] });
      return;
    }

    const config = state.byId[id];
    // Unknown id (misconfig) or already earned → nothing to do. This single
    // guard is what makes the whole engine idempotent: never re-award, re-pop,
    // or re-persist.
    if (!config || state.awarded[id]) return;

    const achievedAt = nowMs();
    const awarded = { ...state.awarded, [id]: { achievedAt } };

    set({
      awarded,
      queue: [...state.queue, { id, tier: config.tier }],
    });

    // Fire-and-forget persistence — the cache already reflects the unlock, so a
    // slow or failed write never blocks the popup. A failure just means the
    // trophy re-awards (and re-pops) next session, which is acceptable.
    state.adapter?.save(id, achievedAt).catch(() => {});

    // Platinum auto-award: when every OTHER trophy is now earned, award the
    // platinum too. It enqueues right after this one, so the two pop in
    // sequence. Skipped while awarding platinum itself (no self-recursion).
    const platinum = state.configs.find(config => config.tier === 'platinum');
    if (platinum && platinum.id !== id) {
      const others = state.configs.filter(config => config.id !== platinum.id);
      if (others.every(config => awarded[config.id])) award(platinum.id);
    }
  };

  return {
    configs: [],
    byId: {},
    adapter: null,
    awarded: {},
    hydrated: false,
    buffered: [],
    queue: [],

    configure: async (configs, adapter) => {
      const byId = Object.fromEntries(
        configs.map(config => [config.id, config]),
      );
      set({ configs, byId, adapter, hydrated: false, buffered: [] });

      let loaded: Record<string, AwardedTrophy> = {};
      try {
        loaded = await adapter.load();
      } catch {
        // Treat a failed load as "nothing earned yet"; triggers will re-award.
        loaded = {};
      }

      // Only this adapter's load may flip hydrated — a newer configure (account
      // switch) supersedes us; bailing avoids clobbering its state.
      if (get().adapter !== adapter) return;

      set({ awarded: loaded, hydrated: true });

      // Self-heal the platinum: the auto-award normally fires inside `award`,
      // but platinum's persistence is fire-and-forget, so a crash/offline kill
      // could land all objectives in storage while losing the platinum write —
      // and nothing would ever re-complete it (every objective re-award hits the
      // already-earned guard). Re-check completion against the loaded set here,
      // so the next launch pops/persists the missing platinum.
      const platinum = configs.find(config => config.tier === 'platinum');
      if (platinum && !loaded[platinum.id]) {
        const objectives = configs.filter(config => config.id !== platinum.id);
        if (
          objectives.length > 0 &&
          objectives.every(config => loaded[config.id])
        )
          award(platinum.id);
      }

      // Replay anything requested before we were ready, through the real path
      // (so dedup + platinum still hold).
      const { buffered } = get();
      if (buffered.length > 0) {
        set({ buffered: [] });
        buffered.forEach(award);
      }
    },

    award,

    dequeue: () => set(state => ({ queue: state.queue.slice(1) })),

    replay: id => {
      const config = get().byId[id];
      if (!config) return;

      set(state => ({ queue: [...state.queue, { id, tier: config.tier }] }));
    },

    reset: () =>
      set({
        configs: [],
        byId: {},
        adapter: null,
        awarded: {},
        hydrated: false,
        buffered: [],
        queue: [],
      }),
  };
});

/** Imperative award, for call sites that aren't React components (services). */
export const awardTrophy = (id: string) => useTrophyStore.getState().award(id);

/** Imperative configure (e.g. from an auth-sync hook). */
export const configureTrophies = (
  configs: TrophyConfig[],
  adapter: TrophyPersistenceAdapter,
) => useTrophyStore.getState().configure(configs, adapter);

/**
 * DEV ONLY — replay a trophy's banner without awarding it. See `replay` on the
 * store for why `awardTrophy` cannot do this.
 */
export const replayTrophy = (id: string) =>
  useTrophyStore.getState().replay(id);

/** Imperative reset on sign-out / account switch. */
export const resetTrophies = () => useTrophyStore.getState().reset();
