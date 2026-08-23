import { useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useWaveform } from '@/hooks/useWaveform';
import { usePlayerStore } from '@/store/player';

// THE TRIM STRIP — clip framing over real material, Photos' way, at the
// SLIDER'S OWN SCALE.
//
// AUTHORED RN, AND HERE IS THE NATIVE COMPONENT THAT WAS REJECTED: there is
// none. UIKit's only public trimmer is `UIVideoEditorController`, a
// video-file view controller that cannot trim an audio range in place;
// SwiftUI and `@expo/ui` 57 ship no trim control at all (the starter
// showcases every component — nothing trims). Photos' own trimmer is
// private. So the strip is drawn by hand, measured against Photos, and its
// two glyphs are still real SF Symbols in stated-box hosts.
//
// THE STRIP MAPS THE WHOLE TRACK, NOT A ZOOMED WINDOW. A zoom that framed
// `selection ± max(5s, 0.75 × clip)` was built first (2026-08-23), with
// edge-pan and a full-track overview bar, and Juan rejected it the same day:
// the window recomputing under the drag read as the control EXPANDING the
// more you dragged it, and a trimmer has to be simple before it is precise.
// Whole-track mapping is also what the slider under it says, so the frame
// sits where the person already believes that moment lives. What the zoom
// bought — fine trims on long tracks — is knowingly given back; the strip
// still beats the bare slider frame because caps, rails and material carry
// the grab affordance at any width. Photos maps its whole video the same
// way. (See docs/rejected-experiments.md.)
//
// THE BARS RESAMPLE TO A FIXED PITCH — one bar per `BAR_PITCH` px of strip,
// whatever the track's length — so a three-minute sound and a thirty-second
// one draw the same calm density, and the waveform reads as one shape rather
// than a data plot.
//
// NO HAPTICS IN THE DRAG. A per-second tick plus grab/release pulses shipped
// with the zoom and Juan rejected them with it ("makes the clipping
// un-usable") — RN's Vibration is a buzz, not Apple's detent click, and a
// buzz per crossed second on a whole-track scale is nearly continuous. The
// save action keeps its single `haptics.selection()` at the save site.
//
// THE TRACK RUNS BETWEEN THE CAPS, Photos' own inset: the bar area is inset
// `CAP_WIDTH` each side so a selection touching 0:00 or the track's end
// keeps its cap fully on screen, exactly as Photos' filmstrip sits inside
// its yellow frame's outer bounds.
//
// THE FRAME IS MEASURED FROM PHOTOS (iPhone 17 / iOS 26.5, video trimmer,
// band-scanned from screenshots): frame outer 51pt with 5pt rails around a
// 40.67pt filmstrip, caps ~14.7pt wide with ~7pt outer corners, chevron ink
// 6 × 24 at a 3pt stroke, media outside the selection dimmed to ×0.67
// luminance, playhead a ~3.3pt white line. Ours maps those onto a 44pt
// band: rails 4, caps 14, radius 7, chevron stepped to match.
//
// DIMMING OUTSIDE THE SELECTION IS LEGITIMATE HERE, and was NOT for the
// slider underneath — that rejection (2026-08-21) was specific to dimming a
// 5.67pt track, where the scrim read as a mask recolouring the player. This
// strip is an opaque band of material, which is Photos' own filmstrip
// premise. The scrim is the BACKGROUND colour washed over the bars, so
// "dimmed" means "faded toward the page" in both appearances — the ink
// equivalent of Photos darkening photographic media.
//
// THE PLAYHEAD IS THE BARS' INVERSE, NOT THEIR INK — Photos' line is white
// because its media is dark, and here the media IS onSurface ink, so an
// onSurface line vanishes into it (shipped and caught on the first
// light-mode screenshot). The hairline keeps it findable between bars.
//
// IT LIVES IN AN ABSOLUTE OVERLAY, exactly like the bracket band it
// replaces: the console's column has ~72pt of flex slack and a strip that
// joined it would move the transport on the exact frame the mode changes —
// the one kind of CLS this player must not have. The strip's box hangs 12pt
// above the slider host, inside the title block's own 20pt padding; the
// slider fades out underneath it while framing.
//
// NO PLAYHEAD CROSSES THE CONSOLE BOUNDARY (chrome.ts): the 10Hz position
// tick lands in a shared value via a store subscription, so it moves the
// playhead line without re-rendering this component — or anything above it.

/** The whole overlay box — the wave band; the frame rides inside it. */
export const TRIM_STRIP_HEIGHT = 44;

/** The frame, mapped from Photos' 51pt trimmer onto the 44pt band. */
const CAP_WIDTH = 14;
const CAP_RADIUS = 7;
const RAIL_HEIGHT = 4;
const CHEVRON_SIZE = 17;
const PLAYHEAD_WIDTH = 3;

/** One bar per this many px of strip — the same density for any track. */
const BAR_PITCH = 3;
const BAR_GAP = 1;
const BAR_MIN_HEIGHT = 3;
/** Bars: ink at full strength inside the selection, faded outside. */
const BAR_ALPHA = 0.9;
const SCRIM_ALPHA = 0.55;
/** Uniform stand-in while the waveform decodes (or never arrives). */
const PLACEHOLDER_LEVEL = 0.35;

const MIN_GAP_S = 1;
const EDGE_SLOP = { bottom: 14, left: 10, right: 10, top: 14 };

type ClipTrimStripIosProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};

