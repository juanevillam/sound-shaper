import { useState } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';

// M3 primary-tab row, drawn in RN so the underline can ANIMATE between tabs
// (Compose SegmentedButtons read as form controls — tabs read as navigation,
// which is what the Shape/Clips switch is).

const INDICATOR_HEIGHT = 3;
const INDICATOR_WIDTH = 56;
const SWITCH_MS = 220;

type PlayerTabsProps<T extends string> = {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
};

export function PlayerTabs<T extends string>({
  tabs,
  active,
  onChange,
}: PlayerTabsProps<T>) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);

  const activeIndex = tabs.findIndex(tab => tab.key === active);
  const tabWidth = rowWidth / Math.max(tabs.length, 1);

  const targetX = useDerivedValue(() => {
    const centered = activeIndex * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2;
    return reduceMotion
      ? centered
      : withTiming(centered, {
          duration: SWITCH_MS,
          easing: Easing.out(Easing.cubic),
        });
  }, [activeIndex, tabWidth, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: targetX.value }],
  }));

  return (
    <View
      style={styles.row}
      onLayout={event => setRowWidth(event.nativeEvent.layout.width)}
    >
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              doNotTranslate
              text={tab.label}
              variant="labelLarge"
              style={[
                styles.label,
                { color: isActive ? colors.primary : colors.onSurfaceMuted },
              ]}
            />
          </Pressable>
        );
      })}
      {rowWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: colors.primary },
            indicatorStyle,
          ]}
        />
      ) : null}
      <View
        style={[styles.baseline, { backgroundColor: colors.surfaceVariant }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: 44 },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  label: { fontWeight: '600' },
  indicator: {
    borderTopLeftRadius: INDICATOR_HEIGHT,
    borderTopRightRadius: INDICATOR_HEIGHT,
    bottom: 0,
    height: INDICATOR_HEIGHT,
    left: 0,
    position: 'absolute',
    width: INDICATOR_WIDTH,
    zIndex: 1,
  },
  baseline: {
    bottom: 0,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
