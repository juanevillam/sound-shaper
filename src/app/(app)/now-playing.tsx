import { useEffect, useRef, useState } from 'react';

import {
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
import { useAudioPlayerStatus } from 'expo-audio';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipSaveSheet } from '@/components/player/ClipSaveSheet';
import { Screen } from '@/components/ui/Screen';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useClipsSubscription } from '@/hooks/useClipsSubscription';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { audioPlayer, formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';
import { TILE_RADIUS } from '@/styles/shape';

// The listener-facing "shape the sound" surface: rate presets + pitch
// retention. True EQ/reverb (custom native audio graph) is a later phase.
const RATE_PRESETS = [0.5, 0.75, 1, 1.5, 2];

const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');

const CONTROL_ICON_SIZE = 32;
const PLAY_BUTTON_SIZE = 72;
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

// Stable fallback for the clips selector: an inline `?? []` would mint a new
// array per snapshot and loop useSyncExternalStore into "maximum update
// depth exceeded".
const NO_CLIPS: never[] = [];

export default function NowPlayingScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();
  const current = usePlayerStore(s => s.current);
  const playlistId = usePlayerStore(s => s.playlistId);
  const toggle = usePlayerStore(s => s.toggle);
  const next = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);
  const clearActiveClip = usePlayerStore(s => s.clearActiveClip);
  const status = useAudioPlayerStatus(audioPlayer);

  // While the thumb is being dragged the slider follows the finger, not the
  // 250ms status stream (which would fight it); the seek fires on release.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastDragRef = useRef(0);

  // Clip marking: "New clip" captures the start at the current position, the
  // same button (now "Set end") captures the end, then the save sheet opens.
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

  // Screen minus its 24dp side margins, capped for tablets/landscape.
  const artSize = Math.min(width - 48, 420);

  if (!current) {
    // Deep-linked / stale entry with nothing loaded: nothing to show.
    return <Screen />;
  }

  const onMarkPress = () => {
    haptics.selection();
    const nowMs = Math.round(status.currentTime * 1000);

    if (markStartMs === null) {
      setMarkStartMs(nowMs);
      return;
    }

    if (nowMs < markStartMs + MIN_CLIP_MS) {
      // Ended before (or basically at) the start — keep marking.
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

  const duration = status.duration > 0 ? status.duration : 1;
  const position = dragValue ?? status.currentTime;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}
      >
        {/* Headerless: the close chevron is the only chrome (slide-up sheet
            idiom — Android back dismisses too). */}
        <View style={styles.topBar}>
          <ThemedHost matchContents>
            <IconButton onClick={() => router.back()}>
              <AppIcon
                name="close"
                tint={colors.onSurface}
                contentDescription={t('common.cancel')}
              />
            </IconButton>
          </ThemedHost>
        </View>

        <View style={styles.artWrap}>
          <SongArt
            artUrl={current.artUrl || undefined}
            emojiSize={96}
            style={[styles.art, { height: artSize, width: artSize }]}
          />
        </View>

        {/* Identity block, LEFT-aligned like a music app's player — the
            centered look was the Topper voice. */}
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
                audioPlayer.seekTo(lastDragRef.current);
                // A manual scrub ends any clip replay — the listener would
                // otherwise pause at the stale boundary.
                clearActiveClip();
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
                {formatTime(status.duration)}
              </Text>
            </Row>

            {/* Transport: previous / play-pause / next, M3 icon buttons with
                the big filled center control. */}
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
                  name={status.playing ? 'pause' : 'play-arrow'}
                  size={40}
                  tint={colors.onPrimary}
                  contentDescription={t(
                    status.playing ? 'player.pause' : 'player.play',
                  )}
                />
              </FilledIconButton>
              <IconButton onClick={next} modifiers={[size(56, 56)]}>
                <AppIcon
                  name="skip-next"
                  size={CONTROL_ICON_SIZE}
                  tint={colors.onSurface}
                  contentDescription={t('player.next')}
                />
              </IconButton>
            </Row>

            {/* Shape the sound: playback rate presets + pitch retention. */}
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

            {/* Clips: personal bookmarks into the song. Mark while listening
                (start, then end), tap a row to jump-play its range — playback
                parks back at the clip start when it runs out. */}
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
                            color={isActive ? colors.primary : colors.onSurface}
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

      {/* Own Host lives inside the sheet (sheets beside other Compose content
          in one Host flicker the siblings). */}
      {pendingRange && playlistId && (
        <ClipSaveSheet
          playlistId={playlistId}
          songId={current.id}
          startMs={pendingRange.startMs}
          endMs={pendingRange.endMs}
          onClose={() => setPendingRange(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: 'flex-start',
    marginLeft: -12,
    paddingBottom: 4,
    width: '100%',
  },
  artWrap: { alignItems: 'center', width: '100%' },
  art: { borderRadius: TILE_RADIUS },
  titleBlock: { gap: 4, paddingTop: 20, width: '100%' },
  titleText: { fontWeight: '700' },
  host: { width: '100%' },
});
