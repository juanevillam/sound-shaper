import React, { useEffect } from 'react';

import { type StyleProp, type ViewStyle } from 'react-native';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { duration as durationTokens } from './tokens';

type AnimatedEntranceProps = {
  children: React.ReactNode;
  delay?: number;
  direction?: 'down' | 'up';
  duration?: number;
  id?: string;
  isVisible: boolean;
  offset?: number;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_OFFSET = 20;

// Tracks ids that have already played their entrance animation in this app
// session. Without this, list items inside recycling containers like FlashList
// can remount with fresh shared values (opacity 0, translated off-screen) and
// — if the timing happens to coincide with a navigation transition — stay
// invisible even though the underlying view is mounted and pressable.
const animatedIds = new Set<string>();

export const AnimatedEntrance = ({
  children,
  delay = 0,
  direction = 'down',
  duration = durationTokens.base,
  id,
  isVisible,
  offset = DEFAULT_OFFSET,
  style,
}: AnimatedEntranceProps) => {
  const initialTranslateY = direction === 'down' ? -offset : offset;
  const hasAnimatedBefore = id ? animatedIds.has(id) : false;
  const opacity = useSharedValue(hasAnimatedBefore ? 1 : 0);
  const translateY = useSharedValue(hasAnimatedBefore ? 0 : initialTranslateY);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!isVisible) return;

    if (id && animatedIds.has(id)) return;

    if (id) animatedIds.add(id);

    opacity.value = withDelay(delay, withTiming(1, { duration }));
    translateY.value = withDelay(delay, withTiming(0, { duration }));
  }, [delay, duration, id, isVisible, opacity, translateY]);

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
};
