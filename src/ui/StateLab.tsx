import { useEffect, useState } from 'react';

import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text as ComposeText,
} from '@expo/ui/jetpack-compose';
import { height, weight } from '@expo/ui/jetpack-compose/modifiers';

import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/core';

import { TEXT_VARIANTS } from './createText';
import {
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  usePressSquash,
} from './SquashPressable';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE DEV STATE LAB — dev-only, but PERMANENT and SHARED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A picker that pins any surface to any one of its UI states, so each can be
 * looked at and pixel-measured on demand instead of racing a debounce and
 * whatever the backend happens to return.
 *
 * It started as throwaway scaffolding inside Topper marked "delete before
 * committing", and earned its place: nearly every layout-shift and spacing
 * defect this repo has caught was found by stepping states side by side.
 * Scaffolding you rebuild each time is scaffolding you skip, so it lives here
 * instead — one implementation for every app, every screen, and (when they
 * come) every bottom sheet.
 *
 * IT RENDERS NOTHING IN A RELEASE BUILD. The bar returns null unless `__DEV__`,
 * so the guard cannot be forgotten at a call site.
 *
 * IT NEEDS NO FIXTURES, AND THERE ARE NONE. A `MOCK_DATA` flag once sat beside
 * each app's `STATE_LAB` and swapped invented rows into the live screens; it
 * and all five fixture files were deleted 2026-08-19. This picker pins the
 * BRANCH a screen renders, not the data underneath, so a skeleton, an empty
 * state or an error is as reachable against a live query as against a fixture.
 * A content state that can only exist by supplying rows is not a state worth
 * pinning — reach it by producing the content.
 *
 * DATA-DRIVEN ON PURPOSE. The first version hardcoded Topper's two screens and
 * their state enums, so a third surface meant editing the picker. A caller now
 * hands it groups; the picker knows only how to step a list and switch between
 * lists. That is what makes it work for a sheet as readily as for a screen.
 *
 * Plain RN, deliberately — scaffolding for judging real UI must never be
 * mistakable for the UI it is judging.
 */

/** One pinnable state. `note` is what to LOOK FOR, so a state is judged rather
 *  than just seen — it is the difference between a picker and a checklist. */
export type StateLabEntry = {
  label: string;
  note: string;
  value: string;
};

/**
 * One independent set of states. A surface with two (Explore: browse AND
 * search) passes two, and the chip row appears to switch between them; with
 * one, the row is omitted entirely rather than shown as a dead single chip.
 */
export type StateLabGroup = {
  key: string;
  /** Chip text, and the prefix on the readout. Already translated — packages
   *  hold no translator (they are handed strings, per the shared-screen rule),
   *  though a dev tool is deliberately English-only anyway. */
  label: string;
  onChange: (value: string) => void;
  states: readonly StateLabEntry[];
  value: string;
};

type StateLabColors = {
  card: string;
  listSeparator: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceContainer: string;
};

/**
 * CONTROL SIZING — this is a thing you POKE AT, repeatedly, while holding a
 * phone and looking at something else on the screen.
 *
 * The first version sized its controls like text: a 26pt glyph in 20pt of
 * padding, about 28×22 of real target, and stepping through eight states meant
 * aiming at it. Apple's 44pt minimum is the floor for a control tapped ONCE;
 * this one gets tapped dozens of times a minute, so the stepper takes 52 and
 * the group chips 40.
 */
const STEP_SIZE = 52;
/** The group switcher's height — deliberately under M3's 40dp default so it
 *  reads as secondary beside the stepper it drives. */
const GROUPS_HEIGHT = 32;
/**
 * The note ALWAYS reserves two lines, exactly like the iOS twin's
 * `lineLimit(2, { reservesSpace: true })`: notes are one line for some states
 * and two for others, and without the reservation the bar changed height as
 * you stepped — a picker that shifts under the thumb, on the one tool whose
 * job is finding shifts.
 *
 * Reserved by a GHOST TEXT, not a height. `2 × lineHeight` was tried first
 * and CLIPPED a real two-line note mid-glyph: an Android `Text` renders
 * taller than its stated `lineHeight` (the `SkeletonTextLine` finding), so
 * the described box was ~3dp shorter than the text it was reserving for. An
 * invisible two-line spacer at the note's own style makes the box whatever
 * the platform actually measures.
 */
const NOTE_LINES = 2;
const NOTE_GHOST = ' \n ';
/** Clearance for a floating tab bar, when the caller does not say otherwise. */
const DEFAULT_BOTTOM_OFFSET = 52;

