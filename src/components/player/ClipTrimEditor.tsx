import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import {
  CAP_TOUCH_OVERHANG,
  ClipTrimFrame,
  MIN_GAP_S,
  RANGE_FILL_ALPHA,
  TRIM_FRAME_HEIGHT,
} from '@/components/player/ClipTrimFrame';
import { GlyphButton } from '@/components/player/GlyphButton';
import { PauseGlyph, PlayGlyph } from '@/components/player/TransportGlyphs';
import {
  SKIP_SECONDS,
  SkipBackGlyph,
  SkipForwardGlyph,
} from '@/components/player/TrimGlyphs';

import { Text as AppText } from '@/components/ui/Text';
import { withAlpha } from '@/core';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useWaveform } from '@/hooks/useWaveform';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { SCREEN_PADDING } from '@/styles/metrics';
import { CARD_RADIUS, CONTINUOUS_CURVE } from '@/styles/shape';
import { SHEET_CONTENT_TOP, SkeletonBone, useSheetLanded } from '@/ui';

import {
  TRANSPORT_GAP,
  TRANSPORT_GLYPH_BOX_RATIO,
  TRANSPORT_PLAY_SIZE,
  TRANSPORT_ROW_HEIGHT,
  TRANSPORT_SKIP_SIZE,
  usePlayerTransportAnchor,
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
// `ClipTrimFrame` — the caps, rails, arbitration, fine-scrub and VoiceOver
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
 * HOW FAR EACH TILE'S CANVAS OVERHANGS ITS OWN STRETCH OF TRACK, so a ruler
 * label sitting ON a tile boundary is drawn whole.
 *
 * A label is `textAnchor="middle"` on its tick, and a tile's seconds start at
 * `Math.ceil(fromS)` — so the FIRST label of every tile is centred on the
 * tile's own x=0 and its left half falls outside the `<Svg>`, which clips.
 * At 0:00 that is the most visible one on the surface: the sound's own
 * "0:00" rendered as "00" against the panel's leading edge (Juan,
 * 2026-09-10, on an iPhone 15 — reproduced on the iPhone 17 simulator).
 *
 * The CARD is not what cuts it, which is worth knowing before reaching for
 * padding there: the panel already leads the first bar by `TRACK_EDGE_PAD`,
 * and the cut lands on the tick, not on the panel's edge.
 *
 * 18 is half of "0:00" at the ruler's 11pt (≈12) plus margin; the widest
 * label this ruler draws is the same four characters at any duration the app
 * handles. The tile shifts left by this much and widens by twice it, so
 * every bar and tick keeps the screen position it had.
 */
const RULER_LABEL_BLEED = 18;
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
 * The overview strip IS the trim frame's box — `ClipTrimFrame` rides it,
 * and that component was designed around exactly this 44 (Apple's minimum,
 * measured against Photos). Stated as the import, not a coincident 44.
 */
const OVERVIEW_HEIGHT = TRIM_FRAME_HEIGHT;
const OVERVIEW_BAR_PITCH = 2.5;
const OVERVIEW_BAR_WIDTH = 1.5;

const SKIP_S = SKIP_SECONDS;
/**
 * The skip glyphs take the transport's own skip size AND its own box ratio —
 * one app, one transport. The ratio was a re-declared 1.3, which is precisely
 * the value `TransportGlyphs.ios` records having MOVED OFF (a double-triangle
 * skip needs 1.45, measured); nothing clipped here only because Apple's ±15
 * glyphs are narrower than `forward.fill`. Taking the exported term is the
 * grep-the-term rule — the constant existing is half the job.
 */
const SKIP_HOST_BOX = Math.round(
  TRANSPORT_SKIP_SIZE * TRANSPORT_GLYPH_BOX_RATIO,
);

/**
 * The band overhangs the track's extent at both ENDS, with its own rounded
 * corners — at 0:00 the container used to start dead on the first bar's
 * edge, a hard cut mid-card ("de repente empieza", Juan 2026-08-26). Now the
 * shape leads the content: rounded band edge, then this much empty panel,
 * then the first bar.
 *
 * 40 since 2026-09-10, doubled from the 20 that first stopped the hard cut:
 * that value only had to keep the corner off the first bar, and once the
 * surface was looked at with the ruler drawing properly it read as the
 * content still crowding its own container (Juan, twice — "add even more").
 * It is the INNER horizontal spacing of the band, so it is what the first
 * bar and the last one breathe against.
 *
 * It must stay at least half a ruler label wide (`RULER_LABEL_BLEED`) or
 * the panel would end before a boundary label does; at 40 that is no longer
 * the binding constraint, which is why the two are stated separately rather
 * than derived from each other.
 */
