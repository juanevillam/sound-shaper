import { useEffect, useRef, useState } from 'react';

import { type Waveform, getWaveform } from '@/lib/waveform';

/**
 * The clip editor's view of `getWaveform`.
 *
 * IT REPORTS A STATUS, NOT JUST A RESULT, and that is the whole point of the
 * shape. It used to return `Waveform | null`, collapsing "decoding" and
 * "decode failed" into one value — so the editor could only ever draw the
 * same thing for both, and what it drew was a flat field of low bars. That
 * placeholder was the defect: a flat waveform is a PLAUSIBLE waveform (a
 * near-silent recording looks exactly like it), so the surface read as
 * settled content rather than as a wait, with no loading indicator anywhere
 * on it (Juan, 2026-09-13, on both platforms). A placeholder that can be
 * mistaken for the content is worse than no placeholder.
 *
 * The geometry still never waits on the network: the band, the ruler, the
 * playhead and the trim frame are all derived from the duration, which the
 * sound document already carries. Only the INK is missing, and the three
 * states say which of the three things is true of it.
 *
 * The nonce is the `loadNonce` idiom: a resolution that lands after the sound
 * changed (or the editor closed) is dropped instead of painting the wrong
 * track's waveform.
 */
export type WaveformStatus = 'loading' | 'ready' | 'failed';

type WaveformState = {
  status: WaveformStatus;
  waveform: Waveform | null;
};

const LOADING: WaveformState = { status: 'loading', waveform: null };

export function useWaveform(
  soundId?: string,
  audioUrl?: string,
): WaveformState {
  const [state, setState] = useState<WaveformState>(LOADING);
  const nonceRef = useRef(0);

  useEffect(() => {
    nonceRef.current += 1;
    const nonce = nonceRef.current;
    setState(LOADING);
    if (!soundId || !audioUrl) return;

    getWaveform(soundId, audioUrl).then(result => {
      if (nonceRef.current !== nonce) return;
      setState(
        result
          ? { status: 'ready', waveform: result }
          : // A failed decode is EVICTED from `getWaveform`'s in-flight map,
            // so re-entering the editor retries — offline once is not offline
            // forever, and this surface never asks again on its own.
            { status: 'failed', waveform: null },
      );
    });
  }, [soundId, audioUrl]);

  return state;
}
