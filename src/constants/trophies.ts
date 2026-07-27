import { type TrophyConfig } from '@portfolio/trophies';

// Sound Shaper's seven trophies, in PlayStation tiers: 3 bronze, 2 silver,
// 1 gold, 1 platinum — the same shape as Topper's set. Ids are the Firestore
// doc ids under `users/{uid}/trophies` and the keys into `trophies.items.*`
// i18n copy — keep them stable.
//
// Nothing here is social, because the app isn't: every objective is something
// you do alone with your own sounds — add them, shape them, clip them, listen.
export const TROPHY_IDS = {
  firstSound: 'first-sound',
  firstShape: 'first-shape',
  firstClip: 'first-clip',
  library: 'library',
  listening: 'listening',
  savedShapes: 'saved-shapes',
  platinum: 'platinum',
} as const;

// Trophy display names — ALWAYS English, never localized. The names are "-er"
// wordplay and that rule is inherently English, so they read identically in
// every locale (a translated "Escuchador" breaks the concept). Single source of
// truth; the i18n `items.*` only localize the description.
export const TROPHY_TITLES: Record<string, string> = {
  [TROPHY_IDS.firstSound]: 'Uploader',
  [TROPHY_IDS.firstShape]: 'Tuner',
  [TROPHY_IDS.firstClip]: 'Clipper',
  [TROPHY_IDS.library]: 'Stacker',
  [TROPHY_IDS.listening]: 'Listener',
  [TROPHY_IDS.savedShapes]: 'Refiner',
  [TROPHY_IDS.platinum]: 'Shaper',
};

// Thresholds for the count-based trophies. Single-sourced here and folded into
// both the trigger logic AND the localized copy (via `{count}`), so changing a
// number never desyncs the description from the objective.
export const LIBRARY_SOUND_COUNT = 3;
export const SAVED_SHAPE_COUNT = 3;
// A deliberately odd number — it reads as a real listening habit rather than a
// round target, and it is roughly an album a day for a week.
export const LISTENING_MINUTES = 133;

/**
 * The trophy set, in display order (most prestigious first — the platinum tops
 * the PS-style list). The array order is also what the engine iterates for the
 * platinum auto-award; the platinum itself is filtered out of that check.
 */
export const TROPHY_CONFIGS: TrophyConfig[] = [
  { id: TROPHY_IDS.platinum, tier: 'platinum' },
  { id: TROPHY_IDS.savedShapes, tier: 'gold' },
  { id: TROPHY_IDS.listening, tier: 'silver' },
  { id: TROPHY_IDS.library, tier: 'silver' },
  { id: TROPHY_IDS.firstSound, tier: 'bronze' },
  { id: TROPHY_IDS.firstShape, tier: 'bronze' },
  { id: TROPHY_IDS.firstClip, tier: 'bronze' },
];