const TRACK_EDGE_PAD = 40;

/**
 * THE BAND'S INNER BOTTOM ROOM — a QUARTER of the horizontal pad, so the card
 * reads as nothing on top, X at the sides, X/4 underneath.
 *
 * The ruler's labels used to sit against the card's bottom edge, which is
 * also what made the controls below feel cramped against it. Nothing is drawn
 * in this band: the tiles state their own height and stand at the top, so the
 * panel simply continues past the last label.
 *
 * It went in at X/2 and was halved on sight the same day (Juan, 2026-09-10:
 * "too much bottom spacing"). Kept as a RATIO of the horizontal pad rather
 * than a number of its own, so the band's three edges stay one statement.
 */
const BAND_BOTTOM_PAD = TRACK_EDGE_PAD / 4;

/**
 * HOW FAR THE PLAYHEAD'S DOTS STICK OUT of the band, and therefore how much
 * room the WRAPPER keeps for them outside the card.
 *
 * The dots are Voice Memos' lollipop and are meant to protrude — the card
 * clips its content to the rounded corner, so they are drawn OUTSIDE it. On
 * iOS a view does not clip to its bounds and the top dot showed anyway; on
 * Android it is cut flat by the wrapper (Juan, 2026-09-10). Reserving the
 * overhang makes the dots fit INSIDE the wrapper on both platforms rather
 * than relying on a platform's clipping behaviour, which is the kind of
 * thing that differs.
 */
const PLAYHEAD_DOT_OVERHANG = 5;

/**
 * ONE GAP BETWEEN THE EDITOR'S GROUPS — wave card, overview, timecode,
 * transport. The first cut used three invented numbers (28/40/36); the
 * console's own block gap is 30 (`titleBlock`), and one value close to it
 * keeps the sheet reading as that family.
 */
const GROUP_GAP = 28;

/**
 * How much longer than the interval it replays each follower tween runs —
 * see the PLAYING regime. Just over 1: enough that a late tick still finds
 * the tween moving, small enough that the added lag stays invisible.
 */
const TICK_TWEEN_OVERRUN = 1.35;
/**
 * The measured half-delta that makes the timecode's INK gaps equal under the
 * two equal `airEven` spacers: box-symmetric, the ink read 49.5 above / 61.3
 * below (the digits' line box carries more bearing under the baseline than
 * over the caps, and the transport's play triangle starts well inside its
 * glyph box). A pure translate, so layout never moves.
 */
const TIMECODE_OPTICAL_DROP = 6;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHILE THE DECODE IS IN FLIGHT — A BONE, NOT A FLAT WAVEFORM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Both bands used to draw their bars at a flat 0.18 level until the buckets
 * landed, on the grounds that the geometry must never wait on the network.
 * The geometry still doesn't — the band, the ruler, the playhead and the trim
 * frame all come from the duration the sound document already carries — but
 * the flat field was the wrong placeholder for one specific reason: A FLAT
 * WAVEFORM IS A PLAUSIBLE WAVEFORM. A near-silent recording renders exactly
 * like it, so the surface read as settled content and the one thing it never
 * showed was that anything was happening (Juan, 2026-09-13, iOS and Android
 * both). A placeholder that can be mistaken for the content is worse than
 * none.
 *
 * So it takes the house placeholder language instead — `SkeletonBone`, one
 * atom and one app-wide sweep — and the bone is a SOLID BLOCK, which is the
 * one shape no waveform can be. This is a bone's case and not the spinner's
 * under "Waiting has two shapes": the person NAVIGATED here, and the layout
 * that is going to land is known to the point — the band's extent is
 * `durationS * PPS` exactly. What is unknown is the bars' heights, which is
 * content, and no bone has ever promised content. (The spinner was built and
 * rejected on the geometry: centred in the band it sits under the fixed red
 * playhead, so the one control that says "loading" would have been drawn with
 * a saturated line through it.)
 *
 * THE BONE KEEPS THE INK'S FOOTPRINT — the same 0.18 of the band the flat
 * bars occupied, so the block stands where the wave will be rather than
 * filling a band the content never fills. Stated as the ratio it always was,
 * through `WAVE_INK_RATIO` like every bar.
 */
