import React, { useCallback } from 'react';

import { Pressable, StyleSheet } from 'react-native';

import { Column, Host, Row, Text } from '@expo/ui/jetpack-compose';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { springs } from './tokens';

type LoginFeatureProps = {
  emoji: string;
  title: string;
  subtitle: string;
  colorScheme?: 'light' | 'dark';
  subtitleColor?: string;
};

const ROW_PRESS_SCALE = 0.97;
const ROW_REST_SCALE = 1;

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});

export const LoginFeature = ({
  emoji,
  title,
  subtitle,
  colorScheme,
  subtitleColor,
}: LoginFeatureProps) => {
  const scale = useSharedValue(ROW_REST_SCALE);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(ROW_PRESS_SCALE, springs.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(ROW_REST_SCALE, springs.press);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.wrap, animatedStyle]}>
        <Host matchContents colorScheme={colorScheme}>
          <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }}>
            <Text style={{ fontSize: 24, lineHeight: 32 }}>{emoji}</Text>
            <Column verticalArrangement={{ spacedBy: 2 }}>
              <Text style={{ typography: 'titleMedium' }}>{title}</Text>
              <Text color={subtitleColor} style={{ typography: 'bodyMedium' }}>
                {subtitle}
              </Text>
            </Column>
          </Row>
        </Host>
      </Animated.View>
    </Pressable>
  );
};
