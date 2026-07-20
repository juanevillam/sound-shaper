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
  FilledIconButton,
  FilterChip,
  IconButton,
  Row,
  Shape,
  Slider,
  Surface,
  Switch,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  horizontalScroll,
  padding,
  size,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  SlideInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipScrubber } from '@/components/player/ClipScrubber';
import { PlayerTabs } from '@/components/player/PlayerTabs';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB } from '@/lib/audioEngine';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { createClip, deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import { EQ_PRESETS, useShaperStore } from '@/store/shaper';
import { TILE_RADIUS } from '@/styles/shape';

// ---------------------------------------------------------------------------
// The YT-Music player interaction: the bottom banner and the full player are
// ONE bottom-anchored, full-height surface. `progress` (0 collapsed, 1
// expanded) drives transform-only animation — the container translates up,
// the single shared artwork element scales/travels from the 44dp thumb to the
// expanded square, the mini row cross-fades into the expanded controls.
//
// Expanded structure (the premium pass): art + title + scrubber + transport
// are FIXED — they never scroll away — and everything below them lives behind
// a Shape / Clips switcher. Shape is the flagship page: the equalizer with its
// presets, then speed and pitch. Clips is the bookmarking page.
// ---------------------------------------------------------------------------

/** CONTENT height of the collapsed banner (consumers add the bottom inset). */
export const MINI_PLAYER_HEIGHT = 64;

const PROGRESS_HEIGHT = 2;
const MINI_ROW_HEIGHT = MINI_PLAYER_HEIGHT - PROGRESS_HEIGHT;
const MINI_ART_SIZE = 44;
const MINI_ART_X = 16;
const MINI_ART_Y = PROGRESS_HEIGHT + (MINI_ROW_HEIGHT - MINI_ART_SIZE) / 2;

// A little clearance so the collapsed banner floats clearly above the nav bar
// instead of sitting flush against it.
const BANNER_BOTTOM_GAP = 8;

const EXPAND_MS = 320;
const COLLAPSE_MS = 260;
// Drag-release: past this progress (or flung faster than this) it commits.
const SNAP_PROGRESS = 0.28;
const SNAP_VELOCITY = 600;

const CONTROL_ICON_SIZE = 32;
const PLAY_BUTTON_SIZE = 64;
const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');
const EQ_LABEL_WIDTH = 36;
const dbLabel = (db: number) => (db > 0 ? `+${db}` : `${db}`);

const SIDE_PADDING = 24;

// Scrolling the tab pages shrinks the artwork (Spotify/YT-Music collapsing
// header): full size at rest, ART_MIN_SHRINK of it after SHRINK_RANGE px.
// The title block compresses in step (toward the banner's type scale) so the
// text never towers over a small artwork.
const SHRINK_RANGE = 140;
const ART_MIN_SHRINK = 0.55;
const TITLE_MIN_SHRINK = 0.72;

// EQ band sliders snap to whole dB; speed snaps to quarter steps.
const EQ_SLIDER_STEPS = EQ_MAX_DB - EQ_MIN_DB - 1;
const RATE_MIN = 0.5;
const RATE_MAX = 2;
const RATE_STEP = 0.25;
const RATE_SLIDER_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) - 1;

// Fresh trimmer range for a song: the first stretch, capped to the track.
const DEFAULT_CLIP_LENGTH_S = 15;

