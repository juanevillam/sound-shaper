import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { withAlpha } from '@portfolio/core';
import {
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  usePressSquash,
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

import {
  HANDLES_REGION_HEIGHT,
  type PlayerCard,
} from '@/components/player/chrome';
import { ClipActionsRow } from '@/components/player/ClipActionsRow';
import { ClipHandles } from '@/components/player/ClipHandles';
import { ClipsSheet } from '@/components/player/ClipsSheet';
import { PlayerBackdrop } from '@/components/player/PlayerBackdrop';
import { PlayerCards } from '@/components/player/PlayerCards';
import { PlayerMenuButton } from '@/components/player/PlayerMenuButton';
import { PlayerScrubber } from '@/components/player/PlayerScrubber';
import { ShaperSheet } from '@/components/player/ShaperSheet';
import { SongInfoSheet } from '@/components/player/SongInfoSheet';
import { EditSongSheet } from '@/components/songs/EditSongSheet';
import { IconButton } from '@/components/ui/IconButton';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { TROPHY_IDS } from '@/constants/trophies';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime, rateLabel } from '@/lib/player';
import { createClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { RESTART_THRESHOLD_S, usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useShapesStore } from '@/store/shapes';
import { useSongsStore } from '@/store/songs';
import { CONTINUOUS_CURVE, HAIRLINE, TILE_RADIUS } from '@/styles/shape';

// ---------------------------------------------------------------------------
// The player interaction: the collapsed banner and the full player are ONE
// bottom-anchored, full-height container. `progress` (0 collapsed, 1 expanded)
// drives everything — the container translates up, the single shared artwork
// element scales/travels from the 44dp thumb to the expanded square, the mini
// row cross-fades into the expanded controls.
//
// Collapsed, the banner is a DETACHED PILL: a floating island inset from both
// screen edges and lifted clear of the bottom one, not a bar welded to the
// window. That shape is what the expansion has to resolve, so the painted
// surface is its OWN layer inside the container rather than the container's
// background: it grows from the pill's box to the full window while its
// corners unwind and its lateral insets close. The container itself only
// translates, so the gestures, the pager and the shared artwork are unchanged
// by any of it.
//
// The expanded surface is a FIXED console: art, title (with an overflow menu
// for song info / editing), the native scrubber, transport, and two cards —
// Shape and Clips — that open their own bottom sheets. Nothing scrolls, so
// nothing can fight the drag-to-close gesture.
// ---------------------------------------------------------------------------

/** CONTENT height of the collapsed banner (consumers add the bottom inset). */
export const MINI_PLAYER_HEIGHT = 64;

/** Gap from the pill to each screen edge. */
export const BANNER_SIDE_INSET = 16;

/** Clearance UNDER the pill, above the home indicator / nav-bar inset. */
export const BANNER_BOTTOM_GAP = 8;

// A capsule rather than a rounded rect: an island reads as one object, and at
// this height the two are not the same gesture of the hand.
const PILL_RADIUS = MINI_PLAYER_HEIGHT / 2;

// A detached surface needs a lift or it reads as a sticker painted on the
// screen. iOS casts a soft shadow, Android raises it through the elevation
// system; both let go as the pill becomes the full-screen player, which is a
// surface with nothing behind it to cast onto.
const PILL_SHADOW_OPACITY = 0.3;
const PILL_ELEVATION = 8;
// The static half of the lift — only the opacity animates. Black rather than a
// palette token on purpose: a shadow is absence of light, not a colour of the
// theme (same call the clip handles already make).
const PILL_LIFT = {
  shadowColor: '#000',
  shadowOffset: { height: 6, width: 0 },
  shadowOpacity: PILL_SHADOW_OPACITY,
  shadowRadius: 14,
};
// How much of the expansion the pill's own chrome — border, lift — takes to
// disappear. Matches the surface's colour cross-fade, so the whole "this is a
// floating object" story ends at once.
const PILL_CHROME_FADE = 0.35;

const PROGRESS_HEIGHT = 2;
// The progress line lives INSIDE the pill. Pinned to the top edge it would be
// clipped to a sliver by the capsule's own curve, so it rides just above the
// bottom rim, inset far enough at both ends to clear the corner arc.
const PROGRESS_INSET_X = 26;
// The unplayed remainder, as a tint of the content colour.
const PROGRESS_TRACK_ALPHA = 0.2;
const PROGRESS_BOTTOM = 4;

const MINI_ROW_HEIGHT = MINI_PLAYER_HEIGHT;
const MINI_ART_SIZE = 44;
// The artwork is ONE element scaled between the two states, so a fixed
// borderRadius renders ~5x smaller when collapsed. These are the radii we want
// to SEE at each end; the style divides by the live scale to hit them.
const MINI_ART_RADIUS = 8;
// Inset INSIDE the pill — enough that the thumb's top corners clear the
// capsule's own curve, which at the artwork's height has already eaten 9pt.
const MINI_ART_PILL_X = 12;
// ...and the same thing in container (screen) space, where the shared artwork
// element is positioned.
const MINI_ART_X = BANNER_SIDE_INSET + MINI_ART_PILL_X;
const MINI_ART_Y = (MINI_ROW_HEIGHT - MINI_ART_SIZE) / 2;

// Extra room under the scrubber WHILE FRAMING A CLIP only. Framing adds a
// third line (the range) under the elapsed/total pair, which without this
// crowds straight into the play button. The default player keeps its original
// tight column — there is no third line to make room for. iOS gets more: SF's
// shorter labels leave less optical air of their own.
const CLIP_FRAMING_GAP = Platform.select({ ios: 16, default: 8 }) as number;

// The pill's outline — iOS only. `styles/surfaces`: iOS separates surfaces by
// EDGE, Android by TONE, and Android's raised pill already reads as its own
// object through elevation and the tonal step.
const IOS_ONLY_HAIRLINE = Platform.OS === 'ios' ? HAIRLINE : 0;

// The wash starts appearing only this far into the expansion.
const BACKDROP_FADE_START = 0.8;

const EXPAND_MS = 320;
const COLLAPSE_MS = 260;
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
// Settles without overshoot — a bouncy song swap looks like a glitch.
const SETTLE_SPRING = { stiffness: 220, mass: 0.6, damping: 22 };

const PLAY_BUTTON_SIZE = 64;
const SIDE_PADDING = 24;

// Stable fallback for the clips selector (an inline `?? []` loops
// useSyncExternalStore into "maximum update depth exceeded").
const NO_CLIPS: never[] = [];

// Hand-drawn transport glyphs for the collapsed row (Compose Icons here would
// blink on navigation returns — the drag-dots lesson).
const PlayGlyph = ({ color }: { color: string }) => (
  <View style={[styles.playTriangle, { borderLeftColor: color }]} />
);

const PauseGlyph = ({ color }: { color: string }) => (
  <View style={styles.pauseRow}>
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
  </View>
);

const NextGlyph = ({ color }: { color: string }) => (
  <View style={styles.nextRow}>
    <View style={[styles.nextTriangle, { borderLeftColor: color }]} />
    <View style={[styles.nextBar, { backgroundColor: color }]} />
  </View>
);

const PreviousGlyph = ({ color }: { color: string }) => (
  <View style={styles.previousRow}>
    <View style={[styles.nextBar, { backgroundColor: color }]} />
    <View style={[styles.previousTriangle, { borderRightColor: color }]} />
  </View>
);

type GlyphButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The transport buttons. Their glyphs are hand-drawn Views rather than icons
 * (a Compose Icon here would blink on navigation returns — the drag-dots
 * lesson), so they can't go through `components/ui/IconButton` — but they use
 * the same press feedback it does, which is the point: one squash, both
 * platforms, no `android_ripple` that iOS silently ignores.
 */
function GlyphButton({
  children,
  onPress,
  accessibilityLabel,
  hitSlop = 8,
  style,
}: GlyphButtonProps) {
  const squash = usePressSquash({
    scale: ICON_PRESS_SCALE,
    opacity: ICON_PRESS_OPACITY,
  });

  return (
    <Animated.View style={squash.style}>
      <Pressable
        onPress={onPress}
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        hitSlop={hitSlop}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

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
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const queue = usePlayerStore(s => s.queue);
  const toggle = usePlayerStore(s => s.toggle);
  const nextSong = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const rate = usePlayerStore(s => s.rate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const playClip = usePlayerStore(s => s.playClip);
  const seek = usePlayerStore(s => s.seek);
  const playing = usePlayerStore(s => s.playing);
  const storePosition = usePlayerStore(s => s.position);
  const storeDuration = usePlayerStore(s => s.duration);
  const expandNonce = usePlayerStore(s => s.expandNonce);
  const clipFramingNonce = usePlayerStore(s => s.clipFramingNonce);

  const activePreset = useShaperStore(s => s.activePreset);
  const activeShapeId = useShaperStore(s => s.activeShapeId);
  const activeShape =
    useShapesStore(s => s.shapes.find(shape => shape.id === activeShapeId)) ??
    null;

  // Geometry (all deterministic — no measuring, no flicker). The expanded art
  // is moderate (~58% width) so the whole console fits without scrolling.
  const miniTotal = MINI_PLAYER_HEIGHT + bottomInset + BANNER_BOTTOM_GAP;
  const travel = winH - miniTotal;
  const artFull = Math.min(Math.round(winW * 0.58), 260);
  const artExpandedX = (winW - artFull) / 2;
  const artExpandedY = insets.top + 60;
  const artScaleMin = MINI_ART_SIZE / artFull;
  const contentTop = artExpandedY + artFull + 36;

  const progress = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const springTo = useCallback(
    (target: 0 | 1) => {
      setExpanded(target === 1);
      // Mirrored so screens' back handlers can yield to the sheet's.
      usePlayerStore.getState().setSheetExpanded(target === 1);
      progress.value = withTiming(target, {
        duration: reduceMotion ? 0 : target === 1 ? EXPAND_MS : COLLAPSE_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [progress, reduceMotion],
  );

  const expand = useCallback(() => {
    haptics.selection();
    springTo(1);
  }, [springTo]);

  const collapse = useCallback(() => springTo(0), [springTo]);

  // A surface asked for the full player (tapping a song tile). If the sheet is
  // just mounting (nothing was loaded before), jump straight to the expanded
  // layout so the container's own slide-in IS the open animation; if the
  // banner was already up, grow it in place.
  const lastExpandNonce = useRef(expandNonce);
  const hadCurrentRef = useRef(current !== null);
  useEffect(() => {
    const freshMount = !hadCurrentRef.current && current !== null;
    hadCurrentRef.current = current !== null;

    if (expandNonce === lastExpandNonce.current) return;
    lastExpandNonce.current = expandNonce;
    if (!current) return;

    if (freshMount) {
      progress.value = 1;
      setExpanded(true);
      usePlayerStore.getState().setSheetExpanded(true);
    } else {
      springTo(1);
    }
  }, [expandNonce, current, progress, springTo]);

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

  // Swipe the art or the title sideways to change song — the idiom every music
  // app uses, so the expanded player stops depending on the two small transport
  // buttons. Left goes forward, matching a carousel: the next song comes in from
  // the right. Skipping wraps, so both directions always lead somewhere.
  const swipeX = useSharedValue(0);

  // The neighbours sit one screen-width away on either side, mounted and painted
  // while the player is open. That is the whole trick: paging one in is a
  // transform on an image that is ALREADY decoded, so it appears immediately
  // instead of after the store swap and a fresh decode.
  const readNeighbours = useCallback(() => {
    const { current: playing, queue: songs } = usePlayerStore.getState();
    if (!playing || songs.length < 2) return { previous: null, next: null };

    const index = songs.findIndex(song => song.id === playing.id);
    if (index < 0) return { previous: null, next: null };

    return {
      previous: songs[(index - 1 + songs.length) % songs.length] ?? null,
      next: songs[(index + 1) % songs.length] ?? null,
    };
  }, []);

  // Held in state, NOT derived per render: the frame that commits a skip must
  // still show the pair we paged with. Refreshing them in that same frame drops
  // the NEW next-song into the centre slot (the pager is still offset by a
  // screen width), which flashes a third song's title for a frame or two.
  const [neighbours, setNeighbours] = useState(readNeighbours);

  // Snaps the pager back to centre. Called once the song has actually changed:
  // the incoming cover is already sitting in the artwork slot, and the real
  // artwork element now holds the same image, so this handoff is invisible.
  const recentre = useCallback(() => {
    swipeX.value = 0;
  }, [swipeX]);

  const settleBack = useCallback(() => {
    swipeX.value = withSpring(0, SETTLE_SPRING);
  }, [swipeX]);

  // Set while a page is in flight and waiting on the song to change.
  const pendingRecentreRef = useRef(false);

  const skip = useCallback(
    (direction: 1 | -1) => {
      const before = usePlayerStore.getState().current?.id;
      if (direction === -1) nextSong();
      else previous();

      if (usePlayerStore.getState().current?.id === before) {
        // Nothing re-renders, so nothing would ever recentre us.
        recentre();
        return;
      }

      pendingRecentreRef.current = true;
    },
    [nextSong, previous, recentre],
  );

  // Decided on the JS thread because it reads live transport state.
  const onSwipeRelease = useCallback(
    (direction: 1 | -1, commit: boolean) => {
      if (!commit) {
        settleBack();
        return;
      }

      haptics.selection();

      const { position } = usePlayerStore.getState();
      // `previous()` restarts the song when deep into it, and a lone song wraps
      // to itself — in both cases no neighbour arrives, so paging one in would
      // be a lie. Settle back and let the action speak.
      const staysPut =
        queue.length < 2 || (direction === 1 && position > RESTART_THRESHOLD_S);

      if (staysPut) {
        settleBack();
        if (direction === -1) nextSong();
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
    [nextSong, previous, queue.length, settleBack, skip, swipeX, winW],
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
    // song AFTER the one just swiped to at the pager's still-offset centre —
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

  // THE detach: the painted surface is a layer inside the container, not the
  // container's own background, so it can be a pill at one end and the whole
  // window at the other. Everything here resolves to the pill's box at p = 0
  // and to a full-bleed, square-cornered, unlifted surface at p = 1.
  const surfaceStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // The floating-object chrome (outline, lift) goes early — by the time the
    // sheet reads as a screen there is nothing left for it to float above.
    const chrome = 1 - Math.min(p / PILL_CHROME_FADE, 1);

    return {
      backgroundColor: interpolateColor(
        p,
        [0, PILL_CHROME_FADE],
        [colors.surfaceContainer, colors.background],
      ),
      borderRadius: PILL_RADIUS * (1 - p),
      borderWidth: IOS_ONLY_HAIRLINE * chrome,
      elevation: PILL_ELEVATION * chrome,
      height: MINI_PLAYER_HEIGHT + (winH - MINI_PLAYER_HEIGHT) * p,
      left: BANNER_SIDE_INSET * (1 - p),
      right: BANNER_SIDE_INSET * (1 - p),
      shadowOpacity: PILL_SHADOW_OPACITY * chrome,
    };
  });

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
      MINI_ART_RADIUS + (TILE_RADIUS - MINI_ART_RADIUS) * p;

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

  const progressLineStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value * 3),
  }));
  // -------------------------------------------------------------------------

  // Scrubber drag-local value (the 250ms status stream would fight the thumb).
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastDragRef = useRef(0);

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

  useClipsSubscription(current?.id);
  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  // Nothing loaded yet: the banner still holds its place (YT Music keeps it
  // parked), primed with the first sound — or saying the library is empty.
  if (!current) return <IdleBanner bottomInset={bottomInset} />;

  // Icon buttons signal presses with their RIPPLE, never vibration.
  const onToggle = toggle;
  const onNext = nextSong;
  const onPrevious = previous;

  const trimmerDuration = Math.floor(storeDuration);

  // From the Clips sheet: close it, drop the brackets around the playhead.
  const onStartFraming = () => {
    setClipsVisible(false);
    const start = Math.max(0, Math.round(storePosition - 7));
    const end = Math.min(trimmerDuration || 15, start + 15);
    setClipRange({ startS: start, endS: Math.max(end, start + 1) });
    setClipMode(true);
  };

  const onPreviewClip = () => {
    haptics.selection();
    playClip('preview', clipRange.startS * 1000, clipRange.endS * 1000);
  };

  const onSaveClip = () => {
    haptics.selection();
    setClipMode(false);
    createClip({
      songId: current.id,
      startMs: clipRange.startS * 1000,
      endMs: clipRange.endS * 1000,
      label: '',
    })
      .then(() => {
        // Awarded here rather than from a store: the clips cache only holds
        // songs you have opened, so it can't answer "have you ever saved one".
        awardTrophy(TROPHY_IDS.firstClip);
        showSnackbar(t('snackbar.clip-created'));
      })
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));
  };

  const duration = storeDuration > 0 ? storeDuration : 1;
  const position = dragValue ?? storePosition;
  const progressRatio =
    storeDuration > 0 ? Math.min(storePosition / storeDuration, 1) : 0;
  const subtitle = current.artist || ' ';

  // Card summaries: live settings at a glance. A saved shape names itself.
  const presetSummary = (() => {
    if (activeShape) return activeShape.name;

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
  const shapeSummary = `${presetSummary} · ${rateLabel(rate)}${
    keepPitch ? '' : ` · ${t('player.shape.pitchOff')}`
  }`;
  const clipsSummary =
    clips.length === 0
      ? t('player.clips.none')
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
        entering={reduceMotion ? undefined : SlideInDown.duration(220)}
        style={[styles.container, { height: winH }, containerStyle]}
      >
        {/* THE surface: a pill at rest, the whole window when open. It is
            PAINT ONLY — nothing renders inside it. Its height is animated, and
            an animated layout prop moves the native view without re-laying out
            its children, so a child anchored to its bottom edge lands at the
            top instead. Every layer below is therefore a sibling, positioned
            against the container, whose height never changes. */}
        <Animated.View
          style={[styles.surface, { borderColor: colors.border }, surfaceStyle]}
          pointerEvents="none"
        />

        {/* The artwork wash tracks the drag directly, so it grows in with the
            surface instead of popping once the expanded chrome crosses its
            fade threshold. */}
        <Animated.View
          style={[styles.backdropLayer, backdropStyle]}
          pointerEvents="none"
        >
          <PlayerBackdrop artUrl={current.artUrl || undefined} />
        </Animated.View>

        {/* Collapsed progress, riding just above the pill's bottom rim. */}
        <Animated.View
          style={[
            styles.progressTrack,
            // NOT surfaceVariant: on the Material You dark palette it resolves
            // to the pill's own fill, so the unplayed part of the line simply
            // vanished and progress read as a stray blue dash. A tint of the
            // content colour is visible on any palette, on both platforms.
            {
              backgroundColor: withAlpha(
                colors.onSurface,
                PROGRESS_TRACK_ALPHA,
              ),
            },
            progressLineStyle,
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progressRatio * 100}%`,
              },
            ]}
          />
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
                  variant="bodyMedium"
                  numberOfLines={1}
                />
                <AppText
                  doNotTranslate
                  muted
                  text={subtitle}
                  variant="bodySmall"
                  numberOfLines={1}
                />
              </View>
            </Pressable>
            {/* Skipping wraps, so previous always leads somewhere — the
                banner never drops a control depending on queue position. */}
            <GlyphButton
              onPress={onPrevious}
              style={styles.miniButton}
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
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
              onPress={onNext}
              style={styles.miniButton}
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} />
            </GlyphButton>
          </Animated.View>
        </GestureDetector>

        {/* Expanded chrome. */}
        <Animated.View
          style={[styles.expanded, expandedStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          {/* One full-width drag-to-close zone spanning everything above the
              console (header row, the gutters beside the art). Buttons and
              the art render ABOVE it, so they keep their own touches. */}
          <GestureDetector gesture={topGesture}>
            <View style={[styles.dragZone, { height: contentTop }]} />
          </GestureDetector>

          <View style={[styles.expandedTop, { paddingTop: insets.top + 4 }]}>
            <IconButton
              name="chevron-down"
              onPress={collapse}
              accessibilityLabel={t('common.back')}
            />
            {/* Song overflow: metadata + the same edit/delete sheet the
                library's long-press opens. Compose anchors a dropdown to the
                trigger; iOS opens the system action sheet instead. Both twins
                size their own touch target, so there is no wrapper here — one
                would only decentre the smaller of the two. */}
            <PlayerMenuButton
              onInfo={() =>
                Platform.OS === 'ios'
                  ? router.push('/sound-info')
                  : setInfoVisible(true)
              }
              onEdit={() =>
                Platform.OS === 'ios'
                  ? router.push({
                      pathname: '/edit-sound',
                      params: { songId: current.id },
                    })
                  : setEditVisible(true)
              }
            />
          </View>

          {/* The console below the art — a fixed column, nothing scrolls. */}
          <View style={[styles.expandedBody, { top: contentTop }]}>
            <GestureDetector gesture={titleGesture}>
              <View style={styles.titleSlot}>
                <Animated.View style={[styles.titleBlock, pagerStyle]}>
                  <AppText
                    doNotTranslate
                    text={current.name}
                    variant="titleLarge"
                    numberOfLines={1}
                    style={styles.titleText}
                  />
                  <AppText
                    doNotTranslate
                    muted
                    text={subtitle}
                    variant="bodyMedium"
                    numberOfLines={1}
                  />
                </Animated.View>

                {/* The neighbours' text rides the same pager as their artwork,
                    so the title arrives WITH the swipe. Absolutely positioned,
                    so they never affect the console's layout. */}
                {expanded
                  ? (
                      [
                        { song: neighbours.previous, side: -1 },
                        { song: neighbours.next, side: 1 },
                      ] as const
                    ).map(({ song, side }) =>
                      song ? (
                        <Animated.View
                          key={`title:${side}:${song.id}`}
                          pointerEvents="none"
                          style={[
                            styles.titleBlock,
                            styles.titleGhost,
                            { left: side * winW },
                            pagerStyle,
                          ]}
                        >
                          <AppText
                            doNotTranslate
                            text={song.name}
                            variant="titleLarge"
                            numberOfLines={1}
                            style={styles.titleText}
                          />
                          <AppText
                            doNotTranslate
                            muted
                            text={song.artist || ' '}
                            variant="bodyMedium"
                            numberOfLines={1}
                          />
                        </Animated.View>
                      ) : null,
                    )
                  : null}
              </View>
            </GestureDetector>

            {/* THE scrubber — always the native slider. While framing, the
                tertiary trim brackets ride on top (Google Photos): edges
                resize, the tinted middle slides the whole clip. */}
            <View
              style={[
                styles.sliderBlock,
                clipMode && styles.sliderBlockFraming,
              ]}
            >
              <PlayerScrubber
                position={position}
                duration={duration}
                totalDuration={storeDuration}
                clipLabel={
                  clipMode
                    ? `${formatTime(clipRange.startS)} – ${formatTime(clipRange.endS)}`
                    : null
                }
                onDrag={value => {
                  lastDragRef.current = value;
                  setDragValue(value);
                }}
                onDragEnd={() => {
                  // seek() also ends any clip replay.
                  seek(lastDragRef.current);
                  setDragValue(null);
                }}
              />
              {clipMode ? (
                <View style={styles.handlesRegion} pointerEvents="box-none">
                  <ClipHandles
                    durationS={trimmerDuration}
                    startS={clipRange.startS}
                    endS={clipRange.endS}
                    onChange={(startS, endS) => setClipRange({ startS, endS })}
                  />
                </View>
              ) : null}
            </View>

            {/* Transport in RN, not Compose: a Compose IconButton's state
                layer is invisible on this dark surface. Feedback is the app's
                squash, which — unlike the ripple these used to carry — also
                exists on iOS. */}
            <View style={styles.transportRow}>
              <GlyphButton
                onPress={onPrevious}
                hitSlop={12}
                style={styles.transportSide}
                accessibilityLabel={t('player.previous')}
              >
                <PreviousGlyph color={colors.onSurface} />
              </GlyphButton>
              <GlyphButton
                onPress={onToggle}
                hitSlop={12}
                style={[
                  styles.transportPlay,
                  { backgroundColor: colors.primary },
                ]}
                accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
              >
                {playing ? (
                  <PauseGlyph color={colors.onPrimary} />
                ) : (
                  <PlayGlyph color={colors.onPrimary} />
                )}
              </GlyphButton>
              <GlyphButton
                onPress={onNext}
                hitSlop={12}
                style={styles.transportSide}
                accessibilityLabel={t('player.next')}
              >
                <NextGlyph color={colors.onSurface} />
              </GlyphButton>
            </View>

            {/* While framing a clip, the action row takes the cards' place. */}
            {clipMode ? (
              <View style={styles.firstCardHost}>
                <ClipActionsRow
                  onCancel={() => setClipMode(false)}
                  onPreview={onPreviewClip}
                  onSave={onSaveClip}
                />
              </View>
            ) : (
              /* Shape + Clips — the two studios, side by side as the
                 console's footer. Outlined, not filled: a filled surface sat
                 as two slabs on top of the artwork wash and cut the gradient
                 in half. A hairline outline keeps the wash running edge to
                 edge, and one row of two instead of two stacked rows gives
                 ~90dp of it back. */
              <View style={[styles.cardHost, styles.firstCardHost]}>
                <PlayerCards cards={cards} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* THE shared artwork — one element across both states, so the
            transition can't pop or resize discontinuously. Drag it down to
            collapse when expanded. */}
        {/* The neighbours' covers, parked one screen-width out on each side.
            Mounted whenever the player is open so their bitmaps are decoded
            BEFORE any swipe — paging one in then costs nothing. */}
        {expanded
          ? (
              [
                { song: neighbours.previous, side: -1 },
                { song: neighbours.next, side: 1 },
              ] as const
            ).map(({ song, side }) =>
              song ? (
                <Animated.View
                  key={`${side}:${song.id}`}
                  pointerEvents="none"
                  style={[
                    styles.art,
                    CONTINUOUS_CURVE,
                    {
                      borderRadius: TILE_RADIUS,
                      height: artFull,
                      left: artExpandedX + side * winW,
                      top: artExpandedY,
                      width: artFull,
                    },
                    pagerStyle,
                  ]}
                >
                  <SongArt
                    artUrl={song.artUrl || undefined}
                    emojiSize={88}
                    fadeMs={0}
                    style={styles.artMedia}
                  />
                </Animated.View>
              ) : null,
            )
          : null}

        <GestureDetector gesture={artGesture}>
          <Animated.View
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
            <SongArt
              artUrl={current.artUrl || undefined}
              emojiSize={88}
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
        <SongInfoSheet song={current} onClose={() => setInfoVisible(false)} />
      )}
      {editVisible && (
        <EditSongSheet
          songId={current.id}
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
  const songs = useSongsStore(s => s.songs);
  const playSong = usePlayerStore(s => s.playSong);
  const requestExpand = usePlayerStore(s => s.requestExpand);

  // Same order the home grid shows, so "the first one" means what it looks
  // like it means.
  const ordered = songs;
  const first = ordered[0] ?? null;

  // Parked on the first sound, so skipping behaves exactly as it would once
  // something is loaded: next steps forward, previous wraps to the last.
  const startAt = (song: (typeof ordered)[number] | undefined) => {
    if (!song) return;

    haptics.selection();
    playSong(song, ordered);
    requestExpand();
  };
  const start = () => startAt(first);

  return (
    <View
      style={[
        styles.idlePill,
        {
          backgroundColor: colors.surfaceContainer,
          // The same floating island the loaded banner resolves to — parked,
          // so it needs none of the animation, only the shape.
          borderColor: colors.border,
          borderWidth: IOS_ONLY_HAIRLINE,
          bottom: bottomInset + BANNER_BOTTOM_GAP,
        },
      ]}
    >
      <Pressable
        style={styles.miniRow}
        onPress={start}
        disabled={!first}
        accessibilityRole="button"
        accessibilityLabel={first ? first.name : t('player.empty')}
      >
        <View style={styles.idleArt}>
          <SongArt
            artUrl={first?.artUrl || undefined}
            emojiSize={22}
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
                variant="bodyMedium"
                numberOfLines={1}
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
              variant="bodyMedium"
              numberOfLines={1}
            />
          )}
        </View>
        {first ? (
          <>
            <GlyphButton
              onPress={() => startAt(ordered[ordered.length - 1])}
              style={styles.miniButton}
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
              onPress={start}
              style={styles.miniButton}
              accessibilityLabel={t('player.play')}
            >
              <PlayGlyph color={colors.onSurface} />
            </GlyphButton>
            <GlyphButton
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
  idlePill: {
    borderRadius: PILL_RADIUS,
    elevation: PILL_ELEVATION,
    left: BANNER_SIDE_INSET,
    position: 'absolute',
    right: BANNER_SIDE_INSET,
    ...PILL_LIFT,
    ...CONTINUOUS_CURVE,
  },
  idleArt: {
    height: MINI_ART_SIZE,
    marginLeft: MINI_ART_PILL_X,
    width: MINI_ART_SIZE,
  },
  idleInfo: { flex: 1, gap: 1, paddingLeft: 12 },
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
    ...PILL_LIFT,
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
  progressTrack: {
    borderRadius: PROGRESS_HEIGHT / 2,
    height: PROGRESS_HEIGHT,
    left: BANNER_SIDE_INSET + PROGRESS_INSET_X,
    overflow: 'hidden',
    position: 'absolute',
    right: BANNER_SIDE_INSET + PROGRESS_INSET_X,
    top: MINI_PLAYER_HEIGHT - PROGRESS_BOTTOM - PROGRESS_HEIGHT,
  },
  progressFill: { height: '100%' },
  miniRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: MINI_ROW_HEIGHT,
    paddingRight: 4,
  },
  // Only the LOADED banner needs this: the idle pill is already inset, being
  // the pill itself rather than a row inside a full-width container.
  miniRowInset: { marginHorizontal: BANNER_SIDE_INSET },
  miniBody: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    // Clears the shared artwork sitting in the banner slot.
    paddingLeft: MINI_ART_PILL_X + MINI_ART_SIZE + 12,
  },
  miniInfo: { gap: 1 },
  miniButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  playTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 9,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderTopWidth: 9,
    marginLeft: 3,
  },
  pauseRow: { flexDirection: 'row', gap: 4 },
  pauseBar: { borderRadius: 1.5, height: 16, width: 4.5 },
  nextRow: { alignItems: 'center', flexDirection: 'row', gap: 1.5 },
  nextTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderTopWidth: 7,
  },
  nextBar: { borderRadius: 1, height: 14, width: 2.5 },
  previousRow: { alignItems: 'center', flexDirection: 'row', gap: 1.5 },
  previousTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderRightWidth: 11,
    borderTopColor: 'transparent',
    borderTopWidth: 7,
  },
  expanded: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 12,
  },
  // The invisible drag-to-close surface behind the whole header region.
  dragZone: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedBody: {
    bottom: 0,
    left: 0,
    paddingHorizontal: SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  titleSlot: { width: '100%' },
  titleBlock: {
    gap: 3,
    paddingBottom: 18,
    width: '100%',
  },
  // Overlays the real title block, so a neighbour's text costs no layout.
  titleGhost: { position: 'absolute', top: 0 },
  titleText: { fontWeight: '700' },
  host: { width: '100%' },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 28,
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  transportSide: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  transportPlay: {
    alignItems: 'center',
    borderRadius: PLAY_BUTTON_SIZE / 2,
    height: PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    width: PLAY_BUTTON_SIZE,
  },
  sliderBlock: { position: 'relative', width: '100%' },
  sliderBlockFraming: { marginBottom: CLIP_FRAMING_GAP },
  // The brackets ride the slider row — never down into the time labels.
  handlesRegion: {
    height: HANDLES_REGION_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  clipActionsHost: {
    height: 56,
    width: '100%',
  },
  cardHost: {
    height: 96,
    marginTop: 12,
    width: '100%',
  },
  // Extra air between the transport and the first card.
  firstCardHost: { marginTop: 28 },
  art: { overflow: 'hidden', position: 'absolute', ...CONTINUOUS_CURVE },
  artMedia: { height: '100%', width: '100%' },
});
