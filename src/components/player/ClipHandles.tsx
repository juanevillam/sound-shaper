import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';

// Trim brackets laid OVER the native scrubber (Google Photos): the player's
// M3 slider keeps seeking, the brackets frame the clip on top of it. NEUTRAL
// onSurface palette (white in dark, near-black in light), so the frame never
// reads as the primary-colored progress bar. Three drag
// zones — each bracket resizes its edge, the tinted middle slides the WHOLE
// clip (length preserved). Horizontal pans only.

const HANDLE_WIDTH = 16;
const HANDLE_HEIGHT = 40;
const MIN_GAP_S = 1;
const EDGE_SLOP = { top: 12, bottom: 12, left: 10, right: 10 };

type ClipHandlesProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};

export function ClipHandles({
  durationS,
  startS,
  endS,
  onChange,
}: ClipHandlesProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const pxPerSecond = durationS > 0 ? trackWidth / durationS : 0;

  const startPx = useSharedValue(0);
  const endPx = useSharedValue(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) {
      startPx.value = startS * pxPerSecond;
      endPx.value = endS * pxPerSecond;
    }
  }, [startS, endS, pxPerSecond, startPx, endPx]);

  const setDragging = (value: boolean) => {
    draggingRef.current = value;
  };

  const commit = (nextStartS: number, nextEndS: number) =>
    onChange(nextStartS, nextEndS);

  const dragStart = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const max = endPx.value - MIN_GAP_S * pxPerSecond;
      startPx.value = Math.min(Math.max(startPx.value + event.changeX, 0), max);
    })
    .onFinalize(() => {
      const seconds = Math.round(startPx.value / pxPerSecond);
      startPx.value = seconds * pxPerSecond;
      runOnJS(setDragging)(false);
      runOnJS(commit)(seconds, Math.round(endPx.value / pxPerSecond));
    });

  const dragEnd = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const min = startPx.value + MIN_GAP_S * pxPerSecond;
      endPx.value = Math.min(
        Math.max(endPx.value + event.changeX, min),
        trackWidth,
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(endPx.value / pxPerSecond);
      endPx.value = seconds * pxPerSecond;
      runOnJS(setDragging)(false);
      runOnJS(commit)(Math.round(startPx.value / pxPerSecond), seconds);
    });

  // Slide the whole clip from the tinted zone — length preserved.
  const dragClip = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const length = endPx.value - startPx.value;
      const next = Math.min(
        Math.max(startPx.value + event.changeX, 0),
        trackWidth - length,
      );
      startPx.value = next;
      endPx.value = next + length;
    })
    .onFinalize(() => {
      const lengthS = Math.round((endPx.value - startPx.value) / pxPerSecond);
      const seconds = Math.round(startPx.value / pxPerSecond);
      startPx.value = seconds * pxPerSecond;
      endPx.value = (seconds + lengthS) * pxPerSecond;
      runOnJS(setDragging)(false);
      runOnJS(commit)(seconds, seconds + lengthS);
    });

  const rangeStyle = useAnimatedStyle(() => ({
    left: startPx.value,
    width: Math.max(endPx.value - startPx.value, 0),
  }));
  const startHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startPx.value - HANDLE_WIDTH }],
  }));
  const endHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endPx.value }],
  }));

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 ? (
        <>
          {/* The framed zone — tinted AND draggable (moves the whole clip). */}
          <GestureDetector gesture={dragClip}>
            <Animated.View
              style={[
                styles.range,
                { backgroundColor: colors.onSurface },
                rangeStyle,
              ]}
            />
          </GestureDetector>
          <GestureDetector gesture={dragStart}>
            <Animated.View
              style={[
                styles.handle,
                styles.handleStart,
                { backgroundColor: colors.onSurface },
                startHandleStyle,
              ]}
            >
              <View
                style={[styles.grip, { backgroundColor: colors.background }]}
              />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={dragEnd}>
            <Animated.View
              style={[
                styles.handle,
                styles.handleEnd,
                { backgroundColor: colors.onSurface },
                endHandleStyle,
              ]}
            >
              <View
                style={[styles.grip, { backgroundColor: colors.background }]}
              />
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  range: {
    borderRadius: 4,
    bottom: 8,
    // A faint neutral veil — readable through, clearly not the track.
    opacity: 0.16,
    position: 'absolute',
    top: 8,
  },
  handle: {
    alignItems: 'center',
    height: HANDLE_HEIGHT,
    justifyContent: 'center',
    marginTop: -HANDLE_HEIGHT / 2,
    position: 'absolute',
    top: '50%',
    width: HANDLE_WIDTH,
  },
  handleStart: {
    borderBottomLeftRadius: 8,
    borderTopLeftRadius: 8,
    left: 0,
  },
  handleEnd: {
    borderBottomRightRadius: 8,
    borderTopRightRadius: 8,
    left: 0,
  },
  grip: {
    borderRadius: 1,
    height: 14,
    width: 2,
  },
});
