import { Pressable, StyleSheet, View } from 'react-native';

import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RippleIconButton } from '@/components/ui/RippleIconButton';
import { SheetHeaderIos } from '@/components/ui/SheetFormIos';
import { Text } from '@/components/ui/Text';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';

const NO_CLIPS: never[] = [];
const PRESSED_OPACITY = 0.55;

// iOS-only route: the saved-clips manager as a content-hugging native form
// sheet (Android presents the Compose `ClipsSheet` in place). "New clip"
// dismisses the sheet and bumps the framing nonce — the PlayerSheet (still
// mounted under this native presentation) picks it up and drops the trim
// brackets on its scrubber.
function ClipsSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const { bottom } = useSafeAreaInsets();

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);
  const requestClipFraming = usePlayerStore(s => s.requestClipFraming);

  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  if (!current) return <View style={{ backgroundColor: colors.sheet }} />;

  const onDelete = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, songId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  const onNewClip = () => {
    haptics.selection();
    router.back();
    requestClipFraming();
  };

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.sheet,
          paddingBottom: Math.max(bottom, 28),
        },
      ]}
    >
      <SheetHeaderIos
        title={t('player.clips.title')}
        actionLabel={t('player.clips.new')}
        onAction={onNewClip}
      />

      {clips.length === 0 ? (
        <Text muted text="player.clips.empty" variant="bodyMedium" />
      ) : (
        <View style={[styles.group, { backgroundColor: colors.sheetField }]}>
          {clips.map((clip, index) => {
            const isActive = activeClip?.clipId === clip.id;
            const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

            return (
              <View key={clip.id}>
                {index > 0 ? (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    haptics.selection();
                    playClip(clip.id, clip.startMs, clip.endMs);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    { opacity: pressed ? PRESSED_OPACITY : 1 },
                  ]}
                >
                  <Text
                    doNotTranslate
                    text={range}
                    variant="bodyLarge"
                    numberOfLines={1}
                    style={[
                      styles.range,
                      isActive ? { color: colors.primary } : null,
                    ]}
                  />
                  <RippleIconButton
                    name="delete"
                    onPress={() => onDelete(clip.id)}
                    size={19}
                    tint={colors.onSurfaceMuted}
                    accessibilityLabel={t('player.clips.delete')}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default iosOnlyRoute(ClipsSheetScreen);

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  group: { borderRadius: 12, overflow: 'hidden' },
  range: { flex: 1 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
  },
  sheet: { gap: 16, paddingHorizontal: 24, paddingTop: 20 },
});
