import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  SlideInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BannerGlassIos } from '@/components/player/BannerGlassIos';
import {
  BANNER_SIDE_INSET,
  bannerBottomOffset,
  MINI_PLAYER_HEIGHT,
} from '@/components/player/bannerMetrics';
import {
  measurePlayerTransport,
  playerArtRadius,
  playerArtFullSize,
  playerArtTop,
  playerConsoleTop,
  type PlayerCard,
} from '@/components/player/chrome';
import { ClipsSheet } from '@/components/player/ClipsSheet';
import { GlyphButton } from '@/components/player/GlyphButton';
import {
  PlayerBackdrop,
  prefetchPlayerBackdrop,
} from '@/components/player/PlayerBackdrop';
import { PlayerConsole } from '@/components/player/PlayerConsole';
import { ShaperSheet } from '@/components/player/ShaperSheet';
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
} from '@/components/player/TransportGlyphs';
import { EditSoundSheet } from '@/components/sounds/EditSoundSheet';
import { SoundArt } from '@/components/ui/SoundArt';
import { Text as AppText } from '@/components/ui/Text';
import { withAlpha, useAppTheme } from '@/core';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useShapeSummary } from '@/hooks/useShapeSummary';
import { useI18n } from '@/i18n';
import { useClipsStore } from '@/store/clips';
import { RESTART_THRESHOLD_S, usePlayerStore } from '@/store/player';
import { useSoundsStore } from '@/store/sounds';
import {
  FLOATING_COPY_GAP,
  FLOATING_RADIUS,
  GLASS_FLOOR,
  CONTINUOUS_CURVE,
  SHAPE_SM,
  TILE_RADIUS,
  innerRadius,
} from '@/ui';

// ---------------------------------------------------------------------------
// The player interaction: the collapsed banner and the full player are ONE
// bottom-anchored, full-height container. `progress` (0 collapsed, 1 expanded)
// drives everything — the container translates up, the single shared artwork
// element scales/travels from the 44dp thumb to the expanded square, the mini
// row cross-fades into the expanded controls.
//
// Collapsed, the banner is DETACHED: a floating rounded rectangle inset from
// both screen edges and lifted clear of the bottom one, not a bar welded to
// the window. That shape is what the expansion has to resolve, so the painted
// surface is its OWN layer inside the container rather than the container's
// background: it grows from the banner's box to the full window while its
// corners unwind and its lateral insets close. The container itself only
// translates, so the gestures, the pager and the shared artwork are unchanged
// by any of it.
//
// The expanded surface is a FIXED console: art, title (with an overflow menu
// for sound info / editing), the native scrubber, transport, and two cards —
// Shape and Clips — that open their own bottom sheets. Nothing scrolls, so
// nothing can fight the drag-to-close gesture.
// ---------------------------------------------------------------------------

// A rounded RECTANGLE. Half the height would be a capsule, and a capsule at
// this size stops reading as a piece of the app.
const BANNER_RADIUS = FLOATING_RADIUS;

const MINI_ART_SIZE = 46;

// Everything inside the banner sits at ONE inset from its edges — which is
// also what centres the artwork vertically in the banner's box, so the corners
// are truly concentric rather than approximately so. Derived from the two, so
// the sentence cannot go stale the way its hard-coded "44pt artwork in a 64pt
// box" did when both grew.
const BANNER_INSET = (MINI_PLAYER_HEIGHT - MINI_ART_SIZE) / 2;

/**
 * THE LIFT — Android's alone. iOS's was measured out of existence.
 *
 * A detached surface needs to read as floating rather than as a sticker painted
 * on the screen, and Android raises it through the elevation system. iOS had an
 * RN drop shadow beside it (0.3 opacity, 14 radius, +6) written when the banner
 * was an OPAQUE card. It is Liquid Glass now, and the material supplies its own
 * separation — so the shadow was stacked on top of something already doing the
 * job.
 *
 * Band-scanned against the portfolio's other floating glass surface, Topper's
 * UIKit tab bar, sampling the page just outside each edge (iPhone 17 / iOS 26.5,
 * light; darkening in luminance steps from a CLEAN page reference):
 *
 *              2pt out   8pt out   16pt out
 *   UIKit         +8        +5        +3
 *   ours @0.3    +40       +26       +12
 *   ours @0.09   +21       +13        +7
 *   ours @0.035  +15        +9        +5
 *   ours OFF     +15        +9        +5   ← identical
 *
 * The last two rows are the finding: by the time the shadow is faint enough to
 * approach UIKit it contributes NOTHING, because the glass alone already
 * darkens the gutter by +15 — roughly twice what UIKit's whole treatment does.
 * Any RN shadow on top can only overshoot. iOS therefore draws none and lets
 * the material be the lift, which is the iOS 26 idiom besides.
 *
 * Take the reference FAR from the banner: it sits 16pt from the screen edge and
 * its own halo reaches the gutter, so a "page" sample beside it is already
 * darkened and flatters whatever is being tested.
 */
const BANNER_ELEVATION = 8;
// How much of the expansion the banner's own chrome — border, lift — takes to
// disappear. Matches the surface's colour cross-fade, so the whole "this is a
// floating object" story ends at once.
const BANNER_CHROME_FADE = 0.35;

const MINI_ROW_HEIGHT = MINI_PLAYER_HEIGHT;
// The artwork is ONE element scaled between the two states, so a fixed
// borderRadius renders ~5x smaller when collapsed. These are the radii we want
// to SEE at each end; the style divides by the live scale to hit them.
// Collapsed it is a rounded child of a rounded container, so its corner is the
// concentric one: iOS subtracts the inset, Android steps down the M3 scale.
const MINI_ART_RADIUS = innerRadius(BANNER_RADIUS, BANNER_INSET, SHAPE_SM);
// The artwork's position in container (screen) space, where the shared element
// that travels to the expanded square is positioned.
const MINI_ART_X = BANNER_SIDE_INSET + BANNER_INSET;
const MINI_ART_Y = BANNER_INSET;

// The glyphs are sized to the GLYPH plus the banner's inset, not to a generic
// touch box: a 48pt box would push the last one nearly 3x further from the
// edge than the artwork is from the other — the single thing that made the
// banner read as badly spaced. hitSlop restores the touch target (38 + 16 =
// 54 wide, 68 tall, both past either platform's minimum).
//
// THE WIDTH IS MEASURED, AND IT MOVED. It read 14 while the glyphs were
// hand-drawn views, and stayed 14 through the switch to SF Symbols because
// `forward.end.fill` happens to be about that wide. `forward.fill` — Apple's
// own music-transport double triangle — band-scans at 25.33pt for a 19pt
// symbol, and the stale 14 silently pulled the trailing inset below to
// 10.33pt against the 18 it states (measured on the banner before this was
// corrected), i.e. level with the artwork's own 11pt inset, which is exactly
// the pinched look that inset exists to avoid.
const MINI_GLYPH_WIDTH = 25.33;
const MINI_BUTTON_WIDTH = 38;
const MINI_BUTTON_HIT_SLOP = 8;

/**
 * Where the LAST glyph's edge sits, and the one measurement on the banner set
 * by eye rather than by rule. An outlined glyph reads far lighter than the
 * solid artwork block opposite it, so giving the two the same inset — which is
 * what the maths says — leaves the trailing side looking pinched. Roughly 1.6x
 * the leading inset is where they balance.
 */
const MINI_TRAILING_GLYPH_INSET = 18;

/**
 * Gap between the title and the artist under it — the PORTFOLIO'S, shared with
 * the trophy banner, which stood 1 for no reason it could name. With Body over
 * Subheadline the two-line block measures 44pt (22 + 2 + 20) against the 46pt
 * artwork beside it, so the copy fills its own band instead of floating in it.
 */
const MINI_COPY_GAP = FLOATING_COPY_GAP;
/**
 * `forward.fill`'s ink is NOT centred in the frame SwiftUI reserves for it.
 * Both centrings in the chain are symmetric — the symbol in its host box, the
 * box in the button — so the trailing inset should land at exactly
 * `MINI_TRAILING_GLYPH_INSET`, and it band-scanned at 16.67 instead. The
 * missing 1.33 is the symbol's own optical bearing, which is a property of
 * that glyph rather than of this layout, so it is corrected here by name and
 * not by quietly editing one of the two widths above.
 */
