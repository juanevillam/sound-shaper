import {
  Column,
  FilterChip,
  ModalBottomSheet,
  Row,
  Slider,
  Switch,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxHeight,
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
  verticalScroll,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  COMPOSE_SHEET_GUTTER,
  composeSheetBottomPadding,
  SheetDragHandle,
} from '@portfolio/mobile-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
/**
 * THE BANDS SNAP WITHOUT DRAWING TICKS; SPEED DRAWS THEM.
 *
 * A Compose `Slider` renders one tick per step, which is right for a small set
 * of discrete values and wrong for a large one: the five bands span 24 whole dB,
 * so `steps` drew 23 dots across each of five stacked tracks and the group read
 * as a dotted texture rather than as five controls. M3 asks for tick marks only
 * where the count is small enough to aim at, and iOS's twin draws none at all.
 *
 * Dropping `steps` does NOT drop the snapping: the store rounds in
 * `onValueChange` and the slider is controlled off that rounded value, so the
 * thumb settles on whole dB exactly as before. Verified by dragging the 80 Hz
 * band on the A54 — it reads +5, never +5.3.
 *
 * SPEED KEEPS ITS TICKS, and the contrast is the point: ten stops between 0.5×
 * and 1.5× is a count you can aim at, and the dots say so.
 */
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
  const insets = useSafeAreaInsets();

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
      {/* FULL HEIGHT, which is what iOS decided for the same surface: `shaper`
          is `[1]` in `IOS_FORM_SHEETS` because it is a PRIMARY surface, like
          Settings and Account. Same vocabulary, said in Material.

          It rested half-height on a note reading "forcing the expanded state
          made it swallow the whole screen" — written while this sheet still
          carried the saved-shapes chips row, a Save pill and a delete button.
          Those went 2026-08-22 and the note did not, so the sheet had been
          resting at a detent sized for content it no longer holds.

          THE RESTING DETENT WAS ALSO WHERE THE NAVIGATION BAR ATE A CONTROL.
          Band-scanned on the A54 (3-button nav): at ~50% the 4k band's slider
          drew from 793.24dp to 809.24 against a bar starting at 784.00 — under
          the Back/Home glyphs. `@expo/ui` 57 exposes no `contentWindowInsets`
          (its `ModalBottomSheetView.kt` names no insets at all) and M3's own
          default applies the TOP side only, so trailing content padding is the
          available lever and full height is what removes the collision.

          No ref either: nothing here dismisses the sheet programmatically —
          every row applies live and the person leaves when they are done. */}
      <ModalBottomSheet
        onDismissRequest={onClose}
        skipPartiallyExpanded
        showDragHandle={false}
      >
        <SheetDragHandle />
        <Column
          verticalArrangement={{ spacedBy: 4 }}
          // Horizontal padding lives on each SECTION, not here — the chips row
          // must scroll edge-to-edge (outside padding would clip the chips at
          // both ends mid-scroll). verticalScroll is a safety net for short
          // screens — the sheet's own drag wins over it at this height, so the
          // content is also sized to fit outright.
          //
          // THE BOTTOM CLEARS THE NAVIGATION BAR. A Compose sheet's window runs
          // to the screen edge, so a bare 16 put the 4k band's slider under the
          // Back/Home glyphs at this sheet's resting detent — measured on the
          // A54. See `composeSheetBottomPadding`.
          // FULL HEIGHT — iOS presents this sheet at [1] (`IOS_FORM_SHEETS`:
          // a primary surface, like Settings), and Topper's list sheets made
          // the same move on Android (`fillMaxHeight` on the follow sheets).
          // A hugging sheet also resized itself whenever a section did.
          modifiers={[
            fillMaxHeight(),
            fillMaxWidth(),
            verticalScroll(),
            padding(0, 0, 0, composeSheetBottomPadding(insets.bottom)),
          ]}
        >
          {/* The sheet's title. NOT `SheetBar`: that bar pairs a title with a
              filled Save pill, and there is nothing here to commit. The sheet
              supplies its own native drag handle. */}
          <Column
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
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
            modifiers={[
              padding(COMPOSE_SHEET_GUTTER, 2, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {t('player.shape.presets')}
          </Text>

          {/* Built-in presets ("Flat" doubles as reset). Padding AFTER
              horizontalScroll = content padding: the row bleeds to the sheet
              edges, the chips start/end on the gutter. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              fillMaxWidth(),
              horizontalScroll(),
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
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
            modifiers={[
              padding(COMPOSE_SHEET_GUTTER, 12, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {t('player.eq.title')}
          </Text>
          {/* The band numbers are hertz, which means nothing to most people —
              say what the ends of the range actually sound like. */}
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodySmall' }}
            modifiers={[
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
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
                  padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
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
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 12, COMPOSE_SHEET_GUTTER, 0),
            ]}
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
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
          />

          {/* Keep pitch belongs WITH speed — it only decides whether changing
              the speed also changes how high the sound is — but it is its own
              control, so it gets real separation from the slider. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 14, COMPOSE_SHEET_GUTTER, 0),
            ]}
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
