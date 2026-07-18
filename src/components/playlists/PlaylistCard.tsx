import { StyleSheet, View } from 'react-native';

import { SquashPressable } from '@/components/ui/SquashPressable';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Playlist } from '@/services/firebase/playlists';
import { CARD_RADIUS } from '@/styles/shape';

// Material 3 filled-card look in plain RN views (Topper's TopCard reasoning:
// a Compose Host per card measures async, so a list of them lags). Tokens
// mirror the Compose Card (surfaceContainer, 12dp corners) and the type scale.
const EMOJI_SIZE = 22;
const CARD_PADDING = 16;

type PlaylistCardProps = {
  onPress: () => void;
  /** Long-press quick actions (Edit / Delete). */
  onLongPress?: () => void;
  playlist: Playlist;
};

/**
 * Card for the home playlists list: emoji + name, then the song count. Tap
 * opens the playlist; long-press offers Edit/Delete. No visibility pill — a
 * personal app has no public tier.
 */
export function PlaylistCard({
  onPress,
  onLongPress,
  playlist,
}: PlaylistCardProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  const countLabel = `${playlist.songCount} ${t(
    playlist.songCount === 1 ? 'home.song' : 'home.songs',
  )}`;

  return (
    <SquashPressable onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          {playlist.emoji.length > 0 ? (
            <Text doNotTranslate text={playlist.emoji} style={styles.emoji} />
          ) : null}
          <Text
            doNotTranslate
            text={playlist.name}
            variant="titleMedium"
            numberOfLines={1}
            style={styles.name}
          />
        </View>

        <Text doNotTranslate muted text={countLabel} variant="bodySmall" />
      </View>
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    gap: 10,
    padding: CARD_PADDING,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  emoji: { fontSize: EMOJI_SIZE },
  name: { flex: 1 },
});
