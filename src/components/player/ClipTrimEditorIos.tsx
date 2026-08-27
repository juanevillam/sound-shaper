import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SHEET_CONTENT_TOP, SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import {
  CAP_TOUCH_OVERHANG,
  ClipTrimFrameIos,
  MIN_GAP_S,
  RANGE_FILL_ALPHA,
  TRIM_FRAME_HEIGHT,
} from '@/components/player/ClipTrimFrameIos';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PauseGlyph, PlayGlyph } from '@/components/player/TransportGlyphs';

import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useWaveform } from '@/hooks/useWaveform';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { SCREEN_PADDING } from '@/styles/metrics';
import { CARD_RADIUS, CONTINUOUS_CURVE } from '@/styles/shape';

import {
  IOS_TRANSPORT_GAP,
  IOS_TRANSPORT_PLAY_SIZE,
  IOS_TRANSPORT_ROW_HEIGHT,
  IOS_TRANSPORT_SKIP_SIZE,
  usePlayerTransportAnchorIos,
} from './chrome';

// ---------------------------------------------------------------------------
// THE CLIP EDITOR — Voice Memos' trim surface, producing a CLIP.
//
// Apple's audio-trimming anatomy, taken from Voice Memos on iOS 26 (Juan's
// screenshots, 2026-08-26): a ZOOMED waveform that scrubs under a fixed
// playhead, a full-track OVERVIEW strip carrying the selection frame, a large
// centisecond timecode, and a ±15s transport. What it produces differs — Voice
// Memos cuts the recording; this saves a replay bookmark — so the commit is
// the sheet bar's ✓ (the house commit-modal pair), not Voice Memos' Trim /
// Delete pill row, which exists there because trimming has two destructive
// verbs.
//
// THIS SURFACE IS WHY THE WAVEFORM IS BACK. The 2026-08-23 rejection was
// about the PLAYER CONSOLE — a second track-shaped surface beside the
// scrubber ("two diff progress sliders… out of place"). A dedicated editor
// has no other progress surface, so the objection does not transfer; Juan
// asked for exactly this layout by name. The ZOOM rejection does not transfer
// either: that zoom recomputed its window UNDER the drag; this view's scale
// never changes — the waveform pans, the coordinate system stands still.
//
// GEOMETRY. The zoomed view draws at a FIXED 100pt per second — measured off
// the Voice Memos screenshots, where ~4 seconds of ruler span the screen —
// and pans as one strip under a centred playhead. The strip is rendered in
// CHUNKS (three windows, re-centred when the playhead crosses a boundary — the
// neighbour-pager idiom from PlayerSheet) because a 3-minute track at 100pt/s
// is an 18,000pt SVG nobody should rasterise whole.
//
// THE SELECTION IS ONE STATE WITH TWO SURFACES. The overview strip reuses
// `ClipTrimFrameIos` — the caps, rails, arbitration, fine-scrub and VoiceOver
// work built for the in-player frame — and the zoomed view draws the same
// shared values as a wash with two draggable edge lines. Both commit through
// one `onChange`.
// ---------------------------------------------------------------------------

/** The zoomed view's scale. Fixed — the zoom rejection was a MOVING scale. */
const PPS = 100;
/** One chunk of the pan strip, in seconds (1200pt at PPS). */
const CHUNK_S = 12;
/**
 * Wave band height — grown from 148 with the space-distribution pass (Juan,
 * 2026-08-26), then again from 200 alongside `WAVE_INK_RATIO` (2026-08-27):
 * the sheet ran out of content half-way down, and the band is the surface
 * that deserves the room.
 */
const WAVE_HEIGHT = 224;
/**
 * THE INK'S CEILING INSIDE THE BAND. A full-level bar used to run the whole
 * band height, so the loudest bars touched the container's edges and the
 * card read cramped (Juan, 2026-08-27). Voice Memos' bars keep clear air
 * above and below their tallest peaks; 0.78 leaves ~24pt of it at this
 * band height. A ratio of the band, not a fixed margin — the geometry rule
 * (`artworkRadius`'s class): resize the band and the air scales with it.
 */
const WAVE_INK_RATIO = 0.78;
/**
 * THE BARS ARE NOT LABEL INK. Full `onSurface` bars under the fixed red
 * cursor made a moving high-contrast grating — bar, gap, bar, gap sweeping
 * beneath a stationary saturated line — which vibrates optically and reads
 * as dizzying (Juan, 2026-08-27; it is also a real vestibular/visual-stress
 * accessibility concern, not taste). Voice Memos' own bars sit near
 * secondaryLabel for the same reason: the WAVE is content, the CURSOR is
 * the instrument, and only one of them gets full contrast.
 */
const WAVE_BAR_ALPHA = 0.6;
/** The ruler band under it, part of the same strip so it pans for free. */
const RULER_HEIGHT = 28;
/**
 * Bars: one per 45ms — DENSER than the decode's own 50ms grid, interpolated
 * by the same aggregation — with a THIN 2pt bar. The by-eye passes kept
 * circling because density and weight were moving together: the original
 * "thicket" was 3pt bars with 2pt gaps (more ink than air), while Voice
 * Memos is dense AND airy because its bars are thinner than their gaps.
 * Density up, weight down — the pairing Juan's VM screenshots actually
 * show.
 */
const BAR_PITCH = 4.5;
const BAR_WIDTH = 2;
/**
 * An edge line's touch wrapper — Apple's 44pt minimum, the same number that
 * sized the trim frame's own box. The line inside is 3pt.
 */
const EDGE_TOUCH_WIDTH = 44;

