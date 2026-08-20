import { View } from 'react-native';

import {
  Button,
  Section,
  SwipeActions,
  Text as SwiftUIText,
} from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { SheetFormIos } from '@portfolio/mobile-ui';
import { router } from 'expo-router';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
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
    router.back();
    requestClipFraming();
  };

  return (
    // `SheetScreen` for the toast — see `SnackbarOutlet`. Deleting a clip
    // confirms with a snackbar that drew behind this sheet.
    <SheetScreen>
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
                    onPress={() => playClip(clip.id, clip.startMs, clip.endMs)}
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
                    {/* LABELLED, like every swipe action in the portfolio.
                      This was glyph-only on the grounds that a worded action
                      pushes this row's short time range off the leading edge
                      and leaves an empty pill — which happens, and is what
                      APPLE ships: Reminders on iOS 26.5, swiped on a row whose
                      whole content is "Hi", draws icon AND label at ~88pt and
                      pushes the text completely away. The old note also cited
                      Mail as glyph-only and put a labelled action at ~110pt;
                      neither survived measurement. */}
                    <Button
                      role="destructive"
                      label={t('player.clips.delete')}
                      systemImage="trash"
                      onPress={() => onDelete(clip.id)}
                    />
                  </SwipeActions.Actions>
                </SwipeActions>
              );
            })}
          </Section>
        )}
      </SheetFormIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(ClipsSheetScreen);
