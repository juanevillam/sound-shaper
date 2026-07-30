import { View } from 'react-native';

import {
  Button,
  Image,
  Section,
  SwipeActions,
  Text as SwiftUIText,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import { SheetFormIos } from '@portfolio/mobile-ui';
import { router } from 'expo-router';

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

// iOS-only route: the saved-clips manager as a content-hugging native form
// sheet (Android presents the Compose `ClipsSheet` in place). "New clip"
// dismisses the sheet and bumps the framing nonce — the PlayerSheet (still
// mounted under this native presentation) picks it up and drops the trim
// brackets on its scrubber.
function ClipsSheetScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

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
    <SheetFormIos
      title={t('player.clips.title')}
      actionLabel={t('player.clips.new')}
      onAction={onNewClip}
    >
      {clips.length === 0 ? (
        <Section>
          <SwiftUIText modifiers={[foregroundStyle(colors.onSurfaceMuted)]}>
            {t('player.clips.empty')}
          </SwiftUIText>
        </Section>
      ) : (
        <Section>
          {clips.map(clip => {
            const isActive = activeClip?.clipId === clip.id;
            const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

            return (
              // Delete is a SWIPE action now, not a trailing trash icon: two
              // tap targets in one row is an Android table idiom, and iOS
              // hides row destruction behind the swipe (Mail, Reminders).
              <SwipeActions key={clip.id}>
                <Button
                  onPress={() => {
                    haptics.selection();
                    playClip(clip.id, clip.startMs, clip.endMs);
                  }}
                >
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(
                        isActive ? colors.primary : colors.onSurface,
                      ),
                    ]}
                  >
                    {range}
                  </SwiftUIText>
                </Button>
                <SwipeActions.Actions edge="trailing">
                  {/* ICON ONLY, no label. Revealing an action translates the
                      row's content left by the action's own width, so a
                      "🗑 Delete clip" action (~110pt) pushed this row's short
                      time range clean off the leading edge and left an empty
                      pill behind. Mail's swipe actions are glyphs for the same
                      reason. */}
                  <Button
                    role="destructive"
                    onPress={() => onDelete(clip.id)}
                    modifiers={[accessibilityLabel(t('player.clips.delete'))]}
                  >
                    <Image systemName="trash" />
                  </Button>
                </SwipeActions.Actions>
              </SwipeActions>
            );
          })}
        </Section>
      )}
    </SheetFormIos>
  );
}

export default iosOnlyRoute(ClipsSheetScreen);