/**
 * The overview strip IS the trim frame's box — `ClipTrimFrameIos` rides it,
 * and that component was designed around exactly this 44 (Apple's minimum,
 * measured against Photos). Stated as the import, not a coincident 44.
 */
const OVERVIEW_HEIGHT = TRIM_FRAME_HEIGHT;
const OVERVIEW_BAR_PITCH = 2.5;
const OVERVIEW_BAR_WIDTH = 1.5;

const SKIP_S = 15;
/** The skip glyphs take the transport's own skip size — one app, one transport. */
const SKIP_HOST_BOX = Math.round(IOS_TRANSPORT_SKIP_SIZE * 1.3);

/**
 * The band overhangs the track's extent at both ENDS, with its own rounded
 * corners — at 0:00 the container used to start dead on the first bar's
 * edge, a hard cut mid-card ("de repente empieza", Juan 2026-08-26). Now the
 * shape leads the content: rounded band edge, then this much empty panel,
 * then the first bar.
 */
const TRACK_EDGE_PAD = 20;

/**
 * ONE GAP BETWEEN THE EDITOR'S GROUPS — wave card, overview, timecode,
 * transport. The first cut used three invented numbers (28/40/36); the
 * console's own block gap is 30 (`titleBlock`), and one value close to it
 * keeps the sheet reading as that family.
 */
const GROUP_GAP = 28;

/** Placeholder amplitude while the decode is in flight — geometry never waits. */
const PLACEHOLDER_LEVEL = 0.18;

type Range = { startS: number; endS: number };

type ClipTrimEditorIosProps = {
  /** Committed selection — the numbers Save writes. */
  range: Range;
  onRangeChange: (startS: number, endS: number) => void;
};

/**
 * Builds one SVG path of bars for [fromS, toS) — one bar per PITCH of screen,
 * each bar the MEAN of the decode buckets it spans, so the display density is
 * a drawing choice and the cached decode stays at its own resolution.
 */
function barsPath(
  buckets: number[] | null,
  bucketMs: number,
  fromS: number,
  toS: number,
  pps: number,
  bandHeight: number,
  pitch: number,
  width: number,
): string {
  const parts: string[] = [];
  const bucketS = bucketMs / 1000;
  const pitchS = pitch / pps;
  const slots = Math.ceil((toS - fromS) / pitchS);
  for (let k = 0; k < slots; k += 1) {
    const t = fromS + k * pitchS;
    if (t >= toS) break;
    let level = PLACEHOLDER_LEVEL;
    if (buckets) {
      const from = Math.max(0, Math.floor(t / bucketS));
      const to = Math.min(buckets.length, Math.ceil((t + pitchS) / bucketS));
      let sum = 0;
      let n = 0;
      for (let i = from; i < to; i += 1) {
        sum += buckets[i];
        n += 1;
      }
      level = n > 0 ? sum / n : 0;
    }
    const x = k * pitchS * pps;
    const h = Math.max(2, level * bandHeight * WAVE_INK_RATIO);
    const y = (bandHeight - h) / 2;
    parts.push(
      `M${x.toFixed(1)},${y.toFixed(1)}h${width}v${h.toFixed(1)}h-${width}z`,
    );
  }
  return parts.join('');
}

