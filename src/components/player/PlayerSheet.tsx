import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { withAlpha } from '@portfolio/core';
import {
  FLOATING_COPY_GAP,
  FLOATING_RADIUS,
  GLASS_FLOOR,
} from '@portfolio/mobile-ui';
import { awardTrophy } from '@portfolio/trophies';
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

import { BannerGlass } from '@/components/player/BannerGlass';
import {
  BANNER_SIDE_INSET,
  bannerBottomOffset,
  MINI_PLAYER_HEIGHT,
} from '@/components/player/bannerMetrics';
import {
  playerArtRadius,
  playerArtSize,
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
import { SoundInfoSheet } from '@/components/player/SoundInfoSheet';
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
} from '@/components/player/TransportGlyphs';
import { EditSoundSheet } from '@/components/sounds/EditSoundSheet';
import { SoundArt } from '@/components/ui/SoundArt';
import { Text as AppText } from '@/components/ui/Text';
import { TROPHY_IDS } from '@/constants/trophies';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { rateLabel } from '@/lib/player';
import { createClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { RESTART_THRESHOLD_S, usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useSoundsStore } from '@/store/sounds';
import {
  CONTINUOUS_CURVE,
  HAIRLINE,
  SHAPE_SM,
  TILE_RADIUS,
  innerRadius,
} from '@/styles/shape';

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

// Material's linear progress indicator is 4dp and Apple's accent bars land in
// the same place. A 2pt hairline was legible as a LINE but not as a QUANTITY —
// you could see it was there without being able to read how far in you were.
const PROGRESS_HEIGHT = 4;
// The unplayed remainder, as a tint of the content colour.
const PROGRESS_TRACK_ALPHA = 0.2;
// How far into the expansion the progress bar is gone. Deliberately tiny: its
// mask is the collapsed banner's shape, so it may only be seen while the
// banner still HAS that shape.
const PROGRESS_FADE_END = 0.04;

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

// Transport glyphs are hand-drawn and ~14pt wide, so a 48pt box would push the
// last one nearly 3x further from the edge than the artwork is from the other
// — the single thing that made the banner read as badly spaced. These are
// sized to the GLYPH plus the banner's inset; hitSlop restores the touch
// target (38 + 16 = 54 wide, 68 tall, both past either platform's minimum).
const MINI_GLYPH_WIDTH = 14;
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
// The row's own padding is then whatever gets the glyph there, so changing the
// button box can't quietly move it.
const MINI_ROW_PADDING_RIGHT =
  MINI_TRAILING_GLYPH_INSET - (MINI_BUTTON_WIDTH - MINI_GLYPH_WIDTH) / 2;

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
 * with it in `@portfolio/mobile-ui`.
 *
 * This banner cannot use that component, and the reason is the expansion:
 * `surfaceStyle` interpolates this exact colour to the opaque player background
 * as the banner grows into a screen, so the floor here is an animated layer
 * rather than a static one. It shares the TERM instead — which is the point,
 * since the number is what a person sees.
 */
const BANNER_GLASS_FLOOR = GLASS_FLOOR;

/**
 * The pill's outline — ANDROID ONLY now, and the change is the portfolio's one
 * edge rule rather than this banner's own taste.
 *
 * iOS separates surfaces by EDGE and Android by TONE, and this used to read
 * that as "so iOS draws a hairline". On Liquid Glass it does not: the material
 * draws its OWN edge — a specular rim, plus the +15 luminance step into the
 * gutter this file already measured when it deleted the iOS drop shadow for
 * being twice UIKit's whole treatment. A hairline on top of that is the same
 * mistake one layer over.
 *
 * Every floating glass surface in the portfolio therefore takes the material's
 * own edge and nothing else — no border here, no SwiftUI shadow on the trophy
 * banner, nothing on the snackbar. Android keeps its outline, and its tonal
 * pill with it.
 */
const ANDROID_ONLY_HAIRLINE = Platform.OS === 'ios' ? 0 : HAIRLINE;

// The wash starts appearing only this far into the expansion.
const BACKDROP_FADE_START = 0.8;

/**
 * OPENING AND CLOSING ARE SPRINGS, not eased timings.
 *
 * iOS moves sheets with springs — SwiftUI's own presentation is
 * `.spring(duration:bounce:)` — and a cubic ease-out is the tell that something
 * was hand-animated: it decelerates on a fixed schedule rather than settling.
 * Same durations the timings used, so the pacing is unchanged and only the
 * character moves.
 *
 * CRITICALLY DAMPED, and that is a correctness requirement here rather than
 * taste. `progress` feeds interpolations that are NOT clamped — the surface's
 * `borderRadius: BANNER_RADIUS * (1 - p)` goes negative past 1, its `height`
 * exceeds the window, and `left`/`right` push the container off both edges. A
 * bouncy spring overshoots 1 by construction, so a visible bounce here would
 * not be a flourish, it would be a frame of broken geometry. `dampingRatio: 1`
 * approaches the target monotonically and can never exceed it.
 *
 * The house already had this instinct for the sound pager (`SETTLE_SPRING`,
 * "settles without overshoot"); this states it as the reason rather than the
 * preference.
 */
const EXPAND_SPRING = { duration: 320, dampingRatio: 1 } as const;
/** See `pausedScale`. Critically damped for the same reason these are. */
const PAUSED_ART_SCALE = 0.88;
const PAUSED_ART_SPRING = { duration: 260, dampingRatio: 1 } as const;
const COLLAPSE_SPRING = { duration: 260, dampingRatio: 1 } as const;
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
 * The banner's played portion — the ONLY thing in the collapsed state that
 * changes with the playhead, so it is the only thing that subscribes to it.
 *
 * A leaf for the same reason `PlayerScrubberLive` is one: the transport ticks
 * ten times a second, and reading `position` on the sheet made all of
 * `PlayerSheet` re-render at that rate to move a 3pt line. This has no
 * children, so the tick stops here.
 */
function BannerProgressFill({ color }: { color: string }) {
  const position = usePlayerStore(s => s.position);
  const duration = usePlayerStore(s => s.duration);
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <View
      style={[
        styles.progressFill,
        { backgroundColor: color, width: `${ratio * 100}%` },
      ]}
    />
  );
}

