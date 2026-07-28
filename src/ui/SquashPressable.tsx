import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/**
 * THE press-feedback language for every portfolio app: a Reanimated squash
 * that behaves identically on both platforms.
 *
 * It lives in the package because both apps had grown their own copy of the
 * same file, and because press feedback is the kind of thing that silently
 * drifts — one app on Compose ripples, another on `android_ripple`, a third
 * surface with no feedback at all. There is one spring here and every custom
 * pressable in the portfolio uses it.
 *
 * Two shapes:
 *
 * - `SquashPressable` — content INSIDE the Pressable. Cards, tiles, rows.
 * - `usePressSquash` — the same feedback for a control that has to build its
 *   own Pressable, e.g. an icon button whose press target must sit ON TOP of a
 *   Compose Host (which consumes touches at the Android layer, so a
 *   `pointerEvents="none"` underlay does not work).
 */

// expo-ui's Compose tree exposes no press-in/out events, so press feedback
// lives on the RN side. Spring tuned like the old bare-RN app.
export const PRESS_SCALE = 0.97;
export const PRESS_SPRING = { damping: 22, mass: 0.4, stiffness: 360 };

/**
 * A lone 24pt glyph barely registers the card squash — 3% of 48pt is under a
 * pixel and a half. Icon buttons press deeper and dim, which is what makes the
 * feedback visible at that size on both platforms.
 */
export const ICON_PRESS_SCALE = 0.86;
export const ICON_PRESS_OPACITY = 0.55;

// Android's own pressed-state delay inside scrollables (~tap timeout): if the
// touch turns into a scroll within this window, onPressIn never fires, so
// scrolling over a card doesn't flash the squash.
const PRESS_IN_DELAY_MS = 100;

type PressSquashOptions = {
  /** How far the content squashes. Defaults to the card scale. */
  scale?: number;
  /** Pressed opacity. Defaults to 1 (no dim) — the card treatment. */
  opacity?: number;
};

/**
 * The squash itself, without a Pressable: an animated style plus the two
 * handlers that drive it. Reduce-motion drops the SCALE (it is motion) but
 * keeps any dim — a control with no feedback at all is a worse answer than a
 * still one.
 */
export function usePressSquash({ scale, opacity }: PressSquashOptions = {}) {
  const pressScale = scale ?? PRESS_SCALE;
  const pressOpacity = opacity ?? 1;
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const style = useAnimatedStyle(() => {
    const target = reduceMotion ? 1 : pressScale;

    return {
      opacity: 1 - pressed.value * (1 - pressOpacity),
      transform: [{ scale: 1 - pressed.value * (1 - target) }],
    };
  });

  return {
    style,
    onPressIn: () => {
      pressed.value = withSpring(1, PRESS_SPRING);
    },
    onPressOut: () => {
      pressed.value = withSpring(0, PRESS_SPRING);
    },
  };
}

type SquashPressableProps = {
  children: React.ReactNode;
  onPress: () => void;
  /** Long-press handler, e.g. to open a card's context menu. */
  onLongPress?: () => void;
  /** Expand the touch area past the visual bounds (44pt/48dp minimums). */
  hitSlop?: PressableProps['hitSlop'];
  style?: StyleProp<ViewStyle>;
  /**
   * Screen-reader label. Optional because most cards carry readable Text
   * children; REQUIRED in spirit for icon/emoji-only content, which otherwise
   * reads as nothing.
   */
  accessibilityLabel?: string;
  /** e.g. `{ selected: true }` for toggled pills. */
  accessibilityState?: PressableProps['accessibilityState'];
};

/**
 * Pressable with a while-pressing squash (Reanimated, native driver — no
 * React re-renders, so Compose children never re-send props). Used by the
 * cards, tiles and rows in place of the Compose ripple.
 */
export function SquashPressable({
  children,
  onPress,
  onLongPress,
  hitSlop,
  style,
  accessibilityLabel,
  accessibilityState,
}: SquashPressableProps) {
  const squash = usePressSquash();

  return (
    <Animated.View style={[squash.style, style]}>
      <Pressable
        unstable_pressDelay={PRESS_IN_DELAY_MS}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
