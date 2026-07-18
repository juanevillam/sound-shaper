import { useRef, useState } from 'react';

import {
  Column,
  ModalBottomSheet,
  OutlinedTextField,
  RNHostView,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useNativeState,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { EmojiPickerSheet } from '@/components/ui/EmojiPickerSheet';
import { MediaPickerAvatar } from '@/components/ui/MediaPickerAvatar';
import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { MIN_NAME_LENGTH } from '@/constants/forms';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import {
  createPlaylist,
  updatePlaylist,
  type PlaylistVisibility,
} from '@/services/firebase/playlists';
import { useAuthStore } from '@/store/auth';
import { usePlaylistsStore } from '@/store/playlists';

const DEFAULT_EMOJI = '🎵';
const VISIBILITIES: PlaylistVisibility[] = ['public', 'private'];

type EditPlaylistSheetProps = {
  /** Omit to create a new playlist; pass an id to edit that playlist. */
  playlistId?: string;
  onClose: () => void;
};

// Create/edit a playlist inside a Compose ModalBottomSheet (the same component
// the emoji picker uses, so the two read identically). Mounted conditionally
// by the parent, so state resets every open. Keyboard avoidance is native to
// the sheet.
//
// Deletion is intentionally NOT here: it lives in the home long-press menu and
// the detail overflow menu.
export function EditPlaylistSheet({
  playlistId,
  onClose,
}: EditPlaylistSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const uid = useAuthStore(s => s.user?.uid);
  const editingPlaylist = usePlaylistsStore(s =>
    playlistId ? s.playlists.find(entry => entry.id === playlistId) : undefined,
  );

  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // One-shot guard: blocks a second tap / keyboard "done" from firing a
  // duplicate write in the window before the dismiss animation unmounts.
  const savingRef = useRef(false);
  const nameState = useNativeState(editingPlaylist?.name ?? '');
  const descriptionState = useNativeState(editingPlaylist?.description ?? '');
  const [name, setName] = useState(editingPlaylist?.name ?? '');
  const [description, setDescription] = useState(
    editingPlaylist?.description ?? '',
  );
  const [emoji, setEmoji] = useState(editingPlaylist?.emoji ?? DEFAULT_EMOJI);
  const [visibility, setVisibility] = useState<PlaylistVisibility>(
    editingPlaylist?.visibility ?? 'private',
  );
  const [showNameError, setShowNameError] = useState(false);
  const [emojiSheetVisible, setEmojiSheetVisible] = useState(false);

  const nameInvalid = name.trim().length < MIN_NAME_LENGTH;
  const nameError = showNameError && nameInvalid;

  const save = async () => {
    if (savingRef.current) return;

    if (nameInvalid) {
      setShowNameError(true);
      return;
    }

    if (!uid) return;

    savingRef.current = true;

    // Fire the write and close immediately: the doc write is
    // latency-compensated, so the live playlists subscription reflects the
    // change at once. A single trailing snackbar confirms success OR failure.
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const action = playlistId
      ? updatePlaylist({
          description: trimmedDescription,
          emoji,
          name: trimmedName,
          playlistId,
          visibility,
        })
      : createPlaylist({
          description: trimmedDescription,
          emoji,
          name: trimmedName,
          ownerId: uid,
          visibility,
        });

    action
      .then(() =>
        showSnackbar(
          t(
            playlistId
              ? 'snackbar.playlist-updated'
              : 'snackbar.playlist-created',
          ),
        ),
      )
      .catch(() =>
        showSnackbar(
          t(
            playlistId
              ? 'snackbar.playlist-update-failed'
              : 'snackbar.playlist-create-failed',
          ),
        ),
      );

    await sheetRef.current?.hide();
    onClose();
  };

  return (
    <>
      <ThemedHost matchContents>
        <ModalBottomSheet
          ref={sheetRef}
          onDismissRequest={onClose}
          skipPartiallyExpanded
        >
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            // No top padding: the sheet's native drag handle already supplies
            // the gap above the content.
            modifiers={[padding(16, 0, 16, 16), fillMaxWidth()]}
          >
            <SheetBar
              title={t(
                playlistId ? 'app.playlistEditExisting' : 'app.playlistEdit',
              )}
              saveLabel={t(
                playlistId ? 'playlistEdit.saveExisting' : 'playlistEdit.save',
              )}
              saving={false}
              saveEnabled={!nameInvalid}
              onSave={save}
            />

            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth()]}
            >
              <RNHostView matchContents>
                <MediaPickerAvatar
                  onPress={() => setEmojiSheetVisible(true)}
                  surfaceColor={colors.surfaceVariant}
                  contentColor={colors.onSurfaceMuted}
                  emoji={emoji}
                />
              </RNHostView>
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
              >
                {t('playlistEdit.emoji.change')}
              </Text>
            </Column>

            <OutlinedTextField
              value={nameState}
              onValueChange={setName}
              singleLine
              isError={nameError}
              keyboardOptions={{
                capitalization: 'sentences',
                imeAction: 'done',
              }}
              keyboardActions={{ onDone: save }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('playlistEdit.name.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('playlistEdit.name.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
              {nameError && (
                <OutlinedTextField.SupportingText>
                  <Text>{t('playlistEdit.name.error')}</Text>
                </OutlinedTextField.SupportingText>
              )}
            </OutlinedTextField>

            {/* Optional, multiline: a place to say what the playlist is about. */}
            <OutlinedTextField
              value={descriptionState}
              onValueChange={setDescription}
              minLines={3}
              maxLines={6}
              keyboardOptions={{ capitalization: 'sentences' }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('playlistEdit.description.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('playlistEdit.description.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
            </OutlinedTextField>

            {/* Visibility grouped with extra top/bottom padding so it reads
                apart from the fields above. */}
            <Column
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}
            >
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelLarge' }}
              >
                {t('playlistEdit.visibility.label')}
              </Text>
              <Column
                verticalArrangement={{ spacedBy: 6 }}
                modifiers={[fillMaxWidth()]}
              >
                <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                  {VISIBILITIES.map(value => (
                    <SegmentedButton
                      key={value}
                      selected={visibility === value}
                      onClick={() => setVisibility(value)}
                    >
                      <SegmentedButton.Label>
                        <Text maxLines={1}>
                          {t(`playlistEdit.visibility.${value}`)}
                        </Text>
                      </SegmentedButton.Label>
                    </SegmentedButton>
                  ))}
                </SingleChoiceSegmentedButtonRow>
                <Text
                  color={colors.onSurfaceMuted}
                  style={{ typography: 'bodySmall' }}
                >
                  {t(`playlistEdit.visibility.${visibility}Description`)}
                </Text>
              </Column>
            </Column>
          </Column>
        </ModalBottomSheet>
      </ThemedHost>

      <EmojiPickerSheet
        title={t('playlistEdit.emoji.sheetTitle')}
        visible={emojiSheetVisible}
        onDismiss={() => setEmojiSheetVisible(false)}
        onSelect={value => {
          setEmoji(value);
          setEmojiSheetVisible(false);
        }}
      />
    </>
  );
}
