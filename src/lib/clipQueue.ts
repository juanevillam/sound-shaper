/**
 * WHAT PLAYS WHEN A CLIP RUNS OUT — the Clips sheet's Repeat setting, as a
 * pure function so every mode can be tested without an audio engine.
 *
 * The four modes, in the order the sheet lists them:
 *
 * - `off`   — today's behaviour: the clip plays once and parks on its start.
 * - `clip`  — the same clip again, forever.
 * - `sound` — the next clip of the same sound, wrapping to its first.
 * - `all`   — the next clip of the same sound, then the clips of the next
 *             sound in LIBRARY order (the grid's hand order), skipping sounds
 *             with no clips and wrapping at the end of the library.
 *
 * "Next" means the order the sheet lists them in, which is `startMs`
 * ascending — the clips query's own `orderBy`. The lists handed in are
 * expected in that order already; nothing here re-sorts them.
 */

export const REPEAT_MODES = ['off', 'clip', 'sound', 'all'] as const;

export type RepeatMode = (typeof REPEAT_MODES)[number];

export const isRepeatMode = (value: unknown): value is RepeatMode =>
  (REPEAT_MODES as readonly unknown[]).includes(value);

/** The part of a clip this decision needs — `Clip` satisfies it. */
export type ClipRange = { endMs: number; id: string; startMs: number };

export type NextClip = { clip: ClipRange; soundId: string };

export type NextClipParams = {
  /**
   * The clips of every sound known so far, keyed by sound id, each in sheet
   * order. A sound that is MISSING here counts as having no clips — the caller
   * is the one that knows whether it has asked yet.
   */
  clipsBySound: Readonly<Record<string, readonly ClipRange[] | undefined>>;
  /** The clip that just ran out. It may have been deleted since it started. */
  current: ClipRange;
  /** The library's sound ids in grid order. */
  libraryOrder: readonly string[];
  mode: RepeatMode;
  soundId: string;
};

/**
 * The clip after `current` within one sound's list, or `null` past its last.
 *
 * A DELETED CURRENT CLIP still has a successor: the first clip that starts
 * after where it started. That is where the sheet's own order would have put
 * the next row, so deleting the clip that is sounding does not end the run.
 */
const followerIn = (
  clips: readonly ClipRange[],
  current: ClipRange,
): ClipRange | null => {
  const index = clips.findIndex(clip => clip.id === current.id);

  if (index !== -1) return clips[index + 1] ?? null;

  return clips.find(clip => clip.startMs > current.startMs) ?? null;
};

export const nextClip = ({
  clipsBySound,
  current,
  libraryOrder,
  mode,
  soundId,
}: NextClipParams): NextClip | null => {
  if (mode === 'off') return null;

  const own = clipsBySound[soundId] ?? [];
  const known = own.length > 0;

  if (mode === 'clip') {
    // A clip deleted while it loops stops looping: repeating a range the
    // person has thrown away would be the app keeping something they did not.
    // An UNKNOWN list (nothing loaded for this sound) is not a deletion, so
    // the range it was started with keeps going.
    if (known && !own.some(clip => clip.id === current.id)) return null;

    return { clip: current, soundId };
  }

  const follower = followerIn(own, current);
  if (follower) return { clip: follower, soundId };

  if (mode === 'sound') {
    return known ? { clip: own[0], soundId } : null;
  }

  // `all`: walk the library from the sound after this one, wrapping, and take
  // the first clip of the first sound that has any. The walk ends back on this
  // same sound, so a library whose only clips are here loops them.
  // A sound missing from the library (-1) starts the walk at index 0.
  const start = libraryOrder.indexOf(soundId);
  const count = libraryOrder.length;

  for (let step = 1; step <= count; step++) {
    const candidate = libraryOrder[(start + step) % count];
    const clips = clipsBySound[candidate];

    if (clips && clips.length > 0) {
      return { clip: clips[0], soundId: candidate };
    }
  }

  // The current sound is not in the library (deleted mid-run) and no other
  // sound has clips — or there is no library at all.
  return known ? { clip: own[0], soundId } : null;
};
