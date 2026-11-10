import { useEffect } from 'react';

import {
  HStack,
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
  listSectionMargins,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { scrollSheetSection } from '@modules/audio-session';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { SKELETON_DELAY_MS } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/core';
import { useDelayedShow } from '@/hooks/useDelayedShow';
import { useI18n } from '@/i18n';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  type EffectLevel,
} from '@/lib/audioEngine';
import { AUTO_DJ_MODES, isAutoDjMode, type DjFocus } from '@/lib/autoDj/plan';
import {
  RATE_LAST_STOP,
  rateLabel,
  rateToStop,
  stopToRate,
} from '@/lib/player';
import { track } from '@/services/firebase/analytics';
import { autoDjModeLabel, useAutoDjStore } from '@/store/autoDj';
import { usePlayerStore } from '@/store/player';
import {
  dbLabel,
  EQ_PRESETS,
  levelLabel as shaperLevelLabel,
  presetLabel,
  useShaperStore,
} from '@/store/shaper';
import { FormValueRowIos, SheetFormBodyIos } from '@/ui';

// iOS-only route: every sound-shaping control as a grouped native `Form`
// (Android presents the Compose `ShaperSheet` in place). iOS vocabulary
// throughout — a `Picker` row for the preset, SwiftUI `Slider`s and a `Toggle`.
//
// It used to draw this out of RN: the presets were `Pressable` capsules — i.e.
// Material chips wearing an iOS palette, the same mistake the editor sheets made
// with their delete pill — and each section header was hand-typeset. A `Form`
// supplies all of that, plus the grouped backgrounds, separators, Dynamic Type
// and keyboard handling, for free.
//
// NOTHING HERE COMMITS, which is why the sheet has no bar action of its own and
// inherits the family's plain close glyph from `IOS_FORM_SHEETS`. Every row
// takes effect on the live audio graph as you move it, so leaving keeps the
// sound you are hearing. Saving a named shape was built and REMOVED
// 2026-08-22 — see the note in `store/shaper.ts`.

/**
 * WHAT APPLE PUTS BETWEEN A FOOTER AND THE NEXT SECTION'S HEADER, less what
 * this Form already gives — added to the EQ section's BOTTOM edge alone.
 *
 * Band-scanned on iPhone 17 / iOS 26.5. Apple's own Settings > General >
 * Keyboard has two footer-to-header boundaries and both measure **31.00** from
 * the footer's ink to the header's ink; a SwiftUI `Form` gives **20.66**. The
 * 10 is that difference, and it lands the boundary at 30.66.
 *
 * `listSectionMargins({edges: 'bottom'})` is the lever because it is the only
 * ONE-SIDED one. `listSectionSpacing` is additive on a section's top and
 * ABSOLUTE on its bottom, so the override that used to sit on Playback Speed
 * bought this same gap by collapsing Speed-to-Preserve-Pitch from the family's
 * 35.00 to 22.00 — see the note on that section. Verified here: at 20 this
 * added exactly 20 above and left the boundary below at 35.00.
 *
 * Everything else on the sheet is the platform's untouched: a card to its own
 * footer ink is 10.67 against Apple's 11.00, and card-to-card is 35.00.
 */
const FOOTER_TO_HEADER_MAKEUP = 10;

const EQ_LABEL_WIDTH = 38;

/** The Presets row's tag for a hand-shaped curve; never a real preset key. */
const CUSTOM_TAG = 'custom';

/** 0-indexed `Form` section for each DJ focus target. */
const DJ_FOCUS_SECTION: Record<DjFocus, number> = {
  presets: 0,
  eq: 1,
  speed: 2,
  keepPitch: 3,
  echo: 4,
  nextRoom: 5,
};

/**
 * HOW FAR THE FIRST READ OF THE LIBRARY HAS GOT — after the standard loading
 * delay, never before. Once the library has been read, switching Auto DJ on
 * only reloads what is cached, which finishes inside that window; shown at
 * once, the row flashed in and out (Juan, on device, 2026-11-04). Mounted
 * only while reading, so the delay counts from the switch, not the sheet.
 */
function DjProgressRow(props: Parameters<typeof FormValueRowIos>[0]) {
  const show = useDelayedShow(SKELETON_DELAY_MS);
  return show ? <FormValueRowIos {...props} /> : null;
}

