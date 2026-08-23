import { Pressable, StyleSheet, View } from 'react-native';

import {
  BRAND_PRESSED_OPACITY,
  FLOATING_RADIUS,
  GlassSurfaceIos,
  MINI_PLAYER_HEIGHT,
  PRESSED_OPACITY,
} from '@portfolio/mobile-ui';

import { GlyphButton } from '@/components/player/GlyphButton';
import { PauseGlyph, PlayGlyph } from '@/components/player/TransportGlyphs';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { usePlayerStore } from '@/store/player';
import { CONTINUOUS_CURVE, PILL_RADIUS } from '@/styles/shape';

import { type ClipActionsRowProps } from './chrome';

/**
 * PHOTOS' TRIM TOOLBAR, IN THE GLASS BAR'S BOX.
 *
 * Framing swaps this in where the Shape/Clips glass bar sits — same
 * `MINI_PLAYER_HEIGHT` box, same `FLOATING_RADIUS`, same material — so the
 * console's bottom edge never changes shape on a mode switch. What changed is
 * the CONTENTS, which now follow Photos' video-trim toolbar: Cancel as a
 * plain word leading, the preview PLAY GLYPH dead centre, the commit
 * trailing.
 *
 * What this replaced was four treatments in one row — a grey ✕, a muted
 * "New Clip" caption, a tinted "Preview" word and a filled pill — which read
 * as loose parts, and the muted caption read as disabled text. Photos titles
 * its trim mode nowhere: once the frame is on the strip, the mode explains
 * itself, so the caption went with the ✕.
 *
 * THE GLYPH IS THE PREVIEW BUTTON, and it answers the preview's own state
 * read at the leaf (`playing && activeClip 'preview'`) — play starts the clip
 * from its start, pause stops it mid-listen. Centred absolutely, the
 * `clipLabelSlot` pattern, so it stays dead centre whatever the two words
 * beside it measure.
 *
 * Save keeps the filled brand pill: framing is a distinct MODE rather than
 * the resting player, and Save is its one commit — the accent carve-out the
 * monochrome rule names.
 */

/** The preview glyph's SF point size — the toolbar's ink, not a transport's. */
const PREVIEW_GLYPH_SIZE = 26;

export function ClipActionsRow({
  onCancel,
  onPreview,
  onSave,
  width = 0,
}: ClipActionsRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  const previewing = usePlayerStore(
    s => s.playing && s.activeClip?.clipId === 'preview',
  );

  return (
    <View style={[styles.bar, { height: MINI_PLAYER_HEIGHT, width }]}>
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

      {/* Dead centre whatever Cancel and Save measure — the absolute slot
          pattern the scrubber's range label uses. */}
      <View pointerEvents="box-none" style={styles.previewSlot}>
        <GlyphButton
          accessibilityLabel={t(
            previewing ? 'player.pause' : 'player.clips.preview',
          )}
          hitSlop={12}
          onPress={previewing ? usePlayerStore.getState().toggle : onPreview}
        >
          {previewing ? (
            <PauseGlyph color={colors.onSurface} size={PREVIEW_GLYPH_SIZE} />
          ) : (
            <PlayGlyph color={colors.onSurface} size={PREVIEW_GLYPH_SIZE} />
          )}
        </GlyphButton>
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
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 10,
    width: '100%',
  },
  cancel: { paddingHorizontal: 12, paddingVertical: 8 },
  previewSlot: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  save: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
});
