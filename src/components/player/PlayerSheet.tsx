import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  Button,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  OutlinedButton,
  Row,
  Shape,
  Slider,
  Surface,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';
import { awardTrophy } from '@portfolio/trophies';
import { usePathname } from 'expo-router';
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

import { ClipHandles } from '@/components/player/ClipHandles';
import { ClipsSheet } from '@/components/player/ClipsSheet';
import { PlayerBackdrop } from '@/components/player/PlayerBackdrop';
import { rateLabel, ShaperSheet } from '@/components/player/ShaperSheet';
import { SongInfoSheet } from '@/components/player/SongInfoSheet';
import { EditSongSheet } from '@/components/songs/EditSongSheet';
import { RippleIconButton } from '@/components/ui/RippleIconButton';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { TROPHY_IDS } from '@/constants/trophies';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { createClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { RESTART_THRESHOLD_S, usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useShapesStore } from '@/store/shapes';
import { useSongsStore } from '@/store/songs';
import { TILE_RADIUS } from '@/styles/shape';

// ---------------------------------------------------------------------------
// The YT-Music player interaction: the bottom banner and the full player are
// ONE bottom-anchored, full-height surface. `progress` (0 collapsed, 1
// expanded) drives transform-only animation — the container translates up,
// the single shared artwork element scales/travels from the 44dp thumb to the
// expanded square, the mini row cross-fades into the expanded controls.
//
// The expanded surface is a FIXED console: art, title (with an overflow menu
// for song info / editing), the native scrubber, transport, and two cards —
// Shape and Clips — that open their own bottom sheets. Nothing scrolls, so
// nothing can fight the drag-to-close gesture.
// ---------------------------------------------------------------------------

/** CONTENT height of the collapsed banner (consumers add the bottom inset). */
export const MINI_PLAYER_HEIGHT = 64;

const PROGRESS_HEIGHT = 2;
const MINI_ROW_HEIGHT = MINI_PLAYER_HEIGHT - PROGRESS_HEIGHT;
const MINI_ART_SIZE = 44;
// The artwork is ONE element scaled between the two states, so a fixed
// borderRadius renders ~5x smaller when collapsed. These are the radii we want
// to SEE at each end; the style divides by the live scale to hit them.
const MINI_ART_RADIUS = 8;
const MINI_ART_X = 16;
const MINI_ART_Y = PROGRESS_HEIGHT + (MINI_ROW_HEIGHT - MINI_ART_SIZE) / 2;

// Clearance under the collapsed banner's content, above the nav-bar inset.
const BANNER_BOTTOM_GAP = 8;

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
const MENU_ICON_SIZE = 24;

const CARD_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 12,
    topEnd: 12,
    bottomStart: 12,
    bottomEnd: 12,
  },
});

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

