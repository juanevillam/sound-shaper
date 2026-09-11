import { useEffect } from 'react';

import { PermissionsAndroid, Platform } from 'react-native';

import { PlaybackNotificationManager } from 'react-native-audio-api';

import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { usePlayerStore } from '@/store/player';

// ---------------------------------------------------------------------------
// THE SYSTEM'S NOW PLAYING SURFACE — one bridge, both platforms.
//
// On iOS the Dynamic Island's audio pill, the Lock Screen player and Control
// Center's card are all ONE thing, drawn by the system for whichever app owns
// the now-playing session. Spotify does not render its island; it publishes
// `MPNowPlayingInfoCenter` metadata and answers `MPRemoteCommandCenter`
// commands, and the system does the rest. On Android the same publish becomes
// a MediaSession notification in the shade and on the lock screen, drawn by the
// OS from the same metadata and answering the same transport events. The audio
// library's `PlaybackNotificationManager` wraps both, which is why this file is
// one file.
//
// IT WAS iOS-ONLY UNTIL 2026-08-28, and the reason was never technical: the
// note here said Android "needs notification permissions and a verified
// device", and there was no verified device. There is now. An Android music
// player with no notification has no lock-screen or shade transport at all and
// is a background-kill candidate the moment the screen goes off — the single
// biggest native-feel gap this app had.
//
// PUSH ON DISCONTINUITIES, NEVER ON THE TICK. iOS interpolates the published
// playhead itself from one (elapsedTime, playbackRate) pair — which is also
// why a pause must publish rate 0 outright (see `speed` below). Republishing
// on the 10Hz position tick would be wrong twice over: it is wasted bridge
// traffic, and it makes the system's own interpolation stutter against the
// stream of overrides. So the effect keys off the things that BREAK the
// interpolation — the sound, play/pause, the rate, the duration landing, and
// `seekNonce`, which every discontinuous playhead move stamps (a scrub, a clip
// start, a boundary park, a restart).
//
// PUBLISH ON DISCONTINUITIES holds on Android too — a MediaSession's playback
// state carries a position and a speed and the system extrapolates from them,
// exactly as iOS does, so the same effect keys serve both.
// ---------------------------------------------------------------------------

/**
 * ANDROID 13+ WILL NOT DRAW THE NOTIFICATION WITHOUT THIS, and the foreground
 * service alone is not enough: the media-playback service is already declared
 * by the audio library's own config plugin, but `POST_NOTIFICATIONS` is a
 * runtime permission and its notification is silently dropped when it is
 * denied.
 *
 * ASKED IN CONTEXT, not at launch. Android's own guidance is to request it at
 * the moment the notification would first be useful, and there is nothing to
 * notify about until a sound is loaded — so this runs on the first `current`,
 * which is the person having pressed play. Denial is not an error: playback and
 * the foreground service both carry on, and the person simply gets no shade
 * controls.
 */
const ensureNotificationPermission = () => {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;

  void PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  ).catch(() => {});
};

/**
 * The island's artwork slot is ~60pt (~180px @3x); the Lock Screen player's is
 * ~360px. One 600px variant covers both sharp and stays one cached asset.
 */
const NOW_PLAYING_ART_WIDTH = 600;

/**
 * WHICH BUTTONS THE SYSTEM DRAWS, and the half that matters is the DISABLING.
 *
 * The library enables all seven remote commands in its own
 * `initializeWithOptions` — play, pause, nextTrack, previousTrack,
 * skipForward, skipBackward, seekTo — so every `true` below is a no-op
 * restating a default. What is NOT a no-op is turning the two SKIP commands
 * off: iOS gives the outer slots to skip-forward/back whenever they are
 * enabled alongside next/previous track, which is why the island shipped
 * with a ±15s pair (Juan's device screenshots, 2026-08-26) where this app's
 * own transport has prev/next.
 *
 * The island must mirror the app: this is a music player with a wrapping
 * queue and no ±15 control anywhere in it, and next/previous is what Music
 * and Spotify put there. The seek command stays enabled — it is the
 * scrubbable progress bar, not a button.
 */
// The same call on Android: a media notification for a music player carries
// previous / play-pause / next, not a ±15 pair. Wearables and Auto read the
// same command set.
const REMOTE_CONTROLS = [
  ['play', true],
  ['pause', true],
  ['nextTrack', true],
  ['previousTrack', true],
  ['seekTo', true],
  ['skipForward', false],
  ['skipBackward', false],
] as const;

/**
 * WHAT THE SYSTEM'S ±15s BUTTONS DO — and they are wired even though the two
 * commands above are disabled, on purpose.
 *
 * A control the system draws and the app ignores is the worst of the three
 * possible outcomes, and it is the one that shipped: the buttons were there
 * and pressing them did nothing (Juan's device, 2026-08-26). The disable is
 * a request about which buttons EXIST; these handlers are the guarantee that
 * whichever ones iOS ends up drawing, they work. If the disable takes, these
 * never fire and cost nothing.
 *
 * The interval comes from the event rather than a constant of ours — it is
 * `MPSkipIntervalCommandEvent.interval`, i.e. the number iOS actually drew
 * inside the glyph, so the two can never disagree.
 */
const skipBy = (deltaS: number) => {
  const { duration, position, seek } = usePlayerStore.getState();
  const upper = duration > 0 ? duration : position + Math.abs(deltaS);
  seek(Math.min(Math.max(position + deltaS, 0), upper));
};

