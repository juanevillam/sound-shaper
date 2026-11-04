import { useState } from 'react';

import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

/**
 * A sound's picture: its cover at the width it is drawn, fading in when it
 * lands; or, with none, the app's art-less box — the first letter on the
 * empty-media fill.
 */
export function Artwork({
  artUrl,
  name,
  width,
  eager = false,
}: {
  artUrl: string;
  name: string;
  width: number;
  eager?: boolean;
}) {
  const src = artUrl ? thumbUrl(artUrl, width) : '';
  // Ready is per picture, so a new cover fades in too.
  const [loaded, setLoaded] = useState('');

  if (!src)
    return (
      <span className="artwork is-empty" aria-hidden="true">
        <span>{name.trim().slice(0, 1)}</span>
      </span>
    );

  return (
    <span className="artwork" aria-hidden="true">
      <img
        key={src}
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={loaded === src ? 'is-ready' : undefined}
        onLoad={() => setLoaded(src)}
      />
    </span>
  );
}
