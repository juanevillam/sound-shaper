import { Pressable, StyleSheet, View } from 'react-native';

import { RippleIconButton } from '@/components/ui/RippleIconButton';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { PILL_RADIUS } from '@/styles/shape';

import { CLIP_ACTIONS_HEIGHT, type ClipActionsRowProps } from './chrome';

const PRESSED_OPACITY = 0.55;

// iOS counterpart of `ClipActionsRow`. Material's outlined/filled button pair
// becomes the iOS capsule pair: a plain tinted text button for the secondary
// action and a filled capsule for the primary one.
export function ClipActionsRow({
  onCancel,
  onPreview,
  onSave,
}: ClipActionsRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <RippleIconButton
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
            opacity: pressed ? PRESSED_OPACITY : 1,
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
