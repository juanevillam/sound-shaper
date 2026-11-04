import { useEffect, useState } from 'react';

import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

/**
 * Two layers and a front: a new picture is LOADED before it takes the front,
 * so the old wash holds until there is something to fade to. Flipping on the
 * prop alone faded the old cover out over an image still on the network —
 * the column dropped to bare ground for a beat on every change of sound.
 */
function useCrossfade(src: string): {
  layers: [string, string];
  front: number;
} {
  const [state, setState] = useState<{
    layers: [string, string];
    front: number;
  }>({ layers: ['', ''], front: 0 });

  useEffect(() => {
    let live = true;
    const show = () =>
      live &&
      setState(({ layers, front }) => {
        if (layers[front] === src) return { layers, front };
        const back = 1 - front;
        const next: [string, string] = [...layers];
        next[back] = src;
        return { layers: next, front: back };
      });

    if (!src) {
      show();
      return () => {
        live = false;
      };
    }
    const img = new Image();
    img.src = src;
    img.decode().then(show, show);
    return () => {
      live = false;
    };
  }, [src]);

  return state;
}

/**
 * The app's PlayerBackdrop, on the web: the playing sound's cover, blurred
 * and dimmed, behind everything. Two layers, so a new cover fades in over the
 * last rather than snapping.
 */
export function Backdrop({ artUrl }: { artUrl: string }) {
  const { layers, front } = useCrossfade(artUrl ? thumbUrl(artUrl, 160) : '');

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
  const { layers, front } = useCrossfade(artUrl ? thumbUrl(artUrl, 320) : '');

  return (
    <div className="player-backdrop" aria-hidden="true">
      <div className={layers[front] ? 'standin' : 'standin is-on'} />
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
