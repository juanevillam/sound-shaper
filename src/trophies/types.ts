// PlayStation-style tiers, in ascending prestige. `platinum` is special: it
// has no objective of its own and is auto-awarded once every other trophy is
// earned (see the engine's `award`).
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * The static, content-free definition of one trophy, supplied by the consuming
 * app. Order in the `trophies` array is the display order (PS lists are
 * game-defined, not sorted), and is also what the platinum check iterates over.
 * Keep it app-agnostic: no copy, no colors, no triggers live here.
 */
export type TrophyConfig = {
  /** Stable id — the persistence key and the React key everywhere. */
  id: string;
  tier: TrophyTier;
};

/**
 * Localized, user-facing copy for one trophy, keyed by trophy id. Supplied by
 * the app (so the package stays i18n-agnostic, exactly like `SettingsScreen`'s
 * injected strings) and re-supplied on locale change.
 */
export type TrophyCopy = {
  title: string;
  /** The objective, shown identically whether locked or unlocked. */
  description: string;
};

/** The award record persisted per trophy: when it was earned (epoch ms). */
export type AwardedTrophy = { achievedAt: number };

/** A trophy merged into a single render-ready shape (config + copy + state). */
export type ResolvedTrophy = TrophyConfig & {
  title: string;
  description: string;
  unlocked: boolean;
  /** Epoch ms when earned, or null while still locked. */
  achievedAt: number | null;
};

/**
 * Injected persistence so the engine stays storage-agnostic. Topper backs this
 * with Firestore (`users/{uid}/trophies/{id}`) so trophies survive a reinstall;
 * another app could use anything. The engine keeps an in-memory zustand cache
 * for instant reads and optimistic unlocks, so neither method ever blocks the
 * popup — `load` runs once on configure, `save` is fire-and-forget.
 */
export type TrophyPersistenceAdapter = {
  load: () => Promise<Record<string, AwardedTrophy>>;
  save: (trophyId: string, achievedAt: number) => Promise<void>;
};

/** A trophy queued to pop, in unlock order (see `TrophyOverlay`). */
export type QueuedTrophy = { id: string; tier: TrophyTier };
