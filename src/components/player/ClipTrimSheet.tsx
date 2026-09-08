import { useEffect, useState } from 'react';

import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '@portfolio/core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipTrimEditor } from '@/components/player/ClipTrimEditor';
import { ShaperSheet } from '@/components/player/ShaperSheet';
import { useClipTrimScreen } from '@/components/player/useClipTrimScreen';
import { IconButton } from '@/components/ui/IconButton';
import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// ANDROID'S CLIP EDITOR IS A SHEET — an RN-built one, over the expanded
// player, where iOS stacks its own sheet route over the Clips list.
//
// It shipped for one day as a PUSHED full-screen dialog and Juan rejected the
// flow on sight (2026-09-08): every other clip surface is a sheet over the
// player, and a route replaced the whole player mid-task. A Compose
// `ModalBottomSheet` cannot host it either — the editor is RN gestures end to
// end, and interactive RN inside a Compose sheet's dialog window loses its
// touches (Topper's comments sheet hit that wall first; its rows went Compose
// for exactly this reason). So the sheet is drawn in RN, the way the player
// itself is: a spring-in panel wearing the Compose sheet's own chrome (the
// sheet ground, the 28dp top corners, the 32×4 handle in its 48dp box), with
// a scrim behind it, BACK and ✕ and a drag-down on its header to leave.
//
// The bar is the iOS sheet bar's arrangement in Material: ✕ leads, the title,
// then tune (Shape stacks over, its own Compose window) and an accent Save
// text action — the full-screen-dialog commit idiom this surface keeps from
// its one day as a route.
// ---------------------------------------------------------------------------

const SHEET_RADIUS = 28;
const HANDLE_BOX = 24;
const HANDLE_WIDTH = 32;
const HANDLE_HEIGHT = 4;
/** Drag-down farther than this (or flick) dismisses. */
const DISMISS_DRAG = 120;
const SPRING = { damping: 34, mass: 0.7, stiffness: 320 };

export type ClipTrimSheetProps = {
  /** Re-frame an existing clip; omit for New Clip. */
  editing?: { clipId: string; endMs: number; startMs: number } | null;
  onClose: () => void;
};

export function ClipTrimSheet({ editing, onClose }: ClipTrimSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [shaperVisible, setShaperVisible] = useState(false);

  // Entry/exit are one shared value: 0 = parked below the screen, 1 = up.
  // The sheet animates itself OUT before unmounting, so every exit leaves the
  // way Compose's own sheets do rather than tearing the panel down mid-air.
  const up = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    up.value = withSpring(1, SPRING);
  }, [up]);

  const { current, editingClipId, onSave, range, saving, setRange } =
    useClipTrimScreen({
      editing,
      onDone: () => {
        up.value = withSpring(0, SPRING, finished => {
          if (finished) runOnJS(onClose)();
        });
      },
    });

  const dismiss = () => {
    if (saving) return;
    up.value = withSpring(0, SPRING, finished => {
      if (finished) runOnJS(onClose)();
    });
  };

  // BACK leaves the editor, not the player under it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismiss();
        return true;
      },
    );
    return () => subscription.remove();
    // `dismiss` is stable enough for the sheet's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag-down on the HEADER region only — the content below is the editor's
  // own gesture field (band pan, caps, transport), and a whole-sheet pan
  // would race every one of them.
  const headerPan = Gesture.Pan()
    .onUpdate(event => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd(event => {
      if (dragY.value > DISMISS_DRAG || event.velocityY > 900) {
        dragY.value = withSpring(0, SPRING);
        runOnJS(dismiss)();
        return;
      }
      dragY.value = withSpring(0, SPRING);
    });

  const winTravel = 1000;
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - up.value) * winTravel + dragY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: up.value,
  }));

  if (!current) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* The Compose sheet's own scrim, tappable to leave. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha('#000000', 0.4) },
          scrimStyle,
        ]}
      >
        <Pressable
          accessibilityLabel={t('common.cancel')}
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.sheet,
            top: insets.top + 12,
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={headerPan}>
          <View>
            <View style={styles.handleBox}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: colors.onSurfaceMuted },
                ]}
              />
            </View>
            <View style={styles.bar}>
              <IconButton
                name="close"
                onPress={dismiss}
                accessibilityLabel={t('common.cancel')}
              />
              <AppText
                doNotTranslate
                text={t(
                  editingClipId ? 'player.clips.edit' : 'player.clips.new',
                )}
                variant="titleLarge"
                numberOfLines={1}
                style={styles.title}
              />
              <IconButton
                name="tune"
                onPress={() => setShaperVisible(true)}
                accessibilityLabel={t('player.shape.title')}
              />
              {/* The commit is a TEXT action — the full-screen dialog's own
                  idiom, in the accent that says "this one acts". */}
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onSave}
                style={({ pressed }) => [
                  styles.save,
                  { opacity: saving ? 0.38 : pressed ? 0.6 : 1 },
                ]}
              >
                <AppText
                  text="player.clips.saveClip"
                  variant="labelLarge"
                  style={{ color: colors.primary }}
                />
              </Pressable>
            </View>
          </View>
        </GestureDetector>

        <View style={styles.body}>
          <ClipTrimEditor
            range={range}
            onRangeChange={(startS, endS) => setRange({ startS, endS })}
          />
        </View>
      </Animated.View>

      {shaperVisible && <ShaperSheet onClose={() => setShaperVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  handleBox: {
    alignItems: 'center',
    height: HANDLE_BOX,
    justifyContent: 'center',
    width: '100%',
  },
  handle: {
    borderRadius: HANDLE_HEIGHT / 2,
    height: HANDLE_HEIGHT,
    width: HANDLE_WIDTH,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 4,
    paddingRight: 8,
  },
  title: { flex: 1, paddingLeft: 4 },
  save: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  body: { flex: 1 },
});
