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

// The Clips-mode scrubber: ONE timeline carrying playback AND the clip frame.
// The playhead keeps working (drag it, or tap anywhere to seek) while two trim
// handles ride the same track, so the range is placed against the exact sound
// you're hearing. Tapping inside the tinted range previews it (playback
// auto-pauses at the range end — the store's clip logic).

const TRACK_HEIGHT = 6;
const RANGE_HEIGHT = 26;
const HANDLE_WIDTH = 14;
const HANDLE_HEIGHT = 34;
const PLAYHEAD_WIDTH = 4;
const PLAYHEAD_HEIGHT = 22;
const CONTAINER_HEIGHT = 44;
const MIN_GAP_S = 1;
const HANDLE_SLOP = { top: 14, bottom: 14, left: 14, right: 14 };

type ClipScrubberProps = {
  durationS: number;
  positionS: number;
  startS: number;
  endS: number;
  onSeek: (seconds: number) => void;
  onChangeRange: (startS: number, endS: number) => void;
  /** Tap inside the framed range — play exactly that stretch. */
  onPreview: () => void;
};

export function ClipScrubber({
  durationS,
  positionS,
  startS,
  endS,
  onSeek,
  onChangeRange,
  onPreview,
}: ClipScrubberProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const pxPerSecond = durationS > 0 ? trackWidth / durationS : 0;

  const startPx = useSharedValue(0);
  const endPx = useSharedValue(0);
  const playheadPx = useSharedValue(0);
  // While a handle/playhead is being dragged, prop syncs must not fight it.
  const draggingRef = useRef({ start: false, end: false, head: false });
  // Live labels snap to whole seconds so re-renders are rare.
  const [liveStart, setLiveStart] = useState(startS);
  const [liveEnd, setLiveEnd] = useState(endS);

  useEffect(() => {
    if (!draggingRef.current.start && !draggingRef.current.end) {
      startPx.value = startS * pxPerSecond;
      endPx.value = endS * pxPerSecond;
      setLiveStart(startS);
      setLiveEnd(endS);
    }
  }, [startS, endS, pxPerSecond, startPx, endPx]);

  useEffect(() => {
    if (!draggingRef.current.head) playheadPx.value = positionS * pxPerSecond;
  }, [positionS, pxPerSecond, playheadPx]);

  const setDragging = (key: 'start' | 'end' | 'head', value: boolean) => {
    draggingRef.current[key] = value;
  };

  const commitRange = (nextStartS: number, nextEndS: number) => {
    setLiveStart(nextStartS);
    setLiveEnd(nextEndS);
    onChangeRange(nextStartS, nextEndS);
  };

  const dragStart = Gesture.Pan()
    .hitSlop(HANDLE_SLOP)
    .onBegin(() => runOnJS(setDragging)('start', true))
    .onChange(event => {
      const max = endPx.value - MIN_GAP_S * pxPerSecond;
      startPx.value = Math.min(Math.max(startPx.value + event.changeX, 0), max);
      runOnJS(setLiveStart)(Math.round(startPx.value / pxPerSecond));
    })
    .onFinalize(() => {
      const seconds = Math.round(startPx.value / pxPerSecond);
      startPx.value = seconds * pxPerSecond;
      runOnJS(setDragging)('start', false);
      runOnJS(commitRange)(seconds, Math.round(endPx.value / pxPerSecond));
    });

  const dragEnd = Gesture.Pan()
    .hitSlop(HANDLE_SLOP)
    .onBegin(() => runOnJS(setDragging)('end', true))
    .onChange(event => {
      const min = startPx.value + MIN_GAP_S * pxPerSecond;
      endPx.value = Math.min(
        Math.max(endPx.value + event.changeX, min),
        trackWidth,
      );
      runOnJS(setLiveEnd)(Math.round(endPx.value / pxPerSecond));
    })
    .onFinalize(() => {
      const seconds = Math.round(endPx.value / pxPerSecond);
      endPx.value = seconds * pxPerSecond;
      runOnJS(setDragging)('end', false);
      runOnJS(commitRange)(Math.round(startPx.value / pxPerSecond), seconds);
    });

  const dragHead = Gesture.Pan()
    .hitSlop({ top: 10, bottom: 10, left: 10, right: 10 })
    .onBegin(() => runOnJS(setDragging)('head', true))
    .onChange(event => {
      playheadPx.value = Math.min(
        Math.max(playheadPx.value + event.changeX, 0),
        trackWidth,
      );
    })
    .onFinalize(() => {
      runOnJS(setDragging)('head', false);
      runOnJS(onSeek)(playheadPx.value / pxPerSecond);
    });

  // Tap: inside the framed range = preview it; anywhere else = seek there.
  const tap = Gesture.Tap().onEnd(event => {
    if (event.x >= startPx.value && event.x <= endPx.value) {
      runOnJS(onPreview)();
    } else {
      const seconds = Math.min(Math.max(event.x / pxPerSecond, 0), durationS);
      playheadPx.value = event.x;
      runOnJS(onSeek)(seconds);
    }
  });

  const rangeStyle = useAnimatedStyle(() => ({
    left: startPx.value,
    width: Math.max(endPx.value - startPx.value, 0),
  }));
  const playedStyle = useAnimatedStyle(() => ({
    width: playheadPx.value,
  }));
  const playheadStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playheadPx.value - PLAYHEAD_WIDTH / 2 }],
  }));
  const startHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startPx.value - HANDLE_WIDTH / 2 }],
  }));
  const endHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endPx.value - HANDLE_WIDTH / 2 }],
  }));

  return (
    <View>
      <GestureDetector gesture={tap}>
        <View
          style={styles.container}
          onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        >
          <View
            style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
          />
          {trackWidth > 0 ? (
            <>
              {/* The framed range — a tinted zone behind everything. */}
              <Animated.View
                style={[
                  styles.range,
                  { backgroundColor: colors.primary },
                  rangeStyle,
                ]}
              />
              {/* Played portion of the track. */}
              <Animated.View
                style={[
                  styles.played,
                  { backgroundColor: colors.primary },
                  playedStyle,
                ]}
              />
              {/* The playhead — draggable, like the normal scrubber thumb. */}
              <GestureDetector gesture={dragHead}>
                <Animated.View
                  style={[
                    styles.playhead,
                    { backgroundColor: colors.onSurface },
                    playheadStyle,
                  ]}
                />
              </GestureDetector>
              {/* Trim handles, over everything. */}
              <GestureDetector gesture={dragStart}>
                <Animated.View
                  style={[
                    styles.handle,
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
      </GestureDetector>
      <View style={styles.labels}>
        <Text
          doNotTranslate
          muted
          text={formatTime(positionS)}
          variant="labelMedium"
        />
        <Text
          doNotTranslate
          text={`${formatTime(liveStart)} – ${formatTime(liveEnd)}`}
          variant="labelMedium"
          style={{ color: colors.primary, fontWeight: '600' }}
        />
        <Text
          doNotTranslate
          muted
          text={formatTime(durationS)}
          variant="labelMedium"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
  },
  range: {
    borderRadius: 6,
    height: RANGE_HEIGHT,
    // A tinted zone, not a slab — handles stay the strong elements.
    opacity: 0.28,
    position: 'absolute',
    top: (CONTAINER_HEIGHT - RANGE_HEIGHT) / 2,
  },
  played: {
    borderBottomLeftRadius: TRACK_HEIGHT / 2,
    borderTopLeftRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    left: 0,
    position: 'absolute',
    top: (CONTAINER_HEIGHT - TRACK_HEIGHT) / 2,
  },
  playhead: {
    borderRadius: PLAYHEAD_WIDTH / 2,
    height: PLAYHEAD_HEIGHT,
    position: 'absolute',
    top: (CONTAINER_HEIGHT - PLAYHEAD_HEIGHT) / 2,
    width: PLAYHEAD_WIDTH,
  },
  handle: {
    alignItems: 'center',
    borderRadius: HANDLE_WIDTH / 2,
    height: HANDLE_HEIGHT,
    justifyContent: 'center',
    position: 'absolute',
    top: (CONTAINER_HEIGHT - HANDLE_HEIGHT) / 2,
    width: HANDLE_WIDTH,
  },
  grip: {
    borderRadius: 1,
    height: 12,
    width: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
