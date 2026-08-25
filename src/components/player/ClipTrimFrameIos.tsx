import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';

// THE TRIM FRAME — clip framing drawn ON the real slider, which stays the
// screen's ONE progress surface.
//
// AUTHORED RN, AND HERE IS THE NATIVE COMPONENT THAT WAS REJECTED: there is
// none. UIKit's only public trimmer is `UIVideoEditorController`, a
// video-file view controller that cannot trim an audio range in place;
// SwiftUI and `@expo/ui` 57 ship no trim control at all (the starter
// showcases every component — nothing trims). Photos' own trimmer is
// private. So the frame is drawn by hand, measured against Photos, and its
// two glyphs are still real SF Symbols in stated-box hosts.
//
// A WAVEFORM STRIP STOOD HERE FOR ONE DAY (2026-08-23) AND JUAN REMOVED IT:
// first with a zoomed window ("the more i drag it the more it expands"),
// then static — and even static, a second track-shaped surface replacing
// the slider read as "two diff progress sliders… out of place". The lesson
// is recorded in docs/rejected-experiments.md: this player already has a
// progress surface, and clip framing is a MODE OF IT, not a second one. So
// the slider stays visible and interactive, its thumb stays unambiguously
// the playhead, and the frame rides on top.
//
// THE FRAME'S TREATMENT IS THE ONE THE STRIP PROVED OUT, measured from
// Photos' video trimmer (iPhone 17 / iOS 26.5: frame outer 51pt, rails 5,
// caps ~14.7 wide with ~7pt outer corners, chevron ink 6 × 24 at a 3pt
// stroke): full-height caps carrying `chevron.compact.left/right`, joined
// by rails into one rounded frame. The chevron is what the first two
// generations were missing — a blank cap read as a switch (gen 1) or as the
// frame's edge (gen 2); the chevron is the platform's own word for "grab
// me, I slide this way".
//
// THE BOX IS 44pt AROUND THE 32pt SLIDER HOST (±6 overhang), so the rails
// clear the thumb's ~27pt disc and the frame reads as enclosing the
// slider's travel rather than crowding its track. 44 is also Apple's
// minimum touch target, which is the point: it shipped at 36 and the caps
// were fiddly to catch (Juan, 2026-08-23), and a cap is only 14pt wide, so
// the height is the only axis where the target can grow without the frame
// mis-stating the range it covers. Inside the rails a faint
// `primary` wash marks the selection and gives the middle drag zone a
// visible body; there is NO scrim outside it — dimming a bare slider track
// was rejected 2026-08-21 (it reads as a mask recolouring the player) and
// with the waveform gone that rejection is fully back in force.
//
// THE MAPPING IS FULL-WIDTH LINEAR, seconds × (width / duration) — verified
// against the slider's own track in the gen-2 audit (48.67 / 369 = 24 / 182,
// AGENTS.md). At the track's ends a cap overhangs the content box into the
// screen gutter; the gutter is 16pt and the cap 14, so it never clips.
//
// NO HAPTICS IN THE DRAG — a per-second buzz shipped with the zoom and was
// rejected with it ("makes the clipping un-usable"); RN's Vibration is a
// motor buzz, not Apple's detent click. Save keeps its one
// `haptics.selection()` at the save site.
//
// IT LIVES IN AN ABSOLUTE OVERLAY over the slider block, like every
// generation before it: entering framing must move nothing (the band-scan
// invariant), and an overlay costs no layout.

/** The frame's box — the 32pt slider host plus a 6pt overhang each side. */
export const TRIM_FRAME_HEIGHT = 44;

/** Photos' trimmer, mapped onto the 36pt box. */
const CAP_WIDTH = 14;
const CAP_RADIUS = 7;
const RAIL_HEIGHT = 4;
/**
 * The height INSIDE the rails — what the framing playhead spans, so it reads
 * the way Photos' does: a line the full height of the trimmed strip rather
 * than a knob sitting on a track. `PlayerScrubber.ios` draws that playhead,
 * because it owns the track the frame brackets.
 */
export const TRIM_FRAME_INNER_HEIGHT = TRIM_FRAME_HEIGHT - RAIL_HEIGHT * 2;
const CHEVRON_SIZE = 17;
/** The selection's body — the same faint accent wash gen 2 carried. */
const RANGE_FILL_ALPHA = 0.16;

const MIN_GAP_S = 1;
const EDGE_SLOP = { bottom: 14, left: 10, right: 10, top: 14 };

