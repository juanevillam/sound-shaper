import { useRef, useState } from 'react';

import {
  BasicAlertDialog,
  Column,
  FilterChip,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  Row,
  Slider,
  Surface,
  Switch,
  Text,
  TextButton,
  useNativeState,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  clip as clipModifier,
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
  Shapes,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useShapesSubscription } from '@/hooks/useShapesSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { createShape, deleteShape } from '@/services/firebase/shapes';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';
import { useShapesStore } from '@/store/shapes';

// All the sound-shaping controls in one native bottom sheet (the YT-Music /
// pro-app idiom for secondary controls): EQ presets + stepped band sliders,
// then speed and pitch. Every change is heard live — the sheet edits the
// playing graph directly.

const EQ_LABEL_WIDTH = 36;
// The five band rows are the sheet's bulk. Compressed from the slider's
// natural ~48dp so the tail of the sheet (speed, keep-pitch and its
// description) still fits when fully expanded.
const EQ_ROW_HEIGHT = 34;
// Band sliders snap per dB; speed snaps to quarter steps.
const EQ_SLIDER_STEPS = EQ_MAX_DB - EQ_MIN_DB - 1;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;
const RATE_SLIDER_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) - 1;
const DIALOG_WIDTH = 312;
const SHAPE_NAME_MAX = 24;

export const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');
const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

type ShaperSheetProps = {
  onClose: () => void;
};

export function ShaperSheet({ onClose }: ShaperSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

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

  // The user's own saved shapes, live beside the built-in presets.
  useShapesSubscription();
  const shapes = useShapesStore(s => s.shapes);
  const { showSnackbar } = useSnackbar();

  const [saveOpen, setSaveOpen] = useState(false);
  const activeShape = shapes.find(shape => shape.id === activeShapeId) ?? null;

  const onSaveShape = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;

    setSaveOpen(false);
    // Save the WHOLE config, not just the curve — speed and pitch are part of
    // how a shape sounds.
    createShape({ gains, keepPitch, name, rate })
      .then(() => showSnackbar(t('snackbar.shape-created')))
      .catch(() => showSnackbar(t('snackbar.shape-save-failed')));
  };

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

  return (
    <ThemedHost matchContents>
      {/* No skipPartiallyExpanded: this sheet's content is tall (two chip
          rows, five bands, speed, pitch), and forcing the expanded state made
          it swallow the whole screen. It now rests half-height — drag up for
          the rest. */}
      <ModalBottomSheet ref={sheetRef} onDismissRequest={onClose}>
        <Column
          verticalArrangement={{ spacedBy: 10 }}
          // Horizontal padding lives on each SECTION, not here — the chips row
          // must scroll edge-to-edge (outside padding would clip the chips at
          // both ends mid-scroll).
          modifiers={[padding(0, 0, 0, 48), fillMaxWidth()]}
        >
          {/* The shared sheet header: title left, filled action pill right —
              the same bar every other sheet in the portfolio uses. */}
          <Column modifiers={[fillMaxWidth(), padding(24, 0, 24, 4)]}>
            <SheetBar
              title={t('player.shape.title')}
              saveLabel={t('player.shapes.save')}
              saving={false}
              onSave={() => setSaveOpen(true)}
            />
          </Column>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[padding(24, 0, 24, 0)]}
          >
            {t('player.eq.title')}
          </Text>

          {/* Built-in presets ("Flat" doubles as reset). Padding AFTER
              horizontalScroll = content padding: the row bleeds to the sheet
              edges, the chips start/end 24 inside. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              fillMaxWidth(),
              horizontalScroll(),
              padding(24, 0, 24, 0),
            ]}
          >
            {EQ_PRESETS.map(preset => (
              <FilterChip
                key={preset.i18nKey}
                selected={
                  activeShapeId === null && activePreset === preset.i18nKey
                }
                onClick={() => applyPreset(preset.i18nKey)}
              >
                <FilterChip.Label>
                  <Text maxLines={1}>{presetLabel(preset.i18nKey)}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
          </Row>

          {/* Your OWN shapes get their own labelled row — mixing them into the
              built-in presets made the two read as one undifferentiated set. */}
          {shapes.length > 0 ? (
            <>
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelLarge' }}
                modifiers={[padding(24, 6, 24, 0)]}
              >
                {t('player.shapes.mine')}
              </Text>
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 8 }}
                modifiers={[
                  fillMaxWidth(),
                  horizontalScroll(),
                  padding(24, 0, 24, 0),
                ]}
              >
                {shapes.map(shape => (
                  <FilterChip
                    key={shape.id}
                    selected={activeShapeId === shape.id}
                    onClick={() => onApplyShape(shape.id)}
                  >
                    <FilterChip.Label>
                      <Text maxLines={1}>{shape.name}</Text>
                    </FilterChip.Label>
                  </FilterChip>
                ))}
              </Row>
            </>
          ) : null}

          {EQ_BANDS.map((band, index) => (
            <Row
              key={band.hz}
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[
                fillMaxWidth(),
                height(EQ_ROW_HEIGHT),
                padding(24, 0, 24, 0),
              ]}
            >
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
                modifiers={[width(EQ_LABEL_WIDTH)]}
              >
                {band.label}
              </Text>
              <Slider
                value={gains[index]}
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                steps={EQ_SLIDER_STEPS}
                onValueChange={value => setBandGain(index, Math.round(value))}
                modifiers={[weight(1)]}
              />
              <Text
                color={colors.onSurface}
                style={{ typography: 'labelMedium' }}
                modifiers={[width(EQ_LABEL_WIDTH)]}
              >
                {dbLabel(gains[index])}
              </Text>
            </Row>
          ))}

          {/* Speed — stepped quarter increments, live value beside the header. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth(), padding(24, 10, 24, 0)]}
          >
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'labelLarge' }}
            >
              {t('player.speed')}
            </Text>
            <Text color={colors.onSurface} style={{ typography: 'labelLarge' }}>
              {rateLabel(rate)}
            </Text>
          </Row>
          <Slider
            value={rate}
            min={RATE_MIN}
            max={RATE_MAX}
            steps={RATE_SLIDER_STEPS}
            onValueChange={value =>
              // Float math on 0.1 steps drifts (0.7000000000000001), so snap
              // to one decimal.
              setRate(Math.round(value / RATE_STEP) / 10)
            }
            modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}
          />

          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth(), padding(24, 6, 24, 0)]}
          >
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1)]}
            >
              <Text
                color={colors.onSurface}
                style={{ typography: 'bodyLarge' }}
              >
                {t('player.keepPitch')}
              </Text>
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'bodySmall' }}
              >
                {t('player.keepPitchDescription')}
              </Text>
            </Column>
            <Switch value={keepPitch} onCheckedChange={setKeepPitch} />
          </Row>

          {/* Destructive action lives at the BOTTOM of the sheet, never in the
              header — only while one of your saved shapes is applied. */}
          {activeShape ? (
            <Row
              horizontalArrangement="center"
              modifiers={[fillMaxWidth(), padding(24, 12, 24, 0)]}
            >
              <OutlinedButton onClick={onDeleteShape}>
                <Text color={colors.danger}>{t('player.shapes.delete')}</Text>
              </OutlinedButton>
            </Row>
          ) : null}
        </Column>
      </ModalBottomSheet>

      {saveOpen ? (
        <SaveShapeDialog
          onCancel={() => setSaveOpen(false)}
          onSave={onSaveShape}
        />
      ) : null}
    </ThemedHost>
  );
}

