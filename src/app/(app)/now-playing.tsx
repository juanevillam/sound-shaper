import { useRef, useState } from 'react';

import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  Column,
  FilledIconButton,
  IconButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Switch,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';
import { useAudioPlayerStatus } from 'expo-audio';

import { Screen } from '@/components/ui/Screen';
import { SongArt } from '@/components/ui/SongArt';
import { Text as AppText } from '@/components/ui/Text';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { audioPlayer, formatTime } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { TILE_RADIUS } from '@/styles/shape';

// The listener-facing "shape the sound" surface: rate presets + pitch
// retention. True EQ/reverb (custom native audio graph) is a later phase.
const RATE_PRESETS = [0.5, 0.75, 1, 1.5, 2];

const rateLabel = (rate: number) => `${rate}×`.replace('.', ',');

const CONTROL_ICON_SIZE = 32;
const PLAY_BUTTON_SIZE = 72;

export default function NowPlayingScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const current = usePlayerStore(s => s.current);
  const toggle = usePlayerStore(s => s.toggle);
  const next = usePlayerStore(s => s.next);
  const previous = usePlayerStore(s => s.previous);
  const rate = usePlayerStore(s => s.rate);
  const setRate = usePlayerStore(s => s.setRate);
  const keepPitch = usePlayerStore(s => s.keepPitch);
  const setKeepPitch = usePlayerStore(s => s.setKeepPitch);
  const status = useAudioPlayerStatus(audioPlayer);

  // While the thumb is being dragged the slider follows the finger, not the
  // 250ms status stream (which would fight it); the seek fires on release.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastDragRef = useRef(0);

  // Screen minus its 24dp side margins, capped for tablets/landscape.
  const artSize = Math.min(width - 48, 420);

  if (!current) {
    // Deep-linked / stale entry with nothing loaded: nothing to show.
    return <Screen />;
  }

  const duration = status.duration > 0 ? status.duration : 1;
  const position = dragValue ?? status.currentTime;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.artWrap}>
          <SongArt
            artUrl={current.artUrl || undefined}
            emojiSize={96}
            style={[styles.art, { height: artSize, width: artSize }]}
          />
        </View>

        <View style={styles.titleBlock}>
          <AppText
            doNotTranslate
            text={current.name}
            variant="titleLarge"
            numberOfLines={2}
            style={styles.centerText}
          />
          {current.artist ? (
            <AppText
              doNotTranslate
              muted
              text={current.artist}
              variant="bodyMedium"
              numberOfLines={1}
              style={styles.centerText}
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
          </Column>
        </ThemedHost>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  artWrap: { alignItems: 'center', width: '100%' },
  art: { borderRadius: TILE_RADIUS },
  titleBlock: { gap: 4, paddingTop: 20, width: '100%' },
  centerText: { textAlign: 'center' },
  host: { width: '100%' },
});
