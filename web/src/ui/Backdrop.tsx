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
