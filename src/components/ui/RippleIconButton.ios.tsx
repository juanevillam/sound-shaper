import { Pressable, StyleSheet } from 'react-native';

import { AppIcon, type IconName } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

// iOS counterpart of `RippleIconButton` — same prop shape, different feedback.
// A ripple is a Material affordance; iOS dims the glyph instead, so the
// Pressable WRAPS the icon here rather than sitting on top of it (there is no
// Compose touch-stealing to work around, and a `pointerEvents="none"` Host
// lets the press read through).

const BUTTON_SIZE = 44; // iOS minimum touch target.
const PRESSED_OPACITY = 0.4;

type RippleIconButtonProps = {
  name: IconName;
  onPress: () => void;
  size?: number;
  tint?: string;
  accessibilityLabel?: string;
};

export function RippleIconButton({
  name,
  onPress,
  size = 22,
  tint,
  accessibilityLabel,
}: RippleIconButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}
    >
      <ThemedHost matchContents pointerEvents="none">
        <AppIcon name={name} size={size} tint={tint ?? colors.onSurface} />
      </ThemedHost>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE,
  },
});
