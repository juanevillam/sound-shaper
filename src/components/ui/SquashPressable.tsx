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

// expo-ui's Compose tree exposes no press-in/out events, so press feedback
// lives on the RN side: a Pressable squashes its content while pressed and
// springs back on release.
const PRESS_SCALE = 0.97;
const PRESS_SPRING = { damping: 22, mass: 0.4, stiffness: 360 };

// Android's own pressed-state delay inside scrollables (~tap timeout): if the
// touch turns into a scroll within this window, onPressIn never fires, so
// scrolling over a card doesn't flash the squash.
const PRESS_IN_DELAY_MS = 100;

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
 * song cards in place of the Compose ripple.
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
  const scale = useSharedValue(1);
  // Respect the OS "remove animations" setting: skip the squash entirely.
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        unstable_pressDelay={PRESS_IN_DELAY_MS}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          if (!reduceMotion)
            scale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
        }}
        onPressOut={() => {
          if (!reduceMotion) scale.value = withSpring(1, PRESS_SPRING);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
