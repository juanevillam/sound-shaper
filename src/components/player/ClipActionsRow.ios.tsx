import { Pressable, StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import {
  BRAND_PRESSED_OPACITY,
  FLOATING_RADIUS,
  GlassSurfaceIos,
  MINI_PLAYER_HEIGHT,
  PRESSED_OPACITY,
  SwiftUIHost,
} from '@portfolio/mobile-ui';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { CONTINUOUS_CURVE, PILL_RADIUS } from '@/styles/shape';

import { type ClipActionsRowProps } from './chrome';

/**
 * IT IS THE SAME BAR IT REPLACES.
 *
 * Framing swaps this in where the Shape/Clips glass bar sits, and it used to
 * arrive as a bare 56pt row of loose parts — a grey ✕, a muted "New Clip"
 * caption that read as disabled text, a tinted word, and a filled capsule —
 * floating over the wash with no container at all. So the console's bottom
 * edge changed material, height and shape the moment you started framing,
 * which is the opposite of what a mode switch should feel like.
 *
 * Now it is the same box: `MINI_PLAYER_HEIGHT` tall, `FLOATING_RADIUS`
 * cornered, on the portfolio's floating material — which is also the collapsed
 * banner's box (see `nowPlayingBanner`). The bar stays put and only its
 * contents change, exactly as it does between the console and the banner.
 *
 * The ACCENT stays here, deliberately, and is the one place the iOS console
 * keeps it: framing is a distinct MODE rather than the resting player, Save is
 * a filled brand action, and Preview is a text button whose tint is what says
 * it is tappable at all.
 */

/** The ✕'s ink, matching the console's bar glyphs rather than a Material 20. */
const CANCEL_GLYPH = 17;
const CANCEL_TARGET = 44;

export function ClipActionsRow({
  onCancel,
  onPreview,
  onSave,
  width = 0,
}: ClipActionsRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.bar, { height: MINI_PLAYER_HEIGHT, width }]}>
      <GlassSurfaceIos
        width={width}
        height={MINI_PLAYER_HEIGHT}
        cornerRadius={FLOATING_RADIUS}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t('common.cancel')}
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancel,
            { opacity: pressed ? PRESSED_OPACITY : 1 },
          ]}
        >
          <SwiftUIHost style={styles.cancelHost} ignoreSafeArea="all">
            <Image
              systemName="xmark"
              size={CANCEL_GLYPH}
              color={colors.onSurfaceMuted}
            />
          </SwiftUIHost>
        </Pressable>

        {/* The mode's name, not an action — so it sits with the ✕ that leaves
            the mode rather than with the two that act on it. */}
        <View style={styles.title}>
          <Text muted text="player.clips.new" variant="bodyMedium" />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onPreview}
          style={({ pressed }) => [
            styles.preview,
            { opacity: pressed ? PRESSED_OPACITY : 1 },
          ]}
        >
          <Text
            text="player.clips.preview"
            variant="bodyLarge"
            numberOfLines={1}
            style={{ color: colors.primary }}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? BRAND_PRESSED_OPACITY : 1,
            },
          ]}
        >
          <Text
            text="player.clips.saveClip"
            variant="bodyLarge"
            numberOfLines={1}
            style={{ color: colors.onPrimary }}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { ...CONTINUOUS_CURVE, borderRadius: FLOATING_RADIUS },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    paddingLeft: 6,
    paddingRight: 10,
    width: '100%',
  },
  cancel: {
    alignItems: 'center',
    height: CANCEL_TARGET,
    justifyContent: 'center',
    width: CANCEL_TARGET,
  },
  cancelHost: { height: CANCEL_TARGET, width: CANCEL_TARGET },
  title: { flex: 1 },
  preview: { paddingHorizontal: 12, paddingVertical: 8 },
  save: {
    borderRadius: PILL_RADIUS,
    marginLeft: 4,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
});