const MINI_GLYPH_TRAILING_BEARING = 1.33;

/**
 * AIR BETWEEN THE COPY AND THE TRANSPORT — the copy's own trailing inset, and
 * the reason it is not zero.
 *
 * The copy column is `flex: 1` up to the first button, so a title or subtitle
 * long enough to truncate puts its ELLIPSIS on the button box's edge. The only
 * thing between the two is that box's slack around its glyph —
 * `(MINI_BUTTON_WIDTH - MINI_GLYPH_WIDTH) / 2`, 6.33 — plus the backward
 * glyph's own leading bearing. Band-scanned on the A54: a subtitle that
 * truncated mid-word left 16.00dp of air, and the column's edge sits 8.24dp
 * from the glyph's ink, which is what a title that fills the column gets.
 * Juan read that as the ellipsis crowding the buttons, on both platforms.
 *
 * It takes `BANNER_INSET` — the SAME air the artwork gives the copy on the
 * leading side — so the copy sits in a band with equal room either side
 * instead of being squeezed against the controls. The rendered gap to the
 * glyph's ink is that plus the box slack, which lands near
 * `MINI_TRAILING_GLYPH_INSET`; the two are the same argument seen from
 * opposite ends of the glyph cluster, and neither is derived from the other
 * because the bearings differ per symbol.
 */
const MINI_COPY_TRAILING_GAP = BANNER_INSET;
// The row's own padding is then whatever gets the glyph there, so changing the
// button box can't quietly move it.
const MINI_ROW_PADDING_RIGHT =
  MINI_TRAILING_GLYPH_INSET -
  (MINI_BUTTON_WIDTH - MINI_GLYPH_WIDTH) / 2 +
  MINI_GLYPH_TRAILING_BEARING;

// iOS trades the banner's solid fill for real Liquid Glass, so the library's
// cover art reads through it. The player it becomes is opaque, so the fill
// ramps in — and the glass out — over this window, fast enough that the
// expanding surface is never see-through for long.
const BANNER_GLASS = Platform.OS === 'ios';
const BANNER_GLASS_FADE = 0.12;
/**
 * THE FLOOR IS THE PORTFOLIO'S, NOT THIS BANNER'S. `GLASS_FLOOR` is the one
 * tonal floor every floating glass surface in every app stands on — the
 * snackbar and the trophy unlock banner take it through `GlassSurfaceIos`, and
 * the measurements that set it (and Apple's own number it is matched to) live
 * with it in `src/ui`.
 *
 * This banner cannot use that component, and the reason is the expansion:
 * `surfaceStyle` interpolates this exact colour to the opaque player background
 * as the banner grows into a screen, so the floor here is an animated layer
 * rather than a static one. It shares the TERM instead — which is the point,
 * since the number is what a person sees.
 */
const BANNER_GLASS_FLOOR = GLASS_FLOOR;

/**
 * NO OUTLINE ON EITHER PLATFORM (Juan, 2026-09-08 — "it shouldn't have border
 * colors; a cool shadow is enough"). iOS's glass draws its own edge; Android's
 * pill floats on its ELEVATION shadow alone now, the hairline retired with the
 * borders on the expanded console's footer. Tone + shadow is Material's own
 * floating grammar — the outline was belt-and-braces.
 */

/**
 * WHERE THE CONSOLE FADES IN, as a window of the expansion — and the window is
 * EARLY on purpose (Juan, 2026-08-25). It was [0.45 → 1.0], which left roughly
 * the first half of every open showing nothing but the cover travelling over a
 * growing surface; the content then materialised into a screen that was
 * already mostly there. Correct, but flat — the animation's whole middle
 * carried one element.
 *
 * The console does not need to wait, because it MOVES with the container: its
 * title, transport and footer are laid out at their final places inside the
 * full-height sheet, so mid-expansion they sit low and ride up with the rise.
 * Fading them in early therefore does not pop a finished screen over the
 * banner — it puts the content IN the motion, arriving from below as the
 * surface grows, with the lower elements entering later than the title by
 * construction. That distribution is the richness; no per-element
 * choreography is needed.
 *
 * Fully in by 0.65 rather than 1.0 for the same reason in reverse: a spring's
 * last stretch is its settle, and an opacity still crawling through the
 * settle reads as the screen never quite finishing.
 */
const CONSOLE_FADE_START = 0.18;
const CONSOLE_FADE_END = 0.65;

// THE WASH TAKES OVER FROM THE GLASS, NOT FROM BLACK (Juan, 2026-10-16). It
// started at 0.6 — and before that at 0.8 — because it was a full-window
// rectangle and, shown early, read as a stray layer outside the growing pill.
// That left the stretch between the glass going (BANNER_GLASS_FADE) and the
// wash arriving as a flat black slab sweeping up half the screen, which read
// as the app stalling. The wash now lives inside the surface, clipped by its
// box, so it can arrive as the glass leaves and the surface is never bare.
// Fully in by 0.3: by 0.45 the dark arrived too late (Juan, 2026-10-16).
const BACKDROP_FADE_START = 0.06;
const BACKDROP_FADE_END = 0.3;

/**
 * OPENING AND CLOSING ARE SPRINGS, not eased timings.
 *
 * iOS moves sheets with springs — SwiftUI's own presentation is
 * `.spring(duration:bounce:)` — and a cubic ease-out is the tell that something
 * was hand-animated: it decelerates on a fixed schedule rather than settling.
 * Same durations the timings used, so the pacing is unchanged and only the
 * character moves.
 *
 * CRITICALLY DAMPED AND CLAMPED, and both are correctness requirements here
 * rather than taste. `progress` feeds interpolations that are NOT clamped —
 * the surface's `borderRadius: BANNER_RADIUS * (1 - p)` goes negative past 1,
 * its `height` exceeds the window, and `left`/`right` push the container off
 * both edges — so a frame outside [0, 1] is not a flourish, it is broken
 * geometry. `dampingRatio: 1` used to be the whole guarantee, and it only
 * holds FROM REST: the day the release velocity started carrying into the
 * spring (below), a flicked close arrives with enough energy to cross the
 * target once even at critical damping. `clamp` is what makes the guarantee
 * unconditional now; the damping keeps the CHARACTER settled.
 *
 * THE RELEASE VELOCITY CARRIES INTO THE SPRING (Juan, 2026-09-11 — closing
 * felt slow, "the whole experience would be better if this animation is
 * smoother"). A drag moves the surface at the finger's own speed, and a
 * spring started from rest on release threw that speed away: the sheet
 * visibly hesitated at the moment of letting go, then re-accelerated — read
 * as sluggishness, felt mostly on the close because closing is usually a
 * flick. The drag's mapping is `progress = ±translationY / travel`, so the
 * handoff is `-velocityY / travel` in progress units and the motion is one
 * continuous gesture-into-settle.
 *
 * The durations also came down (320/260 → 280/200): with the flick fixed,
 * the button-triggered transitions were the remaining slow ones, and the
 * close is the briskest — leaving a screen should cost less than arriving.
 *
 * The house already had the no-overshoot instinct for the sound pager
 * (`SETTLE_SPRING`, "settles without overshoot"); this states it as the
 * reason rather than the preference.
 */
const PROGRESS_CLAMP = { min: 0, max: 1 } as const;
const EXPAND_SPRING = {
  duration: 280,
  dampingRatio: 1,
  clamp: PROGRESS_CLAMP,
} as const;
const COLLAPSE_SPRING = {
  duration: 200,
  dampingRatio: 1,
  clamp: PROGRESS_CLAMP,
} as const;
// Drag-release: past this progress (or flung faster than this) it commits.
const SNAP_PROGRESS = 0.28;
const SNAP_VELOCITY = 600;

// Swipe the artwork/title sideways to skip. Thresholds mirror the vertical
// drag's feel: a deliberate drag OR a flick commits.
const SKIP_DISTANCE = 64;
const SKIP_VELOCITY = 500;
// A committed swipe pages the neighbour's artwork all the way in. Both
// neighbours are ALREADY mounted and painted off-screen, so the incoming cover
// is on screen the instant it slides in — waiting for the store swap (~140ms of
// re-render) and a fresh image decode is what used to make it arrive late.
const PAGE_MS = 240;
// The horizontal drag has to beat the vertical one to activate, and give up if
// the finger is really heading down (that is the collapse gesture).
const SKIP_ACTIVATE_X = 14;
const SKIP_FAIL_Y = 28;
// Settles without overshoot — a bouncy sound swap looks like a glitch.
const SETTLE_SPRING = { stiffness: 220, mass: 0.6, damping: 22 };

