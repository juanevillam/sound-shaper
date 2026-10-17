import {
  Column,
  FilterChip,
  HorizontalDivider,
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
  offset,
  padding,
  verticalScroll,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { withAlpha } from '@/core';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  type EffectLevel,
} from '@/lib/audioEngine';
import {
  RATE_MAX,
  RATE_MIN,
  RATE_SLIDER_STEPS,
  rateLabel,
  snapRate,
} from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';
import {
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  sheetContainer,
  SheetDragHandle,
} from '@/ui';

// All the sound-shaping controls in one native bottom sheet (the YT-Music /
// pro-app idiom for secondary controls): EQ presets + stepped band sliders,
// then speed and pitch. Every change is heard live — the sheet edits the
// playing graph directly.
//
// NOTHING HERE COMMITS, so the `SheetBar` renders TITLE-ONLY — its own
// documented list-sheet mode, which is also what pins this sheet's title ink
// and header→content gap to the family's terms (Juan, 2026-09-08: the presets
// sat ~6dp under the title against the family's 16). Saving a named shape was
// built and REMOVED 2026-08-22 — see the note in `store/shaper.ts`.

const EQ_LABEL_WIDTH = 36;

/** One step per whole dB (−12…+12); the thumb quantizes natively, ticks
 *  hidden — see the stepped-sliders note below. */
const EQ_SLIDER_STEPS = EQ_MAX_DB - EQ_MIN_DB - 1;
// The bands stay COMPACT — Speed is the control people reach for, so it keeps
// its full size while the five bands read as a tighter group. The gap between
// them comes from the column's spacing, not from padding each row out.
const EQ_ROW_HEIGHT = 34;
// EVERY SLIDER IS STEPPED, AND NONE DRAWS ITS TICKS — iOS's arrangement
// exactly (its sliders are stepped and SwiftUI draws nothing). Compose couples
// the two: `steps` quantizes the thumb AND renders a dot per step, which on
// the bands' 24 whole dB was a dotted texture across five stacked tracks. The
// split used to be "drop `steps`, round in `onValueChange`" — that snapped the
// VALUE but let the thumb glide; Juan asked for the real stepped feel
// (2026-09-08), so `steps` is back everywhere and the ticks are hidden through
// transparent tick colors instead (`sliderInk`).
//
// Speed's own `RATE_SLIDER_STEPS` lives in `lib/player.ts` with the range it
// is derived from, so the two twins cannot disagree about it.

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

export type ShaperSheetProps = {
  onClose: () => void;
};

