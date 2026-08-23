import { useEffect, useRef, useState } from 'react';

import { type Waveform, getWaveform } from '@/lib/waveform';

/**
 * The trim strip's view of `getWaveform` — null while decoding or after a
 * failure, so the strip draws placeholder bars either way and its geometry
 * never waits on the network.
 *
 * The nonce is the `loadNonce` idiom: a resolution that lands after the sound
 * changed (or the strip unmounted — the strip only exists in clip mode) is
 * dropped instead of painting the wrong track's waveform.
 */
export function useWaveform(
  soundId?: string,
  audioUrl?: string,
): Waveform | null {
  const [waveform, setWaveform] = useState<Waveform | null>(null);
  const nonceRef = useRef(0);

  useEffect(() => {
    nonceRef.current += 1;
    const nonce = nonceRef.current;
    setWaveform(null);
    if (!soundId || !audioUrl) return;

    getWaveform(soundId, audioUrl).then(result => {
      if (nonceRef.current === nonce && result) setWaveform(result);
    });
  }, [soundId, audioUrl]);

  return waveform;
}
