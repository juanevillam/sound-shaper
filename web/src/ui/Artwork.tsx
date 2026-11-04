import { useState } from 'react';

import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

/**
 * A sound's picture: its cover at the width it is drawn; or, with none, the
 * app's art-less box — the first letter on the empty-media fill.
 *
 * A NEW COVER NEVER PASSES THROUGH GREY. The last picture this slot showed
 * stays underneath until the new one has landed and faded in over it — a
 * key-remounted image started from nothing, so every change of sound
 * flashed the empty fill. `quickWidth` names a size the page has most
 * likely fetched already (the grid's), drawn first as a stand-in while the
 * sharp one loads, so a cold cover is soft for a moment rather than grey.
 */
export function Artwork({
  artUrl,
  name,
  width,
  quickWidth,
  eager = false,
}: {
  artUrl: string;
  name: string;
  width: number;
  quickWidth?: number;
  eager?: boolean;
}) {
  const src = artUrl ? thumbUrl(artUrl, width) : '';
  const quick = artUrl && quickWidth ? thumbUrl(artUrl, quickWidth) : '';
  // The last picture to finish loading, of any sound: what stays beneath.
  const [ready, setReady] = useState('');
  const [quickReady, setQuickReady] = useState('');

  if (!src)
    return (
      <span className="artwork is-empty" aria-hidden="true">
        <span>{name.trim().slice(0, 1)}</span>
      </span>
    );

  const landed = ready === src;

  return (
    <span className="artwork" aria-hidden="true">
      {!landed && ready && (
        <img src={ready} alt="" draggable={false} className="is-ready" />
      )}
      {!landed && quick && (
        <img
          key={quick}
          src={quick}
          alt=""
          draggable={false}
          className={quickReady === quick ? 'is-ready' : undefined}
          onLoad={() => setQuickReady(quick)}
        />
      )}
      <img
        key={src}
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={landed ? 'is-ready' : undefined}
        onLoad={() => setReady(src)}
      />
    </span>
  );
}
