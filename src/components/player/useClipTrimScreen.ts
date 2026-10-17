import { useEffect, useRef, useState } from 'react';

import { TROPHY_IDS } from '@/constants/trophies';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { pushTrophyCounters } from '@/lib/trophyCounters';
import { createClip, updateClip } from '@/services/firebase/clips';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { usePlayerStore } from '@/store/player';
import { awardTrophy } from '@/trophies';
import { useSnackbar } from '@/ui';

/**
 * THE CLIP-TRIM SCREEN'S LOGIC, one hook for both platform routes — the
 * Voice Memos-style editor is one surface with two chromes (an iOS sheet bar,
 * a Compose sheet's `SheetBar` on Android), and everything below the bar is
 * shared:
 * the seeded range, the pause-on-entry, the leave-when-the-sound-changes
 * guard, and the one commit with its two shapes (create vs re-frame).
 *
 * Extracted 2026-09-08, when Android retired in-place framing for this
 * editor. IT TAKES ITS PARAMS AND ITS EXIT AS ARGUMENTS rather than reading
 * the router: iOS's chrome is a ROUTE (which passes search params and
 * router.back), Android's is a Compose SHEET (`ClipTrimSheet`, stacked over
 * the Clips sheet, which passes props and its own dismiss) — one logic, two
 * doors.
 */
export function useClipTrimScreen({
  editing,
  onDone,
}: {
  /**
   * EDITING AN EXISTING CLIP — without it the surface is New Clip. One
   * editor, two commits: the anatomy of re-framing a clip IS the anatomy of
   * framing one (Juan, 2026-08-27).
   */
  editing?: { clipId: string; endMs: number; startMs: number } | null;
  /** Leave the surface — a route pops, a sheet dismisses. */
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const params = {
    clipId: editing?.clipId,
    startMs: editing == null ? undefined : String(editing.startMs),
    endMs: editing == null ? undefined : String(editing.endMs),
  };
  const editingClipId =
    typeof params.clipId === 'string' && params.clipId.length > 0
      ? params.clipId
      : null;
  const [range, setRange] = useState(() => {
    const { position, duration } = usePlayerStore.getState();
    const total = Math.floor(duration);
    if (editingClipId) {
      // Exact — a clip whose cap was set between two seconds must reopen on
      // that exact cap, not on the nearest whole second.
      const startS = Math.max(0, Number(params.startMs) / 1000);
      const endS = Number(params.endMs) / 1000;
      if (Number.isFinite(startS) && Number.isFinite(endS) && endS > startS)
        return { startS, endS };
    }
    const startS = Math.max(0, Math.round(position - 7));
    const endS = Math.min(total || 15, startS + 15);
    return { startS, endS: Math.max(endS, startS + 1) };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usePlayerStore.getState().pause();
    /**
     * Editing opens ON the clip: the band centres the playhead, and a clip
     * saved three minutes from wherever the playhead happens to rest would
     * open the editor on empty track with the selection off-screen in the
     * overview. A real seek (position differs — the store's own no-op guard
     * covers the parked-on-start case), and it also stamps `seekNonce`, which
     * is what jumps the editor's line there on the first frame.
     */
    if (editingClipId) {
      const startS = Number(params.startMs) / 1000;
      if (Number.isFinite(startS))
        usePlayerStore.getState().seek(Math.max(0, startS));
    }
    // Entry-only effect: params are stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The sound changed under the editor (skip from the island, deletion):
  // the selection no longer describes anything — leave.
  const soundIdRef = useRef(current?.id);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (current?.id !== soundIdRef.current) onDoneRef.current();
  }, [current?.id]);

  // One commit per editor. The save no longer holds the surface open, so a
  // second tap in the frames before it closes would write a second clip.
  const savingRef = useRef(false);

  /**
   * LATENCY-COMPENSATED, like the sound editor's metadata save. Firestore
   * applies the write to its local cache at once and the clips listener shows
   * it; only the SERVER's acknowledgement waits on the network. Awaiting that
   * kept the editor spinning until reconnect when saved offline, so the
   * surface closes now with the success toast, and a write the server later
   * REJECTS says so then. Both toasts are `scope: 'app'` — fired as part of
   * (or after) closing this screen, addressed to the Clips list behind it.
   * See `SnackbarScope`.
   */
  const onSave = () => {
    if (!current || savingRef.current) return;
    savingRef.current = true;
    haptics.selection();
    setSaving(true);
    const startMs = Math.round(range.startS * 1000);
    const endMs = Math.round(range.endS * 1000);
    const commit = editingClipId
      ? // Re-framing moves the RANGE and nothing else — no trophy, no
        // saved-clips count: the same bookmark, not a new one.
        updateClip({
          clipId: editingClipId,
          soundId: current.id,
          startMs,
          endMs,
        })
      : createClip({ soundId: current.id, startMs, endMs, label: '' });

    if (!editingClipId) {
      // Awarded here rather than from a store — the clips cache only holds
      // sounds you have opened, so it cannot answer "have you ever saved one".
      // All three are local-first (the trophy store and the counter persist on
      // the phone; the push queues offline), so they fire with the save rather
      // than waiting on the server's ack.
      awardTrophy(TROPHY_IDS.firstClip);
      useClipsSavedStore.getState().saved();
      // A handful of saves in a lifetime: sent on the spot.
      pushTrophyCounters();
    }

    commit.catch(() =>
      showSnackbar(t('snackbar.clip-save-failed'), undefined, {
        scope: 'app',
      }),
    );

    showSnackbar(
      t(editingClipId ? 'snackbar.clip-updated' : 'snackbar.clip-created'),
      undefined,
      { scope: 'app' },
    );
    onDone();
  };

  return { current, editingClipId, onSave, range, saving, setRange };
}
