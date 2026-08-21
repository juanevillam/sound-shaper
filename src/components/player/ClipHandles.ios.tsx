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

import { HANDLES_REGION_HEIGHT, type ClipHandlesProps } from './chrome';

// iOS counterpart of `ClipHandles`. Same three drag zones as Android, a
// different read.
//
// IT IS A TRIM FRAME, NOT TWO SWITCHES. What this replaced drew a translucent
// accent box with two 14 x 28 rounded pills floating outside it, each with a
// white grip bar down the middle — which at this control's real size read as a
// pair of toggle switches sitting on the scrubber, and Juan called it cheap on
// sight. Two things were wrong with it and both are structural:
//
//   1. IT HAD NO FRAME. Caps with nothing joining them are two objects; caps
//      joined by rails are one control.
//   2. THE GRIPS MADE THEM SWITCHES. A white bar down the middle is what a
//      switch has. There is no white in this control now, so the slider's own
//      thumb stays unambiguously the playhead.
//
// NO SCRIM OUTSIDE THE SELECTION. Photos dims the film either side of a trim,
// and that was built here and rejected (Juan, on sight): Photos dims an opaque
// FILMSTRIP, while the thing under this control is a 5.67pt slider track, so
// the dimming reads as a mask laid over the player recolouring the track —
// with a hole in it exactly where the frame sits. A trim frame on a slider is
// already unambiguous without repainting everything it is not.
//
// THE CAPS OVERHANG THE FRAME on all four sides — wider than the rails are
// thick, taller than the box they bracket. They are what you grab, so they are
// the part that has to look grabbable; a cap flush with its own frame reads as
// the frame's edge rather than as a handle.

/**
 * The caps, and the box they bracket. The caps are BIGGER THAN THE BOX in both
 * axes on purpose — see the header. The box is the band's 32 minus 6 at each
 * end, which is the overhang; the caps take the whole band.
 */
const HANDLE_WIDTH = 14;
const HANDLE_HEIGHT = HANDLES_REGION_HEIGHT;
const HANDLE_RADIUS = 4;
const FRAME_HEIGHT = HANDLES_REGION_HEIGHT - 12;
/** The rails that join the two caps into one frame. */
const RAIL_HEIGHT = 2;
const RANGE_FILL_ALPHA = 0.16;
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
          {/* The framed zone — a faint accent wash between two rails, and
              draggable (moves the whole clip). The rails are what make the two
              caps read as ONE control rather than as two loose objects. */}
          <GestureDetector gesture={dragClip}>
            <Animated.View style={[styles.range, rangeStyle]}>
              <View
                style={[
                  styles.rangeFill,
                  {
                    backgroundColor: withAlpha(
                      colors.primary,
                      RANGE_FILL_ALPHA,
                    ),
                  },
                ]}
              />
              <View
                style={[
                  styles.rail,
                  styles.railTop,
                  { backgroundColor: colors.primary },
                ]}
              />
              <View
                style={[
                  styles.rail,
                  styles.railBottom,
                  { backgroundColor: colors.primary },
                ]}
              />
            </Animated.View>
          </GestureDetector>

          {/* The two caps carry NO grip bar. A white bar down the middle is
              what a SWITCH has, and at 10pt wide that is exactly what these
              read as; the cap's own size and overhang are the affordance, and
              dropping it leaves no white in the control at all — so the
              slider's thumb stays unambiguously the playhead. */}
          <GestureDetector gesture={dragStart}>
            <Animated.View
              style={[styles.handle, handleFill, startHandleStyle]}
            />
          </GestureDetector>
          <GestureDetector gesture={dragEnd}>
            <Animated.View
              style={[styles.handle, handleFill, endHandleStyle]}
            />
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
  // The frame's box carries no fill or border of its own — the wash and the two
  // rails are children, so the rails sit flush to its edges and the caps can
  // straddle them.
  range: {
    height: FRAME_HEIGHT,
    marginTop: -FRAME_HEIGHT / 2,
    position: 'absolute',
    top: '50%',
  },
  rangeFill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  rail: { height: RAIL_HEIGHT, left: 0, position: 'absolute', right: 0 },
  railTop: { top: 0 },
  railBottom: { bottom: 0 },
  handle: {
    borderCurve: 'continuous',
    borderRadius: HANDLE_RADIUS,
    height: HANDLE_HEIGHT,
    marginTop: -HANDLE_HEIGHT / 2,
    position: 'absolute',
    top: '50%',
    width: HANDLE_WIDTH,
  },
});