const BONE_LEVEL = 0.18;
const BAND_BONE_HEIGHT = Math.round(BONE_LEVEL * WAVE_HEIGHT * WAVE_INK_RATIO);
/** The overview's own bone — its bars take the strip's full height, not the
 *  zoomed band's ink ratio, so its footprint is the plain ratio. */
const OVERVIEW_BONE_HEIGHT = Math.round(BONE_LEVEL * OVERVIEW_HEIGHT);

type Range = { startS: number; endS: number };

type ClipTrimEditorProps = {
  /** Committed selection — the numbers Save writes. */
  range: Range;
  onRangeChange: (startS: number, endS: number) => void;
  /**
   * A FINGER IS ON THE BAND — true on touch-down, false when it lifts.
   *
   * Android's editor lives in a Compose `ModalBottomSheet`, whose own
   * drag-to-dismiss is a NATIVE gesture in the window above RN's. Scrubbing
   * is never purely horizontal, so the sheet kept claiming the drag and
   * sliding away mid-trim — on the one interaction this surface exists for
   * (Juan, 2026-09-10). The sheet takes this to turn `sheetGesturesEnabled`
   * off while the finger is down, so the two are no longer racing.
   *
   * It fires from `onBegin`, i.e. on touch-down rather than on activation,
   * because by the time a pan activates the sheet may already have won.
   * iOS passes nothing: its sheet is a real `UISheetPresentationController`
   * and arbitrates with the scroller itself.
   */
  onBandTouch?: (down: boolean) => void;
};

/**
 * Builds one SVG path of bars for [fromS, toS) — one bar per PITCH of screen,
 * each bar the MEAN of the decode buckets it spans, so the display density is
 * a drawing choice and the cached decode stays at its own resolution.
 */
function barsPath(
  buckets: number[],
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
    const from = Math.max(0, Math.floor(t / bucketS));
    const to = Math.min(buckets.length, Math.ceil((t + pitchS) / bucketS));
    let sum = 0;
    let n = 0;
    for (let i = from; i < to; i += 1) {
      sum += buckets[i];
      n += 1;
    }
    const level = n > 0 ? sum / n : 0;
    const x = k * pitchS * pps;
    const h = Math.max(2, level * bandHeight * WAVE_INK_RATIO);
    const y = (bandHeight - h) / 2;
    parts.push(
      `M${x.toFixed(1)},${y.toFixed(1)}h${width}v${h.toFixed(1)}h-${width}z`,
    );
  }
  return parts.join('');
}