// Stable fallback for the clips selector (an inline `?? []` loops
// useSyncExternalStore into "maximum update depth exceeded").
const NO_CLIPS: never[] = [];

/**
 * How long a warm-mounted console outlives the touch that warmed it — long
 * enough that a hesitation or a quick second tap never churns the mount, short
 * enough that a play/pause tap on the banner does not leave the full console
 * paying rent behind a 46pt pill (see `playerMounted`).
 */
const WARM_COOL_MS = 2000;

/**
 * ANDROID'S BANNER PROGRESS — a full-bleed rule on the card's bottom edge.
 *
 * iOS HAS NONE, ON PURPOSE. It carried one until 2026-08-25, most recently as
 * Apple's own inset `ProgressView`, and the component was never the problem:
 * a `ProgressView` is a CONTROL, with a control's capsule and a control's
 * margins, and the only space this banner has for it is the 11pt of card
 * padding under the artwork. Nothing fits a control there. Making it fit means
 * a taller banner, and `MINI_PLAYER_HEIGHT` is one box shared with the
 * expanded console's glass footer and the clip-framing row — so the fix would
 * have moved a bar on a different screen.
 *
 * Apple's mini player in Music shows no progress at all: identity and
 * transport, with the position living in the expanded player. That is what
 * this is now, and the expanded player carries a real media scrubber
 * (`MediaScrubberIos`). Podcasts is the other Apple answer — a full-bleed
 * hairline on the bottom EDGE, a seam rather than a control — and it is the
 * shape to reach for if iOS ever wants one back. Not the inset capsule.
 *
 * Android keeps its rule: it is a Material surface, and that is its own
 * bottom rule rather than a control dropped into padding.
 */