export function PlayerSheet() {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
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
  const pathname = usePathname();
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
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.35],
      [colors.surfaceContainer, colors.background],
    ),
  }));

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

  const hairlineStyle = useAnimatedStyle(() => ({
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
  const [clipsVisible, setClipsVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useClipsSubscription(current?.id);
  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  // Settings-ish screens: the floating banner reads as clutter there.
  if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/manage-account')
  )
    return null;

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

  // Perceptible ripple on the hand-drawn banner buttons (theme-safe: the
  // dynamic palette tokens reject alpha suffixes).
  const ripple = {
    borderless: true,
    color: scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
    radius: 26,
  };

  return (
    <>
      <Animated.View
        entering={reduceMotion ? undefined : SlideInDown.duration(220)}
        style={[styles.container, { height: winH }, containerStyle]}
      >
        {/* The artwork wash sits behind EVERY layer of the sheet and tracks
            the drag directly, so it grows in with the surface instead of
            popping once the expanded chrome crosses its fade threshold. */}
        <Animated.View
          style={[styles.backdropLayer, backdropStyle]}
          pointerEvents="none"
        >
          <PlayerBackdrop artUrl={current.artUrl || undefined} />
        </Animated.View>

        {/* Collapsed chrome: hairline progress + the banner row. */}
        <Animated.View
          style={[
            styles.hairlineTrack,
            { backgroundColor: colors.surfaceVariant },
            hairlineStyle,
          ]}
        >
          <View
            style={[
              styles.hairlineFill,
              {
                backgroundColor: colors.primary,
                width: `${progressRatio * 100}%`,
              },
            ]}
          />
        </Animated.View>

        <GestureDetector gesture={dragUp}>
          <Animated.View
            style={[styles.miniRow, miniRowStyle]}
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
            <Pressable
              onPress={onPrevious}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </Pressable>
            <Pressable
              onPress={onToggle}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
            >
              {playing ? (
                <PauseGlyph color={colors.onSurface} />
              ) : (
                <PlayGlyph color={colors.onSurface} />
              )}
            </Pressable>
            <Pressable
              onPress={onNext}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} />
            </Pressable>
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
            <RippleIconButton
              name="chevron-down"
              onPress={collapse}
              accessibilityLabel={t('common.back')}
            />
            {/* Song overflow: metadata + the same edit/delete sheet the
                library's long-press opens. The ripple Pressable sits ON TOP
                of the Compose trigger (whose own state layer is invisible);
                the DropdownMenu still anchors to the icon under it. */}
            <View style={styles.menuAnchor}>
              <ThemedHost matchContents>
                <DropdownMenu
                  expanded={menuOpen}
                  onDismissRequest={() => setMenuOpen(false)}
                >
                  <DropdownMenu.Trigger>
                    <IconButton onClick={() => setMenuOpen(true)}>
                      <AppIcon
                        name="more-vert"
                        tint={colors.onSurface}
                        contentDescription={t('player.menu.label')}
                      />
                    </IconButton>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Items>
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        setInfoVisible(true);
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text color={colors.onSurface}>
                          {t('player.menu.info')}
                        </Text>
                      </DropdownMenuItem.Text>
                      <DropdownMenuItem.LeadingIcon>
                        <AppIcon
                          name="info"
                          size={MENU_ICON_SIZE}
                          tint={colors.onSurface}
                        />
                      </DropdownMenuItem.LeadingIcon>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        setEditVisible(true);
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text color={colors.onSurface}>
                          {t('player.menu.edit')}
                        </Text>
                      </DropdownMenuItem.Text>
                      <DropdownMenuItem.LeadingIcon>
                        <AppIcon
                          name="edit"
                          size={MENU_ICON_SIZE}
                          tint={colors.onSurface}
                        />
                      </DropdownMenuItem.LeadingIcon>
                    </DropdownMenuItem>
                  </DropdownMenu.Items>
                </DropdownMenu>
              </ThemedHost>
              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={8}
                style={StyleSheet.absoluteFill}
                android_ripple={ripple}
                accessibilityRole="button"
                accessibilityLabel={t('player.menu.label')}
              />
            </View>
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
            <View style={styles.sliderBlock}>
              <ThemedHost
                matchContents={{ vertical: true }}
                style={styles.host}
              >
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 0 }}
                  modifiers={[fillMaxWidth()]}
                >
                  <Slider
                    value={Math.min(position, duration)}
                    min={0}
                    max={duration}
                    onValueChange={value => {
                      lastDragRef.current = value;
                      setDragValue(value);
                    }}
                    onValueChangeFinished={() => {
                      // seek() also ends any clip replay.
                      seek(lastDragRef.current);
                      setDragValue(null);
                    }}
                    modifiers={[fillMaxWidth()]}
                  />
                  <Row
                    horizontalArrangement="spaceBetween"
                    modifiers={[fillMaxWidth()]}
                  >
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'labelMedium' }}
                    >
                      {formatTime(position)}
                    </Text>
                    {clipMode ? (
                      <Text
                        color={colors.onSurface}
                        style={{ typography: 'labelMedium' }}
                        // Air above (slider) and below (transport).
                        modifiers={[padding(0, 8, 0, 10)]}
                      >
                        {`${formatTime(clipRange.startS)} – ${formatTime(clipRange.endS)}`}
                      </Text>
                    ) : null}
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'labelMedium' }}
                    >
                      {formatTime(storeDuration)}
                    </Text>
                  </Row>
                </Column>
              </ThemedHost>
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
                layer is invisible on this dark surface, so these carry their
                own ripple — the YT Music idiom for a transport row. */}
            <View style={styles.transportRow}>
              <Pressable
                onPress={onPrevious}
                hitSlop={12}
                style={styles.transportSide}
                android_ripple={ripple}
                accessibilityRole="button"
                accessibilityLabel={t('player.previous')}
              >
                <PreviousGlyph color={colors.onSurface} />
              </Pressable>
              <Pressable
                onPress={onToggle}
                hitSlop={12}
                style={[
                  styles.transportPlay,
                  { backgroundColor: colors.primary },
                ]}
                // Circular and sized to the pill, so the ripple fills the
                // button instead of bleeding past it.
                android_ripple={{
                  borderless: true,
                  color: 'rgba(255,255,255,0.28)',
                  radius: PLAY_BUTTON_SIZE / 2,
                }}
                accessibilityRole="button"
                accessibilityLabel={t(playing ? 'player.pause' : 'player.play')}
              >
                {playing ? (
                  <PauseGlyph color={colors.onPrimary} />
                ) : (
                  <PlayGlyph color={colors.onPrimary} />
                )}
              </Pressable>
              <Pressable
                onPress={onNext}
                hitSlop={12}
                style={styles.transportSide}
                android_ripple={ripple}
                accessibilityRole="button"
                accessibilityLabel={t('player.next')}
              >
                <NextGlyph color={colors.onSurface} />
              </Pressable>
            </View>

            {/* While framing a clip, the action row takes the cards' place. */}
            {clipMode ? (
              <ThemedHost
                style={[styles.clipActionsHost, styles.firstCardHost]}
              >
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 8 }}
                  modifiers={[fillMaxWidth()]}
                >
                  <IconButton onClick={() => setClipMode(false)}>
                    <AppIcon
                      name="close"
                      size={22}
                      tint={colors.onSurfaceMuted}
                      contentDescription={t('common.cancel')}
                    />
                  </IconButton>
                  <Column modifiers={[weight(1)]}>
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'labelLarge' }}
                    >
                      {t('player.clips.new')}
                    </Text>
                  </Column>
                  <OutlinedButton onClick={onPreviewClip}>
                    <Text color={colors.onSurface} maxLines={1}>
                      {t('player.clips.preview')}
                    </Text>
                  </OutlinedButton>
                  <Button onClick={onSaveClip}>
                    <Text maxLines={1}>{t('player.clips.saveClip')}</Text>
                  </Button>
                </Row>
              </ThemedHost>
            ) : (
              /* Shape + Clips — the two studios, side by side as the console's
                 footer. OUTLINED (Material 3's own variant for exactly this):
                 a filled surface sat as two grey slabs on top of the artwork
                 wash and cut the gradient in half. Transparent + a hairline
                 outline keeps the wash running edge to edge, and one row of two
                 instead of two stacked rows gives ~90dp of it back. */
              <ThemedHost style={[styles.cardHost, styles.firstCardHost]}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
                  modifiers={[fillMaxWidth()]}
                >
                  {(
                    [
                      {
                        icon: 'tune',
                        key: 'shape',
                        label: t('player.shape.title'),
                        onPress: () => setShaperVisible(true),
                        summary: shapeSummary,
                      },
                      {
                        icon: 'content-cut',
                        key: 'clips',
                        label: t('player.clips.title'),
                        onPress: () => setClipsVisible(true),
                        summary: clipsSummary,
                      },
                    ] as const
                  ).map(card => (
                    <Surface
                      key={card.key}
                      onClick={() => {
                        haptics.selection();
                        card.onPress();
                      }}
                      color="transparent"
                      border={{ width: 1, color: colors.border }}
                      shape={CARD_SHAPE}
                      modifiers={[weight(1)]}
                    >
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 10 }}
                        modifiers={[fillMaxWidth(), padding(14, 18, 14, 18)]}
                      >
                        <AppIcon
                          name={card.icon}
                          size={26}
                          tint={colors.primary}
                          contentDescription={card.label}
                        />
                        <Column
                          verticalArrangement={{ spacedBy: 1 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            color={colors.onSurface}
                            style={{ typography: 'bodyLarge' }}
                            maxLines={1}
                          >
                            {card.label}
                          </Text>
                          <Text
                            color={colors.onSurfaceMuted}
                            style={{ typography: 'bodySmall' }}
                            maxLines={1}
                          >
                            {card.summary}
                          </Text>
                        </Column>
                      </Row>
                    </Surface>
                  ))}
                </Row>
              </ThemedHost>
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
  const { colors, scheme } = useAppTheme();
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

  const ripple = {
    borderless: true,
    color: scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
    radius: 26,
  };

  return (
    <View
      style={[
        styles.idleContainer,
        {
          backgroundColor: colors.surfaceContainer,
          paddingBottom: bottomInset + BANNER_BOTTOM_GAP,
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
            <Pressable
              onPress={() => startAt(ordered[ordered.length - 1])}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t('player.previous')}
            >
              <PreviousGlyph color={colors.onSurface} />
            </Pressable>
            <Pressable
              onPress={start}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t('player.play')}
            >
              <PlayGlyph color={colors.onSurface} />
            </Pressable>
            <Pressable
              onPress={() => startAt(ordered[1] ?? first)}
              hitSlop={8}
              style={styles.miniButton}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel={t('player.next')}
            >
              <NextGlyph color={colors.onSurface} />
            </Pressable>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  idleContainer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  idleArt: {
    height: MINI_ART_SIZE,
    marginLeft: MINI_ART_X,
    width: MINI_ART_SIZE,
  },
  idleInfo: { flex: 1, gap: 1, paddingLeft: 12 },
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  backdropLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hairlineTrack: { height: PROGRESS_HEIGHT, width: '100%' },
  hairlineFill: { height: PROGRESS_HEIGHT },
  miniRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: MINI_ROW_HEIGHT,
    paddingRight: 4,
  },
  miniBody: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    // Clears the shared artwork sitting in the banner slot.
    paddingLeft: MINI_ART_X + MINI_ART_SIZE + 12,
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
  menuAnchor: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
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
  // The brackets ride the slider row (the host's first ~44dp).
  handlesRegion: {
    height: 44,
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
  art: { overflow: 'hidden', position: 'absolute' },
  artMedia: { height: '100%', width: '100%' },
});
