import * as Haptics from 'expo-haptics';

// iOS twin of the shared haptic vocabulary (see ./haptics.ts for the Android
// side). Same five verbs, spoken in the platform's own language.
//
// THIS IS TOPPER'S FILE, and that is the point — a surface solved in one app is
// the same component in the others. The two apps' vocabularies were already
// identical; only Topper had the iOS half, so Sound Shaper spoke Android's on
// both platforms for as long as this was missing.
//
// RN's `Vibration` is unusable here: iOS ignores the duration entirely and
// plays one fixed system buzz for every call (`RCTVibration.mm` →
// `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)`), and it has no
// `vibrateByPattern` at all — RN emulates patterns in JS as repeated 400ms
// buzzes. So every verb felt identical, heavy, and nothing like the Taptic
// Engine. That mattered most on the ONE verb this app uses it for that Topper
// does not: the platinum trophy's `dragDrop`, whose "two-beat set down" was
// two 400ms motor buzzes over the music.
//
// expo-haptics maps straight onto UIKit's feedback generators, which is where
// iOS's intensity lives — discrete, tuned taps rather than durations.
//
// Fire-and-forget: callers are sync, and a missing native module must not
// surface as an unhandled rejection over a cosmetic tap.
const fire = (run: () => Promise<void>) => {
  void run().catch(() => {});
};

export const haptics = {
  /**
   * Light tick for a discrete choice: a saved clip, a trimmed clip's handles.
   *
   * NOT AN EQ PRESET, which is the one discrete choice in this app that
   * deliberately stays silent. It was walked on device on 2026-08-28 and left
   * that way on purpose: the Shape sheet's whole job is to make you listen, and
   * a tap in the hand at the moment the curve changes competes with the thing
   * you are there to judge.
   */
  selection: () => fire(() => Haptics.selectionAsync()),
  /** A committed action: deleting a sound or a clip. */
  medium: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Drag picked up — a firm "grabbed it". */
  dragPickup: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Crossed into a new slot mid-drag — a crisp reposition tick. */
  dragMove: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /**
   * A two-beat "set down" (UINotificationFeedbackType.success) — and in this
   * app it is also the PLATINUM trophy's, under that trophy's own chime
   * (`lib/trophySound`, which pauses the song around it).
   */
  dragDrop: () =>
    fire(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
};
