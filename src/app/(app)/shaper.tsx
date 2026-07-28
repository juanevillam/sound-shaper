import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Slider } from '@expo/ui/swift-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetHeaderIos } from '@/components/ui/SheetFormIos';
import { Text } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useShapesSubscription } from '@/hooks/useShapesSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { rateLabel } from '@/lib/player';
import { createShape, deleteShape } from '@/services/firebase/shapes';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';
import { useShapesStore } from '@/store/shapes';

// iOS-only route: every sound-shaping control as a native form sheet (Android
// presents the Compose `ShaperSheet` in place). iOS vocabulary throughout:
// capsule chips for presets, SwiftUI sliders, a system `Switch`, and
// `Alert.prompt` — an iOS-only API, and exactly the right one — for naming a
// saved shape.

const EQ_LABEL_WIDTH = 38;
const SLIDER_HEIGHT = 32;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;
const SHAPE_NAME_MAX = 24;
const PRESSED_OPACITY = 0.55;

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

function ShaperSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const { bottom } = useSafeAreaInsets();

  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);

  const gains = useShaperStore(s => s.gains);
  const setBandGain = useShaperStore(s => s.setBandGain);
  const activePreset = useShaperStore(s => s.activePreset);
  const applyPreset = useShaperStore(s => s.applyPreset);
  const applyShape = useShaperStore(s => s.applyShape);
  const activeShapeId = useShaperStore(s => s.activeShapeId);

  useShapesSubscription();
  const shapes = useShapesStore(s => s.shapes);

  const activeShape = shapes.find(shape => shape.id === activeShapeId) ?? null;

  const onSaveShape = (rawName?: string) => {
    const name = (rawName ?? '').trim().slice(0, SHAPE_NAME_MAX);
    if (!name) return;

    // Save the WHOLE config, not just the curve — speed and pitch are part of
    // how a shape sounds.
    createShape({ gains, keepPitch, name, rate })
      .then(() => showSnackbar(t('snackbar.shape-created')))
      .catch(() => showSnackbar(t('snackbar.shape-save-failed')));
  };

  const promptSaveShape = () =>
    Alert.prompt(
      t('player.shapes.saveTitle'),
      t('player.shapes.nameLabel'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('player.shapes.save'), onPress: onSaveShape },
      ],
      'plain-text',
    );

  const onDeleteShape = () => {
    if (!activeShape) return;

    deleteShape(activeShape.id)
      .then(() => showSnackbar(t('snackbar.shape-deleted')))
      .catch(() => showSnackbar(t('snackbar.shape-delete-failed')));
  };

  // Applying a saved shape restores its speed and pitch too.
  const onApplyShape = (shapeId: string) => {
    const shape = shapes.find(entry => entry.id === shapeId);
    if (!shape) return;

    applyShape(shape.id, shape.gains);
    setRate(shape.rate);
    setKeepPitch(shape.keepPitch);
  };

  // The typed t() needs literal keys, so map preset ids explicitly.
  const presetLabel = (key: string) => {
    switch (key) {
      case 'bass':
        return t('player.eq.presets.bass');
      case 'vocal':
        return t('player.eq.presets.vocal');
      case 'treble':
        return t('player.eq.presets.treble');
      case 'warm':
        return t('player.eq.presets.warm');
      case 'bright':
        return t('player.eq.presets.bright');
      default:
        return t('player.eq.presets.flat');
    }
  };

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.sheetField,
          opacity: pressed ? PRESSED_OPACITY : 1,
        },
      ]}
    >
      <Text
        doNotTranslate
        text={label}
        variant="labelLarge"
        numberOfLines={1}
        style={{ color: selected ? colors.onPrimary : colors.onSurface }}
      />
    </Pressable>
  );

  return (
    <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
      <View style={styles.headerBlock}>
        <SheetHeaderIos
          title={t('player.shape.title')}
          actionLabel={t('player.shapes.save')}
          onAction={promptSaveShape}
        />
      </View>

      <View style={[styles.section, styles.padded]}>
        <Text muted text="player.shapes.presets" variant="labelLarge" />
        {/* WRAPPING rows, not a horizontal ScrollView: a nested scrollable
            mis-measures inside the fitToContents form sheet (its content
            painted over the sheet header), and six chips wrap fine anyway. */}
        <View style={styles.chipWrap}>
          {EQ_PRESETS.map(preset =>
            chip(
              preset.i18nKey,
              presetLabel(preset.i18nKey),
              activeShapeId === null && activePreset === preset.i18nKey,
              () => applyPreset(preset.i18nKey),
            ),
          )}
        </View>
      </View>

      {shapes.length > 0 ? (
        <View style={[styles.section, styles.padded]}>
          <Text muted text="player.shapes.mine" variant="labelLarge" />
          <View style={styles.chipWrap}>
            {shapes.map(shape =>
              chip(shape.id, shape.name, activeShapeId === shape.id, () =>
                onApplyShape(shape.id),
              ),
            )}
          </View>
        </View>
      ) : null}

      <View style={[styles.section, styles.padded]}>
        <Text muted text="player.eq.title" variant="labelLarge" />
        {/* The band numbers are hertz, which means nothing to most people —
            say what the ends of the range actually sound like. */}
        <Text muted text="player.eq.hint" variant="bodySmall" />

        {EQ_BANDS.map((band, index) => (
          <View key={band.hz} style={styles.bandRow}>
            <Text
              doNotTranslate
              muted
              text={band.label}
              variant="labelMedium"
              style={styles.bandLabel}
            />
            <ThemedHost style={styles.bandSlider}>
              <Slider
                value={gains[index]}
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={1}
                onValueChange={value => setBandGain(index, Math.round(value))}
              />
            </ThemedHost>
            <Text
              doNotTranslate
              text={dbLabel(gains[index])}
              variant="labelMedium"
              style={styles.bandValue}
            />
          </View>
        ))}
      </View>

      <View style={[styles.section, styles.padded]}>
        <View style={styles.headerRow}>
          <Text muted text="player.speed" variant="labelLarge" />
          <Text doNotTranslate text={rateLabel(rate)} variant="labelLarge" />
        </View>
        <ThemedHost style={styles.rateSlider}>
          <Slider
            value={rate}
            min={RATE_MIN}
            max={RATE_MAX}
            step={RATE_STEP}
            onValueChange={value =>
              // Float math on 0.1 steps drifts (0.7000000000000001), so snap
              // to one decimal.
              setRate(Math.round(value / RATE_STEP) / 10)
            }
          />
        </ThemedHost>
      </View>

      {/* Keep pitch belongs WITH speed — it only decides whether changing the
          speed also changes how high the sound is. */}
      <View style={[styles.switchRow, styles.padded]}>
        <View style={styles.switchCopy}>
          <Text text="player.keepPitch" variant="bodyLarge" />
          <Text muted text="player.keepPitchDescription" variant="bodySmall" />
        </View>
        <Switch value={keepPitch} onValueChange={setKeepPitch} />
      </View>

      {/* Destructive action lives at the BOTTOM, never in the header — and
          only while one of your own shapes is applied. */}
      {activeShape ? (
        <View style={styles.padded}>
          <Pressable
            accessibilityRole="button"
            onPress={onDeleteShape}
            style={({ pressed }) => [
              styles.deleteRow,
              {
                backgroundColor: colors.sheetField,
                opacity: pressed ? PRESSED_OPACITY : 1,
              },
            ]}
          >
            <Text
              text="player.shapes.delete"
              variant="bodyLarge"
              style={{ color: colors.danger }}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={{ height: Math.max(bottom, 24) }} />
    </View>
  );
}

export default iosOnlyRoute(ShaperSheetScreen);

const styles = StyleSheet.create({
  bandLabel: { width: EQ_LABEL_WIDTH },
  bandRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  bandSlider: { flex: 1, height: SLIDER_HEIGHT },
  bandValue: { textAlign: 'right', width: EQ_LABEL_WIDTH },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deleteRow: { alignItems: 'center', borderRadius: 12, paddingVertical: 14 },
  headerBlock: { paddingHorizontal: 24 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  padded: { paddingHorizontal: 24 },
  rateSlider: { height: SLIDER_HEIGHT, width: '100%' },
  section: { gap: 8 },
  sheet: { gap: 14, paddingTop: 20 },
  switchCopy: { flex: 1, gap: 2, paddingRight: 16 },
  switchRow: { alignItems: 'center', flexDirection: 'row' },
});
