import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { withAlpha } from '@portfolio/core';
import { SHEET_CONTENT_TOP, SwiftUIHost } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { ClipTrimFrameIos } from '@/components/player/ClipTrimFrameIos';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PauseGlyph, PlayGlyph } from '@/components/player/TransportGlyphs';
import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useWaveform } from '@/hooks/useWaveform';
import { useI18n } from '@/i18n';
import { usePlayerStore } from '@/store/player';

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
/** Wave band height in the zoomed view. */
const WAVE_HEIGHT = 148;
/** The ruler band under it, part of the same strip so it pans for free. */
const RULER_HEIGHT = 28;
/** Bars: one per waveform bucket (50ms), VM's density at this scale. */
const BAR_PITCH = 5;
const BAR_WIDTH = 3;
/** The selection wash — same term the in-player frame used. */
const RANGE_FILL_ALPHA = 0.16;
/** An edge line's touch wrapper; the line itself is 3pt. */
const EDGE_TOUCH_WIDTH = 44;
const MIN_GAP_S = 1;

/** Overview strip: the full track, with the selection frame riding on it. */
const OVERVIEW_HEIGHT = 44;
const OVERVIEW_BAR_PITCH = 2.5;
const OVERVIEW_BAR_WIDTH = 1.5;

const SKIP_S = 15;
const SKIP_GLYPH_SIZE = 26;
const PLAY_SIZE = 44;

/**
 * Voice Memos' timecode: minutes, seconds, CENTISECONDS, comma-separated —
 * the comma is what the real surface draws (see the screenshots), so it is
 * matched rather than localised by us.
 */
