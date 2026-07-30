import type { ViewStyle } from 'react-native';

import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle, type AnimatedStyle } from 'react-native-reanimated';

/**
 * Bottom inset that keeps a sheet's PINNED bottom bar — a comment composer, a
 * chat field — clear of the keyboard. Apply it to the sheet's root
 * `Animated.View`.
 *
 * ## Why this exists as its own hook
 *
 * Keyboard avoidance is a property of the CONTAINER, not of the control. A
 * field inside a SwiftUI `Form` or `List` needs nothing at all — the native
 * scroll container insets itself. Only something pinned to the bottom of a
 * sheet has to be moved by hand, and every app that has such a bar needs the
 * exact same number, so it belongs here rather than re-derived per app.
 *
 * ## Why not `KeyboardAvoidingView`
 *
 * A form sheet is BOTTOM-ANCHORED: its bottom edge IS the screen's, whichever
 * detent it sits at. So the inset that clears the keyboard is simply the
 * keyboard's full height. `KeyboardAvoidingView` instead treats the sheet's top
 * offset as room already gained and under-pads by that much, which on a small
 * phone leaves the bar entirely behind the keyboard.
 *
 * Driving the padding off the keyboard's own animation (rather than an
 * `isVisible` flag) also keeps the bar glued to the keyboard as it rises,
 * instead of jumping when it lands.
 */
export function useSheetKeyboardInset(): AnimatedStyle<ViewStyle> {
  const { height } = useReanimatedKeyboardAnimation();

  return useAnimatedStyle(() => ({
    // The animation reports the keyboard's offset as a NEGATIVE height while it
    // is up, and settles at 0 when hidden.
    paddingBottom: Math.max(-height.value, 0),
  }));
}
