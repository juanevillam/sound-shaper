/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE LIBRARY'S ORDER — a fractional index, so a move writes ONE document.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY NOT `position: index` ACROSS THE WHOLE LIST, which is what Topper's
 * `reorderTopItems` does. That model writes N documents per drag and, more to
 * the point, it is LAST-WRITE-WINS PER DOCUMENT: two signed-in phones dragging
 * at the same time interleave their batches and settle into an order neither
 * person chose. Juan asked for the two-phone case explicitly, and this is the
 * answer to it.
 *
 * A fractional index gives each entry a position BETWEEN its neighbours', so
 * moving one tile touches one document. Two phones moving DIFFERENT tiles
 * commute — both survive, and the merged order is the one both people would
 * predict. Two phones moving the SAME tile is the only conflict left, and it
 * resolves the way anyone would expect: the later write wins, for that tile
 * alone, and the rest of the order is untouched.
 *
 * FLOATS, NOT STRING KEYS, AND THE TRADE IS DELIBERATE. A base-62 key never
 * runs out of room; a float64 has ~52 bits of mantissa, so repeatedly dropping
 * a tile between the SAME adjacent pair eventually leaves no representable
 * midpoint. That takes ~50 consecutive splits of one gap, which a personal
 * library will not reach by hand — and, unlike the string scheme, the
 * degenerate case is DETECTABLE (`positionBetween` returns `null`) and
 * repairable (`renormalized`). A silent failure would have been the reason to
 * pay for the string keys; a loud one is not.
 */

/** The gap a fresh list leaves between neighbours — see `initialPositions`. */
export const POSITION_STEP = 1;

/**
 * A position strictly between `prev` and `next`, or `null` when float64 has no
 * room left between them and the caller must renormalize first.
 *
 * `null` bounds mean "no neighbour on that side": `(null, null)` is the first
 * entry in an empty library, `(prev, null)` an append, `(null, next)` a
 * prepend.
 */
export const positionBetween = (
  prev: number | null,
  next: number | null,
): number | null => {
  if (prev === null && next === null) return 0;
  if (prev === null) return (next as number) - POSITION_STEP;
  if (next === null) return prev + POSITION_STEP;

  // A caller that hands these over backwards has a sorting bug upstream, and
  // silently "fixing" it here would hide it — there is no correct answer to
  // "between 9 and 4".
  if (prev >= next) return null;

  const middle = prev + (next - prev) / 2;

  // NOT `next - prev < EPSILON`: the question is not whether the gap is small
  // but whether the midpoint is REPRESENTABLE, and that depends on where on
  // the number line the pair sits. Asking the arithmetic directly is exact at
  // every magnitude, where a fixed epsilon is wrong at most of them.
  return middle > prev && middle < next ? middle : null;
};

/** Evenly spaced positions for `count` entries — a fresh list, or a repair. */
export const initialPositions = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => index * POSITION_STEP);

/**
 * The whole order re-spaced, for the one case `positionBetween` cannot serve.
 *
 * This is the ONLY path here that writes every document, so it is also the only
 * one that carries the concurrency weakness described at the top of this file —
 * two phones renormalizing at once settle on one phone's whole order rather
 * than merging. It is allowed to, because it fires after ~50 splits of a single
 * gap and never otherwise: a rare event with a whole-order outcome is a better
 * trade than a common one with a scrambled outcome.
 */
export const renormalized = <T extends { id: string }>(
  ordered: T[],
): Array<{ id: string; position: number }> =>
  ordered.map((entry, index) => ({
    id: entry.id,
    position: index * POSITION_STEP,
  }));

/**
 * Where a tile dropped at `toIndex` belongs, given the order it landed in.
 *
 * The moved entry is ALREADY at `toIndex` in `ordered` — that is the array the
 * grid hands back — so its neighbours are the entries either side of it, and
 * the entry itself is skipped rather than read as its own bound.
 */
export const positionForMove = (
  ordered: Array<{ position: number | null }>,
  toIndex: number,
): number | null => {
  const before = ordered[toIndex - 1]?.position ?? null;
  const after = ordered[toIndex + 1]?.position ?? null;

  return positionBetween(before, after);
};

/**
 * The library in display order: by `position`, then by the `createdAt` the app
 * ordered on before positions existed.
 *
 * THE FALLBACK IS NOT DEAD CODE. A sound written by a build that predates the
 * feature carries no position at all, and a Firestore `orderBy('position')`
 * would drop those documents from the query ENTIRELY rather than sort them
 * last. So the library is still fetched newest-first and ordered here, where a
 * missing position is a sortable value instead of a disappearing row —
 * unpositioned sounds keep exactly the order they used to have, at the end,
 * until the backfill gives them one.
 */
export const byGridOrder = <
  T extends { createdAt: number | null; position: number | null },
>(
  entries: T[],
): T[] =>
  [...entries].sort((a, b) => {
    if (a.position !== null && b.position !== null) {
      return a.position - b.position;
    }
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;

    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });

/**
 * THE ORDER IS BROKEN AND HAS TO BE REWRITTEN WHOLE.
 *
 * True when anything is missing a position, and — the case that matters —
 * when two entries SHARE one. A duplicate is not cosmetic: `positionBetween`
 * refuses a pair that is not strictly increasing, so a tile dropped between
 * two twins can never be given a slot, and the grid silently stops accepting
 * moves in that region.
 *
 * IT HAPPENED HERE, which is why this exists rather than being a defensive
 * flourish. The first backfill skipped documents that already had a position
 * but still took each new one from its index in the WHOLE array, so a second
 * run over a partly-filled library handed out numbers that were already taken
 * — measured on the real library as two sounds on 6 and nothing on 2. The
 * repair below is also the reason that cannot persist: any launch that sees a
 * collision re-spaces the whole order, in the order being displayed, so the
 * damage heals itself instead of waiting to be noticed.
 */
export const needsPositionRepair = (
  entries: Array<{ position: number | null }>,
): boolean => {
  const seen = new Set<number>();

  for (const entry of entries) {
    if (entry.position === null) return true;
    if (seen.has(entry.position)) return true;
    seen.add(entry.position);
  }

  return false;
};
