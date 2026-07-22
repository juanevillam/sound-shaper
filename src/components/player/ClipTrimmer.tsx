import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatTime } from '@/lib/player';

// The clip trimmer inside the Clips sheet: its own track (no playback slider
// underneath, so no gesture wars), painted in the TERTIARY palette so it never
// reads as the progress bar. Three drag zones: each bracket resizes its edge,
// and the tinted middle MOVES the whole clip (length preserved). Horizontal
// pans only — vertical stays with the sheet.

const TRACK_HEIGHT = 44;
const HANDLE_WIDTH = 18;
const MIN_GAP_S = 1;
const EDGE_SLOP = { top: 12, bottom: 12, left: 10, right: 10 };

type ClipTrimmerProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};

export function ClipTrimmer({
  durationS,
  startS,
  endS,
  onChange,
}: ClipTrimmerProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // Handles' centers ride the range edges over the inner span.
  const span = Math.max(trackWidth - HANDLE_WIDTH * 2, 1);
  const pxPerSecond = durationS > 0 ? span / durationS : 0;

  const startPx = useSharedValue(0);
  const endPx = useSharedValue(0);
  const draggingRef = useRef(false);
  const [liveStart, setLiveStart] = useState(startS);
  const [liveEnd, setLiveEnd] = useState(endS);

  useEffect(() => {
    if (!draggingRef.current) {
      startPx.value = startS * pxPerSecond;
      endPx.value = endS * pxPerSecond;
      setLiveStart(startS);
      setLiveEnd(endS);
    }
  }, [startS, endS, pxPerSecond, startPx, endPx]);

  const setDragging = (value: boolean) => {
    draggingRef.current = value;
  };

  const commit = (nextStartS: number, nextEndS: number) => {
    setLiveStart(nextStartS);
    setLiveEnd(nextEndS);
    onChange(nextStartS, nextEndS);
  };

  const updateLive = (nextStartS: number, nextEndS: number) => {
    setLiveStart(nextStartS);
    setLiveEnd(nextEndS);
  };

  const dragStart = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const max = endPx.value - MIN_GAP_S * pxPerSecond;
      startPx.value = Math.min(Math.max(startPx.value + event.changeX, 0), max);
      runOnJS(updateLive)(
        Math.round(startPx.value / pxPerSecond),
        Math.round(endPx.value / pxPerSecond),
      );
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
      endPx.value = Math.min(Math.max(endPx.value + event.changeX, min), span);
      runOnJS(updateLive)(
        Math.round(startPx.value / pxPerSecond),
        Math.round(endPx.value / pxPerSecond),
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(endPx.value / pxPerSecond);
      endPx.value = seconds * pxPerSecond;
      runOnJS(setDragging)(false);
      runOnJS(commit)(Math.round(startPx.value / pxPerSecond), seconds);
    });

  // Drag the tinted middle: slide the WHOLE clip, length preserved.
  const dragClip = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const length = endPx.value - startPx.value;
      const next = Math.min(
        Math.max(startPx.value + event.changeX, 0),
        span - length,
      );
      startPx.value = next;
      endPx.value = next + length;
      runOnJS(updateLive)(
        Math.round(startPx.value / pxPerSecond),
        Math.round(endPx.value / pxPerSecond),
      );
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
    left: HANDLE_WIDTH + startPx.value,
    width: Math.max(endPx.value - startPx.value, 0),
  }));
  const startHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startPx.value }],
  }));
  const endHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endPx.value + HANDLE_WIDTH }],
  }));

  return (
    <View>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {trackWidth > 0 ? (
          <>
            <GestureDetector gesture={dragClip}>
              <Animated.View
                style={[
                  styles.range,
                  { backgroundColor: colors.tertiaryContainer },
                  rangeStyle,
                ]}
              />
            </GestureDetector>
            <GestureDetector gesture={dragStart}>
              <Animated.View
                style={[
                  styles.handle,
                  styles.handleStart,
                  { backgroundColor: colors.onTertiaryContainer },
                  startHandleStyle,
                ]}
              >
                <View
                  style={[
                    styles.grip,
                    { backgroundColor: colors.tertiaryContainer },
                  ]}
                />
              </Animated.View>
            </GestureDetector>
            <GestureDetector gesture={dragEnd}>
              <Animated.View
                style={[
                  styles.handle,
                  styles.handleEnd,
                  { backgroundColor: colors.onTertiaryContainer },
                  endHandleStyle,
                ]}
              >
                <View
                  style={[
                    styles.grip,
                    { backgroundColor: colors.tertiaryContainer },
                  ]}
                />
              </Animated.View>
            </GestureDetector>
          </>
        ) : null}
      </View>
      <View style={styles.labels}>
        <Text
          doNotTranslate
          muted
          text={formatTime(liveStart)}
          variant="labelMedium"
        />
        <Text
          doNotTranslate
          text={`${formatTime(liveEnd - liveStart)}`}
          variant="labelMedium"
          style={{ color: colors.onSurfaceMuted }}
        />
        <Text
          doNotTranslate
          muted
          text={formatTime(liveEnd)}
          variant="labelMedium"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 12,
    height: TRACK_HEIGHT,
    overflow: 'hidden',
  },
  range: {
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  handle: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: HANDLE_WIDTH,
  },
  handleStart: {
    borderBottomLeftRadius: 12,
    borderTopLeftRadius: 12,
    left: 0,
  },
  handleEnd: {
    borderBottomRightRadius: 12,
    borderTopRightRadius: 12,
    left: 0,
  },
  grip: {
    borderRadius: 1,
    height: 14,
    width: 2.5,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
