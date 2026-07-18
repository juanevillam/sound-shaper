import { Pressable, StyleSheet, View } from 'react-native';

import { useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SongArt } from '@/components/ui/SongArt';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { audioPlayer } from '@/lib/player';
import { usePlayerStore } from '@/store/player';
import { innerRadius, SHAPE_SM, TILE_RADIUS } from '@/styles/shape';

// Exported so screens hosting their own instance (playlist-detail) can clear
// it — the FAB lifts by this much while the bar is up.
export const MINI_PLAYER_HEIGHT = 64;

const ART_SIZE = 44;
const ART_RADIUS = innerRadius(TILE_RADIUS, 10, SHAPE_SM);
// Thin progress line along the bar's top edge.
const PROGRESS_HEIGHT = 2;

// Hand-drawn transport glyphs (a triangle and two bars): the mini-player
// persists across every navigation, and a Compose Icon here would blink on
// each return (the same reason the cards hand-draw their drag dots). The
// now-playing screen, which mounts fresh, uses real icons.
const PlayGlyph = ({ color }: { color: string }) => (
  <View style={[styles.playTriangle, { borderLeftColor: color }]} />
);

const PauseGlyph = ({ color }: { color: string }) => (
  <View style={styles.pauseRow}>
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
    <View style={[styles.pauseBar, { backgroundColor: color }]} />
  </View>
);

/**
 * The persistent playback bar — the music-app anchor of the whole UI. Screens
 * pin it to the bottom edge; it extends its own background through the system
 * navigation inset (edge-to-edge, the way a bottom bar reads on Android 15).
 * `MINI_PLAYER_HEIGHT` is the CONTENT height — consumers add the inset
 * themselves when computing clearances. Tap = full now-playing screen; the
 * trailing button toggles play/pause in place.
 */
export function MiniPlayer() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const current = usePlayerStore(s => s.current);
  const toggle = usePlayerStore(s => s.toggle);
  const status = useAudioPlayerStatus(audioPlayer);

  if (!current) return null;

  const progress =
    status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0;
  const subtitle = current.artist || ' ';

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainer,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Progress hairline riding the top edge. */}
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: colors.surfaceVariant },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${progress * 100}%` },
          ]}
        />
      </View>

      <Pressable
        style={styles.row}
        onPress={() => router.push('/now-playing')}
        accessibilityRole="button"
        accessibilityLabel={t('player.title')}
      >
        <SongArt
          artUrl={current.artUrl || undefined}
          displayWidth={ART_SIZE}
          emojiSize={20}
          style={styles.art}
        />
        <View style={styles.info}>
          <Text
            doNotTranslate
            text={current.name}
            variant="bodyMedium"
            numberOfLines={1}
          />
          <Text
            doNotTranslate
            muted
            text={subtitle}
            variant="bodySmall"
            numberOfLines={1}
          />
        </View>
        <Pressable
          onPress={toggle}
          hitSlop={12}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={t(
            status.playing ? 'player.pause' : 'player.play',
          )}
        >
          {status.playing ? (
            <PauseGlyph color={colors.onSurface} />
          ) : (
            <PlayGlyph color={colors.onSurface} />
          )}
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: PROGRESS_HEIGHT, width: '100%' },
  progressFill: { height: PROGRESS_HEIGHT },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: MINI_PLAYER_HEIGHT - PROGRESS_HEIGHT,
    paddingHorizontal: 16,
  },
  art: {
    borderRadius: ART_RADIUS,
    height: ART_SIZE,
    width: ART_SIZE,
  },
  info: { flex: 1, gap: 1 },
  // 48dp min touch target centered on the glyph.
  toggle: {
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
    // Optical centering: a triangle's visual mass sits left of its box center.
    marginLeft: 3,
  },
  pauseRow: { flexDirection: 'row', gap: 4 },
  pauseBar: { borderRadius: 1.5, height: 16, width: 4.5 },
});