type ClipTrimFrameIosProps = {
  durationS: number;
  startS: number;
  endS: number;
  /**
   * The live edges, OWNED BY THE CONSOLE. They are shared rather than local
   * because the range readout under the slider draws from them too — it has
   * to move while the finger is down, and the console is the nearest parent
   * of both (`ClipRangeLabelIos`).
   */
  startSv: SharedValue<number>;
  endSv: SharedValue<number>;
  onChange: (startS: number, endS: number) => void;
};

export function ClipTrimFrameIos({
  durationS,
  startS,
  endS,
  startSv,
  endSv,
  onChange,
}: ClipTrimFrameIosProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const pxPerS = durationS > 0 ? trackWidth / durationS : 0;

  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    startSv.value = startS;
    endSv.value = endS;
  }, [startS, endS, startSv, endSv]);

  const setDragging = (value: boolean) => {
    draggingRef.current = value;
  };
  const commit = (nextStartS: number, nextEndS: number) => {
    draggingRef.current = false;
    onChange(nextStartS, nextEndS);
  };

  const dragStart = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const max = endSv.value - MIN_GAP_S;
      startSv.value = Math.min(
        Math.max(startSv.value + event.changeX / pxPerS, 0),
        max,
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(startSv.value);
      startSv.value = seconds;
      runOnJS(commit)(seconds, Math.round(endSv.value));
    });

  const dragEnd = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const min = startSv.value + MIN_GAP_S;
      endSv.value = Math.max(
        Math.min(endSv.value + event.changeX / pxPerS, durationS),
        min,
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(endSv.value);
      endSv.value = seconds;
      runOnJS(commit)(Math.round(startSv.value), seconds);
    });

  // The framed middle slides the whole clip — length preserved.
  const dragClip = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const length = endSv.value - startSv.value;
      const next = Math.min(
        Math.max(startSv.value + event.changeX / pxPerS, 0),
        durationS - length,
      );
      startSv.value = next;
      endSv.value = next + length;
    })
    .onFinalize(() => {
      const lengthS = Math.round(endSv.value - startSv.value);
      const seconds = Math.min(
        Math.round(startSv.value),
        Math.max(durationS - lengthS, 0),
      );
      startSv.value = seconds;
      endSv.value = seconds + lengthS;
      runOnJS(commit)(seconds, seconds + lengthS);
    });

  const frameStyle = useAnimatedStyle(() => ({
    left: startSv.value * pxPerS,
    width: Math.max((endSv.value - startSv.value) * pxPerS, 0),
  }));
  const startCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startSv.value * pxPerS - CAP_WIDTH }],
  }));
  const endCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endSv.value * pxPerS }],
  }));

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && durationS > 0 ? (
        <>
          <GestureDetector gesture={dragClip}>
            <Animated.View
              style={[
                styles.frame,
                { borderColor: colors.primary },
                frameStyle,
              ]}
            >
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
            </Animated.View>
          </GestureDetector>

          <GestureDetector gesture={dragStart}>
            <Animated.View
              style={[
                styles.cap,
                styles.capStart,
                { backgroundColor: colors.primary },
                startCapStyle,
              ]}
            >
              <SwiftUIHost
                ignoreSafeArea="all"
                pointerEvents="none"
                style={styles.chevronHost}
              >
                <Image
                  systemName="chevron.compact.left"
                  size={CHEVRON_SIZE}
                  color={colors.onPrimary}
                />
              </SwiftUIHost>
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={dragEnd}>
            <Animated.View
              style={[
                styles.cap,
                styles.capEnd,
                { backgroundColor: colors.primary },
                endCapStyle,
              ]}
            >
              <SwiftUIHost
                ignoreSafeArea="all"
                pointerEvents="none"
                style={styles.chevronHost}
              >
                <Image
                  systemName="chevron.compact.right"
                  size={CHEVRON_SIZE}
                  color={colors.onPrimary}
                />
              </SwiftUIHost>
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { height: TRIM_FRAME_HEIGHT, width: '100%' },
  frame: {
    borderBottomWidth: RAIL_HEIGHT,
    borderTopWidth: RAIL_HEIGHT,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  rangeFill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  cap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: CAP_WIDTH,
  },
  capStart: {
    borderBottomLeftRadius: CAP_RADIUS,
    borderCurve: 'continuous',
    borderTopLeftRadius: CAP_RADIUS,
  },
  capEnd: {
    borderBottomRightRadius: CAP_RADIUS,
    borderCurve: 'continuous',
    borderTopRightRadius: CAP_RADIUS,
  },
  chevronHost: { height: 24, width: CAP_WIDTH },
});
