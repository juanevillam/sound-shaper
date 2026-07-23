import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@expo/ui/jetpack-compose';
import { iconSource, type IconName } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

// Icon button with a GUARANTEED visible ripple: the touch lives on an RN
// Pressable (android_ripple), the glyph is a non-clickable Compose Icon that
// lets every touch through. Used where the Compose IconButton's own state
// layer reads too faint (dark surfaces).

const BUTTON_SIZE = 48;

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
  size = 24,
  tint,
  accessibilityLabel,
}: RippleIconButtonProps) {
  const { colors, scheme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.button}
      android_ripple={{
        borderless: true,
        // Theme-safe literal — the dynamic palette tokens reject alpha
        // suffixes.
        color:
          scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
        radius: BUTTON_SIZE / 2,
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <ThemedHost matchContents pointerEvents="none">
        <Icon
          source={iconSource(name)}
          size={size}
          tint={tint ?? colors.onSurface}
          contentDescription={accessibilityLabel}
        />
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
