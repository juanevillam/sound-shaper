import { useEffect, useRef } from 'react';

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
// playhead itself from one (elapsedTime, playbackRate) pair — that is why a
// paused state publishes rate 0 implicitly via `state: 'paused'`. Republishing
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

/** The controls the system surfaces answer to — wired once, below. */
const REMOTE_CONTROLS = [
  'play',
  'pause',
  'nextTrack',
  'previousTrack',
  'seekTo',
] as const;

export function NowPlayingBridgeIos() {
  const current = usePlayerStore(s => s.current);
  const playing = usePlayerStore(s => s.playing);
  const rate = usePlayerStore(s => s.rate);
  const duration = usePlayerStore(s => s.duration);
  const seekNonce = usePlayerStore(s => s.seekNonce);

  const controlsWiredRef = useRef(false);

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

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

  useEffect(() => {
    if (!current) {
      // Sign-out, deletion, queue cleared: the session is over, so the
      // island's pill and the Lock Screen player go with it.
      controlsWiredRef.current = false;
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
      speed: rate,
      state: playing ? ('playing' as const) : ('paused' as const),
    };

    PlaybackNotificationManager.show(info)
      .then(() => {
        if (controlsWiredRef.current) return;
        controlsWiredRef.current = true;
        return Promise.all(
          REMOTE_CONTROLS.map(control =>
            PlaybackNotificationManager.enableControl(control, true),
          ),
        );
      })
      .catch(() => {
        // Best-effort: a failed publish must never take playback down with
        // it, and the next discontinuity retries anyway.
        controlsWiredRef.current = false;
      });
  }, [current, playing, rate, duration, seekNonce]);

  return null;
}
