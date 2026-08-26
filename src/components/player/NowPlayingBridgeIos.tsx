import { useEffect } from 'react';

import { PlaybackNotificationManager } from 'react-native-audio-api';

import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { usePlayerStore } from '@/store/player';

// ---------------------------------------------------------------------------
// THE SYSTEM'S NOW PLAYING SURFACE — the Dynamic Island's audio pill, the Lock
// Screen player and Control Center's card are all ONE thing, drawn by iOS for
// whichever app owns the now-playing session. Spotify does not render its
// island; it publishes `MPNowPlayingInfoCenter` metadata and answers
// `MPRemoteCommandCenter` commands, and the system does the rest. This bridge
// does exactly that through the audio library's `PlaybackNotificationManager`,
// which wraps both (see `PlaybackNotification.mm`).
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
// iOS-ONLY BY NAME, per the house rule (`…Ios.tsx`, no platform suffix, no
// stub). The same manager drives an Android media notification, but that side
// needs notification permissions and a verified device, and nothing Android
// can be verified while the freeze holds — wire it when Android resumes.
// ---------------------------------------------------------------------------

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
const REMOTE_CONTROLS = [
  ['play', true],
  ['pause', true],
  ['nextTrack', true],
  ['previousTrack', true],
  ['seekTo', true],
  ['skipForward', false],
  ['skipBackward', false],
] as const;

export function NowPlayingBridgeIos() {
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
    ];

    /**
     * The button SET is static, so it is stated once here rather than after
     * the first metadata publish — which is also the ordering iOS wants: the
     * command centre decides which controls exist, and the now-playing info
     * is what fills them. Wiring it the other way round left the first
     * rendered session holding the defaults.
     */
    REMOTE_CONTROLS.forEach(([control, enabled]) => {
      PlaybackNotificationManager.enableControl(control, enabled).catch(
        () => {},
      );
    });

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

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
      ...(current.artUrl
        ? { artwork: thumbUrl(current.artUrl, NOW_PLAYING_ART_WIDTH) }
        : {}),
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
