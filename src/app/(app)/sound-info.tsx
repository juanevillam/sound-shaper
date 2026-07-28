import { StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { usePlayerStore } from '@/store/player';

// iOS-only route: read-only metadata for the PLAYING song as a content-hugging
// native form sheet (Android presents the Compose `SongInfoSheet` in place).
// Reads the player store directly — the sheet is only reachable from the
// player's overflow, so "the song" is always the current one.
function SoundInfoSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const song = usePlayerStore(s => s.current);

  if (!song) return <View style={{ backgroundColor: colors.sheet }} />;

  const rows = [
    { label: t('player.info.artist'), value: song.artist },
    { label: t('player.info.album'), value: song.album },
    {
      label: t('player.info.year'),
      value: song.releaseYear != null ? String(song.releaseYear) : '',
    },
  ].filter(row => row.value.length > 0);

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.sheet,
          paddingBottom: Math.max(bottom, 28),
        },
      ]}
    >
      <Text doNotTranslate text={song.name} variant="titleMedium" />

      {rows.length === 0 ? (
        <Text muted text="player.info.none" variant="bodySmall" />
      ) : (
        rows.map(row => (
          <View key={row.label} style={styles.row}>
            <Text doNotTranslate muted text={row.label} variant="bodyMedium" />
            <View style={styles.value}>
              <Text
                doNotTranslate
                text={row.value}
                variant="bodyMedium"
                numberOfLines={2}
                style={styles.valueText}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default iosOnlyRoute(SoundInfoSheetScreen);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  sheet: { gap: 14, paddingHorizontal: 24, paddingTop: 20 },
  value: { alignItems: 'flex-end', flex: 1 },
  valueText: { textAlign: 'right' },
});