const formatTimecode = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped * 100) % 100);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)},${pad(cs)}`;
};

/** Placeholder amplitude while the decode is in flight — geometry never waits. */
const PLACEHOLDER_LEVEL = 0.18;

type Range = { startS: number; endS: number };

type ClipTrimEditorIosProps = {
  /** Committed selection — the numbers Save writes. */
  range: Range;
  onRangeChange: (startS: number, endS: number) => void;
};

/** Builds one SVG path of bars for the buckets in [fromS, toS). */
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
  const first = Math.max(0, Math.floor(fromS / bucketS));
  const last = buckets
    ? Math.min(buckets.length, Math.ceil(toS / bucketS))
    : Math.ceil(toS / bucketS);
  for (let i = first; i < last; i += 1) {
    const t = i * bucketS;
    const x = (t - fromS) * pps;
    if (x + pitch < 0 || x > (toS - fromS) * pps) continue;
    const level = buckets ? (buckets[i] ?? 0) : PLACEHOLDER_LEVEL;
    const h = Math.max(2, level * bandHeight);
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
  const { width: winW } = useWindowDimensions();

  const current = usePlayerStore(s => s.current);
  const playing = usePlayerStore(s => s.playing);
  const storeDuration = usePlayerStore(s => s.duration);
  const durationS = Math.max(1, Math.floor(storeDuration));

  const waveform = useWaveform(current?.id, current?.audioUrl);

  const centerX = winW / 2;

  // --- The playhead -------------------------------------------------------
  // One shared value, written by the position tick while sounding and by the
  // pan while a finger owns it. `panningRef` keeps the tick from fighting the
  // finger — the drag-local idiom the scrubber uses.
  const playheadSv = useSharedValue(usePlayerStore.getState().position);
  const panningRef = useRef(false);
  const setPanning = (value: boolean) => {
    panningRef.current = value;
  };

  useEffect(
    () =>
      usePlayerStore.subscribe(state => {
        if (!panningRef.current) playheadSv.value = state.position;
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

  // --- Chunked strip ------------------------------------------------------
  // The strip renders [chunk-1, chunk, chunk+1] and re-centres when the
  // playhead crosses into a neighbour — the pager idiom, so the pan itself is
  // a pure transform.
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

  const windowStartS = Math.max(0, (chunk - 1) * CHUNK_S);
  const windowEndS = Math.min(durationS, (chunk + 2) * CHUNK_S);
  const windowWidth = (windowEndS - windowStartS) * PPS;

  const wavePath = useMemo(
    () =>
      barsPath(
        waveform?.buckets ?? null,
        waveform?.bucketMs ?? 50,
        windowStartS,
        windowEndS,
        PPS,
        WAVE_HEIGHT,
        BAR_PITCH,
        BAR_WIDTH,
      ),
    [waveform, windowStartS, windowEndS],
  );

  const rulerTicks = useMemo(() => {
    const ticks: { x: number; label: string; major: boolean }[] = [];
    for (let s = Math.ceil(windowStartS); s <= windowEndS; s += 1) {
      const x = (s - windowStartS) * PPS;
      const m = Math.floor(s / 60);
      const sec = s % 60;
      ticks.push({
        x,
        label: `${m}:${String(sec).padStart(2, '0')}`,
        major: true,
      });
      for (let q = 1; q < 4; q += 1) {
        ticks.push({ x: x + (q * PPS) / 4, label: '', major: false });
      }
    }
    return ticks;
  }, [windowStartS, windowEndS]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: centerX - (playheadSv.value - windowStartS) * PPS },
    ],
  }));

  // Selection wash + edges, in STRIP coordinates so they pan for free.
  const washStyle = useAnimatedStyle(() => {
    const left = (startSv.value - windowStartS) * PPS;
    return {
      transform: [{ translateX: left }],
      width: Math.max(0, (endSv.value - startSv.value) * PPS),
    };
  });
  const startEdgeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: (startSv.value - windowStartS) * PPS - EDGE_TOUCH_WIDTH / 2,
      },
    ],
  }));
  const endEdgeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (endSv.value - windowStartS) * PPS - EDGE_TOUCH_WIDTH / 2 },
    ],
  }));

  // --- Gestures -----------------------------------------------------------
  const pause = useCallback(() => usePlayerStore.getState().pause(), []);
  const seekTo = useCallback((seconds: number) => {
    usePlayerStore.getState().seek(seconds);
  }, []);

  // Pan the waveform to scrub — the finger moves the TAPE, so the playhead
  // value moves opposite the drag, exactly Voice Memos' feel. Scrubbing
  // pauses first: the finger owns the transport while it is down.
  const scrubPan = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => {
      runOnJS(setPanning)(true);
      runOnJS(pause)();
    })
    .onChange(event => {
      playheadSv.value = Math.min(
        Math.max(playheadSv.value - event.changeX / PPS, 0),
        durationS,
      );
    })
    .onFinalize(() => {
      runOnJS(setPanning)(false);
      runOnJS(seekTo)(playheadSv.value);
    });

  const makeEdgePan = (edge: 'start' | 'end') =>
    Gesture.Pan()
      .minDistance(2)
      .onBegin(() => runOnJS(setEdgeDragging)(true))
      .onChange(event => {
        if (edge === 'start') {
          startSv.value = Math.min(
            Math.max(startSv.value + event.changeX / PPS, 0),
            endSv.value - MIN_GAP_S,
          );
        } else {
          endSv.value = Math.max(
            Math.min(endSv.value + event.changeX / PPS, durationS),
            startSv.value + MIN_GAP_S,
          );
        }
      })
      .onFinalize(() => runOnJS(commitEdges)());
  const startEdgePan = makeEdgePan('start');
  const endEdgePan = makeEdgePan('end');
  // The strip's scrub yields to an edge grab, the same priority the overview
  // frame states: edges are what an editor edits.
  scrubPan.requireExternalGestureToFail(startEdgePan, endEdgePan);

  // --- Transport ----------------------------------------------------------
  const onSkip = (deltaS: number) => {
    const { position } = usePlayerStore.getState();
    seekTo(Math.min(Math.max(position + deltaS, 0), durationS));
  };

  /** Play from the playhead, stopping on the end cap — the player's rule. */
  const onTogglePlay = () => {
    const store = usePlayerStore.getState();
    if (store.playing) {
      store.pause();
      return;
    }
    const fromS =
      store.position >= range.startS && store.position < range.endS - 0.5
        ? store.position
        : range.startS;
    store.playClip('preview', fromS * 1000, range.endS * 1000);
  };

  // --- Overview -----------------------------------------------------------
  const overviewWidth = winW - 32;
  const overviewPps = overviewWidth / durationS;
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

  if (!current) return null;

  return (
    <View style={styles.screen}>
      {/* THE ZOOMED VIEW — full-bleed, like Voice Memos. */}
      <GestureDetector gesture={scrubPan}>
        {/* The wave BAND has its own ground — Voice Memos gives the zoomed
            container a panel distinct from the page, which is what lets the
            unselected region read as "the track" rather than as bare screen.
            `surfaceContainer` is the house's one art-less-box material. The
            ruler strip below stays on the page colour, as Voice Memos' does. */}
        <View style={styles.zoomRegion}>
          <Animated.View
            style={[styles.strip, { width: windowWidth }, stripStyle]}
          >
            {/* The panel rides INSIDE the strip, so it spans exactly the
                track's extent — before 0:00 and past the end the page colour
                shows, which is what Voice Memos draws there. */}
            <View
              pointerEvents="none"
              style={[
                styles.waveBand,
                { backgroundColor: colors.surfaceContainer },
              ]}
            />
            <Svg width={windowWidth} height={WAVE_HEIGHT + RULER_HEIGHT}>
              <Path d={wavePath} fill={colors.onSurface} />
              {/* APPLE'S ORDER: the tick marks hang directly off the wave's
                  bottom edge and the time labels sit BELOW them — Voice Memos
                  draws it that way (Juan's screenshots), and the first cut
                  had it inverted. */}
              <Path
                d={rulerTicks
                  .map(
                    tick =>
                      `M${tick.x.toFixed(1)},${WAVE_HEIGHT + 2}v${tick.major ? 7 : 4}`,
                  )
                  .join('')}
                stroke={colors.onSurfaceMuted}
                strokeWidth={1}
              />
              {rulerTicks.map(tick =>
                tick.major ? (
                  <SvgText
                    key={`l${tick.x}`}
                    x={tick.x}
                    y={WAVE_HEIGHT + 23}
                    fontSize={11}
                    textAnchor="middle"
                    fill={colors.onSurfaceMuted}
                  >
                    {tick.label}
                  </SvgText>
                ) : null,
              )}
            </Svg>

            {/* Selection wash + edges ride the strip. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.wash,
                {
                  backgroundColor: withAlpha(colors.primary, RANGE_FILL_ALPHA),
                },
                washStyle,
              ]}
            />
            <GestureDetector gesture={startEdgePan}>
              <Animated.View style={[styles.edgeTouch, startEdgeStyle]}>
                <View
                  style={[styles.edgeLine, { backgroundColor: colors.primary }]}
                />
                <View
                  style={[
                    styles.edgeDot,
                    styles.edgeDotTop,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <View
                  style={[
                    styles.edgeDot,
                    styles.edgeDotBottom,
                    { backgroundColor: colors.primary },
                  ]}
                />
              </Animated.View>
            </GestureDetector>
            <GestureDetector gesture={endEdgePan}>
              <Animated.View style={[styles.edgeTouch, endEdgeStyle]}>
                <View
                  style={[styles.edgeLine, { backgroundColor: colors.primary }]}
                />
                <View
                  style={[
                    styles.edgeDot,
                    styles.edgeDotTop,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <View
                  style={[
                    styles.edgeDot,
                    styles.edgeDotBottom,
                    { backgroundColor: colors.primary },
                  ]}
                />
              </Animated.View>
            </GestureDetector>
          </Animated.View>

          {/* THE PLAYHEAD IS THE CURSOR COLOUR, NOT THE BARS' INK — Voice
              Memos draws its bars white, its selection in the edit tint and
              its playhead in a third, cursor colour, so the three can never
              be read as one another (Juan, from the screenshots: the line
              must differ from both the bars and their container). This app
              owns one accent, so the cursor takes it in BOTH views — here
              and in the overview — and the selection's edges stay
              distinguishable by standing on the wash's own boundaries. The
              dots protrude past the band, exactly as Voice Memos' do. */}
          <View
            pointerEvents="none"
            style={[styles.playheadWrap, { left: centerX - 1.25 }]}
          >
            <View
              style={[styles.playheadLine, { backgroundColor: colors.primary }]}
            />
            <View
              style={[
                styles.edgeDot,
                styles.playheadDotTop,
                { backgroundColor: colors.primary },
              ]}
            />
            <View
              style={[
                styles.edgeDot,
                styles.playheadDotBottom,
                { backgroundColor: colors.primary },
              ]}
            />
          </View>
        </View>
      </GestureDetector>

      {/* THE OVERVIEW — the whole track, carrying the selection frame. */}
      <View style={[styles.overview, { width: overviewWidth }]}>
        <Svg width={overviewWidth} height={OVERVIEW_HEIGHT}>
          <Path d={overviewPath} fill={withAlpha(colors.onSurface, 0.55)} />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overviewPlayhead,
            { backgroundColor: colors.primary },
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

      {/* THE TIMECODE — Voice Memos' centrepiece. */}
      <TimecodeLabel playheadSv={playheadSv} color={colors.onSurface} />

      {/* THE TRANSPORT — ±15 and play, the editor's own loop. */}
      <View style={styles.transport}>
        <GlyphButton
          onPress={() => onSkip(-SKIP_S)}
          hitSlop={12}
          accessibilityLabel={t('player.clips.skipBack')}
        >
          {/* Bare `Image`, TransportGlyphs' reasoning: `AppIcon`'s map is
              keyed by Material names, and these are Apple's own ±15 glyphs. */}
          <SwiftUIHost ignoreSafeArea="all" style={styles.skipHost}>
            <Image
              systemName="gobackward.15"
              size={SKIP_GLYPH_SIZE}
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
            <PauseGlyph color={colors.onSurface} size={PLAY_SIZE} />
          ) : (
            <PlayGlyph color={colors.onSurface} size={PLAY_SIZE} />
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
              size={SKIP_GLYPH_SIZE}
              color={colors.onSurface}
            />
          </SwiftUIHost>
        </GlyphButton>
      </View>
    </View>
  );
}

/**
 * The timecode re-renders itself off the shared playhead — the leaf-reader
 * rule (`PlayerScrubberLive`), reacting on the CENTISECOND the label draws so
 * it never renders a frame that reads the same.
 */
function TimecodeLabel({
  playheadSv,
  color,
}: {
  playheadSv: SharedValue<number>;
  color: string;
}) {
  const [cs, setCs] = useState(() => Math.round(playheadSv.value * 100));
  useAnimatedReaction(
    () => Math.round(playheadSv.value * 100),
    (next, previous) => {
      if (next !== previous) runOnJS(setCs)(next);
    },
    [],
  );

  return (
    <AppText
      doNotTranslate
      text={formatTimecode(cs / 100)}
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
  zoomRegion: {
    height: WAVE_HEIGHT + RULER_HEIGHT,
    marginTop: SHEET_CONTENT_TOP,
    overflow: 'hidden',
    width: '100%',
  },
  /** The panel behind the WAVE only — the ruler stays on the page colour. */
  waveBand: {
    height: WAVE_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  strip: {
    bottom: 0,
    left: 0,
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
  edgeDotTop: { top: -4.5 },
  edgeDotBottom: { bottom: -4.5 },
  playheadWrap: {
    alignItems: 'center',
    bottom: RULER_HEIGHT,
    position: 'absolute',
    top: 0,
    width: 2.5,
  },
  playheadLine: { bottom: 0, position: 'absolute', top: 0, width: 2.5 },
  playheadDotTop: { top: -4.5 },
  playheadDotBottom: { bottom: -4.5 },
  overview: {
    alignSelf: 'center',
    height: OVERVIEW_HEIGHT,
    marginTop: 28,
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
  timecode: {
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    // Stated: `AppText`'s variant line box is body-sized, and 44pt glyphs in
    // a 20pt line box render struck-through-looking clips.
    lineHeight: 52,
    marginTop: 40,
    textAlign: 'center',
  },
  transport: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 44,
    justifyContent: 'center',
    marginTop: 36,
  },
  skipHost: { height: 34, width: 34 },
});
