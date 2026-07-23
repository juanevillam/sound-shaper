import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@expo/ui/jetpack-compose';
import { iconSource, type IconName } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

// Icon button with a GUARANTEED visible ripple. The Pressable sits ON TOP of
// the Compose icon (a Compose Host consumes touches at the Android layer even
// under RN pointerEvents="none", so a pass-through underlay doesn't work) —
// topmost sibling wins the touch, the icon below is purely visual.

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
    <View style={styles.button}>
      <ThemedHost matchContents>
        <Icon
          source={iconSource(name)}
          size={size}
          tint={tint ?? colors.onSurface}
          contentDescription={accessibilityLabel}
        />
      </ThemedHost>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={StyleSheet.absoluteFill}
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
      />
    </View>
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