export function ClipTrimEditorIos({
  range,
  onRangeChange,
}: ClipTrimEditorIosProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width: winW, height: winH } = useWindowDimensions();

  const current = usePlayerStore(s => s.current);
  const playing = usePlayerStore(s => s.playing);
  const storeDuration = usePlayerStore(s => s.duration);
  const durationS = Math.max(1, Math.floor(storeDuration));

  const waveform = useWaveform(current?.id, current?.audioUrl);

  /**
   * THE WAVE CARD IS INSET AND ROUNDED (Juan, 2026-08-26) — Voice Memos runs
   * its container full-bleed; he prefers the house card: the app's own screen
   * gutter (`SCREEN_PADDING` — the banner's and the console's inset) and the
   * grouped-card corner. Every x below is CARD-local.
   */
  const cardWidth = winW - SCREEN_PADDING * 2;
  const centerX = cardWidth / 2;
  /**
   * DECLARED BEFORE THE GESTURES THAT CAPTURE IT. A worklet serialises its
   * captures where it is DEFINED, and a `const` still in its dead zone
   * captures as undefined — the overview scrub read `overviewPps` that way
   * and wrote NaN into the playhead on first touch (caught on simulator,
   * 2026-08-26: the whole editor collapsed to NaN geometry).
   */
  const overviewWidth = winW - SCREEN_PADDING * 2;
  const overviewPps = overviewWidth / durationS;

  // --- The playhead -------------------------------------------------------
  // One shared value, written by the position tick while sounding and by the
  // pan while a finger owns it. `panningRef` keeps the tick from fighting the
  // finger — the drag-local idiom the scrubber uses.
  const playheadSv = useSharedValue(usePlayerStore.getState().position);
  const panningRef = useRef(false);
  const setPanning = (value: boolean) => {
    panningRef.current = value;
  };

  /**
   * THE TICK FOLLOWER — three regimes, each earned on device (Juan,
   * 2026-08-26):
   *
   * PLAYING: a linear tween per tick turns ~250ms position steps into
   * continuous tape motion. Its duration is RATE-AWARE: the engine ticks per
   * SOURCE frames consumed, so at 0.5× the wall gap between ticks doubles —
   * a fixed 260ms tween finished early and HELD, which is the
   * move-stop-move chunking shaped playback showed. The tween now spans the
   * expected wall gap (delta ÷ rate), clamped so a stall cannot animate
   * forever.
   *
   * PAUSED: the tween is cancelled and the line SETTLES onto the engine's
   * parked position with one short glide (~140ms, ≤ one tick of travel).
   * Third answer, each previous one rejected on device: letting the
   * in-flight tween FINISH overshot to the next tick ("involuntary… i feel
   * im not in control"); freezing in place kept the line ≤0.25s behind the
   * engine, and repaying that on resume either flickered (resume from the
   * engine) or REPLAYED AUDIO already heard (resume seeked back to the
   * line — Juan, 2026-08-27). Settling to the engine's truth at pause time
   * is honest both ways: the line rests where the sound actually stopped,
   * and resume starts there with no seek at all — the console's own
   * semantics. A drag release still seeks to the LINE: while a finger owns
   * it, the line is the truth.
   *
   * SEEKS: a `seekNonce` change (skip, clip start, boundary park) lands
   * directly even while paused — a jump is a jump.
   */
  const lastSeekNonceRef = useRef(usePlayerStore.getState().seekNonce);
  useEffect(
    () =>
      usePlayerStore.subscribe(state => {
        if (panningRef.current) return;
        const seeked = state.seekNonce !== lastSeekNonceRef.current;
        lastSeekNonceRef.current = state.seekNonce;

        if (seeked) {
          cancelAnimation(playheadSv);
          playheadSv.value = state.position;
          return;
        }
        if (!state.playing) {
          cancelAnimation(playheadSv);
          // Settle onto the engine's parked position — see the PAUSED regime
          // above. ≤ one tick away, so this is a ~140ms glide, not a jump.
          if (Math.abs(state.position - playheadSv.value) > 0.001) {
            playheadSv.value = withTiming(state.position, {
              duration: 140,
              easing: Easing.out(Easing.quad),
            });
          }
          return;
        }
        const delta = state.position - playheadSv.value;
        if (Math.abs(delta) >= 1.5) {
          playheadSv.value = state.position;
          return;
        }
        playheadSv.value = withTiming(state.position, {
          duration: Math.min(
            700,
            Math.max(80, (Math.abs(delta) / Math.max(state.rate, 0.25)) * 1000),
          ),
          easing: Easing.linear,
        });
      }),
    [playheadSv],
  );

  // --- The selection ------------------------------------------------------
  // Shared values live-drawn by both surfaces; `range` is the committed truth.
  const startSv = useSharedValue(range.startS);
  const endSv = useSharedValue(range.endS);
  const edgeDraggingRef = useRef(false);
  const setEdgeDragging = (value: boolean) => {
    edgeDraggingRef.current = value;
  };
  useEffect(() => {
    if (edgeDraggingRef.current) return;
    startSv.value = range.startS;
    endSv.value = range.endS;
  }, [range.startS, range.endS, startSv, endSv]);

  const commitEdges = useCallback(() => {
    edgeDraggingRef.current = false;
    onRangeChange(Math.round(startSv.value), Math.round(endSv.value));
  }, [onRangeChange, startSv, endSv]);

  // --- Tiled strip ---------------------------------------------------------
  // The strip lives in ABSOLUTE track coordinates (translateX derives from
  // the playhead alone) and its waveform renders as per-chunk TILES, keyed by
  // chunk index and memoised. Re-centring therefore mounts and unmounts only
  // the EDGE tiles, off-screen, while everything visible keeps its exact
  // native views — the first cut rebuilt one three-chunk SVG on every
  // boundary crossing, and a ±15 skip (which always crosses, 15 > 12)
  // remounted the whole band under the playhead: Juan saw the flicker on
  // device. Five tiles cover ±24s around the playhead, so no jump the
  // transport can make outruns the window.
  const [chunk, setChunk] = useState(() =>
    Math.floor(usePlayerStore.getState().position / CHUNK_S),
  );
  useAnimatedReaction(
    () => Math.floor(playheadSv.value / CHUNK_S),
    (next, previous) => {
      if (previous !== null && next !== previous) runOnJS(setChunk)(next);
    },
    [],
  );

  const lastChunk = Math.max(0, Math.ceil(durationS / CHUNK_S) - 1);
  const tileSet = new Set<number>();
  for (let i = chunk - 2; i <= chunk + 2; i += 1) {
    if (i >= 0 && i <= lastChunk) tileSet.add(i);
  }
  /**
   * THE SELECTION'S OWN CHUNKS STAY MOUNTED ALWAYS — the clip is this
   * editor's subject, and play-from-outside jumps the playhead to its
   * start: if those tiles had to mount on arrival, the band blinked exactly
   * on that press (Juan, 2026-08-26 — "the flicker happens when the red
   * line is not in the clip dragger"). A clip is a handful of chunks;
   * keeping them is nearly free, and memoisation makes them inert.
   */
  for (
    let i = Math.floor(range.startS / CHUNK_S);
    i <= Math.min(Math.ceil(range.endS / CHUNK_S), lastChunk);
    i += 1
  ) {
    if (i >= 0) tileSet.add(i);
  }
  const tiles = [...tileSet].sort((a, b) => a - b);

  const trackWidth = durationS * PPS;

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: centerX - playheadSv.value * PPS }],
  }));

  // Selection wash + edges, in STRIP coordinates so they pan for free.
  const washStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startSv.value * PPS }],
    width: Math.max(0, (endSv.value - startSv.value) * PPS),
  }));
  const startEdgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startSv.value * PPS - EDGE_TOUCH_WIDTH / 2 }],
  }));
  const endEdgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endSv.value * PPS - EDGE_TOUCH_WIDTH / 2 }],
  }));

  // --- Gestures -----------------------------------------------------------
  const pause = useCallback(() => usePlayerStore.getState().pause(), []);
  const seekTo = useCallback((seconds: number) => {
    usePlayerStore.getState().seek(seconds);
  }, []);

  // Pan the waveform to scrub — the finger moves the TAPE, so the playhead
  // value moves opposite the drag, exactly Voice Memos' feel. Scrubbing
  // pauses first: the finger owns the transport while it is down.
  /**
   * MOTION IS CONTINUOUS, VALUES ARE WHOLE SECONDS — the settlement of two
   * directives that collided (Juan, 2026-08-26). "Second by second" was
   * first read as live detents, and a 100pt step under the finger is what
   * made the drag feel heavy against Voice Memos' "really fast and
   * flawless": VM's tape follows the finger exactly and quantises nothing
   * you can SEE mid-drag. So the tape tracks the finger 1:1 here too —
   * `minDistance(0)`, so the grab is instant — while everything that
   * PERSISTS stays whole-second: the timecode and clip line only ever read
   * whole seconds by construction, and the release rounds before it seeks.
   * No landing can carry milliseconds; no drag can feel them.
   */
  const scrubBaseSv = useSharedValue(0);
  const scrubPan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      // The finger owns the value now — an in-flight tick tween would keep
      // writing under it.
      cancelAnimation(playheadSv);
      scrubBaseSv.value = playheadSv.value;
      runOnJS(setPanning)(true);
      runOnJS(pause)();
    })
    .onChange(event => {
      playheadSv.value = Math.min(
        Math.max(scrubBaseSv.value - event.translationX / PPS, 0),
        durationS,
      );
    })
    .onFinalize(() => {
      playheadSv.value = Math.round(playheadSv.value);
      runOnJS(setPanning)(false);
      runOnJS(seekTo)(playheadSv.value);
    });

  /**
   * SCRUB THE WHOLE TRACK FROM THE OVERVIEW (Juan, 2026-08-26) — the small
   * strip maps the full sound to one screen width, so it is the fast way to
   * anywhere; the zoomed view stays the precise way. The jump is ABSOLUTE
   * (the playhead goes to the finger, scrubber-style), and the release snaps
   * to the second like every landing here.
   *
   * IT YIELDS TO THE FRAME BY GEOMETRY. The frame's middle slides the clip
   * and its cap wrappers reach `CAP_TOUCH_OVERHANG` past each edge; a scrub
   * STARTING in that territory no-ops instead of racing the frame's own
   * pans — the arbitration lesson in `ClipTrimFrameIos`: overlapping
   * handlers on different views are not guaranteed exclusive, so the loser
   * is decided by arithmetic, not by the gesture system. A drag that starts
   * on bare track and then crosses the frame keeps scrubbing — ownership is
   * taken at touch-down, like every drag in the player.
   */
  const overviewRejected = useSharedValue(false);
  const overviewScrub = Gesture.Pan()
    .minDistance(0)
    .onBegin(event => {
      const startPx = startSv.value * overviewPps;
      const endPx = endSv.value * overviewPps;
      if (
        event.x >= startPx - CAP_TOUCH_OVERHANG &&
        event.x <= endPx + CAP_TOUCH_OVERHANG
      ) {
        overviewRejected.value = true;
        return;
      }
      overviewRejected.value = false;
      cancelAnimation(playheadSv);
      runOnJS(setPanning)(true);
      runOnJS(pause)();
      // Continuous under the finger; the release rounds (see scrubPan).
      playheadSv.value = Math.min(
        Math.max(event.x / overviewPps, 0),
        durationS,
      );
    })
    .onChange(event => {
      if (overviewRejected.value) return;
      playheadSv.value = Math.min(
        Math.max(event.x / overviewPps, 0),
        durationS,
      );
    })
    .onFinalize(() => {
      if (overviewRejected.value) return;
      playheadSv.value = Math.round(playheadSv.value);
      runOnJS(setPanning)(false);
      runOnJS(seekTo)(playheadSv.value);
    });

  // Continuous like the scrubs — the wash tracks the finger exactly, and
  // `commitEdges` rounds what persists (see scrubPan's settlement note).
  const edgeBaseSv = useSharedValue(0);
  const makeEdgePan = (edge: 'start' | 'end') =>
    Gesture.Pan()
      .minDistance(0)
      .onBegin(() => {
        edgeBaseSv.value = edge === 'start' ? startSv.value : endSv.value;
        runOnJS(setEdgeDragging)(true);
      })
      .onChange(event => {
        const raw = edgeBaseSv.value + event.translationX / PPS;
        if (edge === 'start') {
          startSv.value = Math.min(Math.max(raw, 0), endSv.value - MIN_GAP_S);
        } else {
          endSv.value = Math.max(
            Math.min(raw, durationS),
            startSv.value + MIN_GAP_S,
          );
        }
      })
      .onFinalize(() => {
        startSv.value = Math.round(startSv.value);
        endSv.value = Math.round(endSv.value);
        runOnJS(commitEdges)();
      });
  const startEdgePan = makeEdgePan('start');
  const endEdgePan = makeEdgePan('end');
  // The strip's scrub yields to an edge grab, the same priority the overview
  // frame states: edges are what an editor edits.
  scrubPan.requireExternalGestureToFail(startEdgePan, endEdgePan);

  // --- Transport ----------------------------------------------------------
  const onSkip = (deltaS: number) => {
    // From the ROUNDED playhead: live playback sits at fractional seconds,
    // and 92.3 + 15 = 107.3 was how fractions leaked back into a surface
    // that speaks whole seconds.
    const { position } = usePlayerStore.getState();
    seekTo(Math.min(Math.max(Math.round(position) + deltaS, 0), durationS));
  };

  /** Play from the playhead, stopping on the end cap — the player's rule. */
  const onTogglePlay = () => {
    const store = usePlayerStore.getState();
    if (store.playing) {
      store.pause();
      return;
    }
    /**
     * RESUME FROM THE ENGINE, LIKE THE CONSOLE DOES. Playing from the frozen
     * LINE was tried (2026-08-27) and REPLAYED AUDIO: the line freezes up to
     * one tick behind the engine, so seeking back onto it made the resume
     * repeat words already heard — "visually looks good, but soundly i hear
     * something that already happened" (Juan). Audio truth outranks visual
     * continuity, so resume never seeks; the LINE is brought to the truth
     * instead, by the follower's pause-settle (its PAUSED regime), and by
     * the time a finger reaches play the two agree.
     */
    const fromS =
      store.position >= range.startS && store.position < range.endS - 0.5
        ? store.position
        : range.startS;
    store.playClip('preview', fromS * 1000, range.endS * 1000);
  };

  // --- Overview -----------------------------------------------------------
  const overviewPath = useMemo(() => {
    const pitchS = OVERVIEW_BAR_PITCH / overviewPps;
    const bars = Math.floor(overviewWidth / OVERVIEW_BAR_PITCH);
    const parts: string[] = [];
    for (let i = 0; i < bars; i += 1) {
      const t = i * pitchS;
      let level = PLACEHOLDER_LEVEL;
      if (waveform) {
        const from = Math.floor((t * 1000) / waveform.bucketMs);
        const to = Math.max(
          from + 1,
          Math.floor(((t + pitchS) * 1000) / waveform.bucketMs),
        );
        let sum = 0;
        let n = 0;
        for (let b = from; b < to && b < waveform.buckets.length; b += 1) {
          sum += waveform.buckets[b];
          n += 1;
        }
        level = n > 0 ? sum / n : 0;
      }
      const h = Math.max(1.5, level * OVERVIEW_HEIGHT);
      const y = (OVERVIEW_HEIGHT - h) / 2;
      parts.push(
        `M${(i * OVERVIEW_BAR_PITCH).toFixed(1)},${y.toFixed(1)}h${OVERVIEW_BAR_WIDTH}v${h.toFixed(1)}h-${OVERVIEW_BAR_WIDTH}z`,
      );
    }
    return parts.join('');
  }, [waveform, overviewWidth, overviewPps]);

  const overviewPlayheadStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: Math.min(
          Math.max(playheadSv.value * overviewPps, 0),
          overviewWidth - 2,
        ),
      },
    ],
  }));

  const insets = useSafeAreaInsets();

  /**
   * NO CLS AGAINST THE PLAYER — the editor's play/pause stands at EXACTLY the
   * screen point the expanded console's does (Juan, 2026-08-26), so moving
   * between the two surfaces never moves the control under the thumb. The
   * anchor is the console's own measurement (see `chrome.ts`); the row is
   * pinned from the SCREEN BOTTOM, the one edge a full-height sheet shares
   * with the fullscreen player, so the sheet's top offset never enters into
   * it. The editor is only reachable through the expanded player, so the
   * anchor is always set by the time this renders; the fallback keeps the
   * sheet standing if that invariant ever breaks.
   */
  const transportAnchorY = usePlayerTransportAnchorIos();
  const anchorBottomPad =
    transportAnchorY == null
      ? null
      : Math.max(
          insets.bottom + 8,
          winH - transportAnchorY - IOS_TRANSPORT_ROW_HEIGHT / 2,
        );

  if (!current) return null;

  return (
    // THE COLUMN FILLS THE SHEET — the console's own rule, its own mechanism
    // (flex spacers between blocks). The sheet's content used to end mid-way
    // and the lower half sat empty; Juan read the Shape sheet as
    // "meaningful" for holding its space, and this surface now does the
    // same: band, overview, timecode, transport and the Shape entry share
    // the column, with the slack distributed as air between them.
    <View style={styles.screen}>
      {/* THE ZOOMED VIEW — full-bleed, like Voice Memos. */}
      <GestureDetector gesture={scrubPan}>
        {/* The WRAPPER is unclipped — it exists so the playhead's dots can
            protrude past the card's edge the way Voice Memos' do; inside it
            the CARD clips its content to the rounded corner. The band's
            ground is `surfaceContainer`, the house's one art-less-box
            material, and inside a rounded card it runs behind the ruler too —
            one card, one interior. */}
        <View style={[styles.zoomWrap, { width: cardWidth }]}>
          <View style={styles.zoomCard}>
            <Animated.View
              style={[styles.strip, { width: trackWidth }, stripStyle]}
            >
              {/* The panel rides INSIDE the strip, so it spans exactly the
                  track's extent — before 0:00 and past the end the page
                  colour shows, which is what Voice Memos draws there. A
                  plain background at this width is a single solid CALayer,
                  not a rasterised bitmap, so the size costs nothing. */}
              <View
                pointerEvents="none"
                style={[
                  styles.waveBand,
                  { backgroundColor: colors.surfaceContainer },
                ]}
              />
              {tiles.map(index => (
                <WaveTile
                  key={index}
                  index={index}
                  buckets={waveform?.buckets ?? null}
                  bucketMs={waveform?.bucketMs ?? 50}
                  durationS={durationS}
                  barColor={withAlpha(colors.onSurface, WAVE_BAR_ALPHA)}
                  mutedColor={colors.onSurfaceMuted}
                />
              ))}
              {/* Selection wash + edges ride the strip. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.wash,
                  {
                    backgroundColor: withAlpha(
                      colors.primary,
                      RANGE_FILL_ALPHA,
                    ),
                  },
                  washStyle,
                ]}
              />
              {/* The edges are plain full-height lines — their Voice Memos
                dots went with the rounded card (they would clip against it),
                and the loss is a gain: only the PLAYHEAD is a lollipop now,
                so the two can never be read as one another even in a
                one-accent palette. */}
              <GestureDetector gesture={startEdgePan}>
                <Animated.View style={[styles.edgeTouch, startEdgeStyle]}>
                  <View
                    style={[
                      styles.edgeLine,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={endEdgePan}>
                <Animated.View style={[styles.edgeTouch, endEdgeStyle]}>
                  <View
                    style={[
                      styles.edgeLine,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          </View>

          {/* THE PLAYHEAD IS ITS OWN COLOUR, DISTINCT FROM THE SELECTION'S
              EDGES TOO (Juan, 2026-08-26) — Voice Memos can split cursor
              from selection by hue because it owns two colours, and one
              accent cannot say both. The cursor takes the audio tool's own
              convention instead: the red playhead Apple's Logic draws,
              already in the palette as `danger` — worn here as the CURSOR
              semantic, the way `switchOn`'s green is worn as a switch's.
              Distinct from the bars, both grounds, and the accent edges, in
              both appearances. The dots protrude past the band, exactly as
              Voice Memos' do. */}
          <View
            pointerEvents="none"
            style={[styles.playheadWrap, { left: centerX - 1.25 }]}
          >
            {/* THE HALO — a stripe of the band's own ground behind the red
                line, so the cursor never sits directly against a passing
                bar: its immediate neighbours are constant whatever slides
                underneath, which is the other half of killing the grating
                vibration (the treatment Photos gives its white trim
                playhead, in this band's own colour). Invisible over the
                unwashed band by construction; a quiet carved slot over the
                wash. */}
            <View
              style={[
                styles.playheadHalo,
                { backgroundColor: colors.surfaceContainer },
              ]}
            />
            <View
              style={[styles.playheadLine, { backgroundColor: colors.danger }]}
            />
            <View
              style={[
                styles.edgeDot,
                styles.playheadDotTop,
                { backgroundColor: colors.danger },
              ]}
            />
            <View
              style={[
                styles.edgeDot,
                styles.playheadDotBottom,
                { backgroundColor: colors.danger },
              ]}
            />
          </View>
        </View>
      </GestureDetector>

      {/* Tight to the band: the overview is the band's MAP — one wave
          group, two scales. */}
      <View style={styles.waveGroupGap} />

      {/* THE OVERVIEW — the whole track, carrying the selection frame, and
          a full-track scrubber on its bare regions. */}
      <GestureDetector gesture={overviewScrub}>
        <View style={[styles.overview, { width: overviewWidth }]}>
          <Svg width={overviewWidth} height={OVERVIEW_HEIGHT}>
            {/* The rest of the track, in the house's muted ink — the frame's
              wash is what marks the selection over it. */}
            <Path d={overviewPath} fill={colors.onSurfaceMuted} />
          </Svg>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overviewPlayhead,
              { backgroundColor: colors.danger },
              overviewPlayheadStyle,
            ]}
          />
          <View style={styles.overviewFrame} pointerEvents="box-none">
            <ClipTrimFrameIos
              durationS={durationS}
              startS={range.startS}
              endS={range.endS}
              startSv={startSv}
              endSv={endSv}
              onChange={onRangeChange}
            />
          </View>
        </View>
      </GestureDetector>

      {/* THE SELECTION'S OWN CAPTION — start on the left corner, length in
          the middle, end on the right: the exact label row the player's
          scrubber stands under its slider, on the object those numbers
          describe. It used to be one centred line under the timecode
          ("0:37 – 0:52 · 0:15"), and Juan read it as disrupting the sheet's
          flow there (2026-08-27) — a technical string floating in the
          middle of the column. Split to the overview's corners the same
          facts read as the strip's own furniture, and the big timecode
          stands alone, which is Voice Memos' arrangement exactly. */}
      <ClipRangeCaption
        startSv={startSv}
        endSv={endSv}
        width={overviewWidth}
        color={colors.onSurfaceMuted}
      />

      {/* The one LARGE air on the sheet — it separates the wave group from
          the control group, which is what makes each read as a group at
          all. Even spacers everywhere was tried and read as
          justifyContent: space-between (Juan, 2026-08-26): rhythm is
          clustering plus chosen slack, not equidistance. */}
      <View style={styles.airLarge} />

      {/* THE TIMECODE — Voice Memos' centrepiece, standing alone. */}
      <TimecodeLabel playheadSv={playheadSv} color={colors.onSurface} />

      {/* THE TRANSPORT — ±15 and play, the editor's own loop. FIXED gap to
          the readout above: the timecode is this transport's own caption
          (read where you are, act on it), so the two are one control
          group. */}
      <View style={[styles.transport, styles.controlGroupGap]}>
        <GlyphButton
          onPress={() => onSkip(-SKIP_S)}
          hitSlop={12}
          accessibilityLabel={t('player.clips.skipBack')}
        >
          {/* Bare `Image`, TransportGlyphs' reasoning: `AppIcon`'s map is
              keyed by Material names, and these are Apple's own ±15 glyphs.
              They draw at the transport's own skip size, so this row and the
              console's read as one app's controls. */}
          <SwiftUIHost ignoreSafeArea="all" style={styles.skipHost}>
            <Image
              systemName="gobackward.15"
              size={IOS_TRANSPORT_SKIP_SIZE}
              color={colors.onSurface}
            />
          </SwiftUIHost>
        </GlyphButton>
        <GlyphButton
          onPress={onTogglePlay}
          hitSlop={12}
          accessibilityLabel={t(
            playing ? 'player.pause' : 'player.clips.preview',
          )}
        >
          {playing ? (
            <PauseGlyph
              color={colors.onSurface}
              size={IOS_TRANSPORT_PLAY_SIZE}
            />
          ) : (
            <PlayGlyph
              color={colors.onSurface}
              size={IOS_TRANSPORT_PLAY_SIZE}
            />
          )}
        </GlyphButton>
        <GlyphButton
          onPress={() => onSkip(SKIP_S)}
          hitSlop={12}
          accessibilityLabel={t('player.clips.skipForward')}
        >
          <SwiftUIHost ignoreSafeArea="all" style={styles.skipHost}>
            <Image
              systemName="goforward.15"
              size={IOS_TRANSPORT_SKIP_SIZE}
              color={colors.onSurface}
            />
          </SwiftUIHost>
        </GlyphButton>
      </View>

      {/* THE TAIL IS THE ANCHOR'S — a fixed spacer that puts the play/pause
          on the console's own measured spot (see `anchorBottomPad` above),
          with all remaining slack absorbed by the one flexible air higher up.
          The sheet's ACTIONS live in the bar: Shape and Save share the
          trailing merged pill (home's own arrangement), Cancel leads. A
          content-level Shape entry was built three ways — capsule, full glass
          bar, hugging glass pill — and each read as one object too many on a
          sheet that wants to be two groups (Juan, 2026-08-26). The weighted
          air the fallback keeps is what this replaced: two rounds of "higher,
          for the thumb" (1 → 1.5 → 3.2) were converging by feel on the spot
          the player's transport already occupied. */}
      {anchorBottomPad == null ? (
        <>
          <View style={styles.airSmall} />
          <View style={{ height: insets.bottom + 8 }} />
        </>
      ) : (
        <View style={{ height: anchorBottomPad }} />
      )}
    </View>
  );
}

/**
 * ONE CHUNK OF THE WAVEFORM — bars plus its stretch of ruler, positioned by
 * ABSOLUTE track time and memoised, so a window re-centre never re-renders
 * or remounts a tile that is already on screen; only the far edges of the
 * five-tile window come and go, and those are off-screen by construction.
 */
const WaveTile = memo(function WaveTile({
  index,
  buckets,
  bucketMs,
  durationS,
  barColor,
  mutedColor,
}: {
  index: number;
  buckets: number[] | null;
  bucketMs: number;
  durationS: number;
  barColor: string;
  mutedColor: string;
}) {
  const fromS = index * CHUNK_S;
  const toS = Math.min(durationS, fromS + CHUNK_S);
  const width = (toS - fromS) * PPS;

  const wavePath = useMemo(
    () =>
      barsPath(
        buckets,
        bucketMs,
        fromS,
        toS,
        PPS,
        WAVE_HEIGHT,
        BAR_PITCH,
        BAR_WIDTH,
      ),
    [buckets, bucketMs, fromS, toS],
  );

  const ticks = useMemo(() => {
    const list: { x: number; label: string; major: boolean }[] = [];
    for (let second = Math.ceil(fromS); second < toS; second += 1) {
      const x = (second - fromS) * PPS;
      const m = Math.floor(second / 60);
      const sec = second % 60;
      list.push({
        x,
        label: `${m}:${String(sec).padStart(2, '0')}`,
        major: true,
      });
      // ONE minor tick, at the half second — three quarter ticks separated
      // the seconds more than the band wants (Juan, 2026-08-27).
      list.push({ x: x + PPS / 2, label: '', major: false });
    }
    return list;
  }, [fromS, toS]);

  return (
    <View
      pointerEvents="none"
      style={[styles.tile, { left: fromS * PPS, width }]}
    >
      <Svg width={width} height={WAVE_HEIGHT + RULER_HEIGHT}>
        <Path d={wavePath} fill={barColor} />
        {/* APPLE'S ORDER: ticks hang off the wave's bottom edge, labels sit
            BELOW them (Voice Memos, Juan's screenshots). */}
        <Path
          d={ticks
            .map(
              tick =>
                `M${tick.x.toFixed(1)},${WAVE_HEIGHT + 2}v${tick.major ? 7 : 4}`,
            )
            .join('')}
          stroke={mutedColor}
          strokeWidth={1}
        />
        {ticks.map(tick =>
          tick.major ? (
            <SvgText
              key={`l${tick.x}`}
              x={tick.x}
              y={WAVE_HEIGHT + 23}
              fontSize={11}
              textAnchor="middle"
              fill={mutedColor}
            >
              {tick.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
});

/**
 * THE SELECTION'S CAPTION ROW — start, length, end on the overview's own
 * corners, the scrubber-label idiom (see the render site). A leaf reacting
 * on the ROUNDED edges (the only values this editor deals in), so an edge
 * drag moves the numbers live without the editor re-rendering — the
 * `ClipRangeLabelIos` idea, rebuilt on this surface's shared values.
 */
const ClipRangeCaption = memo(function ClipRangeCaption({
  startSv,
  endSv,
  width,
  color,
}: {
  startSv: SharedValue<number>;
  endSv: SharedValue<number>;
  width: number;
  color: string;
}) {
  const [edges, setEdges] = useState(() => ({
    start: Math.round(startSv.value),
    end: Math.round(endSv.value),
  }));
  useAnimatedReaction(
    () => ({
      start: Math.round(startSv.value),
      end: Math.round(endSv.value),
    }),
    (next, previous) => {
      if (
        previous === null ||
        next.start !== previous.start ||
        next.end !== previous.end
      ) {
        runOnJS(setEdges)(next);
      }
    },
    [],
  );

  return (
    <View style={[styles.rangeCaption, { width }]}>
      <AppText
        doNotTranslate
        text={formatTime(edges.start)}
        style={[styles.rangeCaptionText, { color }]}
      />
      <AppText
        doNotTranslate
        text={formatTime(Math.max(0, edges.end - edges.start))}
        style={[styles.rangeCaptionText, { color }]}
      />
      <AppText
        doNotTranslate
        text={formatTime(edges.end)}
        style={[styles.rangeCaptionText, { color }]}
      />
    </View>
  );
});

/**
 * The timecode re-renders itself off the shared playhead — the leaf-reader
 * rule (`PlayerScrubberLive`), reacting on the SECOND the label draws so it
 * never renders a frame that reads the same. It showed centiseconds first,
 * copied from Voice Memos; Juan cut them (2026-08-26) — that precision is a
 * recording-trimmer's need, not a clip's — which also makes the label ~100×
 * quieter under a drag.
 */
function TimecodeLabel({
  playheadSv,
  color,
}: {
  playheadSv: SharedValue<number>;
  color: string;
}) {
  const [seconds, setSeconds] = useState(() => Math.round(playheadSv.value));
  useAnimatedReaction(
    () => Math.round(playheadSv.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setSeconds)(next);
    },
    [],
  );

  return (
    <AppText
      doNotTranslate
      text={formatTime(seconds)}
      style={[styles.timecode, { color }]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  /**
   * The sheet's bar is transparent glass floating over content, so the
   * editor states its own clearance: `SHEET_CONTENT_TOP` is where every
   * sheet's first content stands below its own top edge (the 84 rule), and
   * the zoomed view is this sheet's first content.
   */
  zoomWrap: {
    alignSelf: 'center',
    height: WAVE_HEIGHT + RULER_HEIGHT,
    marginTop: SHEET_CONTENT_TOP,
  },
  zoomCard: {
    borderRadius: CARD_RADIUS,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    ...CONTINUOUS_CURVE,
  },
  /**
   * The card's interior ground — the track's extent plus `TRACK_EDGE_PAD` of
   * lead-in/out at each end, with its own rounded corners so the ends read
   * as a shape, not a cut.
   */
  waveBand: {
    borderRadius: CARD_RADIUS,
    bottom: 0,
    left: -TRACK_EDGE_PAD,
    position: 'absolute',
    right: -TRACK_EDGE_PAD,
    top: 0,
    ...CONTINUOUS_CURVE,
  },

  strip: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  tile: {
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  wash: {
    bottom: RULER_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  edgeTouch: {
    alignItems: 'center',
    bottom: RULER_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_TOUCH_WIDTH,
  },
  edgeLine: { bottom: 0, position: 'absolute', top: 0, width: 3 },
  edgeDot: {
    borderRadius: 4.5,
    height: 9,
    position: 'absolute',
    width: 9,
  },
  playheadWrap: {
    alignItems: 'center',
    bottom: RULER_HEIGHT,
    position: 'absolute',
    top: 0,
    width: 2.5,
  },
  playheadLine: { bottom: 0, position: 'absolute', top: 0, width: 2.5 },
  playheadHalo: {
    borderRadius: 4,
    bottom: 0,
    left: -2.75,
    position: 'absolute',
    top: 0,
    width: 8,
  },
  playheadDotTop: { top: -4.5 },
  playheadDotBottom: { bottom: -4.5 },
  overview: {
    alignSelf: 'center',
    height: OVERVIEW_HEIGHT,
  },
  overviewPlayhead: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  overviewFrame: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  /**
   * LARGE TITLE — 34/41, the ladder's biggest named rung. It shipped at a
   * derived 44, which is a size Apple never draws (STEPPED, NEVER SCALED);
   * Voice Memos' giant readout carries centiseconds this surface no longer
   * shows, so the step down also fits what the label now says. The explicit
   * lineHeight is still required: `AppText`'s variant line box is
   * body-sized, and large glyphs in it render clipped.
   */
  timecode: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 41,
    textAlign: 'center',
  },
  /**
   * Tight under the timecode — the two lines are one block (the moment, and
   * the thing being made), so the space WITHIN the block is small and the
   * GROUP_GAP stays between blocks. Subheadline's own metrics; tabular for
   * the same reason every readout here is.
   */
  /**
   * The scrubber's label row, on the overview: `PlayerScrubber.ios`'s own
   * arrangement (space-between corners, `labelMedium`-scale ink, tabular
   * digits so a ticking edge never shifts its neighbours). Three labels, not
   * two — the middle one is the clip's LENGTH, the fact the corner pair
   * cannot say by itself.
   */
  rangeCaption: {
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rangeCaptionText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  transport: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: IOS_TRANSPORT_GAP,
    justifyContent: 'center',
  },
  /**
   * THE SHEET'S RHYTHM — two clustered groups and a footer, with slack in
   * two CHOSEN places instead of four equal ones. In-group gaps are fixed
   * (20 band→overview, GROUP_GAP readout→transport); the large air carries
   * 1.4× the small one, so the wave group visually owns the top of the
   * sheet and the controls sit low, the way the console lifts its transport
   * with weighted spacers rather than centring it.
   */
  waveGroupGap: { height: 20 },
  controlGroupGap: { marginTop: GROUP_GAP },
  /**
   * The slack BELOW the control group outweighs the slack above it
   * (1 : 3.2), so the timecode and transport ride HIGH enough for a resting
   * thumb — Juan had to reach down for them at 1 : 1 and AGAIN at 1 : 1.5
   * (2026-08-26, twice). Same mechanism, bias stepped until the thumb
   * agreed.
   */
  airLarge: { flexGrow: 1, minHeight: GROUP_GAP },
  airSmall: { flexGrow: 3.2, minHeight: GROUP_GAP / 2 },
  skipHost: { height: SKIP_HOST_BOX, width: SKIP_HOST_BOX },
});
