import { Pressable, StyleSheet, View } from 'react-native';

import { BRAND_PRESSED_OPACITY, PRESSED_OPACITY } from '@portfolio/mobile-ui';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { PILL_RADIUS } from '@/styles/shape';

import { CLIP_ACTIONS_HEIGHT, type ClipActionsRowProps } from './chrome';

// iOS counterpart of `ClipActionsRow`. Material's outlined/filled button pair
// becomes the iOS capsule pair: a plain tinted text button for the secondary
// action and a filled capsule for the primary one.
//
// TWO DIFFERENT DIMS, both the package's. Press feedback here is a FADE rather
// than the card squash — these are inline actions in a row — and the portfolio
// has exactly two fade values: `PRESSED_OPACITY` for text and rows, and the
// gentler `BRAND_PRESSED_OPACITY` for a large FILLED surface, where half alpha
// reads far heavier than the same fraction on a line of text. This file had one
// locally-declared 0.55 doing both jobs.
export function ClipActionsRow({
  onCancel,
  onPreview,
  onSave,
}: ClipActionsRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <IconButton
        name="close"
        onPress={onCancel}
        size={20}
        tint={colors.onSurfaceMuted}
        accessibilityLabel={t('common.cancel')}
      />
      <View style={styles.label}>
        <Text muted text="player.clips.new" variant="labelLarge" />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPreview}
        style={({ pressed }) => [
          styles.secondary,
          { opacity: pressed ? PRESSED_OPACITY : 1 },
        ]}
      >
        <Text
          text="player.clips.preview"
          variant="labelLarge"
          numberOfLines={1}
          style={{ color: colors.primary }}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSave}
        style={({ pressed }) => [
          styles.primary,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? BRAND_PRESSED_OPACITY : 1,
          },
        ]}
      >
        <Text
          text="player.clips.saveClip"
          variant="labelLarge"
          numberOfLines={1}
          style={{ color: colors.onPrimary }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flex: 1 },
  primary: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: CLIP_ACTIONS_HEIGHT,
    width: '100%',
  },
  secondary: { paddingHorizontal: 10, paddingVertical: 8 },
});
