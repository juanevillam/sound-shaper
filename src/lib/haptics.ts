import { Vibration } from 'react-native';

// Centralized haptic vocabulary so every tap/drag/toggle across the app speaks
// the same language (mirrors Topper's). expo-haptics isn't in the dev-client
// build, so these ride RN's built-in Vibration (VIBRATE is already in the
// manifest — no native module).

// Light UI ticks — brief pulses for discrete one-off choices.
const SELECTION_MS = 8; // tab switch, segmented toggle, emoji pick
const MEDIUM_MS = 12; // a committed action — deleting a playlist / song

// Reorder (drag) feedback is a touch firmer than the UI ticks above so a drag
// feels tactile from start to finish — a grab when you pick a song up, a tick
// each time it crosses into a new slot, and a two-beat "set down" on drop.
const DRAG_PICKUP_MS = 18;
const DRAG_MOVE_MS = 11;
const DRAG_DROP_PATTERN = [0, 14, 30, 20]; // [wait, buzz, gap, buzz]

export const haptics = {
  /** Light tick for a discrete choice: tab switch, segmented toggle, pick. */
  selection: () => Vibration.vibrate(SELECTION_MS),
  /** A committed action: deleting a playlist / song. */
  medium: () => Vibration.vibrate(MEDIUM_MS),
  /** Drag picked up — a firm "grabbed it". */
  dragPickup: () => Vibration.vibrate(DRAG_PICKUP_MS),
  /** Song crossed into a new slot mid-drag — a crisp reposition tick. */
  dragMove: () => Vibration.vibrate(DRAG_MOVE_MS),
  /** Drag dropped — a two-beat "set down". */
  dragDrop: () => Vibration.vibrate(DRAG_DROP_PATTERN),
};
