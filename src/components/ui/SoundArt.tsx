import { useEffect, useState } from 'react';

import { type StyleProp, type ViewStyle } from 'react-native';

import { ArtImage } from '@/components/ui/ArtImage';
import { InitialArt, type MediaContainer } from '@/ui';

type SoundArtProps = {
  /** Box style — set the size + borderRadius here; the media fills it. */
  style?: StyleProp<ViewStyle>;
  /** Cover art URL (Cloudinary); when empty the initial fallback shows. */
  artUrl?: string;
  /**
   * WHERE THE SLOT SITS. Both branches take it — the loading box and the
   * initial's box are the same material, and in dark a form sheet steps every
   * grouped colour up one, so an unstepped box lands on its own row and there
   * is no box at all (see `emptyMediaColor`).
   */
  container?: MediaContainer;
  /** Layout width (dp) of the slot — fetches a display-sized Cloudinary art. */
  displayWidth?: number;
  /**
   * Side of the rendered box in dp. The fallback letter scales from it, so it
   * has to be the real size — it replaced a hand-tuned `emojiSize`, which let
   * every call site pick its own glyph-to-box ratio.
   */
  size: number;
  /** Names the sound, so an art-less slot can draw its initial. */
  title?: string | null;
  /** Forwarded to ArtImage — 0 when the caller animates the swap itself. */
  fadeMs?: number;
};

/**
 * A sound's media slot: its embedded cover art if the file had one, otherwise
 * the sound's INITIAL in a rounded box on the same neutral surface every empty
 * media slot uses — so mixed art/no-art lists look even.
 *
 * It used to draw one fixed 🎵 for every art-less sound. A single repeated glyph
 * carries no information and a column of them reads as breakage; the initial
 * differs per row and matches how a person without a photo is already drawn.
 * `InitialArt` is shared with Topper, whose items do the same thing.
 */
export function SoundArt({
  style,
  artUrl,
  container,
  displayWidth,
  size,
  title,
  fadeMs,
}: SoundArtProps) {
  // Art that fails to load degrades to the initial instead of a dead grey box.
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [artUrl]);

  if (artUrl && !failed)
    return (
      <ArtImage
        uri={artUrl}
        container={container}
        displayWidth={displayWidth}
        fadeMs={fadeMs}
        style={style}
        onError={() => setFailed(true)}
      />
    );

  return (
    <InitialArt container={container} size={size} style={style} title={title} />
  );
}