export function PlayerSheet() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Android hands back a bottom inset of 0 on some cold starts, resumes and
  // config changes — which would drop the collapsed banner UNDER the
  // navigation bar. Defend on two fronts: fall back to the metrics captured at
  // launch, and latch the largest value seen this session (the inset only
  // grows while the nav bar stays put).
  const launchBottomInset = initialWindowMetrics?.insets.bottom ?? 0;
  const [bottomInset, setBottomInset] = useState(
    Math.max(insets.bottom, launchBottomInset),
  );
  useEffect(() => {
    setBottomInset(current =>
      Math.max(current, insets.bottom, launchBottomInset),
    );
  }, [insets.bottom, launchBottomInset]);
  const { width: winW, height: winH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const current = usePlayerStore(s => s.current);
  const queue = usePlayerStore(s => s.queue);
  const toggle = usePlayerStore(s => s.toggle);
  const nextSound = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const seek = usePlayerStore(s => s.seek);
  const playing = usePlayerStore(s => s.playing);
  /**
   * `position` IS DELIBERATELY NOT READ HERE — see
   * `PlayerScrubberLive`, the two leaves that draw it. The transport ticks it
   * ten times a second; subscribing on this component made the entire sheet
   * (both neighbour covers, every gesture recipe, the whole console tree)
   * re-render at that rate, whether the player was open or a 46pt pill.
   *
   * The handful of places here that genuinely need a playhead READ IT ONCE, at
   * the moment of the action, via `usePlayerStore.getState()` — the swipe's
   * restart test already did. (`duration` left with clip framing: the editor
   * route reads its own.)
   */
  const expandNonce = usePlayerStore(s => s.expandNonce);

  // Geometry (all deterministic — no measuring, no flicker). The expanded art
  // is moderate (~58% width) so the whole console fits without scrolling.
  const miniTotal = MINI_PLAYER_HEIGHT + bannerBottomOffset(bottomInset);
  const travel = winH - miniTotal;
  // The console's box is SHARED with whichever twin renders it — see
  // `chrome.ts`. The sheet may only place the artwork (it is the element that
  // travels), so the two halves of one geometry cannot be derived twice.
  // Height-capped: on a short window the cover gives, never the console's
  // air — see `playerArtFullSize`. On every iPhone here the width wins and
  // this is exactly `playerArtSize(winW)`.
  const artFull = playerArtFullSize(winW, winH, insets.top, bottomInset);
  /**
   * THE COVER'S CORNER IS A RATIO OF THE COVER, not a container constant.
   * This drew `TILE_RADIUS` — the grouped-CARD radius, 26 whatever the box —
   * which was within a point of right while the expanded art was 233 and is
   * plainly wrong now that it is the content box's full width: 26 on 370 is
   * 0.070 of it, against the term's 0.15. `artworkRadius` exists for exactly
   * this drift and the player was the one caller that never adopted it.
   */
  const artFullRadius = playerArtRadius(artFull, TILE_RADIUS);
  const artExpandedX = (winW - artFull) / 2;
  const artExpandedY = playerArtTop(insets.top);
  const artScaleMin = MINI_ART_SIZE / artFull;
  const contentTop = playerConsoleTop(artExpandedY, artFull);

  const progress = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // The React side of opening or closing: the state the rest of the screen
  // reads, mirrored so screens' back handlers can yield to the sheet's.
  const markExpanded = useCallback((open: boolean) => {
    setExpanded(open);
    usePlayerStore.getState().setSheetExpanded(open);
  }, []);

  // `velocity` is the release speed in PROGRESS units per second — the drags
  // hand it over so the settle continues the finger's own motion instead of
  // restarting from rest (see the spring note above). A tap passes nothing
  // and starts from rest exactly as before.
  //
  // A WORKLET, SO A RELEASE STARTS THE SPRING ON THE SAME FRAME (Juan,
  // 2026-10-16: a short drag released felt sticky, a close worst of all).
  // The drags used to hop to JS with `runOnJS(springTo)`, and springTo set
  // React state BEFORE starting the spring — so `progress` sat frozen where
  // the finger left it until JS had re-rendered the whole sheet, then took
  // off. A long drag hid it (little was left to travel); a short one showed
  // the hitch, and a close showed it most because it re-renders the most.
  // The spring now starts on the UI thread and the React state follows.
  const settle = useCallback(
    (target: 0 | 1, velocity = 0) => {
      'worklet';
      progress.value = reduceMotion
        ? // Reduce Motion takes the destination, not a faster spring: the
          // setting asks for no movement, not for brisk movement.
          withTiming(target, { duration: 0 })
        : withSpring(target, {
            ...(target === 1 ? EXPAND_SPRING : COLLAPSE_SPRING),
            velocity,
          });
    },
    [progress, reduceMotion],
  );

  const springTo = useCallback(
    (target: 0 | 1, velocity = 0) => {
      markExpanded(target === 1);
      settle(target, velocity);
    },
    [markExpanded, settle],
  );

  const expand = useCallback(() => springTo(1), [springTo]);

  const collapse = useCallback(() => springTo(0), [springTo]);

  /**
   * IS THE FULL PLAYER ON SCREEN AT ALL — the mount gate for everything that
   * belongs to the expanded console rather than to the banner.
   *
   * Until this existed, the wash, the console and the clips listener were
   * mounted from the moment ANY sound started and merely faded by `progress`.
   * A 46pt pill was therefore paying for a w_640 cover blurred at radius 60
   * across an overscanned full-screen layer, a SwiftUI slider host, the clip
   * handles, the cards, and a Firestore query per sound played — none of it
   * visible, all of it recomposited every frame.
   *
   * IT CANNOT BE `expanded` ALONE, and both failures are real:
   *
   *  - `expanded` flips at the START of the collapse spring, so gating on it
   *    would UNMOUNT the console on frame 0 of closing — it would vanish
   *    instead of fading out under `expandedStyle`.
   *  - A drag up from the banner moves `progress` without touching `expanded`
   *    at all (it is only set on release), so a drag would reveal an empty
   *    sheet and populate it at the end.
   *
   * So the gate is `expanded` OR "progress has left 0", the second half read
   * off the UI thread. `expanded` is what makes a TAP open with the console
   * already mounted (it is set synchronously by `springTo`); the reaction is
   * what keeps it mounted through a drag and through the whole way back down.
   */
  const [offRest, setOffRest] = useState(false);
  useAnimatedReaction(
    () => progress.value > 0,
    (isOff, wasOff) => {
      if (isOff !== wasOff) runOnJS(setOffRest)(isOff);
    },
    [],
  );

  /**
   * THE TRANSPORT ANCHOR'S TRIGGER — see `chrome.ts`. Fired when the expand
   * spring actually SETTLES, never on `expanded` (which flips on frame 0 of
   * the spring — a measurement there would bake the in-flight transform into
   * the anchor). On Android nothing registers a measurer and the call is a
   * no-op.
   */
  useAnimatedReaction(
    () => progress.value >= 0.999,
    (atRest, wasAtRest) => {
      if (atRest && !wasAtRest) runOnJS(measurePlayerTransport)();
    },
    [],
  );

  /**
   * WARM-MOUNTED ON TOUCH-DOWN, so the open animates over a tree that already
   * exists. The gate above decides whether the console is on screen; this
   * decides WHEN its mount commit happens, and the two used to be the same
   * moment — the first frame of a drag, or the tap itself — which put a large
   * React commit (several SwiftUI hosts, the glass footer, the blurred
   * backdrop) in direct contention with the spring's own per-frame ShadowTree
   * commits. That contention was the stutter at the start of every open,
   * recorded on hardware as well as the simulator.
   *
   * A finger lands ~100ms before it lifts or drags far enough to move
   * `progress`, and nothing is animating during that window — so the mount is
   * moved there. `onBegin` fires on touch-down for the drag path, `onPressIn`
   * covers the tap path, and both feed one timer: a touch that never opens the
   * player cools back down after `WARM_COOL_MS`, so a play/pause tap does not
   * leave the console mounted for good and the standing-cost decision the gate
   * documents still holds.
   *
   * The same timer is what UNMOUNTS the console after a collapse — `offRest`
   * flips false on the settle frame, and tearing the tree down right there put
   * the teardown commit on the landing. Cooling through the timer instead
   * moves it well past anything moving.
   */
  const [warm, setWarm] = useState(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmUp = useCallback(() => {
    if (coolTimer.current) {
      clearTimeout(coolTimer.current);
      coolTimer.current = null;
    }
    setWarm(true);
  }, []);
  const cool = useCallback(() => {
    if (coolTimer.current) clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => {
      coolTimer.current = null;
      if (!expandedRef.current) setWarm(false);
    }, WARM_COOL_MS);
  }, []);
  useEffect(
    () => () => {
      if (coolTimer.current) clearTimeout(coolTimer.current);
    },
    [],
  );
  // A collapse that has settled starts the cool-down; while expanded the timer
  // is irrelevant (the gate below is true on its own).
  useEffect(() => {
    if (!expanded && !offRest) cool();
    else warmUp();
  }, [expanded, offRest, cool, warmUp]);

  const playerMounted = expanded || offRest || warm;

  /**
   * A surface asked for the full player (tapping a sound tile).
   *
   * ONE MOTION, ALWAYS: `progress` 0 → 1, which `containerStyle` turns into a
   * rise from the banner's resting place to the full window. It does not matter
   * whether the banner was already up or the sheet is mounting for the first
   * time — the same animation opens it either way, and there is exactly one
   * thing driving translateY.
   *
   * IT USED TO SPECIAL-CASE THE FIRST OPEN and that was the "flick". On a cold
   * start nothing is loaded, so tapping a tile mounts this sheet AND asks it to
   * open; the old code jumped `progress` straight to 1 and left the container's
   * `entering={SlideInDown}` to play the opening, per a comment reasoning that
   * "the container's own slide-in IS the open animation". Two things drive
   * translateY under that plan — the layout animation and `containerStyle` —
   * and the view paints once at its FINAL position before the layout animation
   * takes it. Recorded at 60fps on a cold launch and stepped frame by frame,
   * the first open ran: banner visible → banner gone (2 frames) → the whole
   * expanded player flashed fully formed for ONE frame → gone again for 4 →
   * then it finally slid up. About 67ms of wrongness, which is why it reads as
   * a flick rather than as a glitch you can point at.
   *
   * `isExpandingMount` is what lets this be one motion: a mount that is already
   * being asked to open skips the slide-in entirely, so `progress` owns the
   * whole thing. The sheet paints one frame at the banner's position — its
   * genuine starting state — and animates from there.
   */
  const lastExpandNonce = useRef(expandNonce);
  const hadCurrentRef = useRef(current !== null);
  /**
   * Read during render, deliberately: `entering` is only consulted on the frame
   * the container mounts, which is this one. Both refs still hold their
   * pre-effect values here, which is exactly what makes the test work.
   */
  const isExpandingMount =
    !hadCurrentRef.current &&
    current !== null &&
    expandNonce !== lastExpandNonce.current;

  useEffect(() => {
    hadCurrentRef.current = current !== null;

    if (expandNonce === lastExpandNonce.current) return;
    lastExpandNonce.current = expandNonce;
    if (!current) return;

    springTo(1);
  }, [expandNonce, current, springTo]);

  // Android back collapses the player instead of popping the screen under it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!expandedRef.current) return false;

        springTo(0);
        return true;
      },
    );

    return () => subscription.remove();
  }, [springTo]);

  // Sign-out / queue cleared while open: drop back to nothing.
  useEffect(() => {
    if (!current && expandedRef.current) {
      progress.value = 0;
      setExpanded(false);
    }
  }, [current, progress]);

  // Drag the banner up to expand. `onBegin` fires on touch-down — before the
  // pan activates, before anything animates — which is what lets the console
  // warm-mount during the finger's own dead time (see `warmUp`). `onFinalize`
  // starts the cool-down for a touch that never opened the player.
  const dragUp = Gesture.Pan()
    .enabled(!expanded)
    .activeOffsetY([-12, 12])
    .onBegin(() => {
      runOnJS(warmUp)();
    })
    .onFinalize(() => {
      runOnJS(cool)();
    })
    .onUpdate(event => {
      progress.value = Math.min(Math.max(-event.translationY / travel, 0), 1);
    })
    .onEnd(event => {
      const commit =
        progress.value > SNAP_PROGRESS || event.velocityY < -SNAP_VELOCITY;
      // The finger's speed, in progress units — the settle continues it,
      // starting on this frame; React catches up after (see `settle`).
      settle(commit ? 1 : 0, -event.velocityY / travel);
      runOnJS(markExpanded)(commit);
    });

  // Drag down anywhere above the scrubber (chevron row, artwork, title) to
  // collapse. A gesture instance can only attach once, so each region gets
  // its own from the same recipe.
  const makeDragDown = () =>
    Gesture.Pan()
      .enabled(expanded)
      .activeOffsetY([-12, 12])
      .onUpdate(event => {
        progress.value =
          1 - Math.min(Math.max(event.translationY / travel, 0), 1);
      })
      .onEnd(event => {
        const commit =
          progress.value < 1 - SNAP_PROGRESS || event.velocityY > SNAP_VELOCITY;
        // The finger's speed, in progress units — the settle continues it,
        // starting on this frame; React catches up after (see `settle`).
        settle(commit ? 0 : 1, -event.velocityY / travel);
        runOnJS(markExpanded)(!commit);
      });
  const dragDown = makeDragDown();
  const dragDownTop = makeDragDown();
  const dragDownTitle = makeDragDown();

  // Swipe the art or the title sideways to change sound — the idiom every music
  // app uses, so the expanded player stops depending on the two small transport
  // buttons. Left goes forward, matching a carousel: the next sound comes in from
  // the right. Skipping wraps, so both directions always lead somewhere.
  const swipeX = useSharedValue(0);

  // The neighbours sit one screen-width away on either side, mounted and painted
  // while the player is open. That is the whole trick: paging one in is a
  // transform on an image that is ALREADY decoded, so it appears immediately
  // instead of after the store swap and a fresh decode.
  const readNeighbours = useCallback(() => {
    const { current: playing, queue: sounds } = usePlayerStore.getState();
    if (!playing || sounds.length < 2) return { previous: null, next: null };

    const index = sounds.findIndex(sound => sound.id === playing.id);
    if (index < 0) return { previous: null, next: null };

    return {
      previous: sounds[(index - 1 + sounds.length) % sounds.length] ?? null,
      next: sounds[(index + 1) % sounds.length] ?? null,
    };
  }, []);

  // Held in state, NOT derived per render: the frame that commits a skip must
  // still show the pair we paged with. Refreshing them in that same frame drops
  // the NEW next-sound into the centre slot (the pager is still offset by a
  // screen width), which flashes a third sound's title for a frame or two.
  const [neighbours, setNeighbours] = useState(readNeighbours);

  /**
   * Warm the wash for whatever is loaded, so opening the player is a decode
   * rather than a fetch. See `prefetchPlayerBackdrop`.
   *
   * AND FOR BOTH NEIGHBOURS, which is the half this was missing. Their COVERS
   * are already mounted and painted off-screen precisely so paging one in is a
   * transform on an image that is ALREADY decoded — but the wash under them was
   * never given the same treatment, so a skip left the 420ms crossfade covering
   * a cold network fetch instead of a decode, on the layer that tints the whole
   * screen.
   *
   * It costs less than it looks. Stepping forward, the new current and the new
   * previous are both already in the cache from the last time this ran, so the
   * steady state is one new fetch per skip exactly as before — just taken one
   * sound earlier. Only entering a queue pays the extra two.
   *
   * Not gated on `expanded`: the banner carries its own previous/next transport,
   * so a skip can happen collapsed and the player can be opened straight onto
   * the result. That is the same "fetch early, render late" argument the current
   * sound's prefetch already makes.
   */
  const currentArtUrl = current?.artUrl;
  const previousArtUrl = neighbours.previous?.artUrl;
  const nextArtUrl = neighbours.next?.artUrl;
  useEffect(() => {
    prefetchPlayerBackdrop(currentArtUrl || undefined);
    prefetchPlayerBackdrop(previousArtUrl || undefined);
    prefetchPlayerBackdrop(nextArtUrl || undefined);
  }, [currentArtUrl, nextArtUrl, previousArtUrl]);

  // Snaps the pager back to centre. Called once the sound has actually changed:
  // the incoming cover is already sitting in the artwork slot, and the real
  // artwork element now holds the same image, so this handoff is invisible.
  const recentre = useCallback(() => {
    swipeX.value = 0;
  }, [swipeX]);

  const settleBack = useCallback(() => {
    swipeX.value = withSpring(0, SETTLE_SPRING);
  }, [swipeX]);

  // Set while a page is in flight and waiting on the sound to change.
  const pendingRecentreRef = useRef(false);

  const skip = useCallback(
    (direction: 1 | -1) => {
      const before = usePlayerStore.getState().current?.id;
      if (direction === -1) nextSound();
      else previous();

      if (usePlayerStore.getState().current?.id === before) {
        // Nothing re-renders, so nothing would ever recentre us.
        recentre();
        return;
      }

      pendingRecentreRef.current = true;
    },
    [nextSound, previous, recentre],
  );

  // Decided on the JS thread because it reads live transport state.
  const onSwipeRelease = useCallback(
    (direction: 1 | -1, commit: boolean) => {
      if (!commit) {
        settleBack();
        return;
      }

      const { position } = usePlayerStore.getState();
      // `previous()` restarts the sound when deep into it, and a lone sound wraps
      // to itself — in both cases no neighbour arrives, so paging one in would
      // be a lie. Settle back and let the action speak.
      const staysPut =
        queue.length < 2 || (direction === 1 && position > RESTART_THRESHOLD_S);

      if (staysPut) {
        settleBack();
        if (direction === -1) nextSound();
        else previous();
        return;
      }

      // Carry the current cover out and the neighbour in, together. Nothing
      // fades: both covers are real, so this is just a slide.
      swipeX.value = withTiming(
        direction * winW,
        { duration: PAGE_MS, easing: Easing.out(Easing.cubic) },
        finished => {
          if (finished) runOnJS(skip)(direction);
        },
      );
    },
    [nextSound, previous, queue.length, settleBack, skip, swipeX, winW],
  );

  useEffect(() => {
    if (!pendingRecentreRef.current) {
      setNeighbours(readNeighbours());
      return;
    }

    pendingRecentreRef.current = false;
    recentre();

    // `recentre` writes a SHARED VALUE, which lands on the next UI frame, but
    // this render commits right away. Swapping the pair now would mount the
    // sound AFTER the one just swiped to at the pager's still-offset centre —
    // the ghost title. Let the recentre reach the screen first.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setNeighbours(readNeighbours()));
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [current?.id, queue, readNeighbours, recentre]);

  // Same one-instance-per-region rule as the drag-down recipe above.
  const makeSkipSwipe = () =>
    Gesture.Pan()
      .enabled(expanded)
      .activeOffsetX([-SKIP_ACTIVATE_X, SKIP_ACTIVATE_X])
      .failOffsetY([-SKIP_FAIL_Y, SKIP_FAIL_Y])
      .onUpdate(event => {
        swipeX.value = event.translationX;
      })
      .onEnd(event => {
        const direction: 1 | -1 = event.translationX < 0 ? -1 : 1;
        const commit =
          Math.abs(event.translationX) > SKIP_DISTANCE ||
          Math.abs(event.velocityX) > SKIP_VELOCITY;

        if (reduceMotion) {
          swipeX.value = 0;
          if (commit) runOnJS(skip)(direction);
          return;
        }

        runOnJS(onSwipeRelease)(direction, commit);
      });
  const skipSwipeArt = makeSkipSwipe();
  const skipSwipeTitle = makeSkipSwipe();
  const skipSwipeTop = makeSkipSwipe();

  // Whichever axis crosses its threshold first wins; the loser is cancelled, so
  // a diagonal drag never both skips and collapses.
  const artGesture = Gesture.Race(skipSwipeArt, dragDown);
  const titleGesture = Gesture.Race(skipSwipeTitle, dragDownTitle);
  // The full-width band above the console (header row, gutters beside the art)
  // skips too, so the swipe target is the whole top of the sheet rather than
  // just the artwork square.
  const topGesture = Gesture.Race(skipSwipeTop, dragDownTop);

  // The artwork itself never fades now — the neighbour paging in IS the
  // transition, and fading would only hide the thing we want seen sooner.
  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  // --- Animated styles -----------------------------------------------------
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));

  // Computed here, not in the worklet: `withAlpha` is plain JS and cannot be
  // called on the UI runtime.
  const glassFillStart = withAlpha(colors.surfaceContainer, BANNER_GLASS_FLOOR);

  // THE detach: the painted surface is a layer inside the container, not the
  // container's own background, so it can be a pill at one end and the whole
  // window at the other. Everything here resolves to the pill's box at p = 0
  // and to a full-bleed, square-cornered, unlifted surface at p = 1.
  const surfaceStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // The morph itself HAS to animate layout (height and the two insets close
    // as the pill becomes the window), and on Fabric each of those writes is a
    // ShadowTree commit per frame. So nothing rides along that does not need
    // to: iOS's chrome is CONSTANT — no border, no elevation, per the edge
    // rule above — and writing `borderWidth: 0` every frame was buying an
    // extra layout commit for a value that never changes.
    if (Platform.OS === 'ios') {
      return {
        // Same hue throughout, only the alpha moves: the glass carries the
        // banner's surface at rest, and the opaque player takes over.
        backgroundColor: interpolateColor(
          p,
          [0, BANNER_GLASS_FADE],
          [glassFillStart, colors.background],
        ),
        borderRadius: BANNER_RADIUS * (1 - p),
        height: MINI_PLAYER_HEIGHT + (winH - MINI_PLAYER_HEIGHT) * p,
        left: BANNER_SIDE_INSET * (1 - p),
        right: BANNER_SIDE_INSET * (1 - p),
      };
    }

    // The floating-object chrome (outline, lift) goes early — by the time the
    // sheet reads as a screen there is nothing left for it to float above.
    const chrome = 1 - Math.min(p / BANNER_CHROME_FADE, 1);

    return {
      backgroundColor: interpolateColor(
        p,
        [0, BANNER_CHROME_FADE],
        [colors.surfaceContainer, colors.background],
      ),
      borderRadius: BANNER_RADIUS * (1 - p),
      elevation: BANNER_ELEVATION * chrome,
      height: MINI_PLAYER_HEIGHT + (winH - MINI_PLAYER_HEIGHT) * p,
      left: BANNER_SIDE_INSET * (1 - p),
      right: BANNER_SIDE_INSET * (1 - p),
    };
  });

  // THE COVER NO LONGER SHRINKS WHILE PAUSED (Juan, 2026-08-25). It used to
  // drop to 0.88 — iOS's own now-playing idiom, and the one piece of state
  // you could read without looking at a control — but on this console, where
  // the cover is the full width of the content box, a 44pt breath in and out
  // on every pause is movement the screen does not want. The transport says
  // the same thing without moving anything.
  //
  // What went with it: `PAUSED_ART_SCALE` (0.88, chosen over 0.94 as a
  // rendering wobble and 0.82 as a hole under the bar row) and its critically
  // damped spring. Restoring it is that constant, a shared value driven off
  // `playing`, and one more factor in `artStyle` below.

  const artStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = artScaleMin + (1 - artScaleMin) * p;
    // Centers travel from the mini thumb to the expanded slot.
    const fromCx = MINI_ART_X + MINI_ART_SIZE / 2;
    const fromCy = MINI_ART_Y + MINI_ART_SIZE / 2;
    const toCx = artExpandedX + artFull / 2;
    const toCy = artExpandedY + artFull / 2;

    // Counter-scale the corner so the rendered radius lands on the values
    // above instead of shrinking with the artwork.
    const renderedRadius =
      MINI_ART_RADIUS + (artFullRadius - MINI_ART_RADIUS) * p;

    return {
      borderRadius: renderedRadius / scale,
      transform: [
        // The skip swipe rides on top of the expand travel. Only reachable at
        // p = 1 (scale 1), so it needs no counter-scaling.
        { translateX: (fromCx - toCx) * (1 - p) + swipeX.value },
        { translateY: (fromCy - toCy) * (1 - p) },
        { scale },
      ],
    };
  });

  const miniRowStyle = useAnimatedStyle(() => ({
    // Gone quickly so it never ghosts over the expanded chrome.
    opacity: Math.max(0, 1 - progress.value * 3),
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [CONSOLE_FADE_START, CONSOLE_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BACKDROP_FADE_START, BACKDROP_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // The progress bar is flush with the banner's bottom edge, so it has to be
  // masked by the banner's own corner — otherwise its square ends poke out past
  // the curve. This clip is a SIBLING of the surface with a static box, which
  // is what lets its child anchor to the bottom at all; only the corner (not a
  // layout prop) animates, and the whole thing is gone well before the surface
  // has finished squaring off.
  // The progress bar belongs to the SETTLED banner and to nothing else. Its
  // mask is the banner's collapsed box — fixed corners, fixed insets — while
  // the surface behind it is growing, so any frame where both are visible
  // shows a line still cut to a shape the surface has already left. It is
  // gone within the first breath of the movement instead of fading across a
  // third of it, which is also how it reads: the bar is part of the banner,
  // so it leaves WITH the banner rather than dissolving inside the player.
  // Rides the surface's bottom edge exactly as the progress bar does, so the
  // material never floats inside a surface that has grown past it.
  const bannerGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, BANNER_GLASS_FADE],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateY: (winH - MINI_PLAYER_HEIGHT) * progress.value }],
  }));

  // -------------------------------------------------------------------------

  // The bottom sheets + the title overflow menu.
  const [shaperVisible, setShaperVisible] = useState(false);

  // Framing-on-the-scrubber is GONE on BOTH platforms — a clip is made in
  // the dedicated Voice Memos-style editor (`clip-trim`), which the Clips
  // sheet pushes.
  const [clipsVisible, setClipsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  /**
   * THE CLIPS LISTENER FOLLOWS THE CONSOLE, NOT THE SOUND.
   *
   * It used to take `current?.id` outright, so a Firestore query attached the
   * moment ANY sound started — skip through twenty tracks and that is twenty
   * listener attaches for a subcollection nothing on screen was reading. Clips
   * are drawn in exactly two places, and both live inside the expanded
   * console: the Clips card's count, and the trim brackets while framing.
   *
   * The store deliberately keeps what it has fetched (see the hook), so
   * re-opening a sound you have already looked at still shows its clips on the
   * first frame — the cache is what makes gating cost nothing.
   */
  // NOT `playerMounted`: a warm mount is a touch on the banner, and a
  // play/pause tap must not attach a Firestore listener. The listener follows
  // the console being genuinely on screen, exactly as before the warm gate
  // existed; while merely warm, the cards read the store's cache.
  useClipsSubscription(expanded || offRest ? current?.id : undefined);
  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  // Nothing loaded yet: the banner still holds its place (YT Music keeps it
  // parked), primed with the first sound — or saying the library is empty.
  // Card summaries: live settings at a glance. ONE summary, two surfaces —
  // the clip editor's route reads the same hook. IT MUST SIT ABOVE THE EARLY
  // RETURN BELOW: as an inline expression the summary cost no hooks and could
  // live with the cards, but the extraction gave it four, and computing it
  // after `return <IdleBanner/>` threw "Rendered more hooks than during the
  // previous render" on the exact transition a cold launch performs — idle
  // first, then the persisted sound lands (found on sim, 2026-08-26).
  const shapeSummary = useShapeSummary();

  if (!current) return <IdleBanner bottomInset={bottomInset} />;

  // Icon buttons signal presses with their RIPPLE, never vibration.
  const onToggle = toggle;
  const onNext = nextSound;
  const onPrevious = previous;

  const subtitle = current.artist || ' ';

  const clipsSummary =
    clips.length === 0
      ? t('player.clips.noneSummary')
      : t('player.clips.count').replace('{n}', String(clips.length));

  const cards: readonly PlayerCard[] = [
    {
      icon: 'tune',
      key: 'shape',
      label: t('player.shape.title'),
      onPress: () =>
        Platform.OS === 'ios' ? router.push('/shaper') : setShaperVisible(true),
      summary: shapeSummary,
    },
    {
      icon: 'content-cut',
      key: 'clips',
      label: t('player.clips.title'),
      onPress: () =>
        Platform.OS === 'ios' ? router.push('/clips') : setClipsVisible(true),
      summary: clipsSummary,
    },
  ];

  return (
    <>
      <Animated.View
        /**
         * The slide-in is for a banner ARRIVING — a sound started and the pill
         * rises into place. A mount that is already opening skips it, because
         * `progress` is doing that motion itself and two animations on one
         * translateY is what produced the first-open flick (see
         * `isExpandingMount`).
         */
        entering={
          reduceMotion || isExpandingMount
            ? undefined
            : SlideInDown.duration(220)
        }
        style={[styles.container, { height: winH }, containerStyle]}
      >
        {/* THE surface: a pill at rest, the whole window when open. It is
            PAINT ONLY — nothing renders inside it. Its height is animated, and
            an animated layout prop moves the native view without re-laying out
            its children, so a child anchored to its bottom edge lands at the
            top instead. Every layer below is therefore a sibling, positioned
            against the container, whose height never changes. */}
        {/* THE TONAL FLOOR GOES UNDER THE GLASS, and the order is the whole
            difference between this reading as glass and reading as a tinted
            slab. Painted OVER the material — which is where it was — it veils
            the specular rim and the refraction that make Liquid Glass look
            like glass at all, while leaving the average fill untouched: the
            banner measured L* 14.3 against the toast's 14.3 in dark and still
            looked flatter beside it, which is exactly what an even veil over
            the highlights does. Juan called it by eye before the numbers had
            anything to say (2026-08-20).

            Underneath, the same colour is something the material REFRACTS
            rather than something drawn on top of it — which is what the
            snackbar and the trophy banner do through `GlassSurfaceIos`, and
            why those two read glassier. */}
        <Animated.View
          style={[styles.surface, surfaceStyle]}
          pointerEvents="none"
        >
          {/* THE ARTWORK WASH LIVES INSIDE THE SURFACE (2026-10-16), so the
              surface's own animated box and corner clip it — no second layer
              animating the same height, insets and radius beside it. That
              twin cost a second layout commit and a second rounded clip of a
              blurred image on every frame, and the drag read as sticky.
              It tracks the drag directly, so it grows in with the surface
              instead of popping at the settle. MOUNTED ONLY WHILE THE PLAYER
              IS ON SCREEN — see `playerMounted`: a collapsed banner does not
              pay for it, and since `usePlayerStore`'s current sound prefetches
              this exact transform, mounting it at a drag's first frame is a
              decode, not a fetch. Window-sized and fixed, so the growing clip
              uncovers it rather than re-fitting it every frame. */}
          {playerMounted ? (
            <Animated.View
              style={[{ height: winH, width: winW }, backdropStyle]}
            >
              <PlayerBackdrop artUrl={current.artUrl || undefined} />
            </Animated.View>
          ) : null}
        </Animated.View>

        {BANNER_GLASS ? (
          <Animated.View
            style={[styles.bannerGlass, bannerGlassStyle]}
            pointerEvents="none"
          >
            <BannerGlassIos
              width={winW - BANNER_SIDE_INSET * 2}
              height={MINI_PLAYER_HEIGHT}
              radius={BANNER_RADIUS}
            />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={dragUp}>
          <Animated.View
            style={[styles.miniRow, styles.miniRowInset, miniRowStyle]}
            pointerEvents={expanded ? 'none' : 'auto'}
          >
            <Pressable
              style={styles.miniBody}
              onPress={expand}
              accessibilityRole="button"
              accessibilityLabel={t('player.title')}
            >
              <View style={styles.miniInfo}>
                <AppText
                  doNotTranslate
                  text={current.name}
                  variant="bodyLarge"
                  numberOfLines={1}
                  style={styles.miniTitle}
                />
                {/* SUBHEADLINE, not Footnote. The same two facts — a sound's
                    name and its artist — are typeset three times in this app,
                    and this was the only one that stepped down two rungs: the
                    home tile pairs Body with Subheadline (17/15) and so does
                    the EXPANDED console a few hundred lines below, while the
                    banner paired Body with Footnote (17/13). Apple pairs Body
                    with Subheadline; the odd one out was here. */}
                <AppText
                  doNotTranslate
                  muted
                  text={subtitle}
                  variant="bodyMedium"
                  numberOfLines={1}
                />
              </View>
            </Pressable>
            {/* Skipping wraps, so previous always leads somewhere — the
                banner never drops a control depending on queue position. */}
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={onPrevious}
              style={styles.miniButton}
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={onToggle}
              style={styles.miniButton}
              accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
            >
              {playing ? (
                <PauseGlyph color={colors.onSurface} />
              ) : (
                <PlayGlyph color={colors.onSurface} />
              )}
            </GlyphButton>
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={onNext}
              style={styles.miniButton}
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} />
            </GlyphButton>
          </Animated.View>
        </GestureDetector>

        {/* MOUNTED ONLY WHILE THE PLAYER IS ON SCREEN — see `playerMounted`.
            This is the whole expanded screen: the title, the SwiftUI slider
            host, the clip handles, the transport and the cards. It used to be
            mounted from the moment any sound started and merely faded to zero
            opacity, so a 46pt banner kept a second full screen alive behind
            it. `expandedStyle` still owns the fade — the gate only decides
            whether there is anything to fade. */}
        {playerMounted ? (
          <PlayerConsole
            cards={cards}
            consoleStyle={expandedStyle}
            contentTop={contentTop}
            expanded={expanded}
            neighbours={neighbours}
            onCollapse={collapse}
            onEdit={() =>
              Platform.OS === 'ios'
                ? router.push({
                    pathname: '/edit-sound',
                    params: { soundId: current.id },
                  })
                : setEditVisible(true)
            }
            onNext={onNext}
            onPrevious={onPrevious}
            // The playhead and the drag-local value both live in
            // `PlayerScrubberLive` now; the console needs no time-varying prop
            // at all, only somewhere to commit a scrub to. seek() also ends
            // any clip replay.
            onSeek={seek}
            onToggle={onToggle}
            pagerStyle={pagerStyle}
            playing={playing}
            subtitle={subtitle}
            title={current.name}
            titleGesture={titleGesture}
            topGesture={topGesture}
            winW={winW}
          />
        ) : null}

        {/* THE shared artwork — one element across both states, so the
            transition can't pop or resize discontinuously. Drag it down to
            collapse when expanded. */}
        {/* The neighbours' covers, parked one screen-width out on each side.
            Mounted whenever the player is open so their bitmaps are decoded
            BEFORE any swipe — paging one in then costs nothing. */}
        {expanded
          ? (
              [
                { sound: neighbours.previous, side: -1 },
                { sound: neighbours.next, side: 1 },
              ] as const
            ).map(({ sound, side }) =>
              sound ? (
                <Animated.View
                  key={`${side}:${sound.id}`}
                  pointerEvents="none"
                  style={[
                    styles.art,
                    CONTINUOUS_CURVE,
                    {
                      borderRadius: artFullRadius,
                      height: artFull,
                      left: artExpandedX + side * winW,
                      top: artExpandedY,
                      width: artFull,
                    },
                    pagerStyle,
                  ]}
                >
                  <SoundArt
                    artUrl={sound.artUrl || undefined}
                    size={artFull}
                    displayWidth={artFull}
                    title={sound.name}
                    fadeMs={0}
                    style={styles.artMedia}
                  />
                </Animated.View>
              ) : null,
            )
          : null}

        <GestureDetector gesture={artGesture}>
          <Animated.View
            /**
             * TRANSPARENT TO TOUCH WHILE COLLAPSED. This layer is drawn LAST so
             * the shared artwork rides above every other layer as it travels,
             * which also means it sits on top of the mini row and hit-tests
             * first. Both of its gestures are `.enabled(expanded)`, so on the
             * banner it swallowed the tap and then did nothing with it: the
             * cover was the one part of the banner that would not open the
             * player. `miniBody` already spans the full width underneath —
             * its `paddingLeft` clears the art visually, not for touch — so
             * letting the tap fall through is the whole fix.
             */
            pointerEvents={expanded ? 'auto' : 'none'}
            style={[
              styles.art,
              {
                height: artFull,
                left: artExpandedX,
                top: artExpandedY,
                width: artFull,
              },
              artStyle,
            ]}
          >
            <SoundArt
              artUrl={current.artUrl || undefined}
              size={artFull}
              // A DISPLAY-SIZED VARIANT, not the stored original. Three covers
              // at this size are live while the player is open — the hero and
              // both parked neighbours — and each was fetching and decoding the
              // full asset. `thumbUrl` doubles for density, so this is still
              // sharper than the panel it fills.
              displayWidth={artFull}
              title={current.name}
              // The skip swipe fades this element itself; an inner dissolve on
              // top of it just delays the new cover by its own duration.
              fadeMs={0}
              style={styles.artMedia}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {shaperVisible && <ShaperSheet onClose={() => setShaperVisible(false)} />}
      {/* ONE SHEET FOR BOTH CLIP SURFACES — the list and the editor are two
          MODES of it, so nothing closes as the other opens. It used to take
          `onNewClip` / `onEditClip` and hand the editor back here as a second
          sheet; see `ClipsSheet` for why that had to go. */}
      {clipsVisible && <ClipsSheet onClose={() => setClipsVisible(false)} />}
      {editVisible && (
        <EditSoundSheet
          soundId={current.id}
          onClose={() => setEditVisible(false)}
        />
      )}
    </>
  );
}

type IdleBannerProps = {
  bottomInset: number;
};

/**
 * The banner with nothing loaded. It keeps its place so the bottom of the app
 * never jumps, and it is primed with the first sound in the library — press
 * play and it starts, exactly like YT Music's parked bar. With an empty
 * library it just says so and stays inert: expanding needs a sound's info to
 * animate from, and there isn't one.
 */
function IdleBanner({ bottomInset }: IdleBannerProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width: winW } = useWindowDimensions();
  const sounds = useSoundsStore(s => s.sounds);
  const hasSettled = useSoundsStore(s => s.hasSettled);
  const loadFailed = useSoundsStore(s => s.error !== null);
  const playSound = usePlayerStore(s => s.playSound);
  const requestExpand = usePlayerStore(s => s.requestExpand);

  // Same order the home grid shows, so "the first one" means what it looks
  // like it means.
  const ordered = sounds;
  const first = ordered[0] ?? null;
  /**
   * "NO SOUNDS YET" IS AN ANSWER, so it waits for the question to be answered
   * (2026-10-16). Before the library's first snapshot — a cold start while
   * Firestore's cache replays — and after a failed load, an empty `sounds`
   * says nothing about the library, and the banner used to say it was empty
   * anyway. It stands as its bare glass box instead: no art, no words, no
   * control. Not a bone, because the box's contents differ by answer (art
   * and two lines, or two lines alone) and a bone promises a shape. Home's
   * grid already waits on `hasSettled`; this was the one surface that didn't.
   */
  const isEmpty = !first && hasSettled && !loadFailed;

  // Parked on the first sound, so skipping behaves exactly as it would once
  // something is loaded: next steps forward, previous wraps to the last.
  const startAt = (sound: (typeof ordered)[number] | undefined) => {
    if (!sound) return;

    playSound(sound, ordered);
    requestExpand();
  };
  const start = () => startAt(first);

  return (
    <View
      style={[
        styles.idleBanner,
        {
          // Transparent under the glass, which paints this banner's surface
          // for it — the parked banner is the same object as the loaded one
          // and must not be the one solid slab on the screen.
          backgroundColor: BANNER_GLASS
            ? withAlpha(colors.surfaceContainer, BANNER_GLASS_FLOOR)
            : colors.surfaceContainer,
          // The same floating island the loaded banner resolves to — parked,
          // so it needs none of the animation, only the shape.
          bottom: bannerBottomOffset(bottomInset),
        },
      ]}
    >
      {BANNER_GLASS ? (
        <BannerGlassIos
          width={winW - BANNER_SIDE_INSET * 2}
          height={MINI_PLAYER_HEIGHT}
          radius={BANNER_RADIUS}
        />
      ) : null}
      <Pressable
        style={styles.miniRow}
        onPress={start}
        disabled={!first}
        // Empty, the banner is a statement rather than a control: read as
        // text, with its second line as the hint, instead of as a dimmed
        // button whose hint VoiceOver never reached. Unanswered, it says
        // nothing at all, to VoiceOver either.
        accessible={Boolean(first) || isEmpty}
        accessibilityRole={first ? 'button' : 'text'}
        accessibilityLabel={
          first ? first.name : isEmpty ? t('player.empty') : undefined
        }
        accessibilityHint={isEmpty ? t('player.emptyHint') : undefined}
      >
        {/* AN EMPTY LIBRARY SHOWS NO ART (Juan, 2026-10-16): with no sound
            to stand for, the placeholder fell back to a "?" — a question the
            banner was asking the person. The words alone say it. */}
        {first ? (
          <View style={styles.idleArt}>
            <SoundArt
              artUrl={first.artUrl || undefined}
              size={MINI_ART_SIZE}
              // A DISPLAY-SIZED VARIANT, for the same reason the hero above
              // takes one — and this slot is 46pt, so the stored original was
              // the most oversized fetch in the app. It is also the first thing
              // a cold start with a library pays for: this banner stands parked
              // on the newest sound before anything has been played.
              displayWidth={MINI_ART_SIZE}
              title={first.name}
              // Same corner the loaded banner's thumb renders at.
              style={[styles.artMedia, { borderRadius: MINI_ART_RADIUS }]}
            />
          </View>
        ) : null}
        <View style={[styles.idleInfo, !first && styles.idleInfoEmpty]}>
          {first ? (
            <>
              <AppText
                doNotTranslate
                text={first.name}
                variant="bodyLarge"
                numberOfLines={1}
                style={styles.miniTitle}
              />
              {/* SUBHEADLINE, like the loaded banner — the idle banner IS
                  that banner, parked, so the two cannot typeset one sound's
                  name and artist differently. It paired Body with Footnote
                  (17/13) and was left behind when the loaded row was stepped
                  to 17/15 for being the app's one odd pair. */}
              <AppText
                doNotTranslate
                muted
                text={first.artist || ' '}
                variant="bodyMedium"
                numberOfLines={1}
              />
            </>
          ) : isEmpty ? (
            // The loaded banner's two lines, so the parked pill keeps its
            // typesetting: the state as the title, what to do under it.
            <>
              <AppText
                doNotTranslate
                text={t('player.empty')}
                variant="bodyLarge"
                numberOfLines={1}
                style={styles.miniTitle}
              />
              <AppText
                doNotTranslate
                muted
                text={t('player.emptyHint')}
                variant="bodyMedium"
                numberOfLines={1}
              />
            </>
          ) : null}
        </View>
        {first ? (
          <>
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={() => startAt(ordered[ordered.length - 1])}
              style={styles.miniButton}
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={start}
              style={styles.miniButton}
              accessibilityLabel={t('player.play')}
            >
              <PlayGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
              hitSlop={MINI_BUTTON_HIT_SLOP}
              onPress={() => startAt(ordered[1] ?? first)}
              style={styles.miniButton}
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} />
            </GlyphButton>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The parked banner IS the pill the loaded one animates from, so it is built
  // once here and never moves. `bottom` comes from the safe-area inset.
  idleBanner: {
    borderRadius: BANNER_RADIUS,
    elevation: BANNER_ELEVATION,
    left: BANNER_SIDE_INSET,
    position: 'absolute',
    right: BANNER_SIDE_INSET,
    ...CONTINUOUS_CURVE,
  },
  idleArt: {
    height: MINI_ART_SIZE,
    marginLeft: BANNER_INSET,
    width: MINI_ART_SIZE,
  },
  // No art beside the words, so they stand off the pill's curved end by two
  // of its insets instead of one.
  idleInfoEmpty: {
    paddingLeft: BANNER_INSET * 2,
  },
  idleInfo: {
    flex: 1,
    gap: MINI_COPY_GAP,
    paddingLeft: BANNER_INSET,
    // The idle banner IS the loaded one, parked — it truncates the same names
    // against the same controls and cannot crowd them differently.
    paddingRight: MINI_COPY_TRAILING_GAP,
  },
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // Anchored to the container's top — the pill's own top edge — and grown
  // downward by the animated height.
  // Clips the artwork wash inside it to the pill's corners as it grows.
  surface: {
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    ...CONTINUOUS_CURVE,
  },
  // Positioned from the container's TOP — which is the pill's top — because
  // the surface's animated height is not a layout its children can key off.
  // The banner's box, as a mask. Static — an animated layout prop moves the
  // native view without re-laying out its children, and the track inside is
  // anchored to the bottom of exactly this box.
  // The banner's box, holding the glass. Static like the progress mask, and
  // moved by transform for the same reason.
  bannerGlass: {
    height: MINI_PLAYER_HEIGHT,
    left: BANNER_SIDE_INSET,
    position: 'absolute',
    right: BANNER_SIDE_INSET,
    top: 0,
  },
  miniRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: MINI_ROW_HEIGHT,
    paddingRight: MINI_ROW_PADDING_RIGHT,
  },
  // Only the LOADED banner needs this: the idle banner is already inset, being
  // the surface itself rather than a row inside a full-width container.
  miniRowInset: { marginHorizontal: BANNER_SIDE_INSET },
  miniBody: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    // Clears the shared artwork sitting in the banner slot, then the gap
    // between artwork and title — the same inset again.
    paddingLeft: BANNER_INSET + MINI_ART_SIZE + BANNER_INSET,
  },
  // `paddingRight`, not a row `gap`: the buttons must stay flush to the row's
  // own trailing padding, which is solved against the LAST glyph's edge.
  miniInfo: { gap: MINI_COPY_GAP, paddingRight: MINI_COPY_TRAILING_GAP },
  // The banner exists to say WHAT IS PLAYING, so the title is its anchor —
  // weighted like the expanded player's, one step down the scale.
  miniTitle: { fontWeight: '600' },
  miniButton: {
    alignItems: 'center',
    // Full-height, so the touch target spans the whole banner.
    height: MINI_ROW_HEIGHT,
    justifyContent: 'center',
    width: MINI_BUTTON_WIDTH,
  },
  art: { overflow: 'hidden', position: 'absolute', ...CONTINUOUS_CURVE },
  artMedia: { height: '100%', width: '100%' },
});