export function ShaperSheet({ onClose }: ShaperSheetProps) {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);

  /**
   * MONOCHROME SLIDERS (Juan, 2026-09-08) — the same first-bucket deletion
   * the console's scrubber took: M3 fills a slider with the accent by
   * default, and on this sheet six of them made the accent the loudest thing
   * on a surface whose information is the CURVE, not the colour. The ticks
   * inherit the track inks. What keeps its colour here: the Switch (green-on
   * is the platform semantic) and the selected preset chip (a SELECTION).
   */
  const sliderInk = {
    thumbColor: colors.onSurface,
    activeTrackColor: colors.onSurface,
    inactiveTrackColor: withAlpha(colors.onSurface, 0.24),
    // STEPPED, NEVER DOTTED: every slider on this sheet snaps to its steps
    // exactly as iOS's do, and iOS draws no tick marks — a transparent tick
    // is how Compose says the same thing (the `steps` prop is what makes the
    // THUMB quantize; the dots were only its default rendering).
    activeTickColor: 'transparent',
    inactiveTickColor: 'transparent',
  };

  const gains = useShaperStore(s => s.gains);
  const setBandGain = useShaperStore(s => s.setBandGain);
  const activePreset = useShaperStore(s => s.activePreset);
  const applyPreset = useShaperStore(s => s.applyPreset);
  const nextRoom = useShaperStore(s => s.nextRoom);
  const setNextRoom = useShaperStore(s => s.setNextRoom);
  const echo = useShaperStore(s => s.echo);
  const setEcho = useShaperStore(s => s.setEcho);

  // The typed t() needs literal keys, so map level ids explicitly — the same
  // arrangement as `presetLabel` below.
  const levelLabel = (level: EffectLevel) => {
    switch (level) {
      case 'low':
        return t('player.shape.levels.low');
      case 'medium':
        return t('player.shape.levels.medium');
      case 'high':
        return t('player.shape.levels.high');
      default:
        return t('player.shape.levels.off');
    }
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
        // The family's one ground, stated — unset, Compose picks the OEM
        // token and the RN clip editor beside it cannot share the answer.
        containerColor={sheetContainer(colors, scheme)}
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
          {/* The family's header row — `SheetBar` in its title-only mode
              (the bar pairs a title with a commit pill only when given one).
              The box below it opens the family's header→content gap, less the
              column's own 4. */}
          <Column
            modifiers={[
              fillMaxWidth(),
              padding(
                COMPOSE_SHEET_GUTTER,
                0,
                COMPOSE_SHEET_GUTTER,
                COMPOSE_SHEET_HEADER_TO_CONTENT - 4,
              ),
            ]}
          >
            <SheetBar title={t('player.shape.title')} />
          </Column>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {t('player.shape.presets')}
          </Text>

          {/* Built-in presets ("Flat" doubles as reset), ONE ROW, SCROLLING —
              a wrapping FlowRow was tried and Juan rejected the two-row look
              the same day (2026-09-08), so the scroll came back. Padding
              AFTER horizontalScroll = content padding: the row bleeds to the
              sheet edges, the chips start/end on the gutter. The `offset`
              pulls the DRAWN chips up by the 48dp touch box's slack over the
              32dp face, so the title→content gap READS as the Equalizer
              section's (measured: −7 lands 11.0dp vs its 11.4; without it
              the boxes buried the face 8dp deeper). Offset moves pixels, not
              layout — touch targets stay put. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              fillMaxWidth(),
              offset(0, -7),
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
          {/* A DIVIDER BETWEEN BANDS, iOS's own arrangement (its rows sit in
              a Form section with separators): five stacked identical sliders
              read as one texture without the lines saying where one band ends
              (Juan, 2026-09-08). M3's HorizontalDivider at the list ink,
              inset to the gutter. */}
          <Column modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}>
            {EQ_BANDS.map((band, index) => (
              <Column key={band.hz} modifiers={[fillMaxWidth()]}>
                {index > 0 ? (
                  <HorizontalDivider
                    thickness={1}
                    color={colors.listSeparator}
                    modifiers={[
                      padding(
                        COMPOSE_SHEET_GUTTER,
                        12,
                        COMPOSE_SHEET_GUTTER,
                        12,
                      ),
                    ]}
                  />
                ) : null}
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 8 }}
                  modifiers={[
                    fillMaxWidth(),
                    height(EQ_ROW_HEIGHT),
                    padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
                  ]}
                >
                  {/* BOTH texts take the muted ink and the same rung — the
                      iOS row's own treatment (`mutedText` on both ends), and
                      the value was the odd one out at full onSurface. The
                      label centres in its fixed box and the value trails,
                      exactly iOS's frame alignments, so the two gaps onto
                      the track read even. */}
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ textAlign: 'center', typography: 'labelMedium' }}
                    modifiers={[width(EQ_LABEL_WIDTH)]}
                  >
                    {band.label}
                  </Text>
                  <Slider
                    value={gains[index]}
                    min={EQ_MIN_DB}
                    max={EQ_MAX_DB}
                    steps={EQ_SLIDER_STEPS}
                    colors={sliderInk}
                    onValueChange={value =>
                      setBandGain(index, Math.round(value))
                    }
                    modifiers={[weight(1)]}
                  />
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ textAlign: 'end', typography: 'labelMedium' }}
                    modifiers={[width(EQ_LABEL_WIDTH)]}
                  >
                    {dbLabel(gains[index])}
                  </Text>
                </Row>
              </Column>
            ))}
          </Column>

          {/* The band numbers are hertz, which means nothing to most people —
              say what the ends of the range actually sound like. A LEGEND
              UNDER THE GROUP, iOS's Section-footer position — which Android
              already draws for the Account screen's destructive card (legend
              below the card, bodySmall muted, inset to the content). Under
              the header it read as a second title; under the sliders it
              explains what you just used, the same size as Preserve Pitch's
              own legend below. */}
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodySmall' }}
            modifiers={[
              padding(COMPOSE_SHEET_GUTTER, 2, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {t('player.eq.hint')}
          </Text>

          {/* Speed — stepped quarter increments, live value beside the header.
              The top padding is the LEGEND→HEADER boundary, and it takes the
              same make-up iOS measured for this exact seam (Settings puts
              footer ink 31pt above the next header's; the sheet's default
              left the EQ legend crowding this title — Juan read it on
              Android too, 2026-09-08). Measured after: 30.2dp ink to ink, against iOS's 30.66. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 19, COMPOSE_SHEET_GUTTER, 0),
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
            colors={sliderInk}
            onValueChange={value => setRate(snapRate(value))}
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

          {/* ECHO — GRADED BY LEVEL (Juan, 2026-09-25), so it is a FilterChip
              row again, the shape it had as a spacing picker and the shape the
              Presets row above keeps: a selected chip is a SELECTION, which is
              what keeps its accent on this monochrome sheet. iOS draws the
              same vocabulary as a menu Picker. The levels grade the DEPTH over
              the one surviving spacing — see `ECHO_LEVELS` in `shapeDsp.ts` —
              and Echo stays INDEPENDENT of Next Room (see `store/shaper.ts`). */}
          <Column
            verticalArrangement={{ spacedBy: 2 }}
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 14, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>
              {t('player.echo')}
            </Text>
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodySmall' }}
            >
              {t('player.echoDescription')}
            </Text>
          </Column>
          {/* Edge-to-edge scroll with content padding, exactly the Presets
              row's arrangement — and the same drawn-box `offset` correction,
              so the label→chips gap reads as the sheet's rhythm rather than
              the 48dp touch box's slack. */}
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              fillMaxWidth(),
              offset(0, -7),
              horizontalScroll(),
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {EFFECT_LEVELS.map(level => (
              <FilterChip
                key={level}
                selected={echo === level}
                onClick={() => setEcho(level)}
              >
                <FilterChip.Label>
                  <Text maxLines={1}>{levelLabel(level)}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
          </Row>

          {/* Next Room is its own control, not a companion to the speed block
              above — the same label/supporting/chips anatomy as Echo so the
              two graded effects read as one list rather than as two designs.
              iOS gives it a separate grouped Section for the same reason; here
              the rhythm does that job, because a Compose column has no cards
              to split. */}
          <Column
            verticalArrangement={{ spacedBy: 2 }}
            modifiers={[
              fillMaxWidth(),
              padding(COMPOSE_SHEET_GUTTER, 14, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>
              {t('player.nextRoom')}
            </Text>
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodySmall' }}
            >
              {t('player.nextRoomDescription')}
            </Text>
          </Column>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              fillMaxWidth(),
              offset(0, -7),
              horizontalScroll(),
              padding(COMPOSE_SHEET_GUTTER, 0, COMPOSE_SHEET_GUTTER, 0),
            ]}
          >
            {EFFECT_LEVELS.map(level => (
              <FilterChip
                key={level}
                selected={nextRoom === level}
                onClick={() => setNextRoom(level)}
              >
                <FilterChip.Label>
                  <Text maxLines={1}>{levelLabel(level)}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
          </Row>
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