/**
 * One graded effect — Echo or Next Room — as a menu `Picker` row in a section
 * of its own, its explanation in the section's footer. The two were written
 * out twice, identically but for their copy and their store field.
 */
function LevelPickerSection({
  label,
  footer,
  value,
  onChange,
  levelLabel,
}: {
  label: string;
  footer: string;
  value: EffectLevel;
  onChange: (key: unknown) => void;
  levelLabel: (level: EffectLevel) => string;
}) {
  return (
    <Section footer={<SwiftUIText>{footer}</SwiftUIText>}>
      <Picker
        label={label}
        selection={value}
        onSelectionChange={onChange}
        modifiers={[pickerStyle('menu')]}
      >
        {EFFECT_LEVELS.map(level => (
          <SwiftUIText key={level} modifiers={[tag(level)]}>
            {levelLabel(level)}
          </SwiftUIText>
        ))}
      </Picker>
    </Section>
  );
}

function ShaperSheetScreen() {
  const { t, locale } = useI18n();

  useEffect(() => track({ name: 'open_shape' }), []);
  const { colors } = useAppTheme();

  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);

  const gains = useShaperStore(s => s.gains);
  const setBandGain = useShaperStore(s => s.setBandGain);
  const activePreset = useShaperStore(s => s.activePreset);
  const applyPreset = useShaperStore(s => s.applyPreset);
  const nextRoom = useShaperStore(s => s.nextRoom);
  const setNextRoom = useShaperStore(s => s.setNextRoom);
  const echo = useShaperStore(s => s.echo);
  const setEcho = useShaperStore(s => s.setEcho);

  const djOn = useAutoDjStore(s => s.on);
  const djMode = useAutoDjStore(s => s.mode);
  const djFocus = useAutoDjStore(s => s.focus);
  const djReady = useAutoDjStore(s => s.ready);
  const djTotal = useAutoDjStore(s => s.total);
  const setDjMode = useAutoDjStore(s => s.setMode);
  const stopDj = useAutoDjStore(s => s.stop);

  useEffect(() => {
    if (!djOn || !djFocus) return;
    const section = DJ_FOCUS_SECTION[djFocus];
    scrollSheetSection(section);
    const timer = setTimeout(() => scrollSheetSection(section), 280);
    return () => clearTimeout(timer);
  }, [djOn, djFocus]);

  /**
   * ANY OTHER CONTROL TAKES THE SHAPE BACK FROM THE DJ. Moving one while it
   * mixes would be overwritten on the next beat, which reads as the control
   * not working. So the DJ stops and the sound stays where it is — not
   * restored, because snapping back to the pre-DJ shape under the person's
   * finger would undo the move they just made. See `store/autoDj.ts`.
   */
  const byHand =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A) => {
      if (useAutoDjStore.getState().on) stopDj({ restore: false });
      action(...args);
    };

  const djProgress = t('player.autoDjProgress')
    .replace('{ready}', String(djReady))
    .replace('{total}', String(djTotal));

  const levelLabel = (level: EffectLevel) => shaperLevelLabel(t, level);

  // A Picker hands back an unknown; only a known level may reach the engine.
  const asLevel = (key: unknown): EffectLevel =>
    (EFFECT_LEVELS as readonly string[]).includes(String(key))
      ? (String(key) as EffectLevel)
      : 'off';

  const labelFor = (key: string) =>
    presetLabel(t, key) ?? t('player.eq.presets.flat');

  const mutedText = [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.onSurfaceMuted),
  ];

  /**
   * MONOCHROME FILLS, the same conversion `PlayerScrubber.ios.tsx` already
   * made. A slider's played portion says the same thing its thumb position
   * says, so the colour there carries nothing — it was blue only because
   * `SheetFormBodyIos` tints the whole `Form` `primary`, and a `Slider` picks
   * that up along with everything else.
   *
   * OVERRIDDEN PER SLIDER RATHER THAN AT THE FORM, because that Form tint is
   * load-bearing for the control above: the Presets row is a menu picker whose
   * VALUE is tinted on Apple's own authority (Settings does it to Language and
   * Appearance). Dropping the tint at the top would repaint it.
   */
  const sliderInk = [tint(colors.onSurface)];

  return (
    // `SheetScreen` is the family's full-height sheet root — see its docstring.
    <SheetScreen>
      {/* `fullHeight`: this route is `[1]` in `IOS_FORM_SHEETS`, and the body
          pulls back a different amount there — see `SheetFormBodyIos`. */}
      <SheetFormBodyIos fullHeight>
        {/* One row that says which preset is on and opens the list to change it,
          rather than six capsules competing for the eye — the Settings idiom. */}
        <Section>
          <Picker
            label={t('player.shape.presets')}
            selection={activePreset ?? CUSTOM_TAG}
            onSelectionChange={key => {
              if (key !== CUSTOM_TAG) byHand(applyPreset)(String(key));
            }}
            modifiers={[pickerStyle('menu')]}
          >
            {EQ_PRESETS.map(preset => (
              <SwiftUIText
                key={preset.i18nKey}
                modifiers={[tag(preset.i18nKey)]}
              >
                {labelFor(preset.i18nKey)}
              </SwiftUIText>
            ))}
            {/* A HAND-SHAPED CURVE IS A VALUE TOO. Dragging a band clears
                `activePreset`, which matched no tag, so the row's value went
                blank while the summary under the player said "Custom". The
                option exists only while it is true — Settings lists no
                choice you cannot pick. */}
            {activePreset === null ? (
              <SwiftUIText modifiers={[tag(CUSTOM_TAG)]}>
                {t('player.shape.custom')}
              </SwiftUIText>
            ) : null}
          </Picker>
        </Section>

        {/* The band numbers are hertz, which means nothing to most people — say
          what the ends of the range actually sound like. In a Form that line is
          the section's FOOTER, which is where iOS puts explanatory text. */}
        <Section
          modifiers={[
            listSectionMargins({
              edges: 'bottom',
              length: FOOTER_TO_HEADER_MAKEUP,
            }),
          ]}
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
                modifiers={sliderInk}
                value={gains[index]}
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={1}
                onValueChange={value =>
                  byHand(setBandGain)(index, Math.round(value))
                }
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
              <SwiftUIText>{rateLabel(rate, locale)}</SwiftUIText>
            </HStack>
          }
        >
          <Slider
            modifiers={sliderInk}
            // Stops, not rates — the only way SwiftUI draws the ticks (see
            // `RATE_LAST_STOP`).
            value={rateToStop(rate)}
            min={0}
            max={RATE_LAST_STOP}
            step={1}
            onValueChange={value => byHand(setRate)(stopToRate(value))}
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
            onIsOnChange={byHand(setKeepPitch)}
            // GREEN, not the ink and not the accent — see `switchOn`. It
            // has to be stated because a SwiftUI `Toggle` takes the ambient
            // accent, and `SheetFormBodyIos` tints this whole Form `primary`
            // for the picker's sake one section up.
            modifiers={[tint(colors.switchOn)]}
          />
        </Section>

        <LevelPickerSection
          label={t('player.echo')}
          footer={t('player.echoDescription')}
          value={echo}
          onChange={key => byHand(setEcho)(asLevel(key))}
          levelLabel={levelLabel}
        />

        <LevelPickerSection
          label={t('player.nextRoom')}
          footer={t('player.nextRoomDescription')}
          value={nextRoom}
          onChange={key => byHand(setNextRoom)(asLevel(key))}
          levelLabel={levelLabel}
        />

        {/* DJ JUAN CLOSES THE SHEET: a menu Picker with Off, This Sound,
          and All Sounds — on, it moves every control above it itself, either
          remixing the playing sound continuously or playing the library as a
          set; off from here, the shape goes back to what it was. While the
          library is read the first time in All Sounds mode, a row says how
          far that has got. */}
        <Section
          footer={<SwiftUIText>{t('player.autoDjDescription')}</SwiftUIText>}
        >
          <Picker
            label={t('player.autoDj')}
            selection={djMode}
            onSelectionChange={key => {
              if (isAutoDjMode(key)) setDjMode(key);
            }}
            modifiers={[pickerStyle('menu')]}
          >
            {AUTO_DJ_MODES.map(m => (
              <SwiftUIText key={m} modifiers={[tag(m)]}>
                {autoDjModeLabel(t, m)}
              </SwiftUIText>
            ))}
          </Picker>
          {djMode === 'all' && djTotal > 0 && djReady < djTotal ? (
            <DjProgressRow
              label={t('player.autoDjPreparing')}
              value={djProgress}
              colors={colors}
            />
          ) : null}
        </Section>
      </SheetFormBodyIos>
    </SheetScreen>
  );
}

export default ShaperSheetScreen;
