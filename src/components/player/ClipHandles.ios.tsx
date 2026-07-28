import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@portfolio/core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';

import { type ClipHandlesProps } from './chrome';

// iOS counterpart of `ClipHandles`. Same three drag zones as Android, a
// different read: Android draws the Google-Photos trimmer (hard-edged neutral
// bars over a grey veil), which on iOS collides with the SwiftUI slider's own
// white thumb — three white blobs in a row, none obviously the one you grab.
//
// So the iOS frame is TINTED with the system accent instead of neutral: a
// translucent accent wash inside a hairline accent outline, capped by two
// elevated accent pills. Nothing here is white, so the native thumb stays
// unambiguously the playhead. Rounded, shadowed and accent-keyed is also the
// iOS trim vocabulary (Photos frames its range the same way).

const HANDLE_WIDTH = 14;
const HANDLE_HEIGHT = 28;
const HANDLE_RADIUS = 7;
const GRIP_HEIGHT = 12;
const RANGE_INSET = 3;
const RANGE_RADIUS = 8;
const RANGE_FILL_ALPHA = 0.22;
const RANGE_LINE_ALPHA = 0.55;
const MIN_GAP_S = 1;
const EDGE_SLOP = { top: 14, bottom: 14, left: 10, right: 10 };

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

  const handleFill = { backgroundColor: colors.primary };

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 ? (
        <>
          {/* The framed zone — accent wash inside an accent hairline, and
              draggable (moves the whole clip). */}
          <GestureDetector gesture={dragClip}>
            <Animated.View
              style={[
                styles.range,
                {
                  backgroundColor: withAlpha(colors.primary, RANGE_FILL_ALPHA),
                  borderColor: withAlpha(colors.primary, RANGE_LINE_ALPHA),
                },
                rangeStyle,
              ]}
            />
          </GestureDetector>
          <GestureDetector gesture={dragStart}>
            <Animated.View
              style={[styles.handle, handleFill, startHandleStyle]}
            >
              <View
                style={[styles.grip, { backgroundColor: colors.onPrimary }]}
              />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={dragEnd}>
            <Animated.View style={[styles.handle, handleFill, endHandleStyle]}>
              <View
                style={[styles.grip, { backgroundColor: colors.onPrimary }]}
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
    borderCurve: 'continuous',
    borderRadius: RANGE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: RANGE_INSET,
    position: 'absolute',
    top: RANGE_INSET,
  },
  handle: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: HANDLE_RADIUS,
    height: HANDLE_HEIGHT,
    justifyContent: 'center',
    marginTop: -HANDLE_HEIGHT / 2,
    position: 'absolute',
    // A real lift, so the grabbable ends read above both the wash and the
    // artwork blur behind the console.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    top: '50%',
    width: HANDLE_WIDTH,
  },
  grip: {
    borderRadius: 1,
    height: GRIP_HEIGHT,
    width: 2,
  },
});