type SaveShapeDialogProps = {
  onCancel: () => void;
  onSave: (name: string) => void;
};

/**
 * Names the shape being saved. Its own component so every open remounts it
 * with an empty field, and so `useNativeState` (the Compose-side binding)
 * re-initialises with it — the JS mirror is what our logic reads.
 */
function SaveShapeDialog({ onCancel, onSave }: SaveShapeDialogProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const nameState = useNativeState('');
  const [name, setName] = useState('');

  return (
    <BasicAlertDialog onDismissRequest={onCancel}>
      <Surface
        tonalElevation={6}
        modifiers={[
          width(DIALOG_WIDTH),
          clipModifier(Shapes.RoundedCorner(28)),
        ]}
      >
        <Column modifiers={[fillMaxWidth()]}>
          <Text
            color={colors.onSurface}
            style={{ typography: 'headlineSmall' }}
            modifiers={[padding(24, 24, 24, 16)]}
          >
            {t('player.shapes.saveTitle')}
          </Text>
          <Column modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}>
            <OutlinedTextField
              value={nameState}
              onValueChange={next => setName(next.slice(0, SHAPE_NAME_MAX))}
              singleLine
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('player.shapes.nameLabel')}</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
          </Column>
          <Row
            horizontalArrangement="end"
            modifiers={[fillMaxWidth(), padding(24, 8, 16, 12)]}
          >
            <TextButton onClick={onCancel}>
              <Text>{t('common.cancel')}</Text>
            </TextButton>
            <TextButton
              enabled={name.trim().length > 0}
              onClick={() => onSave(name)}
            >
              <Text>{t('player.shapes.save')}</Text>
            </TextButton>
          </Row>
        </Column>
      </Surface>
    </BasicAlertDialog>
  );
}