export function NowPlayingBridge() {
  const current = usePlayerStore(s => s.current);
  const playing = usePlayerStore(s => s.playing);
  const rate = usePlayerStore(s => s.rate);
  const duration = usePlayerStore(s => s.duration);
  const seekNonce = usePlayerStore(s => s.seekNonce);

  // The remote commands, answered with the store's own transport actions —
  // the same ones the banner and the console call, so the island's buttons
  // cannot drift from the app's.
  useEffect(() => {
    const subscriptions = [
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationPlay',
        () => {
          const store = usePlayerStore.getState();
          if (!store.playing) store.toggle();
        },
      ),
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationPause',
        () => usePlayerStore.getState().pause(),
      ),
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationNextTrack',
        () => usePlayerStore.getState().next(),
      ),
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationPreviousTrack',
        () => usePlayerStore.getState().previous(),
      ),
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationSeekTo',
        event => usePlayerStore.getState().seek(event.value),
      ),
      // See `skipBy`: answered even though the skip commands are disabled
      // below, so the system can never draw a control this app ignores.
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationSkipForward',
        event => skipBy(event.value),
      ),
      PlaybackNotificationManager.addEventListener(
        'playbackNotificationSkipBackward',
        event => skipBy(-event.value),
      ),
    ];

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

  // Keyed on whether there IS a loaded sound rather than on which one, so
  // skipping tracks neither re-asks for the permission nor re-states a button
  // set that has not changed.
  const hasCurrent = current !== null && current !== undefined;

  /**
   * THE BUTTON SET IS STATED PER SESSION, NOT ONCE AT MOUNT — and the once-at-
   * mount version is what shipped iOS-only and drew NO transport at all on
   * Android.
   *
   * It has to come BEFORE the first metadata publish, which is the ordering iOS
   * wants: the command centre decides which controls exist and the now-playing
   * info is what fills them, and wiring it the other way round left the first
   * rendered session holding the defaults. That much was right. What it missed
   * is that a `hide()` CLEARS the set on Android — the native
   * `PlaybackNotification.reset()` zeroes its `controls` bitmask — and this
   * bridge hides whenever there is no loaded sound, which is the state the app
   * launches in. So the mount-time assertion was wiped moments later by the
   * hide it raced, and every session after it published `actions=0`.
   *
   * Measured with `adb shell dumpsys media_session` on the A54: the session
   * carried its metadata and `state=PLAYING` with `actions=0`, and Samsung's
   * media card drew the artwork, the title and a progress bar with no
   * play/pause, no next and no previous.
   *
   * Re-stating it on every session start costs seven bridge calls per SESSION
   * — the effect is keyed on whether there IS a loaded sound, not on which
   * one, so skipping tracks re-states nothing — and it cannot get out of step
   * with the hide.
   */
  useEffect(() => {
    if (!hasCurrent) return;

    ensureNotificationPermission();

    REMOTE_CONTROLS.forEach(([control, enabled]) => {
      PlaybackNotificationManager.enableControl(control, enabled).catch(
        () => {},
      );
    });
  }, [hasCurrent]);

  useEffect(() => {
    if (!current) {
      // Sign-out, deletion, queue cleared: the session is over, so the
      // island's pill and the Lock Screen player go with it.
      PlaybackNotificationManager.hide().catch(() => {});
      return;
    }

    const info = {
      title: current.name,
      // The second line under a cover is whatever the person wrote there —
      // omit it entirely when empty rather than publishing a blank string.
      ...(current.artist ? { artist: current.artist } : {}),
      /**
       * A COVER-LESS SOUND PUBLISHES AN EMPTY ARTWORK, AND OMITTING THE KEY IS
       * THE BUG THIS REPLACES.
       *
       * Both platforms MERGE a now-playing publish over the last one — iOS
       * copies `MPNowPlayingInfoCenter`'s dictionary and writes only the keys
       * the payload carries, Android holds the decoded bitmap in a FIELD and
       * re-stamps it onto every metadata build. So a sound with no cover
       * inherited whichever cover was last loaded, and the island showed sound
       * 1's artwork beside sound 2's title. Nothing in the shipped library
       * cleared it short of `hide()`, which on Android releases the
       * MediaSession and zeroes the control bitmask — see the overlay in
       * `patches/react-native-audio-api`, which makes an empty value mean
       * REMOVE on both sides.
       *
       * What the slot falls back to is then the system's own art-less
       * placeholder, which is what Music and Podcasts show and what this app
       * already showed for a sound that never had a cover at all. Both
       * cover-less cases now agree.
       */
      artwork: current.artUrl
        ? thumbUrl(current.artUrl, NOW_PLAYING_ART_WIDTH)
        : '',
      ...(duration > 0 ? { duration } : {}),
      elapsedTime: usePlayerStore.getState().position,
      /**
       * ZERO WHEN PAUSED, AND THIS IS THE ONLY PAUSE SIGNAL THE SYSTEM GETS.
       *
       * `speed` is `MPNowPlayingInfoPropertyPlaybackRate`, which is what iOS
       * interpolates its own playhead from — so publishing the app's rate
       * setting (1 by default) while paused tells the system to keep
       * counting. On device that ran the Lock Screen player to the end of
       * the track and left it there showing a playing glyph, over silence
       * (Juan, 2026-08-26); the simulator happens to freeze correctly, which
       * is how it passed the first pass of verification.
       *
       * The `state` field below cannot cover for it: the library reads
       * `_currentInfo[@"state"]` but only ever stores keys that appear in
       * its `NOW_PLAYING_INFO_KEYS` map, and `state` is not one of them — so
       * its `playbackState` write is dead code upstream. It stays published
       * because it costs nothing and comes right if that is ever fixed.
       */
      speed: playing ? rate : 0,
      state: playing ? ('playing' as const) : ('paused' as const),
    };

    // Best-effort: a failed publish must never take playback down with it,
    // and the next discontinuity retries anyway.
    PlaybackNotificationManager.show(info).catch(() => {});
  }, [current, playing, rate, duration, seekNonce]);

  return null;
}