export function PlayerSheet() {
  const { t, locale } = useI18n();
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
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const queue = usePlayerStore(s => s.queue);
  const toggle = usePlayerStore(s => s.toggle);
  const nextSound = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const rate = usePlayerStore(s => s.rate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const playClip = usePlayerStore(s => s.playClip);
  const seek = usePlayerStore(s => s.seek);
  const playing = usePlayerStore(s => s.playing);
  /**
   * `position` IS DELIBERATELY NOT READ HERE — see `BannerProgressFill` and
   * `PlayerScrubberLive`, the two leaves that draw it. The transport ticks it
   * ten times a second; subscribing on this component made the entire sheet
   * (both neighbour covers, every gesture recipe, the whole console tree)
   * re-render at that rate, whether the player was open or a 46pt pill.
   *
   * The handful of places here that genuinely need a playhead READ IT ONCE, at
   * the moment of the action, via `usePlayerStore.getState()` — clip framing
   * and the swipe's restart test both already did.
   *
   * `duration` stays a subscription: it lands once per sound, and the clip
   * trimmer needs it in layout.
   */
  const storeDuration = usePlayerStore(s => s.duration);
  const expandNonce = usePlayerStore(s => s.expandNonce);
  const clipFramingNonce = usePlayerStore(s => s.clipFramingNonce);

  const activePreset = useShaperStore(s => s.activePreset);

  // Geometry (all deterministic — no measuring, no flicker). The expanded art
  // is moderate (~58% width) so the whole console fits without scrolling.
  const miniTotal = MINI_PLAYER_HEIGHT + bannerBottomOffset(bottomInset);
  const travel = winH - miniTotal;
  // The console's box is SHARED with whichever twin renders it — see
  // `chrome.ts`. The sheet may only place the artwork (it is the element that
  // travels), so the two halves of one geometry cannot be derived twice.
  const artFull = playerArtSize(winW);
  /**
   * THE COVER'S CORNER IS A RATIO OF THE COVER, not a container constant.
   * This drew `TILE_RADIUS` — the grouped-CARD radius, 26 whatever the box —
   * which was within a point of right while the expanded art was 233 and is
   * plainly wrong now that it is the content box's full width: 26 on 370 is
   * 0.070 of it, against the term's 0.15. `artworkRadius` exists for exactly
   * this drift and the player was the one caller that never adopted it.
   */
  const artFullRadius = playerArtRadius(winW, TILE_RADIUS);
  const artExpandedX = (winW - artFull) / 2;
  const artExpandedY = playerArtTop(insets.top);
  const artScaleMin = MINI_ART_SIZE / artFull;
  const contentTop = playerConsoleTop(artExpandedY, artFull);

  const progress = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const springTo = useCallback(
    (target: 0 | 1) => {
      setExpanded(target === 1);
      // Mirrored so screens' back handlers can yield to the sheet's.
      usePlayerStore.getState().setSheetExpanded(target === 1);
      progress.value = reduceMotion
        ? // Reduce Motion takes the destination, not a faster spring: the
          // setting asks for no movement, not for brisk movement.
          withTiming(target, { duration: 0 })
        : withSpring(target, target === 1 ? EXPAND_SPRING : COLLAPSE_SPRING);
    },
    [progress, reduceMotion],
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
  const playerMounted = expanded || offRest;

  // Warm the wash for whatever is loaded, so opening the player is a decode
  // rather than a fetch. See `prefetchPlayerBackdrop`.
  const currentArtUrl = current?.artUrl;
  useEffect(() => {
    prefetchPlayerBackdrop(currentArtUrl || undefined);
  }, [currentArtUrl]);

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

  // Drag the banner up to expand.
  const dragUp = Gesture.Pan()
    .enabled(!expanded)
    .activeOffsetY([-12, 12])
    .onUpdate(event => {
      progress.value = Math.min(Math.max(-event.translationY / travel, 0), 1);
    })
    .onEnd(event => {
      const commit =
        progress.value > SNAP_PROGRESS || event.velocityY < -SNAP_VELOCITY;
      runOnJS(springTo)(commit ? 1 : 0);
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
        runOnJS(springTo)(commit ? 0 : 1);
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
    // The floating-object chrome (outline, lift) goes early — by the time the
    // sheet reads as a screen there is nothing left for it to float above.
    const chrome = 1 - Math.min(p / BANNER_CHROME_FADE, 1);

    return {
      backgroundColor: BANNER_GLASS
        ? // Same hue throughout, only the alpha moves: the glass carries the
          // banner's surface at rest, and the opaque player takes over.
          interpolateColor(
            p,
            [0, BANNER_GLASS_FADE],
            [glassFillStart, colors.background],
          )
        : interpolateColor(
            p,
            [0, BANNER_CHROME_FADE],
            [colors.surfaceContainer, colors.background],
          ),
      borderRadius: BANNER_RADIUS * (1 - p),
      borderWidth: ANDROID_ONLY_HAIRLINE * chrome,
      elevation: BANNER_ELEVATION * chrome,
      height: MINI_PLAYER_HEIGHT + (winH - MINI_PLAYER_HEIGHT) * p,
      left: BANNER_SIDE_INSET * (1 - p),
      right: BANNER_SIDE_INSET * (1 - p),
    };
  });

  /**
   * THE COVER SHRINKS WHILE PAUSED — iOS's own now-playing idiom, and the one
   * piece of state on this screen you can read without looking at a control.
   *
   * It is an INTERACTION borrowed, not a geometry copied: the amount is ours,
   * solved against this console rather than sampled from anyone's screenshot.
   * 0.88 of a 370pt cover is 44.4pt of travel, enough to be unmistakable in
   * peripheral vision; 0.94 read as a rendering wobble and 0.82 opened a gap
   * under the bar row that made the layout look broken rather than paused.
   *
   * CRITICALLY DAMPED, for the same correctness reason the expand springs are
   * (see `EXPAND_SPRING`): this multiplies the shared element's scale, and an
   * overshoot past 1 would push the cover wider than its own content box on
   * the frame it settles.
   *
   * Reduce Motion takes the destination rather than a faster spring — the
   * setting asks for no movement, not brisk movement, which is the rule
   * `springTo` already follows.
   */
  const pausedScale = useSharedValue(playing ? 1 : PAUSED_ART_SCALE);
  useEffect(() => {
    const target = playing ? 1 : PAUSED_ART_SCALE;
    pausedScale.value = reduceMotion
      ? withTiming(target, { duration: 0 })
      : withSpring(target, PAUSED_ART_SPRING);
  }, [playing, pausedScale, reduceMotion]);

  const artStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // The paused inset is scaled BY the expand ramp, so it exists only on the
    // open console and fades to nothing as the cover collapses into the
    // banner's thumb — a 46pt thumb has no room to shrink and would just look
    // wrong at two sizes.
    const paused = 1 - (1 - pausedScale.value) * p;
    const scale = (artScaleMin + (1 - artScaleMin) * p) * paused;
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
    opacity: Math.min(1, Math.max(0, (progress.value - 0.45) * 1.8)),
  }));

  // Held back until the sheet is nearly open. Mid-drag the surface is still
  // reading as the banner growing, and a visible wash there looks like a
  // stray layer rather than part of the player.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BACKDROP_FADE_START, 1],
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

  const progressLineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, PROGRESS_FADE_END],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    // Rides the surface's BOTTOM EDGE down. The mask is the banner's box, but
    // the surface grows 800pt over the expansion — so even a few percent in it
    // is already tens of points taller, and a bar pinned to the banner's box
    // hangs in the middle of it as a rounded line attached to nothing. This is
    // the whole artifact: not the corner, but the edge the corner belongs to
    // having moved. A transform, not `top`, so the mask's children keep their
    // layout.
    transform: [{ translateY: (winH - MINI_PLAYER_HEIGHT) * progress.value }],
  }));
  // -------------------------------------------------------------------------

  // The bottom sheets + the title overflow menu.
  const [shaperVisible, setShaperVisible] = useState(false);

  // Clip framing ON the scrubber: entered from the Clips sheet's "New clip",
  // exited by save / dismiss / track change.
  const [clipMode, setClipMode] = useState(false);
  const [clipRange, setClipRange] = useState({ startS: 0, endS: 0 });

  useEffect(() => {
    setClipMode(false);
  }, [current?.id]);

  // iOS: the Clips ROUTE's "New clip" bumps this nonce as it dismisses — drop
  // the trim brackets exactly as Android's in-place sheet callback does.
  const lastFramingNonce = useRef(clipFramingNonce);
  useEffect(() => {
    if (clipFramingNonce === lastFramingNonce.current) return;
    lastFramingNonce.current = clipFramingNonce;

    const { position, duration } = usePlayerStore.getState();
    const total = Math.floor(duration);
    const start = Math.max(0, Math.round(position - 7));
    const end = Math.min(total || 15, start + 15);
    setClipRange({ startS: start, endS: Math.max(end, start + 1) });
    setClipMode(true);
  }, [clipFramingNonce]);
  const [clipsVisible, setClipsVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
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
  useClipsSubscription(playerMounted ? current?.id : undefined);
  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  // Nothing loaded yet: the banner still holds its place (YT Music keeps it
  // parked), primed with the first sound — or saying the library is empty.
  if (!current) return <IdleBanner bottomInset={bottomInset} />;

  // Icon buttons signal presses with their RIPPLE, never vibration.
  const onToggle = toggle;
  const onNext = nextSound;
  const onPrevious = previous;

  const trimmerDuration = Math.floor(storeDuration);

  // From the Clips sheet: close it, drop the brackets around the playhead.
  const onStartFraming = () => {
    setClipsVisible(false);
    // Read once, at the moment of the action — the sheet no longer holds a
    // live playhead, and a clip framed "around here" only ever meant the
    // instant the button was pressed anyway.
    const start = Math.max(
      0,
      Math.round(usePlayerStore.getState().position - 7),
    );
    const end = Math.min(trimmerDuration || 15, start + 15);
    setClipRange({ startS: start, endS: Math.max(end, start + 1) });
    setClipMode(true);
  };

  const onPreviewClip = () => {
    playClip('preview', clipRange.startS * 1000, clipRange.endS * 1000);
  };

  const onSaveClip = () => {
    haptics.selection();
    setClipMode(false);
    createClip({
      soundId: current.id,
      startMs: clipRange.startS * 1000,
      endMs: clipRange.endS * 1000,
      label: '',
    })
      .then(() => {
        // Awarded here rather than from a store: the clips cache only holds
        // sounds you have opened, so it can't answer "have you ever saved one".
        // The running total the GOLD trophy counts is banked in the same place,
        // and for the same reason — see `store/clipsSaved.ts`.
        awardTrophy(TROPHY_IDS.firstClip);
        useClipsSavedStore.getState().saved();
        showSnackbar(t('snackbar.clip-created'));
      })
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));
  };

  const subtitle = current.artist || ' ';

  // Card summaries: live settings at a glance.
  const presetSummary = (() => {
    switch (activePreset) {
      case 'flat':
        return t('player.eq.presets.flat');
      case 'bass':
        return t('player.eq.presets.bass');
      case 'vocal':
        return t('player.eq.presets.vocal');
      case 'treble':
        return t('player.eq.presets.treble');
      case 'warm':
        return t('player.eq.presets.warm');
      case 'bright':
        return t('player.eq.presets.bright');
      default:
        return t('player.shape.custom');
    }
  })();
  /**
   * IT STATES WHAT IS NOT DEFAULT, AND NOTHING ELSE.
   *
   * It used to state everything — "Flat · 1×" on a sound nobody had touched,
   * which is a sentence saying "nothing is applied" the long way round. Apple
   * writes the exception and leaves the default silent; Settings shows
   * "Ringtone: None", not "Ringtone: Default, Vibration: Default".
   *
   * It also has to FIT. The bar gained a third cell, so each card's copy box
   * came down to ~65 and a two-attribute summary overruns it. Dropping the
   * defaults makes the long form rare rather than constant — and when
   * everything IS default the summary is "None", the same word the Clips card
   * uses for the same idea.
   *
   * The long form can still overrun the box ("Bright · 1.5×"); it truncates,
   * which is what `numberOfLines={1}` is for.
   */
  const shapeSummary =
    [
      activePreset === 'flat' ? null : presetSummary,
      rate === 1 ? null : rateLabel(rate, locale),
      // THE PITCH NOTE FOLLOWS THE RULE ABOVE — state what is not default —
      // so it inverts whenever the default does (it has twice now; see
      // `keepPitch` in the store). Keeping pitch is the default again, so
      // varispeed is the exception worth printing: "pitch off".
      //
      // AND IT IS SILENT AT 1×, at either setting: there the engine passes the
      // audio through untouched, so the switch describes nothing that is
      // happening. A note that appears on a sound nobody has sped up is exactly
      // the "Flat · 1×" noise this summary was rebuilt to stop.
      rate === 1 || keepPitch ? null : t('player.shape.pitchOff'),
    ]
      .filter(Boolean)
      .join(' · ') || t('player.shape.none');
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
        />

        {BANNER_GLASS ? (
          <Animated.View
            style={[styles.bannerGlass, bannerGlassStyle]}
            pointerEvents="none"
          >
            <BannerGlass
              width={winW - BANNER_SIDE_INSET * 2}
              height={MINI_PLAYER_HEIGHT}
              radius={BANNER_RADIUS}
            />
          </Animated.View>
        ) : null}

        {/* The artwork wash tracks the drag directly, so it grows in with the
            surface instead of popping once the expanded chrome crosses its
            fade threshold. */}
        {/* MOUNTED ONLY WHILE THE PLAYER IS ON SCREEN — see `playerMounted`.
            It still grows in with the drag rather than waiting for the sheet
            to land, which is the whole point of the comment above; what
            changes is that a COLLAPSED banner no longer pays for it. The
            bytes are already local either way, because `usePlayerStore`'s
            current sound prefetches this exact transform (below), so mounting
            it at the first frame of a drag is a decode, not a fetch. */}
        {playerMounted ? (
          <Animated.View
            style={[styles.backdropLayer, backdropStyle]}
            pointerEvents="none"
          >
            <PlayerBackdrop artUrl={current.artUrl || undefined} />
          </Animated.View>
        ) : null}

        {/* Collapsed progress, attached to the banner's bottom edge and cut by
            its corner — the card's own bottom rule, not a line floating inside
            it. */}
        <Animated.View style={[styles.progressClip, progressLineStyle]}>
          <View
            style={[
              styles.progressTrack,
              // NOT surfaceVariant: on the Material You dark palette it
              // resolves to the banner's own fill, so the unplayed part simply
              // vanished and progress read as a stray blue dash. A tint of the
              // content colour is visible on any palette, on both platforms.
              {
                backgroundColor: withAlpha(
                  colors.onSurface,
                  PROGRESS_TRACK_ALPHA,
                ),
              },
            ]}
          >
            {/* MONOCHROME ON iOS, ACCENTED ON ANDROID — and the split is the
                portfolio's platform rule, not a hedge. Material's progress
                indicator IS accent-coloured; that is what a Material surface
                should draw, and Android's banner is a Material surface.
                iOS's is not: the console this banner expands into carries no
                accent anywhere, and the fill was the last thing in the player
                family still tinted, which made a two-frame transition run
                blue-then-monochrome. The track was already a tint of
                `onSurface`; now the fill is the full-strength version of the
                same ink, which is exactly the relationship the expanded
                scrubber has. */}
            <BannerProgressFill
              color={BANNER_GLASS ? colors.onSurface : colors.primary}
            />
          </View>
        </Animated.View>

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
            clipMode={clipMode}
            clipRange={clipRange}
            consoleStyle={expandedStyle}
            contentTop={contentTop}
            expanded={expanded}
            neighbours={neighbours}
            onClipCancel={() => setClipMode(false)}
            onClipPreview={onPreviewClip}
            onClipRangeChange={(startS, endS) => setClipRange({ startS, endS })}
            onClipSave={onSaveClip}
            onCollapse={collapse}
            onEdit={() =>
              Platform.OS === 'ios'
                ? router.push({
                    pathname: '/edit-sound',
                    params: { soundId: current.id },
                  })
                : setEditVisible(true)
            }
            // ANDROID ONLY. iOS's console dropped its overflow menu with the
            // bar row it hung off (see `PlayerConsole.ios`), and the info sheet
            // went with it — with album and release year no longer handled, all
            // it listed was the title and artist already set under the cover.
            onInfo={() => setInfoVisible(true)}
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
            soundId={current.id}
            subtitle={subtitle}
            title={current.name}
            titleGesture={titleGesture}
            topGesture={topGesture}
            trimmerDuration={trimmerDuration}
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
      {clipsVisible && (
        <ClipsSheet
          onNewClip={onStartFraming}
          onClose={() => setClipsVisible(false)}
        />
      )}
      {infoVisible && (
        <SoundInfoSheet sound={current} onClose={() => setInfoVisible(false)} />
      )}
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
  const playSound = usePlayerStore(s => s.playSound);
  const requestExpand = usePlayerStore(s => s.requestExpand);

  // Same order the home grid shows, so "the first one" means what it looks
  // like it means.
  const ordered = sounds;
  const first = ordered[0] ?? null;

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
          borderColor: colors.border,
          borderWidth: ANDROID_ONLY_HAIRLINE,
          bottom: bannerBottomOffset(bottomInset),
        },
      ]}
    >
      {BANNER_GLASS ? (
        <BannerGlass
          width={winW - BANNER_SIDE_INSET * 2}
          height={MINI_PLAYER_HEIGHT}
          radius={BANNER_RADIUS}
        />
      ) : null}
      <Pressable
        style={styles.miniRow}
        onPress={start}
        disabled={!first}
        accessibilityRole="button"
        accessibilityLabel={first ? first.name : t('player.empty')}
      >
        <View style={styles.idleArt}>
          <SoundArt
            artUrl={first?.artUrl || undefined}
            size={MINI_ART_SIZE}
            title={first?.name}
            // Same corner the loaded banner's thumb renders at.
            style={[styles.artMedia, { borderRadius: MINI_ART_RADIUS }]}
          />
        </View>
        <View style={styles.idleInfo}>
          {first ? (
            <>
              <AppText
                doNotTranslate
                text={first.name}
                variant="bodyLarge"
                numberOfLines={1}
                style={styles.miniTitle}
              />
              <AppText
                doNotTranslate
                muted
                text={first.artist || ' '}
                variant="bodySmall"
                numberOfLines={1}
              />
            </>
          ) : (
            <AppText
              doNotTranslate
              muted
              text={t('player.empty')}
              variant="bodyLarge"
              numberOfLines={1}
            />
          )}
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
  idleInfo: { flex: 1, gap: MINI_COPY_GAP, paddingLeft: BANNER_INSET },
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // Anchored to the container's top — the pill's own top edge — and grown
  // downward by the animated height.
  surface: {
    position: 'absolute',
    top: 0,
    ...CONTINUOUS_CURVE,
  },
  backdropLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
  progressClip: {
    // Constant corner: this mask is only ever visible on the settled banner,
    // so it has no reason to animate towards the expanded player's square one.
    borderRadius: BANNER_RADIUS,
    height: MINI_PLAYER_HEIGHT,
    left: BANNER_SIDE_INSET,
    overflow: 'hidden',
    position: 'absolute',
    right: BANNER_SIDE_INSET,
    top: 0,
    ...CONTINUOUS_CURVE,
  },
  progressTrack: {
    bottom: 0,
    height: PROGRESS_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  progressFill: { height: '100%' },
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
  miniInfo: { gap: MINI_COPY_GAP },
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
