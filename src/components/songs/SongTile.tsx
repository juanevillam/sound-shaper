import { useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { SongArt } from '@/components/ui/SongArt';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Song } from '@/services/firebase/songs';
import { TILE_RADIUS } from '@/styles/shape';

// The home grid cell: a square artwork tile (the song's embedded cover, or the
// music glyph) with the title + artist under it — YT Music's album-tile
// language, one song per tile. Tap = play, long-press = edit.

const ART_EMOJI_RATIO = 0.38;
const EMOJI_FALLBACK_SIZE = 56;

type SongTileProps = {
  song: Song;
  /** Tinted primary while this song is the loaded one. */
  isCurrent: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function SongTile({
  song,
  isCurrent,
  onPress,
  onLongPress,
}: SongTileProps) {
  const { colors } = useAppTheme();
  // Measured so the glyph fallback scales with the tile (art is width-driven).
  const [artSize, setArtSize] = useState(0);

  return (
    <SquashPressable onPress={onPress} onLongPress={onLongPress}>
      <View
        style={styles.art}
        onLayout={event => setArtSize(event.nativeEvent.layout.width)}
      >
        <SongArt
          artUrl={song.artUrl || undefined}
          displayWidth={artSize || undefined}
          emojiSize={
            artSize
              ? Math.round(artSize * ART_EMOJI_RATIO)
              : EMOJI_FALLBACK_SIZE
          }
          style={[styles.artMedia, { borderRadius: TILE_RADIUS }]}
        />
      </View>
      <Text
        doNotTranslate
        text={song.name}
        variant="bodyMedium"
        numberOfLines={1}
        style={[styles.name, isCurrent && { color: colors.primary }]}
      />
      <Text
        doNotTranslate
        muted
        text={song.artist || ' '}
        variant="bodySmall"
        numberOfLines={1}
      />
    </SquashPressable>
  );
}

/** The trailing "add a song" cell — a dashed square with a plus. */
export function AddSongTile({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <SquashPressable onPress={onPress} accessibilityLabel={t('home.addSong')}>
      <View
        style={[
          styles.art,
          styles.addBox,
          { borderColor: colors.border, borderRadius: TILE_RADIUS },
        ]}
      >
        <Text doNotTranslate text="+" style={styles.plus} />
      </View>
      <Text text="home.addSong" variant="bodyMedium" style={styles.name} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  art: { aspectRatio: 1, marginBottom: 10, width: '100%' },
  artMedia: { height: '100%', width: '100%' },
  addBox: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
  },
  plus: { fontSize: 40, fontWeight: '300' },
  name: { marginBottom: 1 },
});
