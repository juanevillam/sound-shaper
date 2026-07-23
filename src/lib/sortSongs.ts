import { type Song } from '@/services/firebase/songs';
import { type SortMode } from '@/store/library';

// Client-side ordering for the home grid. The whole personal library is
// already in memory (one flat subscription), so sorting never costs a query.

// Locale-aware, case- and accent-insensitive, with digits compared as numbers
// ("Track 2" before "Track 10").
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/** Untagged songs sort AFTER tagged ones instead of clumping at the top. */
const byArtist = (a: Song, b: Song) => {
  const left = a.artist.trim();
  const right = b.artist.trim();

  if (!left && !right) return collator.compare(a.name, b.name);
  if (!left) return 1;
  if (!right) return -1;

  const compared = collator.compare(left, right);
  return compared !== 0 ? compared : collator.compare(a.name, b.name);
};

// A missing createdAt (a doc still awaiting its server timestamp) counts as
// "just now" so a fresh upload doesn't jump to the bottom.
const createdAt = (song: Song) => song.createdAt ?? Number.MAX_SAFE_INTEGER;

const comparators: Record<SortMode, (a: Song, b: Song) => number> = {
  recent: (a, b) => createdAt(b) - createdAt(a),
  oldest: (a, b) => createdAt(a) - createdAt(b),
  title: (a, b) => collator.compare(a.name, b.name),
  artist: byArtist,
};

/** Returns a NEW sorted array — never mutates the store's list. */
export const sortSongs = (songs: Song[], mode: SortMode): Song[] =>
  [...songs].sort(comparators[mode]);
