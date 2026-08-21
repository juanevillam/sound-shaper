import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import {
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  usePressSquash,
} from '@portfolio/mobile-ui';
import Animated from 'react-native-reanimated';

/**
 * The transport button — the banner's and the console's, on both platforms.
 *
 * A LEAF, like `bannerMetrics`: it is used by `PlayerSheet` (the banner) and by
 * both `PlayerConsole` twins, so it cannot live in any of them. From inside
 * `PlayerConsole.ios.tsx` an import of `./PlayerConsole` resolves back to
 * itself — Metro prefers the platform extension — and the shared value comes
 * back `undefined`.
 *
 * Its glyphs are supplied by the caller (`TransportGlyphs` — SF Symbols on
 * iOS, drawn views on Android), so this owns only the box and the FEEDBACK:
 * the portfolio's icon squash, never `android_ripple`, which renders nothing
 * on iOS and is how the transport once had no press feedback there at all.
 */
export type GlyphButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlyphButton({
  children,
  onPress,
  accessibilityLabel,
  hitSlop = 8,
  style,
}: GlyphButtonProps) {
  const squash = usePressSquash({
    scale: ICON_PRESS_SCALE,
    opacity: ICON_PRESS_OPACITY,
  });

  return (
    <Animated.View style={squash.style}>
      <Pressable
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        hitSlop={hitSlop}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
