import { useEffect, useState } from 'react';

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

// The clip range dragger — Google-Photos-trimmer language instead of
// "mark start / mark end" buttons: a bar that IS the song, two grab handles
// framing the clip, drag either to move its edge. Times snap to whole
// seconds; the framed range is what Preview plays and Save stores.

const TRACK_HEIGHT = 48;
const HANDLE_WIDTH = 22;
const HANDLE_RADIUS = 10;
// A clip is at least this long (the old MIN_CLIP_MS rule, now enforced by the
// geometry itself — the handles simply can't cross closer than this).
const MIN_GAP_S = 1;

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

  // Inner span the handles travel over (their centers ride the range edges).
  const span = Math.max(trackWidth - HANDLE_WIDTH * 2, 1);
  const pxPerSecond = durationS > 0 ? span / durationS : 0;

  const startPx = useSharedValue(0);
  const endPx = useSharedValue(0);
  // Live labels while dragging (state kept to whole seconds, so re-renders
  // only happen when a label actually changes).
  const [liveStart, setLiveStart] = useState(startS);
  const [liveEnd, setLiveEnd] = useState(endS);

  // Reposition when the song/range/width changes from OUTSIDE a drag.
  useEffect(() => {
    startPx.value = startS * pxPerSecond;
    endPx.value = endS * pxPerSecond;
    setLiveStart(startS);
    setLiveEnd(endS);
  }, [startS, endS, pxPerSecond, startPx, endPx]);

  const commit = (nextStartS: number, nextEndS: number) => {
    setLiveStart(nextStartS);
    setLiveEnd(nextEndS);
    onChange(nextStartS, nextEndS);
  };

  const updateLiveStart = (seconds: number) => setLiveStart(seconds);
  const updateLiveEnd = (seconds: number) => setLiveEnd(seconds);

  const dragStart = Gesture.Pan()
    .hitSlop({ left: 16, right: 8, top: 12, bottom: 12 })
    .onChange(event => {
      const max = endPx.value - MIN_GAP_S * pxPerSecond;
      startPx.value = Math.min(Math.max(startPx.value + event.changeX, 0), max);
      runOnJS(updateLiveStart)(Math.round(startPx.value / pxPerSecond));
    })
    .onEnd(() => {
      const seconds = Math.round(startPx.value / pxPerSecond);
      startPx.value = seconds * pxPerSecond;
      runOnJS(commit)(seconds, Math.round(endPx.value / pxPerSecond));
    });

  const dragEnd = Gesture.Pan()
    .hitSlop({ left: 8, right: 16, top: 12, bottom: 12 })
    .onChange(event => {
      const min = startPx.value + MIN_GAP_S * pxPerSecond;
      endPx.value = Math.min(Math.max(endPx.value + event.changeX, min), span);
      runOnJS(updateLiveEnd)(Math.round(endPx.value / pxPerSecond));
    })
    .onEnd(() => {
      const seconds = Math.round(endPx.value / pxPerSecond);
      endPx.value = seconds * pxPerSecond;
      runOnJS(commit)(Math.round(startPx.value / pxPerSecond), seconds);
    });

  const startHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startPx.value }],
  }));
  const endHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endPx.value + HANDLE_WIDTH }],
  }));
  const rangeStyle = useAnimatedStyle(() => ({
    left: HANDLE_WIDTH + startPx.value,
    width: Math.max(endPx.value - startPx.value, 0),
  }));

  return (
    <View>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {trackWidth > 0 ? (
          <>
            <Animated.View
              style={[
                styles.range,
                { backgroundColor: colors.primary },
                rangeStyle,
              ]}
            />
            <GestureDetector gesture={dragStart}>
              <Animated.View
                style={[
                  styles.handle,
                  styles.handleStart,
                  { backgroundColor: colors.primary },
                  startHandleStyle,
                ]}
              >
                <View
                  style={[styles.grip, { backgroundColor: colors.onPrimary }]}
                />
              </Animated.View>
            </GestureDetector>
            <GestureDetector gesture={dragEnd}>
              <Animated.View
                style={[
                  styles.handle,
                  styles.handleEnd,
                  { backgroundColor: colors.primary },
                  endHandleStyle,
                ]}
              >
                <View
                  style={[styles.grip, { backgroundColor: colors.onPrimary }]}
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
    // A tint, not a slab — the solid handles remain the strong elements.
    opacity: 0.3,
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
    borderBottomLeftRadius: HANDLE_RADIUS,
    borderTopLeftRadius: HANDLE_RADIUS,
    left: 0,
  },
  handleEnd: {
    borderBottomRightRadius: HANDLE_RADIUS,
    borderTopRightRadius: HANDLE_RADIUS,
    left: 0,
  },
  grip: {
    borderRadius: 1,
    height: 16,
    width: 2.5,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
