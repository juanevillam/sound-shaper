import { useRef } from 'react';

import {
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
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
  verticalScroll,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { rateLabel } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';

// All the sound-shaping controls in one native bottom sheet (the YT-Music /
// pro-app idiom for secondary controls): EQ presets + stepped band sliders,
// then speed and pitch. Every change is heard live — the sheet edits the
// playing graph directly.
//
// NOTHING HERE COMMITS, so the sheet carries a plain title rather than the
// portfolio's `SheetBar` (which is a title plus a Save pill). Saving a named
// shape was built and REMOVED 2026-08-22 — see the note in `store/shaper.ts`.

const EQ_LABEL_WIDTH = 36;
// The bands stay COMPACT — Speed is the control people reach for, so it keeps
// its full size while the five bands read as a tighter group. The gap between
// them comes from the column's spacing, not from padding each row out.
const EQ_ROW_HEIGHT = 34;
// Band sliders snap per dB; speed snaps to quarter steps.
const EQ_SLIDER_STEPS = EQ_MAX_DB - EQ_MIN_DB - 1;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;
const RATE_SLIDER_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) - 1;

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

export type ShaperSheetProps = {
  onClose: () => void;
};

export function ShaperSheet({ onClose }: ShaperSheetProps) {
  const { t, locale } = useI18n();
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
      {/* No skipPartiallyExpanded: this sheet's content is tall (the chips
          row, five bands, speed, pitch), and forcing the expanded state made
          it swallow the whole screen. It now rests half-height — drag up for
          the rest. */}
      <ModalBottomSheet ref={sheetRef} onDismissRequest={onClose}>
        <Column
          verticalArrangement={{ spacedBy: 4 }}
          // Horizontal padding lives on each SECTION, not here — the chips row
          // must scroll edge-to-edge (outside padding would clip the chips at
          // both ends mid-scroll). verticalScroll is a safety net for short
          // screens — the sheet's own drag wins over it at this height, so the
          // content is also sized to fit outright.
          modifiers={[fillMaxWidth(), verticalScroll(), padding(0, 0, 0, 16)]}
        >
          {/* The sheet's title. NOT `SheetBar`: that bar pairs a title with a
              filled Save pill, and there is nothing here to commit. The sheet
              supplies its own native drag handle. */}
          <Column modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}>
            <Text
              color={colors.onSurface}
              style={{ typography: 'titleLarge' }}
              maxLines={1}
            >
              {t('player.shape.title')}
            </Text>
          </Column>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[padding(24, 2, 24, 0)]}
          >
            {t('player.shape.presets')}
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
                selected={activePreset === preset.i18nKey}
                onClick={() => applyPreset(preset.i18nKey)}
              >
                <FilterChip.Label>
                  <Text maxLines={1}>{presetLabel(preset.i18nKey)}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
          </Row>

          {/* THE equalizer: these five frequency bands and nothing else.
              Speed and keep-pitch below are a separate idea. */}
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[padding(24, 12, 24, 0)]}
          >
            {t('player.eq.title')}
          </Text>
          {/* The band numbers are hertz, which means nothing to most people —
              say what the ends of the range actually sound like. */}
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodySmall' }}
            modifiers={[padding(24, 0, 24, 0)]}
          >
            {t('player.eq.hint')}
          </Text>

          <Column
            verticalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
          >
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
          </Column>

          {/* Speed — stepped quarter increments, live value beside the header. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth(), padding(24, 12, 24, 0)]}
          >
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'labelLarge' }}
            >
              {t('player.speed')}
            </Text>
            <Text color={colors.onSurface} style={{ typography: 'labelLarge' }}>
              {rateLabel(rate, locale)}
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

          {/* Keep pitch belongs WITH speed — it only decides whether changing
              the speed also changes how high the sound is — but it is its own
              control, so it gets real separation from the slider. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth(), padding(24, 14, 24, 0)]}
          >
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1), padding(0, 0, 16, 0)]}
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
