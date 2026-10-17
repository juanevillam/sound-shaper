import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { StyleSheet, View } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { withAlpha, useAppTheme } from '@/core';

// APPLE'S MEDIA SCRUBBER — a capsule that thickens under the finger, with no
// knob at all.
//
// AUTHORED RN, AND THE NATIVE COMPONENT IT REJECTS IS THE ONE THIS REPLACED:
// SwiftUI's `Slider`, which `@expo/ui` wraps directly (`ios/SliderView.swift`
// instantiates a plain `Slider` — there is no style prop, and SwiftUI ships no
// media variant). A thumb slider is a VALUE PICKER: it is what Settings uses
// to choose a brightness. Playback position is not a value you pick, and Apple
// draws it with a different control everywhere it appears — Music, Podcasts
// and the video player all show a bare capsule and no thumb. Using the picker
// for a song's progress was simply the wrong control (Juan, 2026-08-25).
//
// MEASURED off the real thing rather than guessed, per the house rule: iOS 26.5
// on iPhone 17, AVPlayer's transport in Safari, band-scanned from a screen
// recording of an actual scrub.
//
//   at rest        8.00pt tall, fully rounded
//   while scrubbing 10.67pt, grown about the same centre line
//   elapsed        (237,235,236) — effectively the content colour
//   remaining      (101,101,101) over its dark chrome, i.e. ~0.3 of it
//
// The colours become `onSurface` and `onSurface` at `TRACK_REMAINING_ALPHA`
// here, because this player stands on the artwork wash rather than on Apple's
// dark glass and must work in both appearances.
//
// IT ALSO ENDED A LONG-RUNNING FIGHT WITH THE TRIM FRAME, back when clips
// were framed ON this scrubber (that mode is gone — a clip is made in the clip
// editor now, and nothing rides this bar). A native slider claims a touch the
// instant it lands, so the frame's caps kept losing drags aimed at them; the
// fix was to let the caps win their touches by GEOMETRY (transparent touch
// wrappers, resolved by hit-testing) rather than by this control's silence.
//
// A TAP IS NOT A SEEK. Apple's scrubber moves relative to the finger, so a
// touch that lands and lifts without travelling leaves the playhead where it
// was. With `minDistance(0)` the pan BEGINS on a tap, and the end used to
// commit whatever value the last drag left behind — 0:00 on the first tap of
// a session, the previous scrub's point after that.
//
// VOICEOVER CANNOT DRAG, so the bar is ADJUSTABLE — the trait the SwiftUI
// `Slider` it replaced carried for free — and swipe up/down skips by the same
// step as the transport's skip buttons.

/** Apple's, measured. The bar grows about its centre, so the box is stable. */
const TRACK_HEIGHT = 8;
const TRACK_HEIGHT_ACTIVE = 10.67;
const GROW_MS = 150;
/** Apple's remaining track reads ~0.3 of its own chrome — see the header. */
const TRACK_REMAINING_ALPHA = 0.3;
/**
 * THE BAR IS 8pt; THE TARGET IS NOT. The band just above the bar belongs to
 * the title block, whose swipe skips tracks — so reaching for the scrubber
 * paged the artwork instead, and a touch between the two hit nothing at all
 * (Juan, 2026-08-25).
 *
 * It is padding cancelled by a negative margin, NOT `hitSlop`: a gesture's
 * hit slop cannot grow the area past the view's own bounds on iOS, and a
 * version using it took no events whatsoever (measured — the drag logged no
 * `onBegin`). This grows the real view, which costs no layout because the
 * margin gives back exactly what the padding takes, and the scrubber sits
 * after the title in the tree so it wins the overlap.
 */
const SCRUB_TOUCH_PAD = 15;

type MediaScrubberIosProps = {
  /** Displayed position; the drag owns it while the finger is down. */
  position: number;
  /** Always > 0, so the track is never degenerate. */
  duration: number;
  /** Spoken as the bar's name; its value is the elapsed time. */
  accessibilityLabel: string;
  /** Spoken as the bar's value. */
  accessibilityValueText: string;
  /** Seconds a VoiceOver swipe moves the playhead. */
  accessibilityStep: number;
  onDrag: (value: number) => void;
  /** `moved` is false for a touch that never travelled — commit nothing. */
  onDragEnd: (moved: boolean) => void;
};

