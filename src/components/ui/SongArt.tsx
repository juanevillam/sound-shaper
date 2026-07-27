import { useEffect, useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ArtImage } from '@/components/ui/ArtImage';
import { useAppTheme } from '@/hooks/useAppTheme';

// Fallback glyph when a song's file carried no embedded cover art. Songs never
// pick a custom emoji (the art comes from the file's ID3 tag or nothing), so
// one neutral music glyph keeps mixed lists even.
export const DEFAULT_SONG_EMOJI = '🎵';

type SongArtProps = {
  /** Box style — set the size + borderRadius here; the media fills it. */
  style?: StyleProp<ViewStyle>;
  /** Cover art URL (Cloudinary); when empty the glyph fallback shows. */
  artUrl?: string;
  /** Layout width (dp) of the slot — fetches a display-sized Cloudinary art. */
  displayWidth?: number;
  /** Glyph size, scaled to the box (≈24 on a 56px thumb, 40 on a cover). */
  emojiSize?: number;
  /** Forwarded to ArtImage — 0 when the caller animates the swap itself. */
  fadeMs?: number;
};

// A song's media slot: its embedded cover art if the file had one, otherwise a
// music glyph centered in a rounded box on the same neutral surface every
// empty media slot uses — so mixed art/no-art lists look even.
export function SongArt({
  style,
  artUrl,
  displayWidth,
  emojiSize = 24,
  fadeMs,
}: SongArtProps) {
  const { colors } = useAppTheme();
  // Art that fails to load degrades to the glyph instead of a dead grey box.
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

  return (
    <View
      style={[styles.box, { backgroundColor: colors.surfaceVariant }, style]}
    >
      <Text style={{ fontSize: emojiSize }}>{DEFAULT_SONG_EMOJI}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
