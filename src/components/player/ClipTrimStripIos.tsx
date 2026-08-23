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
import { haptics } from '@/lib/haptics';
import { usePlayerStore } from '@/store/player';

// THE ZOOMED TRIM STRIP — clip framing over real material, Photos' way.
//
// What this replaced was a trim frame riding the 5.67pt slider track, and the
// defect no restyling could fix was SCALE: a fifteen-second clip is ~30pt of a
// three-minute track, so fine trimming was impossible at any styling. This
// strip shows a WINDOW around the selection instead of the whole track —
// `pad = max(5s, 0.75 × clip)` each side — which puts the same fifteen seconds
// across ~200pt. The overview bar up top keeps the whole-track context the
// zoom gives up.
//
// THE FRAME IS MEASURED FROM PHOTOS (iPhone 17 / iOS 26.5, video trimmer,
// band-scanned from screenshots): frame outer 51pt with 5pt rails around a
// 40.67pt filmstrip, caps ~14.7pt wide with ~7pt outer corners, chevron ink
// 6 × 24 at a 3pt stroke, media outside the selection dimmed to ×0.67
// luminance, playhead a ~3.3pt white line. Ours maps those onto a 44pt wave
// band: rails 4, caps 14, radius 7, chevron stepped to match.
//
// DIMMING OUTSIDE THE SELECTION IS LEGITIMATE HERE, and was NOT for the
// slider it replaces — that rejection (2026-08-21) was specific to dimming a
// 5.67pt track, where the scrim read as a mask recolouring the player. This
// strip is an opaque band of material, which is Photos' own filmstrip
// premise. The scrim is the BACKGROUND colour washed over the bars, so
// "dimmed" means "faded toward the page" in both appearances — the ink
// equivalent of Photos darkening photographic media.
//
// IT LIVES IN AN ABSOLUTE OVERLAY, exactly like the bracket band it replaces:
// the console's column has ~72pt of flex slack and a strip that joined it
// would move the transport on the exact frame the mode changes — the one kind
// of CLS this player must not have. The strip's box hangs 20pt above the
// slider host, which is the title block's own padding; the slider fades out
// underneath it while framing.
//
// NO PLAYHEAD CROSSES THE CONSOLE BOUNDARY (chrome.ts): the 10Hz position
// tick lands in a shared value via a store subscription, so it moves the
// playhead line without re-rendering this component — or anything above it.

/** The whole overlay box. Overview bar on top, wave band below. */
export const TRIM_STRIP_HEIGHT = 52;
const OVERVIEW_HEIGHT = 4;
const OVERVIEW_GAP = 4;
const WAVE_BAND = TRIM_STRIP_HEIGHT - OVERVIEW_HEIGHT - OVERVIEW_GAP;

/** The frame, mapped from Photos' 51pt trimmer onto the 44pt band. */
const CAP_WIDTH = 14;
const CAP_RADIUS = 7;
const RAIL_HEIGHT = 4;
const CHEVRON_SIZE = 17;
const PLAYHEAD_WIDTH = 3;

/** Bars: ink at full strength inside the selection's premise, faded outside. */
const BAR_ALPHA = 0.9;
const BAR_GAP = 1;
const BAR_MIN_HEIGHT = 3;
const SCRIM_ALPHA = 0.55;
const OVERVIEW_TRACK_ALPHA = 0.15;
const OVERVIEW_WINDOW_ALPHA = 0.45;
/** Uniform stand-in while the waveform decodes (or never arrives). */
const PLACEHOLDER_LEVEL = 0.35;
const PLACEHOLDER_BUCKET_MS = 250;

/** The zoom: padding each side of the selection, in seconds. */
const WINDOW_MIN_PAD_S = 5;
const WINDOW_PAD_RATIO = 0.75;
/** A cap dragged into this many px of the strip's edge pans the window. */
const EDGE_PAN_ZONE = 28;

const MIN_GAP_S = 1;
const EDGE_SLOP = { bottom: 14, left: 10, right: 10, top: 14 };

type ClipTrimStripIosProps = {
  durationS: number;
  startS: number;
  endS: number;
  onChange: (startS: number, endS: number) => void;
};

