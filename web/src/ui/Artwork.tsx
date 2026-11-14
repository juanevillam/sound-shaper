import { useState } from 'react';

import { thumbUrl } from '../lib/thumbUrl';

/**
 * An item's picture, or — with none — the app's art-less box (the first
 * letter on the empty-media fill).
 *
 * A NEW COVER NEVER PASSES THROUGH GREY. The last picture this slot showed
 * stays underneath until the new one has landed and faded in over it.
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
  const [ready, setReady] = useState('');
  const [quickReady, setQuickReady] = useState('');

  if (!src) {
    return (
      <span className="artwork is-empty" aria-hidden="true">
        <span>{name.trim().slice(0, 1)}</span>
      </span>
    );
  }

  const landed = ready === src;

  return (
    <span className="artwork" aria-hidden="true">
      {!landed && ready && (
        <img src={ready} alt="" draggable={false} className="is-ready" />
      )}
      {!landed && quick && (
        <img
          key={quick}
          ref={el => {
            if (el?.complete && el.naturalWidth > 0 && quickReady !== quick) {
              setQuickReady(quick);
            }
          }}
          src={quick}
          alt=""
          draggable={false}
          className={quickReady === quick ? 'is-ready' : undefined}
          onLoad={() => setQuickReady(quick)}
        />
      )}
      <img
        key={src}
        ref={el => {
          if (el?.complete && el.naturalWidth > 0 && ready !== src) {
            setReady(src);
          }
        }}
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
