import { Alert } from 'react-native';

import {
  Button,
  HStack,
  Image,
  Picker,
  Section,
  Slider,
  Spacer,
  Text as SwiftUIText,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { SheetFormDestructiveIos, SheetFormIos } from '@portfolio/mobile-ui';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
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

// iOS-only route: every sound-shaping control as a grouped native `Form`
// (Android presents the Compose `ShaperSheet` in place). iOS vocabulary
// throughout — a `Picker` row for the preset, `Section` rows for saved shapes,
// SwiftUI `Slider`s, a `Toggle`, and `Alert.prompt` (an iOS-only API, and
// exactly the right one) for naming a saved shape.
//
// It used to draw this out of RN: the presets and saved shapes were `Pressable`
// capsules — i.e. Material chips wearing an iOS palette, the same mistake the
// editor sheets made with their delete pill — and each section header was
// hand-typeset. A `Form` supplies all of that, plus the grouped backgrounds,
// separators, Dynamic Type and keyboard handling, for free.

const EQ_LABEL_WIDTH = 38;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;
const SHAPE_NAME_MAX = 24;

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

function ShaperSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

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

  const mutedText = [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.onSurfaceMuted),
  ];

  return (
    // `SheetScreen` for the toast — see `SnackbarOutlet`. Saving or deleting a
    // shape confirms with a snackbar, and from inside a sheet that message drew
    // behind the presentation.
    <SheetScreen>
      <SheetFormIos
        title={t('player.shape.title')}
        actionLabel={t('player.shapes.save')}
        onAction={promptSaveShape}
      >
        {/* One row that says which preset is on and opens the list to change it,
          rather than six capsules competing for the eye — the Settings idiom.
          A saved shape overrides the preset, so nothing is selected then. */}
        <Section>
          <Picker
            label={t('player.shapes.presets')}
            selection={activeShapeId === null ? activePreset : null}
            onSelectionChange={key => applyPreset(String(key))}
            modifiers={[pickerStyle('menu')]}
          >
            {EQ_PRESETS.map(preset => (
              <SwiftUIText
                key={preset.i18nKey}
                modifiers={[tag(preset.i18nKey)]}
              >
                {presetLabel(preset.i18nKey)}
              </SwiftUIText>
            ))}
          </Picker>
        </Section>

        {shapes.length > 0 ? (
          <Section title={t('player.shapes.mine')}>
            {shapes.map(shape => (
              // Trailing checkmark on the applied one — how iOS marks the chosen
              // row in a list you can pick from.
              <Button key={shape.id} onPress={() => onApplyShape(shape.id)}>
                <HStack>
                  <SwiftUIText modifiers={[foregroundStyle(colors.onSurface)]}>
                    {shape.name}
                  </SwiftUIText>
                  <Spacer />
                  {activeShapeId === shape.id ? (
                    <Image systemName="checkmark" color={colors.primary} />
                  ) : null}
                </HStack>
              </Button>
            ))}
          </Section>
        ) : null}

        {/* The band numbers are hertz, which means nothing to most people — say
          what the ends of the range actually sound like. In a Form that line is
          the section's FOOTER, which is where iOS puts explanatory text. */}
        <Section
          title={t('player.eq.title')}
          footer={<SwiftUIText>{t('player.eq.hint')}</SwiftUIText>}
        >
          {EQ_BANDS.map((band, index) => (
            <HStack key={band.hz} spacing={8}>
              <SwiftUIText
                modifiers={[...mutedText, frame({ width: EQ_LABEL_WIDTH })]}
              >
                {band.label}
              </SwiftUIText>
              <Slider
                value={gains[index]}
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={1}
                onValueChange={value => setBandGain(index, Math.round(value))}
              />
              <SwiftUIText
                modifiers={[
                  ...mutedText,
                  frame({ width: EQ_LABEL_WIDTH, alignment: 'trailing' }),
                ]}
              >
                {dbLabel(gains[index])}
              </SwiftUIText>
            </HStack>
          ))}
        </Section>

        <Section
          header={
            <HStack>
              <SwiftUIText>{t('player.speed')}</SwiftUIText>
              <Spacer />
              <SwiftUIText>{rateLabel(rate)}</SwiftUIText>
            </HStack>
          }
        >
          <Slider
            value={rate}
            min={RATE_MIN}
            max={RATE_MAX}
            step={RATE_STEP}
            onValueChange={value =>
              // Float math on 0.1 steps drifts (0.7000000000000001), so snap to
              // one decimal.
              setRate(Math.round(value / RATE_STEP) / 10)
            }
          />
        </Section>

        {/* Keep pitch belongs WITH speed — it only decides whether changing the
          speed also changes how high the sound is. Its explanation is the
          section footer, so nothing here has to hand-place a support line. */}
        <Section
          footer={<SwiftUIText>{t('player.keepPitchDescription')}</SwiftUIText>}
        >
          <Toggle
            isOn={keepPitch}
            label={t('player.keepPitch')}
            onIsOnChange={setKeepPitch}
          />
        </Section>

        {/* Destructive action last and in its OWN section — the Contacts "Delete
          Contact" pattern, which is also why it spans the full width without
          anyone forcing a frame onto it. Only while one of your own shapes is
          applied. */}
        {activeShape ? (
          <Section>
            <SheetFormDestructiveIos
              label={t('player.shapes.delete')}
              onPress={onDeleteShape}
            />
          </Section>
        ) : null}
      </SheetFormIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(ShaperSheetScreen);
