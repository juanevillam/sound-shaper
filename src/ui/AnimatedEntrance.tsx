import React, { useEffect } from 'react';

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
  isVisible: boolean;
};

const OFFSET = 20;

export const AnimatedEntrance = ({
  children,
  delay = 0,
  direction = 'down',
  duration = durationTokens.base,
  isVisible,
}: AnimatedEntranceProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(direction === 'down' ? -OFFSET : OFFSET);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!isVisible) return;

    opacity.value = withDelay(delay, withTiming(1, { duration }));
    translateY.value = withDelay(delay, withTiming(0, { duration }));
  }, [delay, duration, isVisible, opacity, translateY]);

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};
