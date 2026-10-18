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

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/core';
import { useI18n } from '@/i18n';
import {
  EFFECT_LEVELS,
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  type EffectLevel,
} from '@/lib/audioEngine';
import {
  RATE_LAST_STOP,
  rateLabel,
  rateToStop,
  stopToRate,
} from '@/lib/player';
import { track } from '@/services/firebase/analytics';
import { usePlayerStore } from '@/store/player';
import {
  dbLabel,
  EQ_PRESETS,
  levelLabel as shaperLevelLabel,
  presetLabel,
  useShaperStore,
} from '@/store/shaper';
import { SheetFormBodyIos } from '@/ui';

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
              if (key !== CUSTOM_TAG) applyPreset(String(key));
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

        {/* THE OVERRIDE THAT USED TO SIT HERE IS GONE (2026-08-22), and what
          replaced it is one-sided and on the section ABOVE — see
          `FOOTER_TO_HEADER_MAKEUP`.

          This one read "a section that follows a footer loses half its
          separation" and handed 22 back through `listSectionSpacing`. The gap
          it was chasing is real — Apple's Settings > General > Keyboard puts
          31.00 between a footer's ink and the next header's ink, twice, where
          a SwiftUI `Form` puts 20.66 — but the instrument was wrong twice
          over. It sat on the section BELOW the boundary, and
          `listSectionSpacing` is additive on a section's top and ABSOLUTE on
          its bottom, so it paid for the gap by collapsing Speed to Preserve
          Pitch from the family's 35.00 to 22.00. Juan caught that by eye.

          Not everything the old note called a defect was one. A card's bottom
          to its own footer ink reads 10.67 here against Apple's 11.00, because
          a footer's INK is not its section's edge — the footer belongs to the
          section above and is meant to occupy that space. That half needed
          nothing. */}
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
            onValueChange={value => setRate(stopToRate(value))}
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
            // GREEN, not the ink and not the accent — see `switchOn`. It
            // has to be stated because a SwiftUI `Toggle` takes the ambient
            // accent, and `SheetFormBodyIos` tints this whole Form `primary`
            // for the picker's sake one section up.
            modifiers={[tint(colors.switchOn)]}
          />
        </Section>

        {/* Echo GRADES BY LEVEL (Juan, 2026-09-25), so it is a menu Picker row
          again — the Presets row's own idiom, and the value takes the Form's
          tint on Apple's authority (Settings tints its menu-picker values).
          It was a picker of three SPACINGS once and a switch after those were
          rejected on device; the levels grade the DEPTH instead, over the one
          surviving spacing — see `ECHO_LEVELS` in `shapeDsp.ts`. It is
          deliberately INDEPENDENT of Next Room — see the note on `echo` in
          `store/shaper.ts`. */}
        <LevelPickerSection
          label={t('player.echo')}
          footer={t('player.echoDescription')}
          value={echo}
          onChange={key => setEcho(asLevel(key))}
          levelLabel={levelLabel}
        />

        {/* Next Room gets its OWN section rather than joining Preserve Pitch's.
          A grouped section is a statement that its rows belong together, and
          these two answer different questions — one is about the speed control
          above it, the other is a place. Sharing a card would also leave one
          footer explaining two rows. Levels, like Echo above: the wall's
          DEPTH — see `NEXT_ROOM_LEVELS`. */}
        <LevelPickerSection
          label={t('player.nextRoom')}
          footer={t('player.nextRoomDescription')}
          value={nextRoom}
          onChange={key => setNextRoom(asLevel(key))}
          levelLabel={levelLabel}
        />
      </SheetFormBodyIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(ShaperSheetScreen);