const windowFor = (startS: number, endS: number, durationS: number) => {
  const pad = Math.max(WINDOW_MIN_PAD_S, WINDOW_PAD_RATIO * (endS - startS));
  const winStartS = Math.max(0, startS - pad);
  const winEndS = Math.min(durationS, endS + pad);
  return { winLenS: winEndS - winStartS, winStartS };
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

  // The window is React state on purpose: it changes only at discrete moments
  // (mount, sound change, gesture end), and each change re-slices the bars at
  // the new scale. DURING a drag only `winStartSv` moves, on the UI thread.
  const [window, setWindow] = useState(() =>
    windowFor(startS, endS, durationS),
  );
  const pxPerS = window.winLenS > 0 ? stripWidth / window.winLenS : 0;
  const wholeTrack = window.winStartS === 0 && window.winLenS >= durationS;

  const startSv = useSharedValue(startS);
  const endSv = useSharedValue(endS);
  const winStartSv = useSharedValue(window.winStartS);
  // The last whole second a moving edge crossed — the haptic tick's memory.
  const tickSv = useSharedValue(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    startSv.value = startS;
    endSv.value = endS;
    const next = windowFor(startS, endS, durationS);
    winStartSv.value = next.winStartS;
    setWindow(next);
  }, [startS, endS, durationS, startSv, endSv, winStartSv]);

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
    haptics.selection();
    onChange(nextStartS, nextEndS);
    const next = windowFor(nextStartS, nextEndS, durationS);
    winStartSv.value = next.winStartS;
    setWindow(next);
  };

  const winLenS = window.winLenS;

  const grab = () => {
    'worklet';

    runOnJS(setDragging)(true);
    runOnJS(haptics.selection)();
  };
  const tickAcross = (seconds: number) => {
    'worklet';

    const whole = Math.round(seconds);
    if (whole !== tickSv.value) {
      tickSv.value = whole;
      runOnJS(haptics.dragMove)();
    }
  };
  const panWindowFor = (edgeS: number) => {
    'worklet';

    // Keep the moving edge out of the strip's margins by sliding the window.
    const edgePx = (edgeS - winStartSv.value) * pxPerS;
    if (edgePx < EDGE_PAN_ZONE) {
      winStartSv.value = Math.max(0, edgeS - EDGE_PAN_ZONE / pxPerS);
    } else if (edgePx > stripWidth - EDGE_PAN_ZONE) {
      winStartSv.value = Math.min(
        Math.max(durationS - winLenS, 0),
        edgeS + EDGE_PAN_ZONE / pxPerS - winLenS,
      );
    }
  };

  const dragStart = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(grab)
    .onChange(event => {
      const max = endSv.value - MIN_GAP_S;
      const next = Math.min(
        Math.max(startSv.value + event.changeX / pxPerS, 0),
        max,
      );
      startSv.value = next;
      tickAcross(next);
      panWindowFor(next);
    })
    .onFinalize(() => {
      const seconds = Math.round(startSv.value);
      startSv.value = seconds;
      runOnJS(commit)(seconds, Math.round(endSv.value));
    });

  const dragEnd = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .hitSlop(EDGE_SLOP)
    .onBegin(grab)
    .onChange(event => {
      const min = startSv.value + MIN_GAP_S;
      const next = Math.max(
        Math.min(endSv.value + event.changeX / pxPerS, durationS),
        min,
      );
      endSv.value = next;
      tickAcross(next);
      panWindowFor(next);
    })
    .onFinalize(() => {
      const seconds = Math.round(endSv.value);
      endSv.value = seconds;
      runOnJS(commit)(Math.round(startSv.value), seconds);
    });

  // The framed middle slides the whole clip — length preserved.
  const dragClip = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(grab)
    .onChange(event => {
      const length = endSv.value - startSv.value;
      const next = Math.min(
        Math.max(startSv.value + event.changeX / pxPerS, 0),
        durationS - length,
      );
      startSv.value = next;
      endSv.value = next + length;
      tickAcross(next);
      panWindowFor(event.changeX < 0 ? next : next + length);
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
  // The slice covers the window plus half a window each side, so an auto-pan
  // mid-drag is pure UI-thread translation with bars already standing there.
  const slice = useMemo(() => {
    const bucketS = (waveform?.bucketMs ?? PLACEHOLDER_BUCKET_MS) / 1000;
    const sliceStartS = Math.max(0, window.winStartS - winLenS / 2);
    const sliceEndS = Math.min(durationS, window.winStartS + winLenS * 1.5);
    const first = Math.floor(sliceStartS / bucketS);
    const last = Math.ceil(sliceEndS / bucketS);
    const bars: { level: number; timeS: number }[] = [];
    for (let i = first; i < last; i += 1) {
      bars.push({
        level: waveform
          ? Math.max(waveform.buckets[i] ?? 0, 0.04)
          : PLACEHOLDER_LEVEL,
        timeS: i * bucketS,
      });
    }
    return { bars, bucketS, sliceStartS };
  }, [waveform, window.winStartS, winLenS, durationS]);

  const barsStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (slice.sliceStartS - winStartSv.value) * pxPerS },
    ],
  }));

  const scrimLeftStyle = useAnimatedStyle(() => ({
    width: Math.max((startSv.value - winStartSv.value) * pxPerS, 0),
  }));
  const scrimRightStyle = useAnimatedStyle(() => {
    const endPx = (endSv.value - winStartSv.value) * pxPerS;
    return { width: Math.max(stripWidth - endPx, 0) };
  });

  const frameStyle = useAnimatedStyle(() => ({
    left: (startSv.value - winStartSv.value) * pxPerS,
    width: Math.max((endSv.value - startSv.value) * pxPerS, 0),
  }));
  const startCapStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: (startSv.value - winStartSv.value) * pxPerS - CAP_WIDTH,
      },
    ],
  }));
  const endCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (endSv.value - winStartSv.value) * pxPerS }],
  }));

  const playheadStyle = useAnimatedStyle(() => {
    const px = (positionSv.value - winStartSv.value) * pxPerS;
    const inside = px >= 0 && px <= stripWidth;
    return {
      opacity: inside ? 1 : 0,
      transform: [{ translateX: px - PLAYHEAD_WIDTH / 2 }],
    };
  });

  const overviewStyle = useAnimatedStyle(() => ({
    left: durationS > 0 ? (winStartSv.value / durationS) * stripWidth : 0,
    width: durationS > 0 ? (winLenS / durationS) * stripWidth : 0,
  }));

  const barInk = withAlpha(colors.onSurface, BAR_ALPHA);
  const scrim = withAlpha(colors.background, SCRIM_ALPHA);

  return (
    <View
      style={styles.strip}
      pointerEvents="box-none"
      onLayout={event => setStripWidth(event.nativeEvent.layout.width)}
    >
      {stripWidth > 0 && durationS > 0 ? (
        <>
          {!wholeTrack ? (
            <View
              style={[
                styles.overviewTrack,
                {
                  backgroundColor: withAlpha(
                    colors.onSurface,
                    OVERVIEW_TRACK_ALPHA,
                  ),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.overviewWindow,
                  {
                    backgroundColor: withAlpha(
                      colors.onSurface,
                      OVERVIEW_WINDOW_ALPHA,
                    ),
                  },
                  overviewStyle,
                ]}
              />
            </View>
          ) : null}

          <View style={styles.band}>
            <Animated.View style={[styles.bars, barsStyle]}>
              {slice.bars.map(bar => (
                <View
                  key={bar.timeS}
                  style={{
                    backgroundColor: barInk,
                    borderRadius: 1,
                    height: Math.max(
                      Math.round(bar.level * (WAVE_BAND - RAIL_HEIGHT * 2)),
                      BAR_MIN_HEIGHT,
                    ),
                    left: (bar.timeS - slice.sliceStartS) * pxPerS,
                    position: 'absolute',
                    top: '50%',
                    transform: [
                      {
                        translateY:
                          -Math.max(
                            Math.round(
                              bar.level * (WAVE_BAND - RAIL_HEIGHT * 2),
                            ),
                            BAR_MIN_HEIGHT,
                          ) / 2,
                      },
                    ],
                    width: Math.max(slice.bucketS * pxPerS - BAR_GAP, 1),
                  }}
                />
              ))}
            </Animated.View>

            {/* Outside the selection the material fades toward the page —
                the ink equivalent of Photos dimming its filmstrip. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scrim,
                styles.scrimLeft,
                { backgroundColor: scrim },
                scrimLeftStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scrim,
                styles.scrimRight,
                { backgroundColor: scrim },
                scrimRightStyle,
              ]}
            />

            {/* The playhead is the bars' INVERSE, not their ink — Photos'
                line is white because its media is dark, and here the media IS
                onSurface ink, so an onSurface line vanishes into it (shipped
                and caught on the first light-mode screenshot). The hairline
                keeps it findable in the gaps between bars. */}
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
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: TRIM_STRIP_HEIGHT, width: '100%' },
  overviewTrack: {
    borderRadius: OVERVIEW_HEIGHT / 2,
    height: OVERVIEW_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  overviewWindow: {
    borderRadius: OVERVIEW_HEIGHT / 2,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  band: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: OVERVIEW_HEIGHT + OVERVIEW_GAP,
  },
  bars: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
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
