import { Vibration } from 'react-native';

// ANDROID'S haptic vocabulary, so every tap/drag/toggle across the app speaks
// the same language (mirrors Topper's). Durations ride RN's built-in
// `Vibration` — VIBRATE is already in the manifest, so no native module.
//
// iOS TAKES ITS OWN (`./haptics.ios.ts`), and must: iOS ignores these durations
// entirely and plays one fixed system buzz for every verb. This file used to be
// both platforms', which is exactly how that shipped.

// Light UI ticks — brief pulses for discrete one-off choices.
//
// NOT AN EQ PRESET, which is the one discrete choice in this app that
// deliberately stays silent — walked on device 2026-08-28 and left that way on
// purpose: the Shape sheet's whole job is to make you listen, and a tap in the
// hand at the moment the curve changes competes with the thing you are there
// to judge. This line named a picked preset as a case for months while the iOS
// twin documented the opposite; a decision that lives on one twin only is a
// decision the next session re-derives.
const SELECTION_MS = 8; // a saved clip, a trimmed clip's handles
const MEDIUM_MS = 12; // a committed action — see `medium` below

// Reorder (drag) feedback is a touch firmer than the UI ticks above so a drag
// feels tactile from start to finish — a grab when you pick a sound up, a tick
// each time it crosses into a new slot, and a two-beat "set down" on drop.
const DRAG_PICKUP_MS = 18;
const DRAG_MOVE_MS = 11;
const DRAG_DROP_PATTERN = [0, 14, 30, 20]; // [wait, buzz, gap, buzz]

export const haptics = {
  /** Light tick for a discrete choice: a saved clip, a trimmed clip's handles.
   *  Not an EQ preset — see above. */
  selection: () => Vibration.vibrate(SELECTION_MS),
  /** A committed action: deleting a sound, a clip or the account, and a
   *  non-platinum trophy unlock. */
  medium: () => Vibration.vibrate(MEDIUM_MS),
  /** Drag picked up — a firm "grabbed it". */
  dragPickup: () => Vibration.vibrate(DRAG_PICKUP_MS),
  /** Sound crossed into a new slot mid-drag — a crisp reposition tick. */
  dragMove: () => Vibration.vibrate(DRAG_MOVE_MS),
  /** Drag dropped — a two-beat "set down". */
  dragDrop: () => Vibration.vibrate(DRAG_DROP_PATTERN),
};
