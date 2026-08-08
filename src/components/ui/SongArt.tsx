import { useEffect, useState } from 'react';

import { type StyleProp, type ViewStyle } from 'react-native';

import { InitialArt } from '@portfolio/mobile-ui';

import { ArtImage } from '@/components/ui/ArtImage';

type SongArtProps = {
  /** Box style — set the size + borderRadius here; the media fills it. */
  style?: StyleProp<ViewStyle>;
  /** Cover art URL (Cloudinary); when empty the initial fallback shows. */
  artUrl?: string;
  /** Layout width (dp) of the slot — fetches a display-sized Cloudinary art. */
  displayWidth?: number;
  /**
   * Side of the rendered box in dp. The fallback letter scales from it, so it
   * has to be the real size — it replaced a hand-tuned `emojiSize`, which let
   * every call site pick its own glyph-to-box ratio.
   */
  size: number;
  /** Names the song, so an art-less slot can draw its initial. */
  title?: string | null;
  /** Forwarded to ArtImage — 0 when the caller animates the swap itself. */
  fadeMs?: number;
};

/**
 * A song's media slot: its embedded cover art if the file had one, otherwise
 * the song's INITIAL in a rounded box on the same neutral surface every empty
 * media slot uses — so mixed art/no-art lists look even.
 *
 * It used to draw one fixed 🎵 for every art-less song. A single repeated glyph
 * carries no information and a column of them reads as breakage; the initial
 * differs per row and matches how a person without a photo is already drawn.
 * `InitialArt` is shared with Topper, whose items do the same thing.
 */
export function SongArt({
  style,
  artUrl,
  displayWidth,
  size,
  title,
  fadeMs,
}: SongArtProps) {
  // Art that fails to load degrades to the initial instead of a dead grey box.
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [artUrl]);

  if (artUrl && !failed)
    return (
      <ArtImage
        uri={artUrl}
        displayWidth={displayWidth}
        fadeMs={fadeMs}
        style={style}
        onError={() => setFailed(true)}
      />
    );

  return <InitialArt size={size} style={style} title={title} />;
}
