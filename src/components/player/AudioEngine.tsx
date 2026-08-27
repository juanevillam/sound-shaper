import { useCallback, useEffect, useRef } from 'react';

import {
  Audio,
  useAudioTagContext,
  type AudioTagHandle,
} from 'react-native-audio-api';

import { audioEngine } from '@/lib/audioEngine';
import { bankSoundDuration } from '@/services/firebase/sounds';
import { usePlayerStore } from '@/store/player';

// ---------------------------------------------------------------------------
// The playback engine. Mounts ONE streaming <Audio> element (keyed by sound so
// each track loads fresh) and routes it through the shaping graph on load.
// Transport state flows back into the player store; all control goes the other
// way through the store's actions. Rate/pitch ride the declarative props (the
// <Audio> applies them live).
// ---------------------------------------------------------------------------

// Bridges the <Audio> element's live state into the store. Must be a CHILD of
// <Audio> — it reads the element's context.
function AudioStateBridge() {
  const { currentTime, duration, playbackState } = useAudioTagContext();

  useEffect(() => {
    usePlayerStore.getState().setDuration(duration);
    /**
     * BANK IT — a sound's duration never changes, so the first engine report
     * writes it onto the document (`Sound.durationMs`) and every later load
     * seeds the scrubber from there instead of flashing `-:--`. The 1s
     * tolerance keeps a once-banked value from being re-written over
     * container-metadata jitter; a genuinely wrong banked value (a replaced
     * upload) still corrects itself on the next play.
     */
    const current = usePlayerStore.getState().current;
    if (
      duration > 0 &&
      current &&
      Math.abs((current.durationMs ?? 0) / 1000 - duration) > 1
    )
      void bankSoundDuration(current.id, Math.round(duration * 1000));
  }, [duration]);

  useEffect(() => {
    usePlayerStore.getState().onPosition(currentTime);
  }, [currentTime]);

  useEffect(() => {
    // 'idle' is transient (loading / ended) — ignore it so it can't clobber the
    // store's play intent before onLoad gets to start playback. Only the real
    // playing↔paused transitions sync back.
    if (playbackState === 'idle') return;
    usePlayerStore.getState().setPlaying(playbackState === 'playing');
  }, [playbackState]);

  return null;
}

export function AudioEngine() {
  const current = usePlayerStore(s => s.current);
  const loadNonce = usePlayerStore(s => s.loadNonce);
  const rate = usePlayerStore(s => s.rate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const ref = useRef<AudioTagHandle>(null);

  const onLoad = useCallback(() => {
    const tag = ref.current;
    if (!tag) return;

    // Wire the freshly-loaded stream through the EQ graph, then play only if
    // the store wants playback (a track reloaded at the end of the queue is
    // parked paused, ready to replay).
    audioEngine.registerHandle(tag);
    audioEngine.buildGraph(tag);
    void audioEngine.activateSession();
    if (usePlayerStore.getState().playing) tag.play();
  }, []);

  const onEnded = useCallback(() => {
    usePlayerStore.getState().onEnded();
  }, []);

  if (!current) return null;

  return (
    <Audio
      key={`${current.id}#${loadNonce}`}
      ref={ref}
      source={{ uri: current.audioUrl }}
      context={audioEngine.getContext()}
      preload="auto"
      playbackRate={rate}
      preservesPitch={keepPitch}
      onLoad={onLoad}
      onEnded={onEnded}
    >
      <AudioStateBridge />
    </Audio>
  );
}
