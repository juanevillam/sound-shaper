import { Pressable, StyleSheet, View } from 'react-native';

import {
  BRAND_PRESSED_OPACITY,
  FLOATING_RADIUS,
  GlassSurfaceIos,
  MINI_PLAYER_HEIGHT,
  PRESSED_OPACITY,
} from '@portfolio/mobile-ui';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { CONTINUOUS_CURVE, PILL_RADIUS } from '@/styles/shape';

import { type ClipActionsRowProps } from './chrome';

/**
 * PHOTOS' TRIM BAR, IN THE GLASS BAR'S BOX: leave the mode, or commit it.
 *
 * Framing swaps this in where the Shape/Clips glass bar sits — same
 * `MINI_PLAYER_HEIGHT` box, same `FLOATING_RADIUS`, same material — so the
 * console's bottom edge never changes shape on a mode switch. Only the
 * contents change.
 *
 * IT HELD A THIRD CONTROL AND THAT WAS THE DEFECT (Juan, 2026-08-23): a
 * preview play glyph sat dead centre here while the transport's own play sat
 * ~130pt directly above it — the same triangle, on the same centre line,
 * meaning two different things ("like seeing the player controls twice").
 * Preview is now what the TRANSPORT's play button does while framing, so
 * there is exactly one play control on the screen and this bar is left with
 * the two actions that are genuinely its own.
 *
 * That is also the shape Apple ships: Photos and Voice Memos put a single
 * play beside the trim surface and leave the bar to Cancel and the commit.
 * `onPreview` stays on the shared props because ANDROID's row still owns its
 * own preview button; this side no longer draws one.
 *
 * Save keeps the filled brand pill: framing is a distinct MODE rather than
 * the resting player, and Save is its one commit — the accent carve-out the
 * monochrome rule names.
 */
export function ClipActionsRow({
  onCancel,
  onSave,
  width = 0,
}: ClipActionsRowProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();

  return (
    // The bar's CONTENTS fade in over the mode change — the box, corner and
    // material are the resting glass bar's exactly, so only what the bar says
    // should read as changing. Same 200ms as the trim frame's own entrance
    // and the time row's drop: one transition, three parts.
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      style={[styles.bar, { height: MINI_PLAYER_HEIGHT, width }]}
    >
      <GlassSurfaceIos
        width={width}
        height={MINI_PLAYER_HEIGHT}
        cornerRadius={FLOATING_RADIUS}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancel,
            { opacity: pressed ? PRESSED_OPACITY : 1 },
          ]}
        >
          <Text
            text="common.cancel"
            variant="bodyLarge"
            numberOfLines={1}
            style={{ color: colors.onSurface }}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { ...CONTINUOUS_CURVE, borderRadius: FLOATING_RADIUS },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 10,
    width: '100%',
  },
  cancel: { paddingHorizontal: 12, paddingVertical: 8 },
  save: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
});