export function StateLab({
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  colors,
  groups,
}: {
  /** Height of whatever floats at the bottom of THIS surface — a tab bar on a
   *  screen, nothing on a sheet. */
  bottomOffset?: number;
  colors: StateLabColors;
  groups: readonly StateLabGroup[];
}) {
  const { bottom } = useSafeAreaInsets();
  const { scheme } = useAppTheme();
  const [activeKey, setActiveKey] = useState(groups[0]?.key);

  /**
   * RIDE THE KEYBOARD. Pinning a state can focus a real text field, and a
   * picker buried under the keyboard cannot be stepped — which is exactly the
   * moment you most want to step it.
   */
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', event =>
      setKeyboard(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboard(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (!__DEV__ || groups.length === 0) return null;

  const group = groups.find(entry => entry.key === activeKey) ?? groups[0];
  const index = Math.max(
    0,
    group.states.findIndex(state => state.value === group.value),
  );
  const entry = group.states[index];
  if (!entry) return null;

  const step = (delta: number) => {
    const { length } = group.states;
    group.onChange(group.states[(index + delta + length) % length].value);
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          bottom: (keyboard > 0 ? keyboard : bottom + bottomOffset) + 8,
        },
      ]}
    >
      {groups.length > 1 ? (
        // A REAL M3 SegmentedButton row, exactly as the iOS twin uses a real
        // segmented Picker — the hand-drawn chip row this replaces was the
        // "scaffolding mistakable for UI" the iOS rewrite already called out
        // (Juan, 2026-09-04). The Host carries the resolved scheme itself,
        // the same move EmptyState makes; each button takes an equal share so
        // the switcher cannot be missed, matching the chips it replaces.
        <View style={styles.groups}>
          <Host
            colorScheme={scheme}
            matchContents={{ vertical: true }}
            style={styles.groupsHost}
          >
            {/* SECONDARY-SIZED: the switcher picks which group the stepper
                drives, so it must not outweigh the stepper row it serves.
                At M3's default 40dp it read as the bar's primary control
                (Juan, 2026-09-04); 32 with a labelMedium label keeps a real
                target while stepping it back. */}
            <SingleChoiceSegmentedButtonRow modifiers={[height(GROUPS_HEIGHT)]}>
              {groups.map(option => (
                <SegmentedButton
                  key={option.key}
                  selected={option.key === group.key}
                  onClick={() => setActiveKey(option.key)}
                  modifiers={[weight(1)]}
                >
                  <SegmentedButton.Label>
                    <ComposeText
                      maxLines={1}
                      style={{ typography: 'labelMedium' }}
                    >
                      {option.label}
                    </ComposeText>
                  </SegmentedButton.Label>
                </SegmentedButton>
              ))}
            </SingleChoiceSegmentedButtonRow>
          </Host>
        </View>
      ) : null}

      <View style={styles.row}>
        <Step colors={colors} glyph="‹" onPress={() => step(-1)} />

        <View style={styles.body}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: colors.onSurface }]}
          >
            {`${group.label.toUpperCase()}  ${index + 1}/${group.states.length}  ${entry.label}`}
          </Text>
          <View>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.note, styles.noteGhost]}
            >
              {NOTE_GHOST}
            </Text>
            <Text
              numberOfLines={NOTE_LINES}
              style={[
                styles.note,
                styles.noteOverlay,
                { color: colors.onSurfaceMuted },
              ]}
            >
              {entry.note}
            </Text>
          </View>
        </View>

        <Step colors={colors} glyph="›" onPress={() => step(1)} />
      </View>
    </View>
  );
}

// THE PORTFOLIO'S ICON PRESS, not a pressed fill. This shipped with a
// `surfaceContainer` fill under the pressed glyph on the argument that a dim is
// hard to see under a thumb — which is exactly what `ICON_PRESS_SCALE` +
// `ICON_PRESS_OPACITY` exist to solve for a lone glyph, and what the iOS twin
// answers with its SF Symbol bounce. One press language (Juan, 2026-09-04:
// bring this bar to the iOS one).
function Step({
  colors,
  glyph,
  onPress,
}: {
  colors: StateLabColors;
  glyph: string;
  onPress: () => void;
}) {
  const squash = usePressSquash({
    scale: ICON_PRESS_SCALE,
    opacity: ICON_PRESS_OPACITY,
  });

  return (
    <Animated.View style={squash.style}>
      <Pressable
        hitSlop={12}
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        style={styles.step}
      >
        <Text style={[styles.glyph, { color: colors.onSurface }]}>{glyph}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 20,
    // Android's shadow: the `shadow*` props below are iOS-only, so without
    // this the bar had no float at all and melted into any ground that
    // resolves to its own card colour (Juan, 2026-09-04) — which after the
    // card remap is every card it hovers over. 8 was the first value and read
    // heavier than the iOS twin's soft RN shadow; 4 floats without shouting
    // (Juan, same day).
    elevation: 4,
    gap: 8,
    left: 12,
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 10,
    position: 'absolute',
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  groups: { marginHorizontal: 6 },
  groupsHost: { width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  body: { flex: 1, gap: 2 },
  title: TEXT_VARIANTS.labelLarge,
  note: TEXT_VARIANTS.bodySmall,
  // The two-line measuring device the real note draws over (see NOTE_GHOST).
  noteGhost: { opacity: 0 },
  noteOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  step: {
    alignItems: 'center',
    borderRadius: 14,
    height: STEP_SIZE,
    justifyContent: 'center',
    width: STEP_SIZE,
  },
  // 44, up from 34 (Juan, 2026-09-04): the ‹ › glyphs carry heavy side
  // bearings, so at 34 their INK was well under the iOS chevron's — size the
  // ink, not the font box.
  glyph: { fontSize: 44, lineHeight: 50 },
});