export function MediaScrubberIos({
  position,
  duration,
  accessibilityLabel,
  accessibilityValueText,
  accessibilityStep,
  onDrag,
  onDragEnd,
}: MediaScrubberIosProps) {
  const { colors } = useAppTheme();

  const widthSv = useSharedValue(0);
  const valueSv = useSharedValue(0);
  const activeSv = useSharedValue(0);
  const movedSv = useSharedValue(false);
  const draggingRef = useRef(false);

  // FOLLOW THE TRANSPORT ONLY WHEN THE FINGER DOES NOT OWN THE VALUE, and do
  // it in an effect: writing a shared value during render fought the drag
  // value this component's own `onDrag` sends up to `PlayerScrubberLive`,
  // which comes straight back down as `position` — the two compounded and a
  // 180pt drag scrubbed 143s instead of 92.
  useEffect(() => {
    if (draggingRef.current) return;
    valueSv.value = Math.min(Math.max(position, 0), duration);
  }, [position, duration, valueSv]);

  // THE GESTURE IS BUILT ONCE PER DURATION, NOT PER RENDER. The console
  // re-renders this on every 10Hz transport tick (`position`), and a fresh
  // `Gesture.Pan()` each time re-created its worklets and re-attached them to
  // the detector ten times a second while the player was open. The callbacks
  // the gesture reaches are read through refs, so it never needs rebuilding
  // to see the latest ones.
  const onDragRef = useRef(onDrag);
  const onDragEndRef = useRef(onDragEnd);
  useLayoutEffect(() => {
    onDragRef.current = onDrag;
    onDragEndRef.current = onDragEnd;
  });

  const setDragging = useCallback((value: boolean) => {
    draggingRef.current = value;
  }, []);
  const emitDrag = useCallback((value: number) => {
    onDragRef.current(value);
  }, []);
  const emitDragEnd = useCallback((moved: boolean) => {
    onDragEndRef.current(moved);
  }, []);

  const scrub = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          runOnJS(setDragging)(true);
          activeSv.value = 1;
          movedSv.value = false;
        })
        .onChange(event => {
          if (widthSv.value <= 0) return;
          movedSv.value = true;
          const next =
            valueSv.value + (event.changeX / widthSv.value) * duration;
          valueSv.value = Math.min(Math.max(next, 0), duration);
          runOnJS(emitDrag)(valueSv.value);
        })
        .onFinalize(() => {
          activeSv.value = 0;
          runOnJS(setDragging)(false);
          runOnJS(emitDragEnd)(movedSv.value);
        }),
    [
      activeSv,
      duration,
      emitDrag,
      emitDragEnd,
      movedSv,
      setDragging,
      valueSv,
      widthSv,
    ],
  );

  const barStyle = useAnimatedStyle(() => ({
    borderRadius: withTiming(
      (activeSv.value ? TRACK_HEIGHT_ACTIVE : TRACK_HEIGHT) / 2,
      { duration: GROW_MS },
    ),
    height: withTiming(activeSv.value ? TRACK_HEIGHT_ACTIVE : TRACK_HEIGHT, {
      duration: GROW_MS,
    }),
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width:
      duration > 0
        ? Math.min(Math.max(valueSv.value / duration, 0), 1) * widthSv.value
        : 0,
  }));

  return (
    <GestureDetector gesture={scrub}>
      <View
        accessible
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: accessibilityValueText }}
        onAccessibilityAction={event => {
          const direction =
            event.nativeEvent.actionName === 'increment' ? 1 : -1;
          const next = Math.min(
            Math.max(valueSv.value + direction * accessibilityStep, 0),
            duration,
          );
          valueSv.value = next;
          onDrag(next);
          onDragEnd(true);
        }}
        style={styles.hit}
        onLayout={event => {
          widthSv.value = event.nativeEvent.layout.width;
        }}
      >
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: withAlpha(
                colors.onSurface,
                TRACK_REMAINING_ALPHA,
              ),
            },
            barStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: colors.onSurface },
              fillStyle,
            ]}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  /** The bar is 8pt; the target around it is the console's slider box. */
  hit: {
    justifyContent: 'center',
    marginVertical: -SCRUB_TOUCH_PAD,
    paddingVertical: SCRUB_TOUCH_PAD,
    width: '100%',
  },
  bar: { overflow: 'hidden', width: '100%' },
  fill: { bottom: 0, left: 0, position: 'absolute', top: 0 },
});
