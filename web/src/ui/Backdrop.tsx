import { useEffect, useState } from 'react';

import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

/**
 * The app's PlayerBackdrop, on the web: the playing sound's cover, blurred
 * and dimmed, behind everything. Two layers, so a new cover fades in over the
 * last rather than snapping.
 */
export function Backdrop({ artUrl }: { artUrl: string }) {
  const [layers, setLayers] = useState<[string, string]>(['', '']);
  const [front, setFront] = useState(0);

  useEffect(() => {
    const src = artUrl ? thumbUrl(artUrl, 160) : '';

    if (src === layers[front]) return;
    const back = 1 - front;

    setLayers(current => {
      const copy: [string, string] = [...current];
      copy[back] = src;
      return copy;
    });
    setFront(back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artUrl]);

  return (
    <div className="backdrop" aria-hidden="true">
      {layers.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            alt=""
            className={i === front ? 'is-on' : undefined}
          />
        ) : null,
      )}
    </div>
  );
}

/**
 * THE APP'S PlayerBackdrop, LITERALLY: the cover fetched small (w_320, so
 * w_640 at 2x), blurred 60, at 0.75 over the page colour, with the same
 * fade laid over it — the app's stops, moved from its overscanned box into
 * the column's own height (screen y = offset × 1514 − 320 on the 874pt
 * phone they were measured on). An art-less sound takes the app's stand-in:
 * the ink, in two crossing ramps.
 */
export function PlayerBackdrop({ artUrl }: { artUrl: string }) {
  const [layers, setLayers] = useState<[string, string]>(['', '']);
  const [front, setFront] = useState(0);

  useEffect(() => {
    const src = artUrl ? thumbUrl(artUrl, 320) : '';

    if (src === layers[front]) return;
    const back = 1 - front;

    setLayers(current => {
      const copy: [string, string] = [...current];
      copy[back] = src;
      return copy;
    });
    setFront(back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artUrl]);

  return (
    <div className="player-backdrop" aria-hidden="true">
      <div className={artUrl ? 'standin' : 'standin is-on'} />
      {layers.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            alt=""
            className={i === front ? 'is-on' : undefined}
          />
        ) : null,
      )}
      <div className="fade" />
    </div>
  );
}
