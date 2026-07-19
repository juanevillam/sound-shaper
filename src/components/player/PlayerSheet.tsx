import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  Button,
  Column,
  FilledIconButton,
  IconButton,
  Row,
  SegmentedButton,
  Shape,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Surface,
  Switch,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';
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

import { ClipSaveSheet } from '@/components/player/ClipSaveSheet';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import { TILE_RADIUS } from '@/styles/shape';

// ---------------------------------------------------------------------------
// The YT-Music player interaction: the bottom banner and the full player are
// ONE bottom-anchored, full-height surface. `progress` (0 collapsed, 1
// expanded) drives transform-only animation — the container translates up,
// the single shared artwork element scales/travels from the 44dp thumb to the
// full-width square, the mini row cross-fades into the expanded controls.
// One art element = nothing remounts, nothing resizes discontinuously.
// Tap the banner (or drag it up) to expand; chevron, drag-down on the art, or
// Android back to collapse. Screens never navigate to a player route.
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
const PLAY_BUTTON_SIZE = 72;
const RATE_PRESETS = [0.5, 0.75, 1, 1.5, 2];
const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');

// A clip needs at least this much room between its marks to be worth saving.
const MIN_CLIP_MS = 1000;

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
  const playlistId = usePlayerStore(s => s.playlistId);
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

  // Geometry (all deterministic — no measuring, no flicker). The collapsed
  // banner rests `insets.bottom + gap` above the screen bottom, so its content
  // always clears the Android nav bar.
  const miniTotal = MINI_PLAYER_HEIGHT + insets.bottom + BANNER_BOTTOM_GAP;
  const travel = winH - miniTotal;
  const artFull = Math.min(winW - 48, 420);
  const artExpandedX = (winW - artFull) / 2;
  const artExpandedY = insets.top + 56;
  const artScaleMin = MINI_ART_SIZE / artFull;
  const contentTop = artExpandedY + artFull + 16;

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

  // Clip marking state (start captured, then end, then the save sheet).
  const [markStartMs, setMarkStartMs] = useState<number | null>(null);
  const [pendingRange, setPendingRange] = useState<{
    startMs: number;
    endMs: number;
  } | null>(null);

  // A track change invalidates a half-made mark.
  useEffect(() => {
    setMarkStartMs(null);
  }, [current?.id]);

  useClipsSubscription(playlistId, current?.id);
  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  if (!current) return null;

  const onMarkPress = () => {
    haptics.selection();
    const nowMs = Math.round(storePosition * 1000);

    if (markStartMs === null) {
      setMarkStartMs(nowMs);
      return;
    }

    if (nowMs < markStartMs + MIN_CLIP_MS) {
      showSnackbar(t('snackbar.clip-too-short'));
      return;
    }

    setPendingRange({ startMs: markStartMs, endMs: nowMs });
    setMarkStartMs(null);
  };

  const onDeleteClip = (clipId: string) => {
    if (!playlistId) return;

    haptics.medium();
    deleteClip({ clipId, playlistId, songId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  const duration = storeDuration > 0 ? storeDuration : 1;
  const position = dragValue ?? storePosition;
  const progressRatio =
    storeDuration > 0 ? Math.min(storePosition / storeDuration, 1) : 0;
  const subtitle = current.artist || ' ';

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
                  contentDescription={t('common.cancel')}
                />
              </IconButton>
            </ThemedHost>
          </View>

          <ScrollView
            style={[styles.expandedScroll, { top: contentTop }]}
            contentContainerStyle={[
              styles.expandedScrollContent,
              { paddingBottom: insets.bottom + 32 },
            ]}
            scrollEnabled={expanded}
          >
            <View style={styles.titleBlock}>
              <AppText
                doNotTranslate
                text={current.name}
                variant="titleLarge"
                numberOfLines={2}
                style={styles.titleText}
              />
              {current.artist ? (
                <AppText
                  doNotTranslate
                  muted
                  text={current.artist}
                  variant="bodyMedium"
                  numberOfLines={1}
                />
              ) : null}
            </View>

            <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 4 }}
                modifiers={[fillMaxWidth(), padding(24, 8, 24, 0)]}
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

                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 24 }}
                  modifiers={[padding(0, 8, 0, 8)]}
                >
                  <IconButton onClick={previous} modifiers={[size(56, 56)]}>
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
                      size={40}
                      tint={colors.onPrimary}
                      contentDescription={t(
                        playing ? 'player.pause' : 'player.play',
                      )}
                    />
                  </FilledIconButton>
                  <IconButton onClick={nextSong} modifiers={[size(56, 56)]}>
                    <AppIcon
                      name="skip-next"
                      size={CONTROL_ICON_SIZE}
                      tint={colors.onSurface}
                      contentDescription={t('player.next')}
                    />
                  </IconButton>
                </Row>

                <Column
                  verticalArrangement={{ spacedBy: 8 }}
                  modifiers={[fillMaxWidth(), padding(0, 16, 0, 0)]}
                >
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ typography: 'labelLarge' }}
                  >
                    {t('player.speed')}
                  </Text>
                  <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                    {RATE_PRESETS.map(preset => (
                      <SegmentedButton
                        key={preset}
                        selected={rate === preset}
                        onClick={() => setRate(preset)}
                      >
                        <SegmentedButton.Label>
                          <Text maxLines={1}>{rateLabel(preset)}</Text>
                        </SegmentedButton.Label>
                      </SegmentedButton>
                    ))}
                  </SingleChoiceSegmentedButtonRow>
                </Column>

                <Row
                  verticalAlignment="center"
                  horizontalArrangement="spaceBetween"
                  modifiers={[fillMaxWidth(), padding(0, 12, 0, 8)]}
                >
                  <Column verticalArrangement={{ spacedBy: 2 }}>
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
                  <Switch value={keepPitch} onCheckedChange={setKeepPitch} />
                </Row>

                <Row
                  verticalAlignment="center"
                  horizontalArrangement="spaceBetween"
                  modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}
                >
                  <Text
                    color={colors.onSurfaceMuted}
                    style={{ typography: 'labelLarge' }}
                  >
                    {markStartMs !== null
                      ? `${t('player.clips.title')} · ${formatTime(markStartMs / 1000)} →`
                      : t('player.clips.title')}
                  </Text>
                  <Button onClick={onMarkPress}>
                    <Text maxLines={1}>
                      {t(
                        markStartMs !== null
                          ? 'player.clips.setEnd'
                          : 'player.clips.new',
                      )}
                    </Text>
                  </Button>
                </Row>

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
                            modifiers={[fillMaxWidth(), padding(12, 4, 0, 4)]}
                          >
                            <Column
                              verticalArrangement={{ spacedBy: 1 }}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                color={
                                  isActive ? colors.primary : colors.onSurface
                                }
                                style={{ typography: 'bodyLarge' }}
                                maxLines={1}
                              >
                                {clip.label || range}
                              </Text>
                              {clip.label ? (
                                <Text
                                  color={colors.onSurfaceMuted}
                                  style={{ typography: 'bodySmall' }}
                                >
                                  {range}
                                </Text>
                              ) : null}
                            </Column>
                            <IconButton onClick={() => onDeleteClip(clip.id)}>
                              <AppIcon
                                name="delete"
                                size={20}
                                tint={colors.onSurfaceMuted}
                                contentDescription={t('player.clips.delete')}
                              />
                            </IconButton>
                          </Row>
                        </Surface>
                      );
                    })}
                  </Column>
                )}
              </Column>
            </ThemedHost>
          </ScrollView>
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
              emojiSize={96}
              style={[styles.artMedia, { borderRadius: TILE_RADIUS }]}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {pendingRange && playlistId && (
        <ClipSaveSheet
          playlistId={playlistId}
          songId={current.id}
          startMs={pendingRange.startMs}
          endMs={pendingRange.endMs}
          onClose={() => setPendingRange(null)}
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
  expandedScroll: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  expandedScrollContent: { paddingHorizontal: 24 },
  titleBlock: { gap: 4, paddingBottom: 4, width: '100%' },
  titleText: { fontWeight: '700' },
  host: { width: '100%' },
  art: { position: 'absolute' },
  artMedia: { height: '100%', width: '100%' },
});
