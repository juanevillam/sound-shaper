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

import { ArtImage } from '@/components/ui/ArtImage';
import { MediaPickerAvatar } from '@/components/ui/MediaPickerAvatar';
import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { MIN_NAME_LENGTH } from '@/constants/forms';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useCoverPicker, type PickedCover } from '@/hooks/useCoverPicker';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { type Id3Tags } from '@/lib/id3';
import {
  createSound,
  deleteSound,
  updateSound,
} from '@/services/firebase/sounds';
import { usePlayerStore } from '@/store/player';
import { useSoundsStore } from '@/store/sounds';

/** The picture fills the slot the package sized and clipped. */
const MEDIA_PREVIEW_FILL = { height: '100%', width: '100%' } as const;

/** A freshly picked .mp3, parsed: the parent runs the document picker + ID3
 *  read BEFORE mounting this sheet, so the form opens already prefilled. */
export type PickedSoundFile = {
  uri: string;
  fileName: string;
  tags: Id3Tags;
};

export type EditSoundSheetProps = {
  /** Create mode: the picked file (id3-prefilled). */
  pickedFile?: PickedSoundFile;
  /** Edit mode: the sound to edit (metadata only — the file never changes). */
  soundId?: string;
  onClose: () => void;
};

// Strip the extension for the name prefill when the file had no ID3 title.
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