const CLIP_ROW_SHAPE = Shape.RoundedCorner({
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

type ShaperTab = 'shape' | 'clips';

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

export function PlayerSheet() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { showSnackbar } = useSnackbar();
  const reduceMotion = useReducedMotion();

  const current = usePlayerStore(s => s.current);
  const toggle = usePlayerStore(s => s.toggle);
  const nextSong = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);
  const seek = usePlayerStore(s => s.seek);
  const playing = usePlayerStore(s => s.playing);
  const storePosition = usePlayerStore(s => s.position);
  const storeDuration = usePlayerStore(s => s.duration);
  const expandNonce = usePlayerStore(s => s.expandNonce);

  const gains = useShaperStore(s => s.gains);
  const setBandGain = useShaperStore(s => s.setBandGain);
  const activePreset = useShaperStore(s => s.activePreset);
  const applyPreset = useShaperStore(s => s.applyPreset);

  // Geometry (all deterministic — no measuring, no flicker). The collapsed
  // banner rests `insets.bottom + gap` above the screen bottom, so its content
  // always clears the Android nav bar. The expanded art is deliberately
  // moderate (~58% width) so the transport and the shaping tools share the
  // screen with it instead of living below the fold.
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

  const [tab, setTab] = useState<ShaperTab>('shape');

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

        collapse();
        return true;
      },
    );

    return () => subscription.remove();
  }, [collapse]);

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

  // Drag the artwork area down to collapse.
  const dragDown = Gesture.Pan()
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

  // --- Animated styles -----------------------------------------------------
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * travel }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.35],
      [colors.surfaceContainer, colors.background],
    ),
  }));

  // Scroll offset of the active tab page — drives the artwork shrink.
  const tabScrollY = useSharedValue(0);
  const onTabScroll = useAnimatedScrollHandler(event => {
    tabScrollY.value = event.contentOffset.y;
  });

  const artStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Scrolling the tab content shrinks the art toward its top edge. Gated by
    // `p` so the collapse morph always starts from clean geometry.
    const shrink =
      1 -
      (1 -
        interpolate(
          tabScrollY.value,
          [0, SHRINK_RANGE],
          [1, ART_MIN_SHRINK],
          Extrapolation.CLAMP,
        )) *
        p;
    const scale = (artScaleMin + (1 - artScaleMin) * p) * shrink;
    // Centers travel from the mini thumb to the expanded slot.
    const fromCx = MINI_ART_X + MINI_ART_SIZE / 2;
    const fromCy = MINI_ART_Y + MINI_ART_SIZE / 2;
    const toCx = artExpandedX + artFull / 2;
    const toCy = artExpandedY + artFull / 2;

    return {
      transform: [
        { translateX: (fromCx - toCx) * (1 - p) },
        // The shrink term pins the art's TOP edge instead of its center.
        {
          translateY: (fromCy - toCy) * (1 - p) - ((1 - shrink) * artFull) / 2,
        },
        { scale },
      ],
    };
  });

  // The fixed section below the art rides up to claim the freed space.
  const bodyStyle = useAnimatedStyle(() => {
    const shrink = interpolate(
      tabScrollY.value,
      [0, SHRINK_RANGE],
      [1, ART_MIN_SHRINK],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY: -(1 - shrink) * artFull }] };
  });

  // Title + artist compress with the art (scaled from the left edge, so the
  // text shrinks in place instead of drifting toward center).
  const titleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          tabScrollY.value,
          [0, SHRINK_RANGE],
          [1, TITLE_MIN_SHRINK],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

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

  // The framed range on the clips scrubber. Re-seeded per song once its
  // duration is known.
  const [clipRange, setClipRange] = useState({ startS: 0, endS: 0 });

  const trimmerDuration = Math.floor(storeDuration);
  useEffect(() => {
    setClipRange({
      startS: 0,
      endS:
        trimmerDuration > 0
          ? Math.min(DEFAULT_CLIP_LENGTH_S, trimmerDuration)
          : 0,
    });
    // Re-seed per track (identified by id), not on every duration tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, trimmerDuration > 0]);

  useClipsSubscription(current?.id);
  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  if (!current) return null;

  const onPreviewClip = () => {
    haptics.selection();
    playClip('preview', clipRange.startS * 1000, clipRange.endS * 1000);
  };

  // Clips are just timestamps — no naming step, the save is one tap.
  const onSaveClip = () => {
    haptics.selection();
    createClip({
      songId: current.id,
      startMs: clipRange.startS * 1000,
      endMs: clipRange.endS * 1000,
      label: '',
    })
      .then(() => showSnackbar(t('snackbar.clip-created')))
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));
  };

  const onDeleteClip = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, songId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  const onSwitchTab = (next: ShaperTab) => {
    if (next === tab) return;
    haptics.selection();
    // The pages remount at offset 0 (keyed scroller) — drop the art shrink.
    tabScrollY.value = withTiming(0, { duration: 180 });
    setTab(next);
  };

  const duration = storeDuration > 0 ? storeDuration : 1;
  const position = dragValue ?? storePosition;
  const progressRatio =
    storeDuration > 0 ? Math.min(storePosition / storeDuration, 1) : 0;
  const subtitle = current.artist || ' ';

  // The typed t() needs literal keys, so map preset ids explicitly.
  const presetLabel = (key: string) => {
    switch (key) {
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
        return t('player.eq.presets.flat');
    }
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
            <Pressable
              onPress={toggle}
              hitSlop={8}
              style={styles.miniButton}
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
              onPress={nextSong}
              hitSlop={8}
              style={styles.miniButton}
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
          <View style={[styles.expandedTop, { paddingTop: insets.top + 4 }]}>
            <ThemedHost matchContents>
              <IconButton onClick={collapse}>
                <AppIcon
                  name="chevron-down"
                  tint={colors.onSurface}
                  contentDescription={t('common.back')}
                />
              </IconButton>
            </ThemedHost>
          </View>

          {/* Everything under the art: title + transport stay FIXED; only the
              tab pages scroll (and scrolling them shrinks the art, so the
              whole block rides up to claim the freed space). */}
          <Animated.View
            style={[styles.expandedBody, { top: contentTop }, bodyStyle]}
          >
            <View style={styles.titleBlock}>
              <Animated.View style={[styles.titleScaler, titleStyle]}>
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
            </View>

            {/* The timeline. Shape = the plain scrubber; Clips = the SAME
                timeline carrying the trim handles, so the range is placed
                while listening (tap the tinted range to preview it). */}
            {tab === 'shape' ? (
              <ThemedHost
                matchContents={{ vertical: true }}
                style={styles.transportHost}
              >
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 0 }}
                  modifiers={[
                    fillMaxWidth(),
                    padding(SIDE_PADDING, 0, SIDE_PADDING, 0),
                  ]}
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
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'labelMedium' }}
                    >
                      {formatTime(storeDuration)}
                    </Text>
                  </Row>
                </Column>
              </ThemedHost>
            ) : (
              <View style={styles.clipScrubberWrap}>
                <ClipScrubber
                  durationS={trimmerDuration}
                  positionS={storePosition}
                  startS={clipRange.startS}
                  endS={clipRange.endS}
                  onSeek={seek}
                  onChangeRange={(startS, endS) =>
                    setClipRange({ startS, endS })
                  }
                  onPreview={onPreviewClip}
                />
              </View>
            )}

            <ThemedHost
              matchContents={{ vertical: true }}
              style={styles.transportHost}
            >
              <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 28 }}
                  modifiers={[padding(0, 4, 0, 4)]}
                >
                  <IconButton onClick={previous} modifiers={[size(52, 52)]}>
                    <AppIcon
                      name="skip-previous"
                      size={CONTROL_ICON_SIZE}
                      tint={colors.onSurface}
                      contentDescription={t('player.previous')}
                    />
                  </IconButton>
                  <FilledIconButton
                    onClick={toggle}
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
                  <IconButton onClick={nextSong} modifiers={[size(52, 52)]}>
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

            {/* Shape / Clips switcher — real tabs with a gliding underline
                (segmented buttons read as form controls, not navigation). */}
            <View style={styles.tabsRow}>
              <PlayerTabs
                tabs={[
                  { key: 'shape', label: t('player.tabs.shape') },
                  { key: 'clips', label: t('player.tabs.clips') },
                ]}
                active={tab}
                onChange={onSwitchTab}
              />
            </View>

            <Animated.ScrollView
              key={tab}
              style={styles.tabScroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              scrollEnabled={expanded}
              showsVerticalScrollIndicator={false}
              onScroll={onTabScroll}
              scrollEventThrottle={16}
            >
              {tab === 'shape' ? (
                <ThemedHost
                  matchContents={{ vertical: true }}
                  style={styles.tabHost}
                >
                  <Column
                    verticalArrangement={{ spacedBy: 8 }}
                    modifiers={[
                      fillMaxWidth(),
                      padding(SIDE_PADDING, 8, SIDE_PADDING, 0),
                    ]}
                  >
                    {/* Equalizer — live band gains on the shaping graph. */}
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'labelLarge' }}
                    >
                      {t('player.eq.title')}
                    </Text>

                    {/* One scrolling row of preset chips ("Flat" doubles as
                        the reset). */}
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 8 }}
                      modifiers={[fillMaxWidth(), horizontalScroll()]}
                    >
                      {EQ_PRESETS.map(preset => (
                        <FilterChip
                          key={preset.i18nKey}
                          selected={activePreset === preset.i18nKey}
                          onClick={() => applyPreset(preset.i18nKey)}
                        >
                          <FilterChip.Label>
                            <Text maxLines={1}>
                              {presetLabel(preset.i18nKey)}
                            </Text>
                          </FilterChip.Label>
                        </FilterChip>
                      ))}
                    </Row>

                    {EQ_BANDS.map((band, index) => (
                      <Row
                        key={band.hz}
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 8 }}
                        modifiers={[fillMaxWidth()]}
                      >
                        <Text
                          color={colors.onSurfaceMuted}
                          style={{ typography: 'labelMedium' }}
                          modifiers={[width(EQ_LABEL_WIDTH)]}
                        >
                          {band.label}
                        </Text>
                        <Slider
                          value={gains[index]}
                          min={EQ_MIN_DB}
                          max={EQ_MAX_DB}
                          steps={EQ_SLIDER_STEPS}
                          onValueChange={value =>
                            setBandGain(index, Math.round(value))
                          }
                          modifiers={[weight(1)]}
                        />
                        <Text
                          color={colors.onSurface}
                          style={{ typography: 'labelMedium' }}
                          modifiers={[width(EQ_LABEL_WIDTH)]}
                        >
                          {dbLabel(gains[index])}
                        </Text>
                      </Row>
                    ))}

                    {/* Speed — one stepped slider (quarter-step snaps), the
                        live value beside the header. */}
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement="spaceBetween"
                      modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
                    >
                      <Text
                        color={colors.onSurfaceMuted}
                        style={{ typography: 'labelLarge' }}
                      >
                        {t('player.speed')}
                      </Text>
                      <Text
                        color={colors.onSurface}
                        style={{ typography: 'labelLarge' }}
                      >
                        {rateLabel(rate)}
                      </Text>
                    </Row>
                    <Slider
                      value={rate}
                      min={RATE_MIN}
                      max={RATE_MAX}
                      steps={RATE_SLIDER_STEPS}
                      onValueChange={value =>
                        setRate(Math.round(value / RATE_STEP) * RATE_STEP)
                      }
                      modifiers={[fillMaxWidth()]}
                    />

                    <Row
                      verticalAlignment="center"
                      horizontalArrangement="spaceBetween"
                      modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}
                    >
                      <Column
                        verticalArrangement={{ spacedBy: 2 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          color={colors.onSurface}
                          style={{ typography: 'bodyLarge' }}
                        >
                          {t('player.keepPitch')}
                        </Text>
                        <Text
                          color={colors.onSurfaceMuted}
                          style={{ typography: 'bodySmall' }}
                        >
                          {t('player.keepPitchDescription')}
                        </Text>
                      </Column>
                      <Switch
                        value={keepPitch}
                        onCheckedChange={setKeepPitch}
                      />
                    </Row>
                  </Column>
                </ThemedHost>
              ) : (
                <View style={styles.clipsPage}>
                  {/* The frame lives ON the timeline above; this page is just
                      save + the saved list. */}
                  <ThemedHost style={styles.clipActionsHost}>
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement="spaceBetween"
                      modifiers={[fillMaxWidth()]}
                    >
                      <Text
                        color={colors.onSurfaceMuted}
                        style={{ typography: 'labelLarge' }}
                      >
                        {t('player.clips.title')}
                      </Text>
                      <Button onClick={onSaveClip}>
                        <Text maxLines={1}>{t('player.clips.saveClip')}</Text>
                      </Button>
                    </Row>
                  </ThemedHost>

                  <ThemedHost
                    matchContents={{ vertical: true }}
                    style={styles.tabHost}
                  >
                    {clips.length === 0 ? (
                      <Text
                        color={colors.onSurfaceMuted}
                        style={{ typography: 'bodySmall' }}
                      >
                        {t('player.clips.empty')}
                      </Text>
                    ) : (
                      <Column
                        verticalArrangement={{ spacedBy: 2 }}
                        modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}
                      >
                        {clips.map(clip => {
                          const isActive = activeClip?.clipId === clip.id;
                          const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

                          return (
                            <Surface
                              key={clip.id}
                              onClick={() =>
                                playClip(clip.id, clip.startMs, clip.endMs)
                              }
                              color="transparent"
                              shape={CLIP_ROW_SHAPE}
                              modifiers={[fillMaxWidth()]}
                            >
                              <Row
                                verticalAlignment="center"
                                horizontalArrangement={{ spacedBy: 12 }}
                                modifiers={[
                                  fillMaxWidth(),
                                  padding(12, 4, 0, 4),
                                ]}
                              >
                                <Column
                                  verticalArrangement={{ spacedBy: 1 }}
                                  modifiers={[weight(1)]}
                                >
                                  <Text
                                    color={
                                      isActive
                                        ? colors.primary
                                        : colors.onSurface
                                    }
                                    style={{ typography: 'bodyLarge' }}
                                    maxLines={1}
                                  >
                                    {range}
                                  </Text>
                                </Column>
                                <IconButton
                                  onClick={() => onDeleteClip(clip.id)}
                                >
                                  <AppIcon
                                    name="delete"
                                    size={20}
                                    tint={colors.onSurfaceMuted}
                                    contentDescription={t(
                                      'player.clips.delete',
                                    )}
                                  />
                                </IconButton>
                              </Row>
                            </Surface>
                          );
                        })}
                      </Column>
                    )}
                  </ThemedHost>
                </View>
              )}
            </Animated.ScrollView>
          </Animated.View>
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
  expanded: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedTop: {
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  expandedBody: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  titleBlock: {
    paddingBottom: 6,
    paddingHorizontal: SIDE_PADDING,
    width: '100%',
  },
  // The scale pivots on the text's own top-left corner (inside the padding),
  // so shrinking never drifts the title toward center.
  titleScaler: { gap: 2, transformOrigin: 'top left' },
  titleText: { fontWeight: '700' },
  transportHost: { width: '100%' },
  clipScrubberWrap: { paddingHorizontal: SIDE_PADDING, paddingTop: 6 },
  tabsRow: {
    marginHorizontal: SIDE_PADDING,
    marginTop: 6,
  },
  tabScroll: { flex: 1, marginTop: 4 },
  tabHost: { width: '100%' },
  clipsPage: {
    gap: 12,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 12,
  },
  clipActionsHost: { height: 48 },
  art: { position: 'absolute' },
  artMedia: { height: '100%', width: '100%' },
});