export function ClipTrimEditor({
  range,
  onRangeChange,
  onBandTouch,
}: ClipTrimEditorProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  // Each platform's own accent, no branch — see the frame's note
  // (`ClipTrimFrame`); wash and edge lines are the same selection.
  const frameAccent = colors.accentFill;
  const { width: winW, height: winH } = useWindowDimensions();

  const current = usePlayerStore(s => s.current);
  const playing = usePlayerStore(s => s.playing);
  const storeDuration = usePlayerStore(s => s.duration);
  const durationS = Math.max(1, Math.floor(storeDuration));

  const { status: waveStatus, waveform } = useWaveform(
    current?.id,
    current?.audioUrl,
  );

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
    // The sheet under this editor stops competing for the drag — see
    // `onBandTouch`.
    onBandTouch?.(value);
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
        /**
         * THE TWEEN IS DELIBERATELY LONGER THAN THE GAP IT REPLAYS, and that
         * is what took the last stutter out of playback.
         *
         * Each tick replays the interval just consumed over the interval
         * about to be: aim at the engine's reported position, span the wall
         * time that delta took. Sized EXACTLY, it finishes the moment the
         * next tick is due — and a tick is delivered by the JS thread, so it
         * is routinely a few ms late. The tween then completes and HOLDS at
         * its target until the next one arrives, which is a stall of a frame
         * or two, every tick, on a surface whose whole job is smooth tape
         * motion (Juan, 2026-09-10).
         *
         * `TICK_TWEEN_OVERRUN` makes it outlast the gap, so a tick always
         * retargets a tween still in flight and the line never idles. It
         * cannot run AHEAD of the sound: the target is still the engine's
         * last reported position and never an extrapolation past it, so the
         * "involuntary, not in control" overshoot recorded in the PAUSED
         * regime above cannot come back this way. The cost is that the line
         * trails by a fraction more of one tick, which is below what the eye
         * resolves at this zoom.
         */
        playheadSv.value = withTiming(state.position, {
          duration: Math.min(
            700,
            Math.max(
              80,
              (Math.abs(delta) / Math.max(state.rate, 0.25)) *
                1000 *
                TICK_TWEEN_OVERRUN,
            ),
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
    // Dragging a cap is the same competition as scrubbing — see `onBandTouch`.
    onBandTouch?.(value);
  };
  useEffect(() => {
    if (edgeDraggingRef.current) return;
    startSv.value = range.startS;
    endSv.value = range.endS;
  }, [range.startS, range.endS, startSv, endSv]);

  // A SOUNDING PREVIEW STOPS AT THE CAP'S NEW EDGE, not the one it was armed
  // with — the store's `retargetClipEnd` had lost its only caller when
  // in-place framing went, so dragging the end cap while listening still
  // stopped at the stale edge. Every committed range change lands here (a
  // drag, a VoiceOver nudge); a no-op unless the preview is what is playing.
  useEffect(() => {
    usePlayerStore.getState().retargetClipEnd(range.endS);
  }, [range.endS]);

  const commitEdges = useCallback(() => {
    edgeDraggingRef.current = false;
    // RELEASE THE SHEET TOO. This cleared only the ref, so a cap drag left
    // `sheetGesturesEnabled` off permanently — swipe-to-dismiss was dead for
    // the rest of the editor's life, and the leak was invisible because the
    // symptom is a gesture that STOPS working rather than one that misfires.
    onBandTouch?.(false);
    onRangeChange(startSv.value, endSv.value);
  }, [onBandTouch, onRangeChange, startSv, endSv]);

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
  /**
   * THE TILE WINDOW WAITS FOR THE SHEET TO LAND. The editor's first render
   * happens DURING the sheet's presentation, and it used to mount the full
   * five-tile window plus the clip's pinned chunks right there — SVG path
   * builds and native commits riding the present animation's own frames.
   * Until `transitionEnd` (+ the settle frame) only ±1 chunk mounts, which
   * already covers ~6× the visible band; the rest follows one frame after
   * the sheet stops moving, off-screen and invisible by construction.
   */
  const landed = useSheetLanded();
  const reach = landed ? 2 : 1;
  const tileSet = new Set<number>();
  for (let i = chunk - reach; i <= chunk + reach; i += 1) {
    if (i >= 0 && i <= lastChunk) tileSet.add(i);
  }
  /**
   * THE SELECTION'S OWN CHUNKS STAY MOUNTED ALWAYS (once the sheet has
   * landed) — the clip is this editor's subject, and play-from-outside
   * jumps the playhead to its start: if those tiles had to mount on
   * arrival, the band blinked exactly on that press (Juan, 2026-08-26 —
   * "the flicker happens when the red line is not in the clip dragger").
   * A clip is a handful of chunks; keeping them is nearly free, and
   * memoisation makes them inert.
   */
  if (landed) {
    for (
      let i = Math.floor(range.startS / CHUNK_S);
      i <= Math.min(Math.ceil(range.endS / CHUNK_S), lastChunk);
      i += 1
    ) {
      if (i >= 0) tileSet.add(i);
    }
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
   * MOTION IS CONTINUOUS, AND ONLY THE LABELS SPEAK WHOLE SECONDS — the
   * policy in its third and narrowest form. "Second by second" (Juan,
   * 2026-08-26) was first read as live detents, and a 100pt step under the
   * finger made the drag heavy against Voice Memos' "really fast and
   * flawless"; the 2026-08-26 settlement kept motion 1:1 and rounded every
   * RELEASE — which then made a cap or a line placed "just in between 2:22
   * and 2:23" unsettable (Juan, 2026-08-27, twice: the caps, then "same
   * exact problem goes for the red line"). So nothing snaps any more: drags
   * track the finger (`minDistance(0)`), releases seek and commit EXACTLY
   * where they were dropped, and the whole-second rule lives only in what
   * is DISPLAYED — the timecode and the caption floor to the second,
   * `formatTime`'s own semantics.
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
      /**
       * UNROUNDED — the line rests exactly where the finger left it, the
       * same narrowing the trim caps took (Juan, 2026-08-27: "same exact
       * problem goes for the red line"). The whole-second rule is the
       * LABELS' now, nothing else's: the timecode floors what it displays.
       */
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
   * pans — the arbitration lesson in `ClipTrimFrame`: overlapping
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
      // Unrounded, like the band scrub above.
      runOnJS(setPanning)(false);
      runOnJS(seekTo)(playheadSv.value);
    });

  // Continuous like the scrubs — the wash tracks the finger exactly, and
  // `commitEdges` commits exactly where it was dropped (the settlement note
  // above: only labels round).
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
        // Unrounded — the cap commits exactly where it was dropped. The
        // whole-second policy is the playhead's and the labels'; see
        // `ClipTrimFrame`'s start cap for the full note (Juan,
        // 2026-08-27).
        runOnJS(commitEdges)();
      });
  const startEdgePan = makeEdgePan('start');
  const endEdgePan = makeEdgePan('end');
  // The strip's scrub yields to an edge grab, the same priority the overview
  // frame states: edges are what an editor edits.
  scrubPan.requireExternalGestureToFail(startEdgePan, endEdgePan);

  // --- Transport ----------------------------------------------------------
  const onSkip = (deltaS: number) => {
    // From the EXACT playhead — a skip moves ±15 from where you are, the way
    // Apple's does; rounding first made it also snap a line the person had
    // placed between seconds (the trim-cap narrowing, 2026-08-27).
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
    // No buckets, no bars — the strip's own bone stands in their place (see
    // `BONE_LEVEL`), rather than a flat field that reads as a quiet track.
    if (!waveform) return '';
    const pitchS = OVERVIEW_BAR_PITCH / overviewPps;
    const bars = Math.floor(overviewWidth / OVERVIEW_BAR_PITCH);
    const parts: string[] = [];
    for (let i = 0; i < bars; i += 1) {
      const t = i * pitchS;
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
      const level = n > 0 ? sum / n : 0;
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
  const transportAnchorY = usePlayerTransportAnchor();
  const anchorBottomPad =
    transportAnchorY == null
      ? null
      : Math.max(
          insets.bottom + 8,
          winH - transportAnchorY - TRANSPORT_ROW_HEIGHT / 2,
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
              {/* THE WAIT'S OWN INK — one bone across the track's whole
                  extent, inside the strip so it spans exactly what the band
                  spans and pans with it. It fades out as the bars fade in
                  (see `WaveTile`), and a failed decode drops it rather than
                  sweeping forever: what the band can't draw, the caption
                  below says in words. */}
              {waveStatus === 'loading' ? (
                <Animated.View
                  pointerEvents="none"
                  exiting={FadeOut.duration(180)}
                  style={styles.bandBone}
                >
                  <SkeletonBone height={BAND_BONE_HEIGHT} />
                </Animated.View>
              ) : null}
              {/* Selection wash + edges ride the strip. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.wash,
                  {
                    backgroundColor: withAlpha(frameAccent, RANGE_FILL_ALPHA),
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
                    style={[styles.edgeLine, { backgroundColor: frameAccent }]}
                  />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={endEdgePan}>
                <Animated.View style={[styles.edgeTouch, endEdgeStyle]}>
                  <View
                    style={[styles.edgeLine, { backgroundColor: frameAccent }]}
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

          {/* A FAILED DECODE SAYS SO, ONCE, IN THE MIDDLE OF THE CARD.
              Everything else still works — the ruler, the playhead, the
              transport and both sets of handles are duration-derived, so a
              clip can be trimmed and saved with no waveform at all, which is
              why this is one quiet line and not an error state. Re-entering
              the editor retries the decode (see `useWaveform`).

              PINNED TO THE VIEWPORT, AND ABOVE THE PLAYHEAD. It is chrome
              about the band rather than content in it, so panning must not
              carry it away; and stood inside the card it rendered UNDER the
              red line, which struck the sentence out mid-word ("Couldn't load
              |he waveform.", measured on device). It stands on a pill of the
              band's own ground for the same reason the playhead's halo is
              that colour — the line passes behind the words instead of
              through them. */}
          {waveStatus === 'failed' ? (
            <View pointerEvents="none" style={styles.waveNotice}>
              <AppText
                text="player.clips.waveformUnavailable"
                style={[
                  styles.waveNoticePill,
                  styles.waveNoticeText,
                  { backgroundColor: colors.surfaceContainer },
                  { color: colors.onSurfaceMuted },
                ]}
              />
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {/* Tight to the band: the overview is the band's MAP — one wave
          group, two scales. */}
      <View style={styles.waveGroupGap} />

      {/* THE OVERVIEW — the whole track, carrying the selection frame, and
          a full-track scrubber on its bare regions. */}
      <GestureDetector gesture={overviewScrub}>
        <View style={[styles.overview, { width: overviewWidth }]}>
          {/* THE MAP WAITS ON THE SAME DECODE, so it takes a bone of its own
              — the strip standing empty beside a boned band would read as
              half-broken, and the doc's count-of-bones is not a smell. Its
              footprint is the overview's own ratio, not the zoomed band's. */}
          {waveStatus === 'loading' ? (
            <Animated.View
              pointerEvents="none"
              exiting={FadeOut.duration(180)}
              style={styles.overviewBone}
            >
              <SkeletonBone height={OVERVIEW_BONE_HEIGHT} />
            </Animated.View>
          ) : null}
          <Animated.View
            // Same crossfade the zoomed bars take, for the same reason.
            entering={overviewPath ? FadeIn.duration(220) : undefined}
            key={overviewPath ? 'wave' : 'bone'}
          >
            <Svg width={overviewWidth} height={OVERVIEW_HEIGHT}>
              {/* The rest of the track, in the house's muted ink — the frame's
                wash is what marks the selection over it. */}
              <Path d={overviewPath} fill={colors.onSurfaceMuted} />
            </Svg>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overviewPlayhead,
              { backgroundColor: colors.danger },
              overviewPlayheadStyle,
            ]}
          />
          <View style={styles.overviewFrame} pointerEvents="box-none">
            <ClipTrimFrame
              durationS={durationS}
              startS={range.startS}
              endS={range.endS}
              startSv={startSv}
              endSv={endSv}
              onChange={onRangeChange}
              onBandTouch={onBandTouch}
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
      <View style={styles.airEven} />

      {/* THE TIMECODE — Voice Memos' centrepiece, standing alone. */}
      <TimecodeLabel playheadSv={playheadSv} color={colors.onSurface} />

      {/* THE TRANSPORT — ±15 and play, the editor's own loop. FIXED gap to
          the readout above: the timecode is this transport's own caption
          (read where you are, act on it), so the two are one control
          group. */}
      <View style={styles.airEven} />

      <View style={styles.transport}>
        <GlyphButton
          onPress={() => onSkip(-SKIP_S)}
          hitSlop={12}
          accessibilityLabel={t('player.clips.skipBack').replace(
            '{s}',
            String(SKIP_SECONDS),
          )}
        >
          {/* The platform's own skip badge at the transport's skip size, so
              this row and the console's read as one app's controls — SF's
              ±15 on iOS, Material's ±10 on Android (`TrimGlyphs` has the
              split's argument). The slot keeps the transport's stated box. */}
          <View style={styles.skipHost}>
            <SkipBackGlyph
              color={colors.onSurface}
              size={TRANSPORT_SKIP_SIZE}
            />
          </View>
        </GlyphButton>
        <GlyphButton
          onPress={onTogglePlay}
          hitSlop={12}
          accessibilityLabel={t(
            playing ? 'player.pause' : 'player.clips.preview',
          )}
        >
          {/* STATED BOX, exactly as the skips beside it take one. A drawn
              pause is WIDER than a drawn play — two bars against a triangle —
              so an unboxed middle item re-measures on every toggle and the
              centred row slides sideways under the finger (Juan, 2026-09-10).
              The console fixed this on its own transport and this row was
              left behind, which is why iOS looks right (its SF Symbols sit in
              fixed hosts) and only Android's banner did.
              `TRANSPORT_ROW_HEIGHT` IS the play glyph's box — the row's
              height is defined as exactly that — so the square is the term
              rather than a second derivation of it. */}
          <View style={styles.playHost}>
            {playing ? (
              <PauseGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            ) : (
              <PlayGlyph color={colors.onSurface} size={TRANSPORT_PLAY_SIZE} />
            )}
          </View>
        </GlyphButton>
        <GlyphButton
          onPress={() => onSkip(SKIP_S)}
          hitSlop={12}
          accessibilityLabel={t('player.clips.skipForward').replace(
            '{s}',
            String(SKIP_SECONDS),
          )}
        >
          <View style={styles.skipHost}>
            <SkipForwardGlyph
              color={colors.onSurface}
              size={TRANSPORT_SKIP_SIZE}
            />
          </View>
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
/**
 * BUILT TILE PATHS ARE CACHED — a tile's path is a pure function of the
 * decode result and the chunk, so remounting a tile (the window sliding back
 * over a chunk it dropped, the landed expansion above) must not rebuild a
 * ~270-rect string. Keyed by the BUCKETS ARRAY'S IDENTITY (a WeakMap, so a
 * new decode simply starts a new map and the old one collects) — the
 * cache-audit's home table: render-scoped value, module-memo home.
 */
const wavePathCache = new WeakMap<number[], Map<number, string>>();

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

  const wavePath = useMemo(() => {
    // BEFORE THE DECODE THE TILE IS ITS RULER ALONE — the ticks and their
    // labels are known from the duration, so they stand immediately; the
    // wave's place is held by the band's bone (see `BONE_LEVEL`).
    if (!buckets) return '';
    let byChunk = wavePathCache.get(buckets);
    if (!byChunk) {
      byChunk = new Map();
      wavePathCache.set(buckets, byChunk);
    }
    const hit = byChunk.get(index);
    if (hit !== undefined) return hit;
    const built = barsPath(
      buckets,
      bucketMs,
      fromS,
      toS,
      PPS,
      WAVE_HEIGHT,
      BAR_PITCH,
      BAR_WIDTH,
    );
    byChunk.set(index, built);
    return built;
  }, [buckets, bucketMs, fromS, toS, index]);

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
      style={[
        styles.tile,
        {
          left: fromS * PPS - RULER_LABEL_BLEED,
          width: width + RULER_LABEL_BLEED * 2,
        },
      ]}
    >
      {/* THE RULER IS NOT PART OF THE WAIT, so it is not part of the fade
          either — its ticks and labels come from the duration and stand on the
          first frame. It used to share one canvas with the bars, and the tile
          as a whole was REMOUNTED when the decode landed to cross-fade them;
          that meant fading a ruler out under an identical ruler fading in, for
          no reason once the placeholder stopped being bar-shaped. */}
      <Svg
        width={width + RULER_LABEL_BLEED * 2}
        height={WAVE_HEIGHT + RULER_HEIGHT}
      >
        {/* Everything is drawn in the tile's own coordinates and shifted into
            the bleed, so the canvas grew without anything moving. */}
        <G x={RULER_LABEL_BLEED}>
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
        </G>
      </Svg>
      {/* THE BARS ARRIVE AS A CROSSFADE, not a swap: this layer fades in over
          the 220ms the band's bone takes to fade out. Opacity-only, which is
          exactly what Reduce Motion asks transitions to become — so it is not
          gated. */}
      {wavePath ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.tileWave}>
          <Svg width={width + RULER_LABEL_BLEED * 2} height={WAVE_HEIGHT}>
            <G x={RULER_LABEL_BLEED}>
              <Path d={wavePath} fill={barColor} />
            </G>
          </Svg>
        </Animated.View>
      ) : null}
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
    start: Math.floor(startSv.value),
    end: Math.floor(endSv.value),
  }));
  useAnimatedReaction(
    // FLOORED, not rounded: the caps are continuous now and `formatTime`
    // floors, so keying the reaction on the floored second is what keeps the
    // label and the re-render schedule telling the same story.
    () => ({
      start: Math.floor(startSv.value),
      end: Math.floor(endSv.value),
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
  const [seconds, setSeconds] = useState(() => Math.floor(playheadSv.value));
  useAnimatedReaction(
    // FLOORED to match `formatTime`'s own semantics — the playhead is
    // continuous now, and a rounded reaction re-rendered a label that then
    // floored to a different second half the time.
    () => Math.floor(playheadSv.value),
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
   * THE CLEARANCE IS iOS'S ALONE, and paying it on Android put the band 84dp
   * too low (Juan, 2026-09-10: "why does the sound bars container is too
   * low").
   *
   * On iOS the sheet's bar is transparent glass floating over content, so
   * the editor states its own clearance — `SHEET_CONTENT_TOP`, where every
   * sheet's first content stands below its own top edge, and the zoomed view
   * IS this sheet's first content. On Android the sheet is Compose and has
   * already stood a drag handle, a `SheetBar` and the family's
   * header-to-content gap above this component, so the editor adding the 84
   * on top of them counted the same idea twice. There the band is simply the
   * first thing under the bar, like every other Compose sheet's content.
   */
  zoomWrap: {
    alignSelf: 'center',
    // The card's own height plus the dots' overhang at BOTH ends, so the
    // lollipop is inside this box and no platform has to be asked not to
    // clip it. See `PLAYHEAD_DOT_OVERHANG`.
    height:
      WAVE_HEIGHT + RULER_HEIGHT + BAND_BOTTOM_PAD + PLAYHEAD_DOT_OVERHANG * 2,
    marginTop: Platform.select({ ios: SHEET_CONTENT_TOP, default: 0 }),
  },
  zoomCard: {
    borderRadius: CARD_RADIUS,
    // Inset by the dots' overhang: the CARD is the visible band, the wrapper
    // is only bigger so the dots have somewhere to be.
    bottom: PLAYHEAD_DOT_OVERHANG,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: PLAYHEAD_DOT_OVERHANG,
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
  /** The bars' own layer, over the ruler's canvas and in the same box. */
  tileWave: { left: 0, position: 'absolute', top: 0 },
  /**
   * THE BAND'S BONE — the track's full extent inside the strip, centred in
   * the wave's own area (the ruler and the bottom pad are below it, which is
   * where every other wave-height number here is stated from).
   */
  bandBone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: (WAVE_HEIGHT - BAND_BONE_HEIGHT) / 2,
  },
  overviewBone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: (OVERVIEW_HEIGHT - OVERVIEW_BONE_HEIGHT) / 2,
  },
  /**
   * The failed-decode line, centred in the card's visible wave area — stated
   * against the WRAPPER, which starts a dot's overhang above the card.
   */
  waveNotice: {
    alignItems: 'center',
    height: WAVE_HEIGHT,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: PLAYHEAD_DOT_OVERHANG,
  },
  /** Enough ground either side that the playhead clears the words. */
  waveNoticePill: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  /** `footnote` — a quiet aside about the band, not a title on it. */
  waveNoticeText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  wash: {
    bottom: RULER_HEIGHT + BAND_BOTTOM_PAD,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  edgeTouch: {
    alignItems: 'center',
    bottom: RULER_HEIGHT + BAND_BOTTOM_PAD,
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
    // Card-relative, stated against the WRAPPER: the card starts an overhang
    // down, and the wave ends a ruler plus the bottom pad above the card's
    // own floor.
    bottom: PLAYHEAD_DOT_OVERHANG + BAND_BOTTOM_PAD + RULER_HEIGHT,
    position: 'absolute',
    top: PLAYHEAD_DOT_OVERHANG,
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
    transform: [{ translateY: TIMECODE_OPTICAL_DROP }],
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
    gap: TRANSPORT_GAP,
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

  /**
   * The slack BELOW the control group outweighs the slack above it
   * (1 : 3.2), so the timecode and transport ride HIGH enough for a resting
   * thumb — Juan had to reach down for them at 1 : 1 and AGAIN at 1 : 1.5
   * (2026-08-26, twice). Same mechanism, bias stepped until the thumb
   * agreed.
   */
  /**
   * THE TIMECODE'S AIR IS EVEN — the same flexible spacer above and below it
   * (Juan, 2026-08-27: the number should sit centred in its slack, not
   * closer to one neighbour). It replaced a flexible air above plus a fixed
   * GROUP_GAP below, which read 59.0 / 51.8 in ink. Box symmetry alone is
   * not ink symmetry — the digits' bearings and the transport's glyph
   * bearings differ — so the label carries a small measured translate too.
   */
  airEven: { flexGrow: 1, minHeight: GROUP_GAP },
  airSmall: { flexGrow: 3.2, minHeight: GROUP_GAP / 2 },
  skipHost: {
    alignItems: 'center',
    height: SKIP_HOST_BOX,
    justifyContent: 'center',
    width: SKIP_HOST_BOX,
  },
  playHost: {
    alignItems: 'center',
    height: TRANSPORT_ROW_HEIGHT,
    justifyContent: 'center',
    width: TRANSPORT_ROW_HEIGHT,
  },
});
