import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';

import { CLIP_ZOOM_SPAN_S, type ClipWindow } from './chrome';

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
const CHEVRON_SIZE = 17;
/** The selection's body — the same faint accent wash gen 2 carried. */
const RANGE_FILL_ALPHA = 0.16;

/** How close to a window edge a dragged edge may get before the view pans. */
const EDGE_PAN_ZONE = 28;
/**
 * How fast the view travels when an edge is pushed into the margin, at full
 * depth. A gesture only reports while the finger MOVES, so pushing to the
 * screen's edge and holding would otherwise stop dead a screen-width from
 * where it started — this is what makes a clip that runs from 0:15 to 2:00
 * reachable in one gesture, the way a timeline scrolls in any editor.
 */
const AUTO_PAN_S_PER_SEC = 24;
const MIN_GAP_S = 1;
const EDGE_SLOP = { bottom: 14, left: 10, right: 10, top: 14 };

type ClipTrimFrameIosProps = {
  durationS: number;
  startS: number;
  endS: number;
  /**
   * Told whenever the mapped slice changes — at a grab, and again at the
   * release — so the slider and its end labels stay on the frame's scale.
   * See `ClipWindow`.
   */
  onWindowChange: (window: ClipWindow) => void;
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
  onWindowChange,
  onChange,
}: ClipTrimFrameIosProps) {
  const { colors } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // THE MAPPED SLICE lives in shared values, because it changes ON the
  // gesture — at the grab and at the release — and the frame's geometry has
  // to follow in the same frame the finger does. React hears about it too
  // (`onWindowChange`), for the slider and the end labels, and that lagging a
  // commit is fine: neither is under the finger.
  const draggingRef = useRef(false);
  const winStartSv = useSharedValue(0);
  const winSpanSv = useSharedValue(Math.max(durationS, 1));
  // Which edge the finger owns, so the auto-pan knows what to carry with it:
  // 0 none, 1 start, 2 end, 3 both (the clip sliding whole).
  const heldSv = useSharedValue(0);

  useEffect(() => {
    if (draggingRef.current) return;
    winStartSv.value = 0;
    winSpanSv.value = Math.max(durationS, 1);
  }, [durationS, winStartSv, winSpanSv]);

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

  /**
   * ZOOM AT THE GRAB, and hold that scale until the finger lifts — see
   * `ClipWindow`. Centring on the handle being dragged keeps it under the
   * finger through the transition.
   */
  const zoomAround = (seconds: number) => {
    'worklet';

    const span = Math.min(CLIP_ZOOM_SPAN_S, Math.max(durationS, 1));
    const from = Math.min(
      Math.max(seconds - span / 2, 0),
      Math.max(durationS - span, 0),
    );
    winStartSv.value = from;
    winSpanSv.value = span;
    runOnJS(onWindowChange)({ endS: from + span, startS: from });
  };

  const zoomOut = () => {
    'worklet';

    const span = Math.max(durationS, 1);
    winStartSv.value = 0;
    winSpanSv.value = span;
    runOnJS(onWindowChange)({ endS: span, startS: 0 });
  };

  /** Seconds per point AT THE CURRENT SCALE — constant for a whole drag. */
  const perPoint = () => {
    'worklet';

    return trackWidth > 0 ? winSpanSv.value / trackWidth : 0;
  };

  const dragStart = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => {
      runOnJS(setDragging)(true);
      heldSv.value = 1;
      zoomAround(startSv.value);
    })
    .onChange(event => {
      const max = endSv.value - MIN_GAP_S;
      startSv.value = Math.min(
        Math.max(startSv.value + event.changeX * perPoint(), 0),
        max,
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(startSv.value);
      startSv.value = seconds;
      heldSv.value = 0;
      zoomOut();
      runOnJS(commit)(seconds, Math.round(endSv.value));
    });

  const dragEnd = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(() => {
      runOnJS(setDragging)(true);
      heldSv.value = 2;
      zoomAround(endSv.value);
    })
    .onChange(event => {
      const min = startSv.value + MIN_GAP_S;
      endSv.value = Math.max(
        Math.min(endSv.value + event.changeX * perPoint(), durationS),
        min,
      );
    })
    .onFinalize(() => {
      const seconds = Math.round(endSv.value);
      endSv.value = seconds;
      heldSv.value = 0;
      zoomOut();
      runOnJS(commit)(Math.round(startSv.value), seconds);
    });

  // The framed middle slides the whole clip — length preserved.
  const dragClip = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(() => {
      runOnJS(setDragging)(true);
      heldSv.value = 3;
      zoomAround((startSv.value + endSv.value) / 2);
    })
    .onChange(event => {
      const length = endSv.value - startSv.value;
      const next = Math.min(
        Math.max(startSv.value + event.changeX * perPoint(), 0),
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
      heldSv.value = 0;
      zoomOut();
      runOnJS(commit)(seconds, seconds + lengthS);
    });

  /**
   * AUTO-PAN while an edge is held in the margin — see `AUTO_PAN_S_PER_SEC`.
   * It moves the window and the held edge together at the SAME scale, so the
   * mapping under the finger still never changes; only the view travels.
   */
  useFrameCallback(frame => {
    if (!heldSv.value || trackWidth <= 0) return;
    const scale = winSpanSv.value / trackWidth;
    const edgeS = heldSv.value === 1 ? startSv.value : endSv.value;
    const px = (edgeS - winStartSv.value) / scale;
    const depth =
      px < EDGE_PAN_ZONE
        ? (px - EDGE_PAN_ZONE) / EDGE_PAN_ZONE
        : px > trackWidth - EDGE_PAN_ZONE
          ? (px - (trackWidth - EDGE_PAN_ZONE)) / EDGE_PAN_ZONE
          : 0;
    if (!depth) return;

    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    const step = Math.max(Math.min(depth, 1), -1) * AUTO_PAN_S_PER_SEC * dt;
    const limit = Math.max(durationS - winSpanSv.value, 0);
    const from = Math.min(Math.max(winStartSv.value + step, 0), limit);
    if (from === winStartSv.value) return;
    winStartSv.value = from;

    const length = endSv.value - startSv.value;
    if (heldSv.value === 1) {
      startSv.value = Math.min(
        Math.max(startSv.value + step, 0),
        endSv.value - MIN_GAP_S,
      );
    } else if (heldSv.value === 2) {
      endSv.value = Math.max(
        Math.min(endSv.value + step, durationS),
        startSv.value + MIN_GAP_S,
      );
    } else {
      const next = Math.min(
        Math.max(startSv.value + step, 0),
        durationS - length,
      );
      startSv.value = next;
      endSv.value = next + length;
    }
  }, true);

  const toPx = (seconds: number) => {
    'worklet';

    const scale = winSpanSv.value > 0 ? trackWidth / winSpanSv.value : 0;
    return (seconds - winStartSv.value) * scale;
  };

  const frameStyle = useAnimatedStyle(() => ({
    left: toPx(startSv.value),
    width: Math.max(toPx(endSv.value) - toPx(startSv.value), 0),
  }));
  const startCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toPx(startSv.value) - CAP_WIDTH }],
  }));
  const endCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toPx(endSv.value) }],
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
