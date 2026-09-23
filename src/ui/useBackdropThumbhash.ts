import { useEffect, useState } from 'react';

import { Image } from 'expo-image';

/**
 * A TINY SOURCE FOR A BACKDROP THAT HAS NONE TO FETCH — one hook, every app.
 *
 * Both apps letterbox artwork the same way: the picture uncropped (`contain`)
 * over a blurred, zoomed copy of itself (`cover`), so the empty bars fill with
 * colour drawn from the image. On iOS that blur is applied by SDWebImage to the
 * DECODED SOURCE bitmap, before the view shrinks it — so the radius only reads
 * as a blur when the source is already small, which is why `ItemImage` and
 * `ArtImage` both fetch a 64px Cloudinary variant for that layer.
 *
 * A LOCAL PICK HAS NO VARIANT TO FETCH. An image straight out of the library is
 * a full-resolution `file://`, so the same radius comes out sub-pixel and the
 * backdrop renders SHARP — which is what made an editor's fresh pick look
 * unlike the very same picture once saved (Juan, 2026-09-22: the create sheet
 * against the detail sheet). Android is unaffected, blurring at VIEW size.
 *
 * `generateThumbhashAsync` is the tiny source we cannot fetch: `expo-image`'s
 * own ~32px reconstruction of the picture, decoded once, which is colour and
 * nothing else — exactly what this layer is ever read as. No new dependency, no
 * view trickery, and the caller's `blurRadius` still lands on top of it, so a
 * local pick and a remote variant end in the same smear.
 *
 * Returns `null` until the hash lands. Callers render NO backdrop while it is
 * null rather than falling back to the full-size source — that fallback is the
 * sharp backdrop this exists to remove, and it would flash on every pick.
 */
export const useBackdropThumbhash = (
  uri: string,
  enabled: boolean,
): string | null => {
  const [thumbhash, setThumbhash] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !uri) {
      setThumbhash(null);
      return;
    }

    let cancelled = false;

    // Clear first: a repick must not leave the previous pick's colours behind
    // the new picture while its own hash is being computed.
    setThumbhash(null);

    Image.generateThumbhashAsync(uri)
      .then(hash => {
        if (!cancelled) setThumbhash(hash);
      })
      // Best-effort — a hash that cannot be made just leaves the slot's own
      // empty-media material behind the art, which is what it falls back to
      // everywhere else.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, uri]);

  return enabled ? thumbhash : null;
};
