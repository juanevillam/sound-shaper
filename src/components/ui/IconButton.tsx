import { Platform, Pressable, StyleSheet } from 'react-native';

import {
  AppIcon,
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  usePressSquash,
  type IconName,
} from '@portfolio/mobile-ui';
import Animated from 'react-native-reanimated';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ROW_MIN_HEIGHT } from '@/styles/metrics';

// The app's ONE icon button, and the only press treatment it has: the
// portfolio squash from `@portfolio/mobile-ui`, not a ripple.
//
// A ripple is a Material affordance that renders NOTHING on iOS — which is how
// the player's transport ended up with no press feedback there at all — and a
// borderless one bleeds outside its container, now visible with the
// now-playing banner detached into a pill. The squash reads identically on
// both platforms, so this file has no `.ios` twin: the only thing that differs
// is the glyph itself, and `AppIcon` already maps the shared icon set onto SF
// Symbols there.
//
// The Pressable sits ON TOP of the icon rather than wrapping it: a Compose
// Host consumes touches at the Android layer even under RN
// `pointerEvents="none"`, so a pass-through underlay doesn't work. Topmost
// sibling wins the touch; the glyph below is purely visual, and the squash
// rides the wrapper so both move together.

/** Material icons are drawn on a 24dp grid; SF Symbols read heavier at parity. */
const GLYPH_SIZE = Platform.select({ ios: 22, default: 24 }) as number;

type IconButtonProps = {
  name: IconName;
  onPress: () => void;
  size?: number;
  tint?: string;
  accessibilityLabel?: string;
};

export function IconButton({
  name,
  onPress,
  size = GLYPH_SIZE,
  tint,
  accessibilityLabel,
}: IconButtonProps) {
  const { colors } = useAppTheme();
  const squash = usePressSquash({
    scale: ICON_PRESS_SCALE,
    opacity: ICON_PRESS_OPACITY,
  });

  return (
    <Animated.View style={[styles.button, squash.style]}>
      <ThemedHost matchContents pointerEvents="none">
        <AppIcon
          name={name}
          size={size}
          tint={tint ?? colors.onSurface}
          contentDescription={accessibilityLabel}
        />
      </ThemedHost>
      <Pressable
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        hitSlop={8}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: ROW_MIN_HEIGHT,
    justifyContent: 'center',
    width: ROW_MIN_HEIGHT,
  },
});