export function ClipTrimStripIos({
  durationS,
  startS,
  endS,
  onChange,
}: ClipTrimStripIosProps) {
  const { colors } = useAppTheme();
  const [stripWidth, setStripWidth] = useState(0);

  const soundId = usePlayerStore(s => s.current?.id);
  const audioUrl = usePlayerStore(s => s.current?.audioUrl);
  const waveform = useWaveform(soundId, audioUrl);

  // The track runs between the caps — see the header.
  const trackWidth = Math.max(stripWidth - CAP_WIDTH * 2, 0);
  const pxPerS = durationS > 0 ? trackWidth / durationS : 0;

  const startSv = useSharedValue(startS);
  const endSv = useSharedValue(endS);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    startSv.value = startS;
    endSv.value = endS;
  }, [startS, endS, startSv, endSv]);

  // The 10Hz playhead tick lands in a shared value, never in React.
  const positionSv = useSharedValue(usePlayerStore.getState().position);
  useEffect(
    () =>
      usePlayerStore.subscribe(s => {
        positionSv.value = s.position;
      }),
    [positionSv],
  );

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

  // ------------------------------------------------------------------ bars --
  // Rendered ONCE per waveform/width — nothing about them changes during a
  // drag. Each bar is the MAX of its bucket range: at this downsample a mean
  // flattens the song's shape, and the shape is the whole point.
  const bars = useMemo(() => {
    if (trackWidth <= 0) return [];
    const count = Math.floor(trackWidth / BAR_PITCH);
    if (count <= 0) return [];
    const levels: number[] = [];
    if (waveform) {
      const perBar = waveform.buckets.length / count;
      for (let i = 0; i < count; i += 1) {
        const from = Math.floor(i * perBar);
        const to = Math.max(Math.ceil((i + 1) * perBar), from + 1);
        let peak = 0;
        for (let j = from; j < to && j < waveform.buckets.length; j += 1) {
          if (waveform.buckets[j] > peak) peak = waveform.buckets[j];
        }
        levels.push(Math.max(peak, 0.04));
      }
    } else {
      for (let i = 0; i < count; i += 1) levels.push(PLACEHOLDER_LEVEL);
    }
    return levels;
  }, [waveform, trackWidth]);

  const toPx = (seconds: number) => {
    'worklet';

    return CAP_WIDTH + seconds * pxPerS;
  };

  const scrimLeftStyle = useAnimatedStyle(() => ({
    width: Math.max(startSv.value * pxPerS, 0),
  }));
  const scrimRightStyle = useAnimatedStyle(() => ({
    width: Math.max((durationS - endSv.value) * pxPerS, 0),
  }));

  const frameStyle = useAnimatedStyle(() => ({
    left: toPx(startSv.value),
    width: Math.max((endSv.value - startSv.value) * pxPerS, 0),
  }));
  const startCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toPx(startSv.value) - CAP_WIDTH }],
  }));
  const endCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toPx(endSv.value) }],
  }));

  const playheadStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toPx(positionSv.value) - PLAYHEAD_WIDTH / 2 }],
  }));

  const barInk = withAlpha(colors.onSurface, BAR_ALPHA);
  const scrim = withAlpha(colors.background, SCRIM_ALPHA);

  return (
    <View
      style={styles.strip}
      pointerEvents="box-none"
      onLayout={event => setStripWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && durationS > 0 ? (
        <>
          <View style={styles.track} pointerEvents="none">
            {bars.map((level, index) => {
              const height = Math.max(
                Math.round(level * (TRIM_STRIP_HEIGHT - RAIL_HEIGHT * 2)),
                BAR_MIN_HEIGHT,
              );
              return (
                <View
                  key={index}
                  style={{
                    backgroundColor: barInk,
                    borderRadius: 1,
                    height,
                    left: index * BAR_PITCH,
                    position: 'absolute',
                    top: '50%',
                    transform: [{ translateY: -height / 2 }],
                    width: BAR_PITCH - BAR_GAP,
                  }}
                />
              );
            })}

            {/* Outside the selection the material fades toward the page —
                the ink equivalent of Photos dimming its filmstrip. */}
            <Animated.View
              style={[
                styles.scrim,
                styles.scrimLeft,
                { backgroundColor: scrim },
                scrimLeftStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.scrim,
                styles.scrimRight,
                { backgroundColor: scrim },
                scrimRightStyle,
              ]}
            />
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.playhead,
              {
                backgroundColor: colors.background,
                borderColor: withAlpha(colors.onSurface, 0.35),
              },
              playheadStyle,
            ]}
          />

          <GestureDetector gesture={dragClip}>
            <Animated.View
              style={[
                styles.frame,
                { borderColor: colors.primary },
                frameStyle,
              ]}
            />
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
  strip: { height: TRIM_STRIP_HEIGHT, width: '100%' },
  track: {
    bottom: 0,
    left: CAP_WIDTH,
    overflow: 'hidden',
    position: 'absolute',
    right: CAP_WIDTH,
    top: 0,
  },
  scrim: { bottom: 0, position: 'absolute', top: 0 },
  scrimLeft: { left: 0 },
  scrimRight: { right: 0 },
  playhead: {
    borderRadius: PLAYHEAD_WIDTH / 2,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: RAIL_HEIGHT,
    left: 0,
    position: 'absolute',
    top: RAIL_HEIGHT,
    width: PLAYHEAD_WIDTH,
  },
  frame: {
    borderBottomWidth: RAIL_HEIGHT,
    borderTopWidth: RAIL_HEIGHT,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
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
