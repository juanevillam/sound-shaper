import { useRef } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  Box,
  Column,
  FilterChip,
  ModalBottomSheet,
  Row,
  Slider,
  Switch,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  background,
  fillMaxWidth,
  horizontalScroll,
  offset,
  padding,
  size as sizeModifier,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';

// All the sound-shaping controls in one native bottom sheet (the YT-Music /
// pro-app idiom for secondary controls): EQ presets + stepped band sliders,
// then speed and pitch. Every change is heard live — the sheet edits the
// playing graph directly.

const EQ_LABEL_WIDTH = 36;
// Band sliders snap per dB; speed snaps to quarter steps.
const EQ_SLIDER_STEPS = EQ_MAX_DB - EQ_MIN_DB - 1;
const RATE_MIN = 0.5;
const RATE_MAX = 2;
const RATE_STEP = 0.25;
const RATE_SLIDER_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) - 1;
// Where 1× sits on the speed track (fraction of its width).
const RATE_DEFAULT_FRACTION = (1 - RATE_MIN) / (RATE_MAX - RATE_MIN);
const SIDE = 24;
// The "this is the default" tick drawn under a slider's track.
const MARKER_W = 2;
const MARKER_H = 14;

export const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');
const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

type ShaperSheetProps = {
  onClose: () => void;
};

export function ShaperSheet({ onClose }: ShaperSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width: winW } = useWindowDimensions();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  // Deterministic slider widths (full-width sheet, SIDE padding per edge).
  const speedSliderW = winW - SIDE * 2;
  const speedMarkerX =
    Math.round(speedSliderW * RATE_DEFAULT_FRACTION) - MARKER_W / 2;

  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);

  const gains = useShaperStore(s => s.gains);
  const setBandGain = useShaperStore(s => s.setBandGain);
  const activePreset = useShaperStore(s => s.activePreset);
  const applyPreset = useShaperStore(s => s.applyPreset);

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
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        <Column
          verticalArrangement={{ spacedBy: 10 }}
          // Horizontal padding lives on each SECTION, not here — the chips row
          // must scroll edge-to-edge (outside padding would clip the chips at
          // both ends mid-scroll).
          modifiers={[padding(0, 0, 0, 28), fillMaxWidth()]}
        >
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[padding(24, 0, 24, 0)]}
          >
            {t('player.eq.title')}
          </Text>

          {/* One scrolling row of preset chips ("Flat" doubles as reset).
              Padding AFTER horizontalScroll = content padding: the row bleeds
              to the sheet edges, the chips start/end 24 inside. */}
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
                selected={activePreset === preset.i18nKey}
                onClick={() => applyPreset(preset.i18nKey)}
              >
                <FilterChip.Label>
                  <Text maxLines={1}>{presetLabel(preset.i18nKey)}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
          </Row>

          {EQ_BANDS.map((band, index) => (
            <Row
              key={band.hz}
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}
            >
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
                modifiers={[width(EQ_LABEL_WIDTH)]}
              >
                {band.label}
              </Text>
              {/* Center tick = 0 dB, so "back to default" has a target. */}
              <Box contentAlignment="center" modifiers={[weight(1)]}>
                <Box
                  modifiers={[
                    sizeModifier(MARKER_W, MARKER_H),
                    background(colors.onSurfaceMuted),
                  ]}
                />
                <Slider
                  value={gains[index]}
                  min={EQ_MIN_DB}
                  max={EQ_MAX_DB}
                  steps={EQ_SLIDER_STEPS}
                  onValueChange={value => setBandGain(index, Math.round(value))}
                  modifiers={[fillMaxWidth()]}
                />
              </Box>
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
          {/* Tick at the 1× position — the default is findable at a glance. */}
          <Box
            contentAlignment="centerStart"
            modifiers={[fillMaxWidth(), padding(SIDE, 0, SIDE, 0)]}
          >
            <Box
              modifiers={[
                offset(speedMarkerX, 0),
                sizeModifier(MARKER_W, MARKER_H),
                background(colors.onSurfaceMuted),
              ]}
            />
            <Slider
              value={rate}
              min={RATE_MIN}
              max={RATE_MAX}
              steps={RATE_SLIDER_STEPS}
              onValueChange={value =>
                setRate(Math.round(value / RATE_STEP) * RATE_STEP)
              }
              modifiers={[fillMaxWidth()]}
            />
          </Box>

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
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
