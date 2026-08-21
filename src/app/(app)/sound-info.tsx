import { StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { usePlayerStore } from '@/store/player';

// iOS-only route: read-only metadata for the PLAYING sound as a content-hugging
// native form sheet (Android presents the Compose `SoundInfoSheet` in place).
// Reads the player store directly — the sheet is only reachable from the
// player's overflow, so "the sound" is always the current one.
function SoundInfoSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const sound = usePlayerStore(s => s.current);

  if (!sound) return <View style={{ backgroundColor: colors.sheet }} />;

  const rows = [
    { label: t('player.info.artist'), value: sound.artist },
    { label: t('player.info.album'), value: sound.album },
    {
      label: t('player.info.year'),
      value: sound.releaseYear != null ? String(sound.releaseYear) : '',
    },
  ].filter(row => row.value.length > 0);

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.sheet,
          // THE FAMILY'S RHYTHM, not this sheet's own. Every `fitToContents`
          // info sheet in the portfolio stands its content 32 off both ends —
          // Topper's `creator-info` and `item-detail`, and this app's
          // `trophy-detail`. This one had drifted to 20/28 and was the only
          // member sitting tighter than its siblings.
          paddingBottom: Math.max(bottom, 32),
        },
      ]}
    >
      <Text doNotTranslate text={sound.name} variant="titleMedium" />

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
  sheet: { gap: 14, paddingHorizontal: 24, paddingTop: 32 },
  value: { alignItems: 'flex-end', flex: 1 },
  valueText: { textAlign: 'right' },
});
