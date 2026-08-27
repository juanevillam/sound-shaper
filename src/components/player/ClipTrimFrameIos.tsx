import { useEffect, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';

// THE TRIM FRAME — the selection's caps, rails and wash.
//
// IT LIVES IN THE CLIP EDITOR'S OVERVIEW STRIP NOW (2026-08-26). It was built
// to ride the player's scrubber, and everything it learned there carries
// over unchanged: the Photos-measured treatment, the fine-scrub gain, the
// gesture arbitration, the VoiceOver adjustables. Only the surface under it
// changed — a full-track waveform in the Voice Memos-style editor instead of
// the live scrubber.
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

/**
 * The frame's box. 44 was its whole life on the player's scrubber — the 32pt
 * slider host plus overhang, and Apple's minimum touch target. On the
 * editor's overview (its only home now) the box grows to 56: the overview is
 * a MAP, and Juan asked the editor's surfaces to hold more of the sheet
 * (2026-08-26) — a taller map reads more, and the caps' targets only gain.
 */
export const TRIM_FRAME_HEIGHT = 56;

/** Photos' trimmer, mapped onto the 36pt box. */
const CAP_WIDTH = 14;
const CAP_RADIUS = 7;
const RAIL_HEIGHT = 4;
const CHEVRON_SIZE = 17;
/**
 * The selection's body — the same faint accent wash gen 2 carried. Exported:
 * the editor's zoomed view draws the SAME selection over its waveform, and a
 * re-declared 0.16 is how the two would drift.
 */
export const RANGE_FILL_ALPHA = 0.16;

/** A clip's floor, shared with every surface that edits one. */
export const MIN_GAP_S = 1;
/**
 * A cap is 14pt of ink; its TARGET is a transparent wrapper VIEW around it —
 * ±15 horizontal (44 wide, Apple's minimum, the same number that sized the
 * frame's height) and ±14 vertical (72 tall). It was RNGH `hitSlop` on the
 * gesture, and that stopped being enough the moment the scrubber underneath
 * came back to life for framing: slop is a GESTURE-arena expansion, so a
 * touch inside it still lands on the scrubber's view and the two pans race.
 * A wrapper the caps' pans own is resolved by hit-testing instead — topmost
 * view wins, deterministically, and the scrubber simply never sees a touch
 * aimed at an edge. When the clip is short the wrappers overlap the middle
 * zone; they are rendered after it, so the edges win, which is the right
 * priority — edges are what framing adjusts.
 */
const CAP_TOUCH_PAD_X = 15;
const CAP_TOUCH_PAD_Y = 14;
const CAP_TOUCH_WIDTH = CAP_WIDTH + CAP_TOUCH_PAD_X * 2;

/**
 * How far the frame's TOUCH territory reaches past a selection edge, in px —
 * the cap's ink (14) plus its wrapper pad (15). Exported for the editor's
 * overview scrub, which yields to any touch starting inside the frame's
 * reach: that yield is done by GEOMETRY against this number, not by gesture
 * arbitration, so it cannot drift from the wrappers it describes.
 */
export const CAP_TOUCH_OVERHANG = CAP_WIDTH + CAP_TOUCH_PAD_X;

/**
 * FINE SCRUBBING — Apple's own answer to precision on a control that must not
 * zoom, taken from the platform's scrubbers (Music, Podcasts, UISlider's
 * scrubbing rates): the track never moves, the FINGER's gain does. Slide
 * vertically off the frame while dragging and the same horizontal travel
 * moves the edge at half, quarter, then a tenth speed; come back up and full
 * speed returns. At whole-track scale a second is ~2pt, so the fine band
 * turns it into ~20pt — second-accurate placement with a thumb.
 *
 * This is the precision the zoom was built to buy and rejected for
 * (docs/rejected-experiments.md): a coordinate system that moves under the
 * finger is not simple. This one's coordinate system is static — the gain is
 * felt, not watched, and someone who never discovers it loses nothing. The
 * bands are Apple's ladder (100% / 50% / 25% / 10%), at the distances the
 * system scrubbers use.
 */
const scrubGain = (translationY: number): number => {
  'worklet';
  const away = Math.abs(translationY);
  if (away >= 150) return 0.1;
  if (away >= 100) return 0.25;
  if (away >= 50) return 0.5;
  return 1;
};

/**
 * The drags activate on ANY movement, immediately. They carried
 * `activeOffsetX([-8, 8])`, which cost twice: 8pt of travel was swallowed
 * before the first change arrived (4 seconds at whole-track scale), and a
 * finger that slid DOWN first — the fine-scrub entry — never activated at
 * all, because vertical movement is not an X offset. The live scrubber
 * underneath is no reason to wait either: the frame's views OWN their touch
 * boxes (see the cap wrapper above), so by the time one of these pans sees a
 * touch there is nothing left to disambiguate against.
 */
const DRAG_MIN_DISTANCE = 2;

/** VoiceOver's increment/decrement step, and the label's own granularity. */
const A11Y_STEP_S = 1;

type ClipTrimFrameIosProps = {
  durationS: number;
  startS: number;
  endS: number;
  /**
   * The live edges, OWNED BY THE EDITOR. They are shared rather than local
   * because the zoomed view's wash and edge lines draw from them too — both
   * have to move while the finger is down, and the editor is the nearest
   * parent of all three surfaces.
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
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
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
    .minDistance(DRAG_MIN_DISTANCE)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const max = endSv.value - MIN_GAP_S;
      startSv.value = Math.min(
        Math.max(
          startSv.value +
            (event.changeX / pxPerS) * scrubGain(event.translationY),
          0,
        ),
        max,
      );
    })
    .onFinalize(() => {
      /**
       * THE CAP COMMITS EXACTLY WHERE IT WAS DROPPED — no snap. Whole-second
       * rounding lived here first, as part of the editor's values policy, and
       * it cost the one thing a trim cap exists for: a start "just in
       * between 2:22 and 2:23" snapped to either side and could not be set
       * at all (Juan, 2026-08-27). The whole-second rule survives where it
       * was actually aimed — the PLAYHEAD's releases and the LABELS' display
       * — and the caps are continuous underneath it.
       */
      runOnJS(commit)(startSv.value, endSv.value);
    });

  const dragEnd = Gesture.Pan()
    .minDistance(DRAG_MIN_DISTANCE)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const min = startSv.value + MIN_GAP_S;
      endSv.value = Math.max(
        Math.min(
          endSv.value +
            (event.changeX / pxPerS) * scrubGain(event.translationY),
          durationS,
        ),
        min,
      );
    })
    .onFinalize(() => {
      // Unrounded, like the start cap above.
      runOnJS(commit)(startSv.value, endSv.value);
    });

  // The framed middle slides the whole clip — length preserved. It takes the
  // same fine-scrub gain as the caps: one drag language for the whole frame.
  const dragClip = Gesture.Pan()
    .minDistance(DRAG_MIN_DISTANCE)
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange(event => {
      const length = endSv.value - startSv.value;
      const next = Math.min(
        Math.max(
          startSv.value +
            (event.changeX / pxPerS) * scrubGain(event.translationY),
          0,
        ),
        durationS - length,
      );
      startSv.value = next;
      endSv.value = next + length;
    })
    .onFinalize(() => {
      // Unrounded, like the caps — the slide preserves the exact length.
      runOnJS(commit)(startSv.value, endSv.value);
    });

  /**
   * ARBITRATION, STATED — never left to the gesture system's defaults. The
   * three drags' touch boxes OVERLAP by design (a short clip's two 44pt
   * wrappers can cover most of its own middle), and overlapping RNGH
   * handlers on different views are not guaranteed exclusive: a touch in an
   * overlap could start two drags at once, and a frame whose start chases
   * its own end collapses to the minimum gap under one swipe (seen on
   * simulator, 2026-08-25: one middle drag left a 0:49–0:50 sliver). So the
   * priority is explicit, and it is the same one the render order implies —
   * a cap beats the middle, and where the two caps' boxes overlap the END
   * cap wins, the edge framing exists to adjust most.
   */
  dragStart.requireExternalGestureToFail(dragEnd);
  dragClip.requireExternalGestureToFail(dragStart, dragEnd);

  /**
   * VOICEOVER'S OWN TRIM. Each cap is an ADJUSTABLE element — the trait a
   * `UISlider` carries — so swipe up/down nudges its edge by a second, spoken
   * back through `accessibilityValue`. Without it the mode's whole point was
   * three unlabeled views only a drag could operate, and VoiceOver cannot
   * drag. The middle is adjustable too: it slides the clip whole, exactly as
   * its pan does.
   */
  const nudge = (edge: 'start' | 'end' | 'clip', direction: 1 | -1) => {
    const deltaS = direction * A11Y_STEP_S;
    if (edge === 'start') {
      onChange(Math.min(Math.max(startS + deltaS, 0), endS - MIN_GAP_S), endS);
      return;
    }
    if (edge === 'end') {
      onChange(
        startS,
        Math.max(Math.min(endS + deltaS, durationS), startS + MIN_GAP_S),
      );
      return;
    }
    const length = endS - startS;
    const next = Math.min(Math.max(startS + deltaS, 0), durationS - length);
    onChange(next, next + length);
  };

  const adjustable = (edge: 'start' | 'end' | 'clip') =>
    ({
      accessible: true,
      accessibilityActions: [
        { name: 'increment' as const },
        { name: 'decrement' as const },
      ],
      accessibilityRole: 'adjustable' as const,
      onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) =>
        nudge(edge, event.nativeEvent.actionName === 'increment' ? 1 : -1),
    }) as const;

  const frameStyle = useAnimatedStyle(() => ({
    left: startSv.value * pxPerS,
    width: Math.max((endSv.value - startSv.value) * pxPerS, 0),
  }));
  // The WRAPPER is positioned, and the ink sits at a fixed inset inside it —
  // so the touch box and the visible cap can never drift apart.
  const startCapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: startSv.value * pxPerS - CAP_WIDTH - CAP_TOUCH_PAD_X },
    ],
  }));
  const endCapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endSv.value * pxPerS - CAP_TOUCH_PAD_X }],
  }));

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && durationS > 0 ? (
        // The frame FADES IN over the mode change — the same 200ms the time
        // row takes to make room below it, so the two read as one transition
        // rather than a pop and a slide. It is an inner wrapper because the
        // outer view is the measuring overlay and must never animate; the
        // band-scan invariant (entering framing moves nothing) is untouched,
        // since opacity is not layout.
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(200)}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={dragClip}>
            <Animated.View
              {...adjustable('clip')}
              accessibilityLabel={t('player.clips.selection')}
              accessibilityValue={{
                text: `${formatTime(startS)} – ${formatTime(endS)}`,
              }}
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
              {...adjustable('start')}
              accessibilityLabel={t('player.clips.startHandle')}
              accessibilityValue={{ text: formatTime(startS) }}
              style={[styles.capTouch, startCapStyle]}
            >
              <View
                style={[
                  styles.cap,
                  styles.capStart,
                  { backgroundColor: colors.primary },
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
              </View>
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={dragEnd}>
            <Animated.View
              {...adjustable('end')}
              accessibilityLabel={t('player.clips.endHandle')}
              accessibilityValue={{ text: formatTime(endS) }}
              style={[styles.capTouch, endCapStyle]}
            >
              <View
                style={[
                  styles.cap,
                  styles.capEnd,
                  { backgroundColor: colors.primary },
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
              </View>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
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
  // The transparent touch box; the visible cap sits at a fixed inset inside.
  capTouch: {
    bottom: -CAP_TOUCH_PAD_Y,
    left: 0,
    position: 'absolute',
    top: -CAP_TOUCH_PAD_Y,
    width: CAP_TOUCH_WIDTH,
  },
  cap: {
    alignItems: 'center',
    bottom: CAP_TOUCH_PAD_Y,
    justifyContent: 'center',
    left: CAP_TOUCH_PAD_X,
    position: 'absolute',
    top: CAP_TOUCH_PAD_Y,
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
