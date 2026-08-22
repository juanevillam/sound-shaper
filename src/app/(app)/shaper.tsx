import { Alert } from 'react-native';

import {
  Button,
  HStack,
  Image,
  Picker,
  Section,
  Slider,
  Spacer,
  SwipeActions,
  Text as SwiftUIText,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  hidden,
  listSectionSpacing,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {
  sheetCommitBarOptionsIos,
  SheetFormBodyIos,
} from '@portfolio/mobile-ui';
import { router, Stack } from 'expo-router';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useShapesSubscription } from '@/hooks/useShapesSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { haptics } from '@/lib/haptics';
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

/**
 * The applied-shape checkmark. Sized and boxed so it can NEVER drive the row's
 * height — see the note at its call site. 15 is under the row's Body line box
 * (17/22) with room to spare, and still reads as iOS's list checkmark.
 */
const CHECK_GLYPH = 15;
const CHECK_BOX = 20;

const EQ_LABEL_WIDTH = 38;
const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const RATE_STEP = 0.1;
const SHAPE_NAME_MAX = 24;

const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

function ShaperSheetScreen() {
  const { t, locale } = useI18n();
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

  const onDeleteShape = (shapeId: string) => {
    haptics.selection();

    deleteShape(shapeId)
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

  /**
   * ADDED to the existing separation, not the total — verified by measurement:
   * passing 44 produced a 66pt gap on a boundary that already had 22. So this
   * is the 22 a footer eats, handed back, landing the boundary on the same 44
   * a card-to-header one has. See the note on the Playback Speed section.
   */
  const SECTION_AFTER_FOOTER_SPACING = 22;

  const mutedText = [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.onSurfaceMuted),
  ];

  return (
    // `SheetScreen` for the toast — see `SnackbarOutlet`. Saving or deleting a
    // shape confirms with a snackbar, and from inside a sheet that message drew
    // behind the presentation.
    <SheetScreen>
      {/* Real UIKit bar, Topper's standard — see `IOS_FORM_SHEETS`. The ✓ is
          "save this as a named shape" rather than "apply": the EQ, speed and
          pitch rows take effect as you move them, so closing keeps the sound
          you are hearing and the ✓ only names it. */}
      <Stack.Screen
        options={sheetCommitBarOptionsIos({
          title: t('player.shape.title'),
          cancelLabel: t('common.done'),
          onCancel: () => router.back(),
          actionLabel: t('player.shapes.save'),
          onAction: promptSaveShape,
        })}
      />
      <SheetFormBodyIos>
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
              // DELETE IS A SWIPE, not a button at the foot of the sheet. It
              // was a `SheetFormDestructiveIos` in its own last section, which
              // had two problems beyond the distance: it could only ever delete
              // the APPLIED shape, so every other one was undeletable, and it
              // appeared and vanished with `activeShape`, so the sheet's last
              // section came and went as you tapped around. A swipe reaches any
              // row and takes nothing away when it is idle. Same control, same
              // labelling rule as the clips list one sheet over.
              <SwipeActions key={shape.id}>
                {/* Trailing checkmark on the applied one — how iOS marks the
                    chosen row in a list you can pick from.

                    THE SLOT IS ALWAYS THERE, and the glyph is only hidden.
                    Rendering the `Image` conditionally shifted the layout: an
                    unsized SF Symbol's FRAME is taller than the row's text line
                    box, so whichever row held it grew. Measured on iPhone 17 /
                    iOS 26.5 by moving the selection between two rows — the
                    separator jumped 313 → 311 and the active row went 51 → 55,
                    so the divider hopped every time you picked a different
                    shape.

                    SwiftUI's `hidden()` keeps the space and drops the view from
                    the accessibility tree, which is exactly what a reserved
                    slot wants. The explicit frame is the belt to that braces:
                    it pins the box under the text's line height so the symbol
                    can never drive the row again, whatever size it renders. */}
                <Button onPress={() => onApplyShape(shape.id)}>
                  <HStack>
                    <SwiftUIText
                      modifiers={[foregroundStyle(colors.onSurface)]}
                    >
                      {shape.name}
                    </SwiftUIText>
                    <Spacer />
                    <Image
                      systemName="checkmark"
                      size={CHECK_GLYPH}
                      color={colors.primary}
                      modifiers={[
                        frame({ width: CHECK_BOX, height: CHECK_BOX }),
                        ...(activeShapeId === shape.id ? [] : [hidden()]),
                      ]}
                    />
                  </HStack>
                </Button>
                <SwipeActions.Actions edge="trailing">
                  {/* LABELLED, like every swipe action in the portfolio. */}
                  {/* TINTED EXPLICITLY. `role="destructive"` colours a plain
                      Form button red on its own — that is how the Delete rows
                      elsewhere get theirs — but a SWIPE action takes its
                      background from the inherited `tint`, and
                      `SheetFormBodyIos` tints the whole Form `primary`. Without
                      this the destructive action renders BLUE, which was
                      shipping in both sheets. */}
                  <Button
                    role="destructive"
                    label={t('player.shapes.delete')}
                    systemImage="trash"
                    modifiers={[tint(colors.danger)]}
                    onPress={() => onDeleteShape(shape.id)}
                  />
                </SwipeActions.Actions>
              </SwipeActions>
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

        {/* A SECTION THAT FOLLOWS A FOOTER LOSES HALF ITS SEPARATION.
          Band-scanned on iPhone 17 / iOS 26.5: a card-to-header boundary (My
          Shapes → Equalizer) runs 44pt from the card's edge to the header's
          ink, while this one — footer ink to header ink — ran 22. SwiftUI puts
          the footer INSIDE the previous section's box and then applies its
          standard spacing, so the footer's own line eats the gap the header
          would otherwise have had.

          Restored explicitly rather than by padding the text, so the two
          boundaries in this form are the same distance. */}
        <Section
          modifiers={[listSectionSpacing(SECTION_AFTER_FOOTER_SPACING)]}
          header={
            <HStack>
              <SwiftUIText>{t('player.speed')}</SwiftUIText>
              <Spacer />
              <SwiftUIText>{rateLabel(rate, locale)}</SwiftUIText>
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
      </SheetFormBodyIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(ShaperSheetScreen);
