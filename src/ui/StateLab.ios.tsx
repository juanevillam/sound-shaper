import { useEffect, useState } from 'react';

import { Keyboard, StyleSheet, View } from 'react-native';

import {
  Button,
  HStack,
  Host,
  Image,
  Picker,
  Spacer,
  Text,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  imageScale,
  lineLimit,
  padding,
  pickerStyle,
  shapes,
  symbolEffect,
  tint,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnUI } from 'react-native-worklets';
import type { SFSymbol } from 'sf-symbols-typescript';

import { FLOATING_RADIUS } from './GlassSurfaceIos';
import type { StateLabGroup } from './StateLab';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE DEV STATE LAB — iOS. SwiftUI, like everything else on this platform.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Same contract as the RN twin (`StateLab.tsx`, which Android still uses); only
 * the drawing differs. The previous version's comment claimed plain RN was
 * deliberate — "scaffolding must never be mistakable for the UI it is judging"
 * — and that argument does not survive contact with the thing it produced: a
 * bar of hand-drawn pills and text glyphs sitting on an otherwise fully native
 * screen looked like a bug in the app, not like a tool. A dev surface is still
 * a surface, and this repo's rule is that the platform's own component is the
 * default. So the parts are Apple's:
 *
 *  - the group switcher is a real segmented `Picker`, which is exactly the
 *    control iOS uses to swap between two views of the same thing;
 *  - the steppers are `Button`s carrying SF Symbol chevrons, at `large`
 *    control size, rather than typographic ‹ › in a padded box;
 *  - the bar's SURFACE stays an RN card fill, not `glassEffect` — see the
 *    note on `styles.card`: `@expo/ui` exposes no `background` modifier, and
 *    Liquid Glass is for chrome that refracts live content, which a dev HUD
 *    that only needs to be legible is not. (An earlier version of this
 *    docblock claimed the bar WAS glass; it never shipped that way.)
 *
 * WHAT STAYS RN: the positioning shell only — absolute placement, the safe-area
 * inset and riding the keyboard. Those are layout, not chrome, and RN owns the
 * frame the `Host` is handed.
 */

/** Two lines of note, always — see `NOTE_LINES`. */
const NOTE_LINES = 2;
/** The bar's corner. Applied inside SwiftUI — see the `clipShape` note. */
// A floating card over content — the family's corner, not a copy of it.
const CARD_RADIUS = FLOATING_RADIUS;
/** Clearance for a floating tab bar, when the caller does not say otherwise. */
const DEFAULT_BOTTOM_OFFSET = 52;

export function StateLab({
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  colors,
  groups,
}: {
  bottomOffset?: number;
  colors: {
    card: string;
    listSeparator: string;
    onSurface: string;
    onSurfaceMuted: string;
    surfaceContainer: string;
  };
  groups: readonly StateLabGroup[];
}) {
  const { bottom } = useSafeAreaInsets();
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
        styles.shell,
        {
          bottom: (keyboard > 0 ? keyboard : bottom + bottomOffset) + 8,
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {/* `{ vertical: true }`, never the boolean — the boolean collapses a
            fill-width child, which is what the picker and the readout row
            are. */}
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <VStack
            spacing={10}
            modifiers={[
              padding({ all: 12 }),
              // Clipped on BOTH sides of the bridge, deliberately: the RN
              // wrapper carries the same radius, but an RN parent is not
              // guaranteed to clip a native subtree to its corners, so the
              // SwiftUI content rounds itself as well. Same value either way.
              clipShape('roundedRectangle', CARD_RADIUS),
            ]}
          >
            {groups.length > 1 ? (
              <Picker
                modifiers={[pickerStyle('segmented')]}
                selection={group.key}
                onSelectionChange={setActiveKey}
              >
                {groups.map(option => (
                  <Text key={option.key} modifiers={[tag(option.key)]}>
                    {option.label}
                  </Text>
                ))}
              </Picker>
            ) : null}

            <HStack spacing={12}>
              <Step
                colors={colors}
                direction="down"
                glyph="chevron.left"
                onPress={() => step(-1)}
              />

              <VStack alignment="leading" spacing={6}>
                <Text
                  modifiers={[
                    font({ size: 15, weight: 'semibold' }),
                    foregroundStyle(colors.onSurface),
                    lineLimit(1),
                  ]}
                >
                  {`${group.label.toUpperCase()}  ${index + 1}/${group.states.length}  ${entry.label}`}
                </Text>
                {/*
                 * RESERVES SPACE, which is the whole point: notes are one line
                 * for some states and two for others, and without this the bar
                 * changed height as you stepped — a picker that shifts under the
                 * thumb, on the one tool whose job is finding shifts. SwiftUI's
                 * own answer, so the reserved box is exactly two lines of THIS
                 * font rather than a height guessed in points.
                 */}
                <Text
                  modifiers={[
                    font({ size: 13 }),
                    foregroundStyle(colors.onSurfaceMuted),
                    lineLimit(NOTE_LINES, { reservesSpace: true }),
                  ]}
                >
                  {entry.note}
                </Text>
              </VStack>

              <Spacer />

              <Step
                colors={colors}
                direction="up"
                glyph="chevron.right"
                onPress={() => step(1)}
              />
            </HStack>
          </VStack>
        </Host>
      </View>
    </View>
  );
}