// Create/edit a sound inside a Compose ModalBottomSheet — the analog of
// Topper's EditItemSheet. Cover art sits at the TOP as a read-only preview:
// it comes from the file's ID3 tag (or nothing), never hand-picked, so the
// avatar doesn't open a chooser. Create-mode Save AWAITS the audio upload
// behind the Save spinner (the one real network wait), then closes; edit-mode
// metadata writes are latency-compensated, so they close immediately.
export function EditSoundSheet({
  pickedFile,
  soundId,
  onClose,
}: EditSoundSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const sounds = useSoundsStore(s => s.sounds);
  const editingSound = soundId
    ? sounds.find(entry => entry.id === soundId)
    : undefined;

  const tags = pickedFile?.tags;
  const initialName =
    editingSound?.name ??
    tags?.title ??
    (pickedFile ? nameFromFile(pickedFile.fileName) : '');
  const initialArtist = editingSound?.artist ?? tags?.artist ?? '';
  const initialAlbum = editingSound?.album ?? tags?.album ?? '';
  const initialYear =
    editingSound?.releaseYear != null
      ? String(editingSound.releaseYear)
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
  const { pickCover, uploadCover } = useCoverPicker();
  const [showNameError, setShowNameError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  /**
   * A cover picked in this session outranks the file's ID3 art and the saved
   * one — it is the most recent thing the person said. Same rule as the iOS
   * editor; the picker itself is the shared `MediaPickerAvatar`.
   */
  const [pickedCover, setPickedCover] = useState<PickedCover | null>(null);

  const onPickCover = () => {
    if (isSaving) return;

    void pickCover()
      .then(picked => {
        if (picked) setPickedCover(picked);
      })
      .catch(() => showSnackbar(t('snackbar.sound-save-failed')));
  };

  // The preview: a picked cover, else the ID3-embedded picture (create) or the
  // uploaded art (edit).
  const artPreviewUri =
    pickedCover?.uri ??
    (tags?.picture
      ? `data:${tags.picture.mime};base64,${tags.picture.base64}`
      : editingSound?.artUrl || undefined);

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

    if (soundId) {
      if (pickedCover) {
        // A new cover makes this a real upload, so it can no longer be
        // latency-compensated — hold the sheet behind the spinner the way the
        // create path does. Metadata alone still closes immediately.
        setIsSaving(true);

        try {
          const cover = await uploadCover(pickedCover);

          await updateSound({
            album: trimmedAlbum,
            artist: trimmedArtist,
            cover,
            name: trimmedName,
            releaseYear,
            soundId,
          });

          showSnackbar(t('snackbar.sound-updated'));
          onClose();
        } catch {
          showSnackbar(t('snackbar.sound-save-failed'));
          setIsSaving(false);
          savingRef.current = false;
        }

        return;
      }

      // Metadata-only update: latency-compensated, so close immediately and
      // let a single trailing snackbar confirm success OR failure.
      updateSound({
        album: trimmedAlbum,
        artist: trimmedArtist,
        name: trimmedName,
        releaseYear,
        soundId,
      })
        .then(() => showSnackbar(t('snackbar.sound-updated')))
        .catch(() => showSnackbar(t('snackbar.sound-save-failed')));

      await sheetRef.current?.hide();
      onClose();
      return;
    }

    if (!pickedFile) return;

    // Create: the audio (+ art) upload is the one real network wait — hold the
    // sheet open behind the Save spinner so a failure can be retried in place.
    setIsSaving(true);

    try {
      const picked = pickedCover ? await uploadCover(pickedCover) : null;

      await createSound({
        album: trimmedAlbum,
        artist: trimmedArtist,
        cover: picked,
        art: tags?.picture
          ? { base64: tags.picture.base64, mime: tags.picture.mime }
          : null,
        localAudioUri: pickedFile.uri,
        name: trimmedName,
        releaseYear,
      });

      showSnackbar(t('snackbar.sound-created'));
      await sheetRef.current?.hide();
      onClose();
    } catch {
      showSnackbar(t('snackbar.sound-save-failed'));
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!soundId) return;

    haptics.medium();
    setDeleteVisible(false);

    // Clear it from the player up front — a deleted sound must not linger in
    // the now-playing banner or stay playable.
    usePlayerStore.getState().soundDeleted(soundId);

    deleteSound(soundId)
      .then(() => showSnackbar(t('snackbar.sound-deleted')))
      .catch(() => showSnackbar(t('snackbar.sound-delete-failed')));

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
              title={t(soundId ? 'app.soundEditExisting' : 'app.soundEdit')}
              saveLabel={t(
                soundId ? 'soundEdit.saveExisting' : 'soundEdit.save',
              )}
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
                  onPress={onPickCover}
                  accessibilityLabel={t('common.pickMedia')}
                  disabled={isSaving}
                  surfaceColor={colors.surfaceVariant}
                  contentColor={colors.onSurfaceMuted}
                  emoji="🎵"
                  // Same `ArtImage` the slot rendered internally before it
                  // moved to the package — ANDROID IS FROZEN and this keeps
                  // its output identical, tokens and circle included.
                  preview={
                    artPreviewUri ? (
                      <ArtImage
                        uri={artPreviewUri}
                        style={MEDIA_PREVIEW_FILL}
                      />
                    ) : null
                  }
                />
              </RNHostView>
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
              >
                {t(
                  isSaving
                    ? 'soundEdit.uploading'
                    : artPreviewUri
                      ? 'soundEdit.art.change'
                      : 'soundEdit.art.add',
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
                <Text>{t('soundEdit.name.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('soundEdit.name.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
              {nameError && (
                <OutlinedTextField.SupportingText>
                  <Text>{t('soundEdit.name.error')}</Text>
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
                <Text>{t('soundEdit.artist.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('soundEdit.artist.placeholder')}</Text>
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
                <Text>{t('soundEdit.album.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('soundEdit.album.placeholder')}</Text>
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
                <Text>{t('soundEdit.year.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('soundEdit.year.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
              {yearInvalid && (
                <OutlinedTextField.SupportingText>
                  <Text>{t('soundEdit.year.error')}</Text>
                </OutlinedTextField.SupportingText>
              )}
            </OutlinedTextField>

            {soundId ? (
              <OutlinedButton
                onClick={() => setDeleteVisible(true)}
                enabled={!isSaving}
                modifiers={[fillMaxWidth()]}
              >
                <Text color={colors.danger}>{t('soundEdit.delete')}</Text>
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
              title: t('soundEdit.deleteConfirm.title'),
              message: t('soundEdit.deleteConfirm.message'),
              confirm: t('soundEdit.deleteConfirm.confirm'),
              cancel: t('soundEdit.deleteConfirm.cancel'),
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
