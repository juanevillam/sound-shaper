import { useRef, useState } from 'react';

import {
  Column,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  RNHostView,
  Text,
  useNativeState,
  type ModalBottomSheetRef,
  type TextFieldRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { DestructiveConfirmDialog } from '@portfolio/mobile-ui';

import { MediaPickerAvatar } from '@/components/ui/MediaPickerAvatar';
import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { MIN_NAME_LENGTH } from '@/constants/forms';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { type Id3Tags } from '@/lib/id3';
import { createSong, deleteSong, updateSong } from '@/services/firebase/songs';
import { usePlayerStore } from '@/store/player';
import { useSongsStore } from '@/store/songs';

/** A freshly picked .mp3, parsed: the parent runs the document picker + ID3
 *  read BEFORE mounting this sheet, so the form opens already prefilled. */
export type PickedSongFile = {
  uri: string;
  fileName: string;
  tags: Id3Tags;
};

type EditSongSheetProps = {
  /** Create mode: the picked file (id3-prefilled). */
  pickedFile?: PickedSongFile;
  /** Edit mode: the song to edit (metadata only — the file never changes). */
  songId?: string;
  onClose: () => void;
};

// Strip the extension for the name prefill when the file had no ID3 title.
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

// Create/edit a song inside a Compose ModalBottomSheet — the analog of
// Topper's EditItemSheet. Cover art sits at the TOP as a read-only preview:
// it comes from the file's ID3 tag (or nothing), never hand-picked, so the
// avatar doesn't open a chooser. Create-mode Save AWAITS the audio upload
// behind the Save spinner (the one real network wait), then closes; edit-mode
// metadata writes are latency-compensated, so they close immediately.
export function EditSongSheet({
  pickedFile,
  songId,
  onClose,
}: EditSongSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const songs = useSongsStore(s => s.songs);
  const editingSong = songId
    ? songs.find(entry => entry.id === songId)
    : undefined;

  const tags = pickedFile?.tags;
  const initialName =
    editingSong?.name ??
    tags?.title ??
    (pickedFile ? nameFromFile(pickedFile.fileName) : '');
  const initialArtist = editingSong?.artist ?? tags?.artist ?? '';
  const initialAlbum = editingSong?.album ?? tags?.album ?? '';
  const initialYear =
    editingSong?.releaseYear != null
      ? String(editingSong.releaseYear)
      : (tags?.year ?? '');

  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // Re-entry guard: the year field's keyboard "done" calls save() directly and
  // isn't gated by the disabled Save button.
  const savingRef = useRef(false);
  const artistFieldRef = useRef<TextFieldRef>(null);
  const nameState = useNativeState(initialName);
  const artistState = useNativeState(initialArtist);
  const albumState = useNativeState(initialAlbum);
  const yearState = useNativeState(initialYear);
  const [name, setName] = useState(initialName);
  const [artist, setArtist] = useState(initialArtist);
  const [album, setAlbum] = useState(initialAlbum);
  const [year, setYear] = useState(initialYear);
  const [isSaving, setIsSaving] = useState(false);
  const [showNameError, setShowNameError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  // Art preview: the ID3-embedded picture (create) or the uploaded art (edit).
  const artPreviewUri = tags?.picture
    ? `data:${tags.picture.mime};base64,${tags.picture.base64}`
    : editingSong?.artUrl || undefined;

  const nameInvalid = name.trim().length < MIN_NAME_LENGTH;
  const nameError = showNameError && nameInvalid;

  const parseYear = (): number | null | 'invalid' => {
    const trimmed = year.trim();

    if (trimmed.length === 0) return null;

    const parsed = Number(trimmed);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > currentYear)
      return 'invalid';

    return parsed;
  };

  const yearInvalid = parseYear() === 'invalid';

  const save = async () => {
    if (savingRef.current) return;

    if (nameInvalid) {
      setShowNameError(true);
      return;
    }

    if (yearInvalid) return;

    const releaseYear = parseYear() as number | null;
    const trimmedName = name.trim();
    const trimmedArtist = artist.trim();
    const trimmedAlbum = album.trim();

    savingRef.current = true;

    if (songId) {
      // Metadata-only update: latency-compensated, so close immediately and
      // let a single trailing snackbar confirm success OR failure.
      updateSong({
        album: trimmedAlbum,
        artist: trimmedArtist,
        name: trimmedName,
        releaseYear,
        songId,
      })
        .then(() => showSnackbar(t('snackbar.song-updated')))
        .catch(() => showSnackbar(t('snackbar.song-save-failed')));

      await sheetRef.current?.hide();
      onClose();
      return;
    }

    if (!pickedFile) return;

    // Create: the audio (+ art) upload is the one real network wait — hold the
    // sheet open behind the Save spinner so a failure can be retried in place.
    setIsSaving(true);

    try {
      await createSong({
        album: trimmedAlbum,
        artist: trimmedArtist,
        art: tags?.picture
          ? { base64: tags.picture.base64, mime: tags.picture.mime }
          : null,
        localAudioUri: pickedFile.uri,
        name: trimmedName,
        releaseYear,
      });

      showSnackbar(t('snackbar.song-created'));
      await sheetRef.current?.hide();
      onClose();
    } catch {
      showSnackbar(t('snackbar.song-save-failed'));
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!songId) return;

    haptics.medium();
    setDeleteVisible(false);

    // Clear it from the player up front — a deleted song must not linger in
    // the now-playing banner or stay playable.
    usePlayerStore.getState().songDeleted(songId);

    deleteSong(songId)
      .then(() => showSnackbar(t('snackbar.song-deleted')))
      .catch(() => showSnackbar(t('snackbar.song-delete-failed')));

    await sheetRef.current?.hide();
    onClose();
  };

  return (
    <>
      <ThemedHost matchContents>
        <ModalBottomSheet
          ref={sheetRef}
          onDismissRequest={() => {
            if (!isSaving) onClose();
          }}
          skipPartiallyExpanded
        >
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            // No top padding: the sheet's native drag handle already supplies
            // the gap above the content.
            modifiers={[padding(16, 0, 16, 16), fillMaxWidth()]}
          >
            <SheetBar
              title={t(songId ? 'app.songEditExisting' : 'app.songEdit')}
              saveLabel={t(songId ? 'songEdit.saveExisting' : 'songEdit.save')}
              saving={isSaving}
              saveEnabled={!nameInvalid}
              onSave={save}
            />

            {/* Cover art at the TOP — a read-only preview of the file's
                embedded picture (uploading a photo is not a thing: the art IS
                the file's). RNHostView matchContents sizes the 72×72 avatar
                without blanking the fields below it. */}
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth()]}
            >
              <RNHostView matchContents>
                <MediaPickerAvatar
                  onPress={() => {}}
                  disabled
                  surfaceColor={colors.surfaceVariant}
                  contentColor={colors.onSurfaceMuted}
                  emoji="🎵"
                  imageUrl={artPreviewUri}
                />
              </RNHostView>
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
              >
                {t(
                  isSaving
                    ? 'songEdit.uploading'
                    : artPreviewUri
                      ? 'songEdit.art.embedded'
                      : 'songEdit.art.none',
                )}
              </Text>
            </Column>

            <OutlinedTextField
              value={nameState}
              onValueChange={setName}
              singleLine
              isError={nameError}
              keyboardOptions={{
                capitalization: 'sentences',
                imeAction: 'next',
              }}
              keyboardActions={{
                onNext: () => artistFieldRef.current?.focus(),
              }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('songEdit.name.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('songEdit.name.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
              {nameError && (
                <OutlinedTextField.SupportingText>
                  <Text>{t('songEdit.name.error')}</Text>
                </OutlinedTextField.SupportingText>
              )}
            </OutlinedTextField>

            <OutlinedTextField
              ref={artistFieldRef}
              value={artistState}
              onValueChange={setArtist}
              singleLine
              keyboardOptions={{
                capitalization: 'words',
                imeAction: 'next',
              }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('songEdit.artist.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('songEdit.artist.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
            </OutlinedTextField>

            <OutlinedTextField
              value={albumState}
              onValueChange={setAlbum}
              singleLine
              keyboardOptions={{
                capitalization: 'words',
                imeAction: 'next',
              }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('songEdit.album.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('songEdit.album.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
            </OutlinedTextField>

            <OutlinedTextField
              value={yearState}
              onValueChange={setYear}
              singleLine
              isError={yearInvalid}
              keyboardOptions={{ keyboardType: 'number', imeAction: 'done' }}
              keyboardActions={{ onDone: save }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('songEdit.year.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('songEdit.year.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
              {yearInvalid && (
                <OutlinedTextField.SupportingText>
                  <Text>{t('songEdit.year.error')}</Text>
                </OutlinedTextField.SupportingText>
              )}
            </OutlinedTextField>

            {songId ? (
              <OutlinedButton
                onClick={() => setDeleteVisible(true)}
                enabled={!isSaving}
                modifiers={[fillMaxWidth()]}
              >
                <Text color={colors.danger}>{t('songEdit.delete')}</Text>
              </OutlinedButton>
            ) : null}
          </Column>
        </ModalBottomSheet>
      </ThemedHost>

      {/* Own Host — a dialog mounted beside other Compose content in one Host
          flickers the siblings. */}
      {deleteVisible && (
        <ThemedHost matchContents>
          <DestructiveConfirmDialog
            dialog={{
              title: t('songEdit.deleteConfirm.title'),
              message: t('songEdit.deleteConfirm.message'),
              confirm: t('songEdit.deleteConfirm.confirm'),
              cancel: t('songEdit.deleteConfirm.cancel'),
            }}
            colors={{ danger: colors.danger }}
            onConfirm={handleDelete}
            onDismiss={() => setDeleteVisible(false)}
          />
        </ThemedHost>
      )}
    </>
  );
}
