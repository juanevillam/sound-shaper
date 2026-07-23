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
  FilledIconButton,
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
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';
import { usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SlideInDown,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipHandles } from '@/components/player/ClipHandles';
import { ClipsSheet } from '@/components/player/ClipsSheet';
import { rateLabel, ShaperSheet } from '@/components/player/ShaperSheet';
import { SongInfoSheet } from '@/components/player/SongInfoSheet';
import { EditSongSheet } from '@/components/songs/EditSongSheet';
import { RippleIconButton } from '@/components/ui/RippleIconButton';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { createClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
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
const MINI_ART_X = 16;
const MINI_ART_Y = PROGRESS_HEIGHT + (MINI_ROW_HEIGHT - MINI_ART_SIZE) / 2;

// Clearance under the collapsed banner's content, above the nav-bar inset.
const BANNER_BOTTOM_GAP = 12;

const EXPAND_MS = 320;
const COLLAPSE_MS = 260;
// Drag-release: past this progress (or flung faster than this) it commits.
const SNAP_PROGRESS = 0.28;
const SNAP_VELOCITY = 600;

const CONTROL_ICON_SIZE = 32;
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

  // Geometry (all deterministic — no measuring, no flicker). The expanded art
  // is moderate (~58% width) so the whole console fits without scrolling.
  const miniTotal = MINI_PLAYER_HEIGHT + insets.bottom + BANNER_BOTTOM_GAP;
  const travel = winH - miniTotal;
  const artFull = Math.min(Math.round(winW * 0.58), 260);
  const artExpandedX = (winW - artFull) / 2;
  const artExpandedY = insets.top + 60;
  const artScaleMin = MINI_ART_SIZE / artFull;
  const contentTop = artExpandedY + artFull + 20;

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

    return {
      transform: [
        { translateX: (fromCx - toCx) * (1 - p) },
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

  if (!current) return null;

  // Settings-ish screens: the floating banner reads as clutter there.
  if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/manage-account')
  )
    return null;

  const hasPrevious =
    queue.findIndex(song => song.id === current.id) > 0 ||
    storePosition > 3; /* deep in a song "previous" restarts it */

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
      .then(() => showSnackbar(t('snackbar.clip-created')))
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));
  };

  const duration = storeDuration > 0 ? storeDuration : 1;
  const position = dragValue ?? storePosition;
  const progressRatio =
    storeDuration > 0 ? Math.min(storePosition / storeDuration, 1) : 0;
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
            {hasPrevious ? (
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
            ) : null}
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
          <GestureDetector gesture={dragDownTop}>
            <View style={[styles.expandedTop, { paddingTop: insets.top + 4 }]}>
              <RippleIconButton
                name="chevron-down"
                onPress={collapse}
                accessibilityLabel={t('common.back')}
              />
              {/* Song overflow: metadata + the same edit/delete sheet the
                  library's long-press opens. */}
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
            </View>
          </GestureDetector>

          {/* The console below the art — a fixed column, nothing scrolls. */}
          <View style={[styles.expandedBody, { top: contentTop }]}>
            <GestureDetector gesture={dragDownTitle}>
              <View style={styles.titleBlock}>
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

            <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 0 }}
                modifiers={[fillMaxWidth()]}
              >
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 28 }}
                  modifiers={[padding(0, 4, 0, 4)]}
                >
                  <IconButton onClick={onPrevious} modifiers={[size(52, 52)]}>
                    <AppIcon
                      name="skip-previous"
                      size={CONTROL_ICON_SIZE}
                      tint={colors.onSurface}
                      contentDescription={t('player.previous')}
                    />
                  </IconButton>
                  <FilledIconButton
                    onClick={onToggle}
                    modifiers={[size(PLAY_BUTTON_SIZE, PLAY_BUTTON_SIZE)]}
                  >
                    <AppIcon
                      name={playing ? 'pause' : 'play-arrow'}
                      size={36}
                      tint={colors.onPrimary}
                      contentDescription={t(
                        playing ? 'player.pause' : 'player.play',
                      )}
                    />
                  </FilledIconButton>
                  <IconButton onClick={onNext} modifiers={[size(52, 52)]}>
                    <AppIcon
                      name="skip-next"
                      size={CONTROL_ICON_SIZE}
                      tint={colors.onSurface}
                      contentDescription={t('player.next')}
                    />
                  </IconButton>
                </Row>
              </Column>
            </ThemedHost>

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
              <>
                {/* Shape + Clips — the two studios, one card each. */}
                <ThemedHost style={[styles.cardHost, styles.firstCardHost]}>
                  <Surface
                    onClick={() => {
                      haptics.selection();
                      setShaperVisible(true);
                    }}
                    color={colors.surfaceContainer}
                    shape={CARD_SHAPE}
                    modifiers={[fillMaxWidth()]}
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 16 }}
                      modifiers={[fillMaxWidth(), padding(16, 14, 12, 14)]}
                    >
                      <AppIcon
                        name="tune"
                        size={24}
                        tint={colors.primary}
                        contentDescription={t('player.shape.title')}
                      />
                      <Column
                        verticalArrangement={{ spacedBy: 1 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          color={colors.onSurface}
                          style={{ typography: 'bodyLarge' }}
                        >
                          {t('player.shape.title')}
                        </Text>
                        <Text
                          color={colors.onSurfaceMuted}
                          style={{ typography: 'bodySmall' }}
                          maxLines={1}
                        >
                          {shapeSummary}
                        </Text>
                      </Column>
                      <AppIcon
                        name="chevron"
                        size={22}
                        tint={colors.onSurfaceMuted}
                      />
                    </Row>
                  </Surface>
                </ThemedHost>

                <ThemedHost style={styles.cardHost}>
                  <Surface
                    onClick={() => {
                      haptics.selection();
                      setClipsVisible(true);
                    }}
                    color={colors.surfaceContainer}
                    shape={CARD_SHAPE}
                    modifiers={[fillMaxWidth()]}
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 16 }}
                      modifiers={[fillMaxWidth(), padding(16, 14, 12, 14)]}
                    >
                      <AppIcon
                        name="content-cut"
                        size={24}
                        tint={colors.primary}
                        contentDescription={t('player.clips.title')}
                      />
                      <Column
                        verticalArrangement={{ spacedBy: 1 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          color={colors.onSurface}
                          style={{ typography: 'bodyLarge' }}
                        >
                          {t('player.clips.title')}
                        </Text>
                        <Text
                          color={colors.onSurfaceMuted}
                          style={{ typography: 'bodySmall' }}
                          maxLines={1}
                        >
                          {clipsSummary}
                        </Text>
                      </Column>
                      <AppIcon
                        name="chevron"
                        size={22}
                        tint={colors.onSurfaceMuted}
                      />
                    </Row>
                  </Surface>
                </ThemedHost>
              </>
            )}
          </View>
        </Animated.View>

        {/* THE shared artwork — one element across both states, so the
            transition can't pop or resize discontinuously. Drag it down to
            collapse when expanded. */}
        <GestureDetector gesture={dragDown}>
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
              style={[styles.artMedia, { borderRadius: TILE_RADIUS }]}
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

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
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
  expandedBody: {
    bottom: 0,
    left: 0,
    paddingHorizontal: SIDE_PADDING,
    position: 'absolute',
    right: 0,
  },
  titleBlock: {
    gap: 2,
    paddingBottom: 6,
    width: '100%',
  },
  titleText: { fontWeight: '700' },
  host: { width: '100%' },
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
    height: 76,
    marginTop: 12,
    width: '100%',
  },
  // Extra air between the transport and the first card.
  firstCardHost: { marginTop: 28 },
  art: { position: 'absolute' },
  artMedia: { height: '100%', width: '100%' },
});