/**
 * A stepper: a bare chevron in the READOUT'S OWN INK, no fill behind it.
 *
 * PRESS FEEDBACK IS AN SF SYMBOL BOUNCE, not a dim, and that is not a
 * preference — it is the only one of the two that works here. A SwiftUI button
 * style renders its pressed state by modulating the label, and measuring the
 * glyph through a 3.5s hold showed NO change under `plain`, `borderless`, the
 * default style, or with the colour moved from `foregroundStyle` to `tint`.
 * Taps registered the whole time (the readout stepped), so the control was
 * live and simply drew nothing.
 *
 * `symbolEffect` fires on VALUE CHANGE rather than on press state, which side-
 * steps that entirely — and a symbol that bounces when you tap it is the iOS 26
 * idiom for a glyph-only control anyway, so this is the better answer even
 * where a dim would have worked. The write goes through `scheduleOnUI` because
 * the trigger is native state living on the UI runtime.
 *
 * `padding` + `contentShape` keep the TARGET big now that the fill is gone: a
 * chrome-less button is otherwise only as tappable as its glyph, and this one
 * is tapped dozens of times a minute.
 */
function Step({
  colors,
  direction,
  glyph,
  onPress,
}: {
  colors: { onSurface: string };
  /** Bounce the way the chevron points, so the two steppers do not animate
   *  identically — the motion says which way you just moved. */
  direction: 'up' | 'down';
  glyph: SFSymbol;
  onPress: () => void;
}) {
  const trigger = useNativeState(0);

  return (
    <Button
      onPress={() => {
        scheduleOnUI(() => {
          'worklet';
          trigger.value = trigger.value + 1;
        });
        onPress();
      }}
      modifiers={[contentShape(shapes.rectangle()), tint(colors.onSurface)]}
    >
      <Image
        systemName={glyph}
        modifiers={[
          imageScale('large'),
          symbolEffect({ effect: 'bounce', direction }, { value: trigger }),
          padding({ horizontal: 12, vertical: 14 }),
        ]}
      />
    </Button>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CARD IS RN, not SwiftUI. `@expo/ui` exposes no `background` modifier —
   * only `glassEffect`, which is the wrong answer here: a Liquid Glass panel is
   * for chrome that floats over live content and refracts it, and this is a
   * plain dev HUD that only needs to be legible. The shell already owns the
   * frame (absolute placement, safe area, keyboard), so it owns the surface
   * too, and the `Host` composites over it transparently.
   */
  // SHADOW ONLY. It cannot share a view with the corner clip: `overflow:
  // 'hidden'` clips the shadow off with everything else, so the float and the
  // rounding have to be two layers.
  shell: {
    left: 12,
    position: 'absolute',
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  /**
   * The surface. Radius matches the `clipShape` inside the `Host` — see there.
   *
   * NOTE FOR ANYONE EDITING THIS FILE: changes to `packages/mobile-ui` do NOT
   * fast-refresh into a running app. Relaunch it, or you will spend a while
   * "fixing" something that was already fixed and never loaded.
   */
  card: { backgroundColor: 'transparent', borderRadius: CARD_RADIUS },
  host: { width: '100%' },
});
