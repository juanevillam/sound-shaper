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
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { SheetFormBodyIos } from '@portfolio/mobile-ui';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { rateLabel } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';

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

const EQ_LABEL_WIDTH = 38;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

function ShaperSheetScreen() {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();

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
            selection={activePreset}
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

        {/* EVERY BOUNDARY IN THIS FORM IS THE PLATFORM'S OWN, and the one
          override that used to sit here is gone (2026-08-22).

          It read "a section that follows a footer loses half its separation"
          and handed 22 back through `listSectionSpacing`, on the evidence that
          a card-to-header boundary measures 31 while footer-ink to header-ink
          measures 20.66. Those two are not comparable: a footer's INK is not
          its section's edge — the footer belongs to the section above and is
          supposed to occupy that space.

          Apple's own Motion pane (Settings > Accessibility > Motion) is three
          headerless sections each carrying a footer, and it measures a card's
          bottom to its own footer ink at 10.00 and that footer's ink to the
          next card at 25.66. Ours reads 10.67 for the first, which is the
          platform behaviour, not a defect.

          What the override DID cost was the boundary below it: SwiftUI applied
          the 22 to both sides of this section, so Speed to Preserve Pitch came
          to 22.00 against the family's 35.00 — the account sheet's two
          card-to-card boundaries, measured. Juan caught that by eye. */}
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
      </SheetFormBodyIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(ShaperSheetScreen);
