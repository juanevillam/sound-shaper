import { create } from 'zustand';

import { byGridOrder, positionBetween } from '@/lib/gridOrder';
import { type Sound } from '@/services/firebase/sounds';

// Mirror of the ONE flat library subscription (users/{uid}/sounds), held in
// GRID ORDER — the fractional `position` each sound carries, falling back to
// the `createdAt desc` the app ordered on before positions existed. The query
// itself still asks for `createdAt desc`; see `byGridOrder` for why the
// ordering is done here rather than in Firestore.
//
// `hasSettled` flips on the first snapshot so home can branch between
// "loading" and "genuinely empty".
type SoundsState = {
  sounds: Sound[];
  error: Error | null;
  hasSettled: boolean;
  // Bumped by `retry` to re-attach a dead listener after an error.
  subNonce: number;
  /**
   * A DRAG IS IN PROGRESS, so incoming snapshots are held rather than applied.
   *
   * The library is live, and a personal app is still multi-device: the other
   * phone's reorder can land mid-gesture. Applying it would re-sort the grid
   * UNDER THE FINGER — the tile being dragged jumps to a new index and the
   * drop lands somewhere nobody aimed at. So the snapshot waits, and the drag
   * that is happening here wins the moment it ends.
   *
   * It is a held SNAPSHOT and not a suppressed one: whatever arrived last is
   * applied on release, so the two devices reconcile a gesture later rather
   * than never.
   */
  isDragging: boolean;
  /**
   * The last snapshot came from the local disk cache, not the server. Anything
   * that WRITES a correction back must wait for a server snapshot — see
   * `subscribeToSounds`.
   */
  fromCache: boolean;
  setSounds: (sounds: Sound[], meta?: { fromCache: boolean }) => void;
  setError: (error: Error) => void;
  retry: () => void;
  clear: () => void;
  setDragging: (dragging: boolean) => void;
  /**
   * Move a sound locally, ahead of the write — the grid must not wait on
   * Firestore to show where the tile landed. The write-through and its
   * revert live at the call site, which is the one that knows how to say so.
   */
  applyPosition: (soundId: string, position: number) => void;
};

/** The snapshot that arrived while a drag was running, applied on release. */
let heldSnapshot: Sound[] | null = null;

export const useSoundsStore = create<SoundsState>()((set, get) => ({
  sounds: [],
  error: null,
  hasSettled: false,
  fromCache: true,
  isDragging: false,
  subNonce: 0,
  setSounds: (sounds, meta) => {
    const fromCache = meta?.fromCache ?? false;

    if (get().isDragging) {
      heldSnapshot = sounds;
      // Still settle: a first snapshot arriving mid-drag is impossible in
      // practice (there is nothing to drag yet), but a screen stuck loading
      // behind a flag is the worse failure of the two.
      set({ error: null, fromCache, hasSettled: true });

      return;
    }

    set({
      error: null,
      fromCache,
      hasSettled: true,
      sounds: byGridOrder(sounds),
    });
  },
  setError: error => set({ error, hasSettled: true }),
  retry: () =>
    set(state => ({
      error: null,
      hasSettled: false,
      subNonce: state.subNonce + 1,
    })),
  clear: () => {
    heldSnapshot = null;
    set({
      error: null,
      fromCache: true,
      hasSettled: false,
      isDragging: false,
      sounds: [],
    });
  },
  setDragging: dragging => {
    if (dragging) {
      set({ isDragging: true });

      return;
    }

    const pending = heldSnapshot;
    heldSnapshot = null;
    set(
      pending
        ? { isDragging: false, sounds: byGridOrder(pending) }
        : { isDragging: false },
    );
  },
  applyPosition: (soundId, position) =>
    set(state => ({
      sounds: byGridOrder(
        state.sounds.map(sound =>
          sound.id === soundId ? { ...sound, position } : sound,
        ),
      ),
    })),
}));

/**
 * Where a NEWLY UPLOADED sound goes: the FRONT of the library (Juan,
 * 2026-09-12).
 *
 * It used to append past everything, on the argument that an upload should
 * never displace an arrangement made by hand. That protected the arrangement
 * and lost the sound: in a library of any size the thing you just added
 * appeared off the bottom of the screen, and the first thing you had to do with
 * it was go looking for it. The tile you just created is the one you want.
 *
 * IT IS THE FIRST *SOUND*, NOT THE FIRST CELL, and the add tile is why. That
 * tile is a control rather than content and it holds a slot in this same order,
 * so measuring the front against the sounds alone leaves it exactly where it
 * was parked — including the default, where its position is `null` and the grid
 * renders it first unconditionally. Prepending past it instead would push it
 * down by one on every single upload until it was buried.
 *
 * Reads the store directly rather than taking a hook, because both call sites
 * are inside a save handler rather than a render.
 */
export const nextLeadPosition = (): number => {
  const positions = useSoundsStore
    .getState()
    .sounds.map(sound => sound.position)
    .filter((position): position is number => position !== null);

  if (positions.length === 0) return 0;

  // `positionBetween(null, min)` is the prepend case and cannot fail, but the
  // signature allows `null` and a `?? ` here beats a non-null assertion.
  return positionBetween(null, Math.min(...positions)) ?? 0;
};
