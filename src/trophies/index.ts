// Engine — config-driven, idempotent, platinum auto-award. Storage lives behind
// an injected adapter; a zustand cache powers instant reads / optimistic pops.
export {
  awardTrophy,
  configureTrophies,
  resetTrophies,
  useTrophyStore,
} from './store';
export {
  resolveTrophies,
  useTrophies,
  type TrophySummary,
} from './useTrophies';

// UI — the top-anchored animated popup (with queue + platinum flair), the
// PS-style screen, and the standalone tier-tinted trophy icon.
export {
  TrophyOverlay,
  type TrophyOverlayColors,
  type TrophyOverlayProps,
  type TrophyOverlayStrings,
} from './TrophyOverlay';
export {
  TrophiesScreen,
  type TrophiesScreenColors,
  type TrophiesScreenProps,
  type TrophiesScreenStrings,
} from './TrophiesScreen';
export {
  TrophyDetailContent,
  type TrophyDetailContentColors,
  type TrophyDetailContentProps,
} from './TrophyDetailContent';
export { TrophyIcon } from './TrophyIcon';
export { TIER_COLORS, tierColor } from './tierColors';

// Types.
export {
  type AwardedTrophy,
  type QueuedTrophy,
  type ResolvedTrophy,
  type TrophyConfig,
  type TrophyCopy,
  type TrophyPersistenceAdapter,
  type TrophyTier,
} from './types';
