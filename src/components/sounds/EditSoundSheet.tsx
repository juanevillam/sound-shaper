import { useRef, useState } from 'react';

import {
  Box,
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
import {
  artworkRadius,
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  DestructiveConfirmDialog,
  SheetDragHandle,
} from '@portfolio/mobile-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtImage } from '@/components/ui/ArtImage';
import {
  MEDIA_PICKER_SIZE,
  MediaPickerAvatar,
} from '@/components/ui/MediaPickerAvatar';
import { SheetBar } from '@/components/ui/SheetBar';
import { SheetErrorLine } from '@/components/ui/SheetErrorLine';
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
import { SHAPE_MD } from '@/styles/shape';

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
// Topper's EditItemSheet. Cover art sits at the TOP, seeded from the file's ID3
// tag and REPLACEABLE: the slot presses and opens the image picker
// (`useCoverPicker`), in Topper's two-step deferred shape, so the upload waits
// for save and cancelling never orphans a Cloudinary asset. Create-mode Save
// AWAITS the audio upload behind the Save spinner (the one real network wait),
// then closes; edit-mode metadata writes are latency-compensated, so they close
// immediately — unless a new cover made it a real upload.
/** The form's own field-to-field gap. */
const FORM_GAP = 16;

export function EditSoundSheet({
  pickedFile,
  soundId,
  onClose,
}: EditSoundSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
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

  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // Re-entry guard: the subtitle field's keyboard "done" calls save() directly
  // and isn't gated by the disabled Save button.
  const savingRef = useRef(false);
  const artistFieldRef = useRef<TextFieldRef>(null);
  const nameState = useNativeState(initialName);
  const artistState = useNativeState(initialArtist);
  const [name, setName] = useState(initialName);
  const [artist, setArtist] = useState(initialArtist);
  const [isSaving, setIsSaving] = useState(false);
  const { pickCover, uploadCover } = useCoverPicker();
  const [showNameError, setShowNameError] = useState(false);
  /**
   * A FAILURE THAT LEAVES THIS SHEET STANDING has to be said in the sheet — the
   * toast draws behind a Compose sheet's own window. See `SheetErrorLine`.
   */
  const [failure, setFailure] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  /**
   * A cover picked in this session outranks the file's ID3 art and the saved
   * one — it is the most recent thing the person said. Same rule as the iOS
   * editor; the picker itself is the shared `MediaPickerAvatar`.
   */
  const [pickedCover, setPickedCover] = useState<PickedCover | null>(null);

  const onPickCover = () => {
    if (isSaving) return;

    setFailure(null);

    void pickCover()
      .then(picked => {
        if (picked) setPickedCover(picked);
      })
      .catch(() => setFailure(t('snackbar.sound-save-failed')));
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

  const save = async () => {
    if (savingRef.current) return;

    if (nameInvalid) {
      setShowNameError(true);
      return;
    }

    const trimmedName = name.trim();
    const trimmedArtist = artist.trim();

    savingRef.current = true;
    setFailure(null);

    if (soundId) {
      if (pickedCover) {
        // A new cover makes this a real upload, so it can no longer be
        // latency-compensated — hold the sheet behind the spinner the way the
        // create path does. Metadata alone still closes immediately.
        setIsSaving(true);

        try {
          const cover = await uploadCover(pickedCover);

          await updateSound({
            artist: trimmedArtist,
            cover,
            name: trimmedName,
            soundId,
          });

          await sheetRef.current?.hide();
          onClose();
          showSnackbar(t('snackbar.sound-updated'));
        } catch {
          // The sheet stays open so the edit can be retried, so the toast
          // would be invisible — see `SheetErrorLine`.
          setFailure(t('snackbar.sound-save-failed'));
          setIsSaving(false);
          savingRef.current = false;
        }

        return;
      }

      // Metadata-only update: latency-compensated, so close immediately and
      // let a single trailing snackbar confirm success OR failure. The close
      // comes FIRST — a toast fired while this sheet still stands draws behind
      // its window (see `SheetErrorLine`), and by the time either of these
      // resolves the sheet is gone.
      await sheetRef.current?.hide();
      onClose();

      updateSound({
        artist: trimmedArtist,
        name: trimmedName,
        soundId,
      })
        .then(() => showSnackbar(t('snackbar.sound-updated')))
        .catch(() => showSnackbar(t('snackbar.sound-save-failed')));

      return;
    }

    if (!pickedFile) return;

    // Create: the audio (+ art) upload is the one real network wait — hold the
    // sheet open behind the Save spinner so a failure can be retried in place.
    setIsSaving(true);

    try {
      const picked = pickedCover ? await uploadCover(pickedCover) : null;

      await createSound({
        artist: trimmedArtist,
        cover: picked,
        art: tags?.picture
          ? { base64: tags.picture.base64, mime: tags.picture.mime }
          : null,
        localAudioUri: pickedFile.uri,
        name: trimmedName,
      });

      await sheetRef.current?.hide();
      onClose();
      showSnackbar(t('snackbar.sound-created'));
    } catch {
      // Held open so the upload can be retried without re-picking the file.
      setFailure(t('snackbar.sound-save-failed'));
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

    await sheetRef.current?.hide();
    onClose();

    deleteSound(soundId)
      .then(() => showSnackbar(t('snackbar.sound-deleted')))
      .catch(() => showSnackbar(t('snackbar.sound-delete-failed')));
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
          showDragHandle={false}
        >
          <SheetDragHandle />
          <Column
            verticalArrangement={{ spacedBy: FORM_GAP }}
            // No top padding: the sheet's native drag handle already supplies
            // the gap above the content. The bottom clears the navigation bar
            // — see `composeSheetBottomPadding`.
            modifiers={[
              padding(
                COMPOSE_SHEET_GUTTER,
                0,
                COMPOSE_SHEET_GUTTER,
                composeSheetBottomPadding(insets.bottom),
              ),
              fillMaxWidth(),
            ]}
          >
            {/* The header→content gap is the SHEET family's
                (`COMPOSE_SHEET_HEADER_TO_CONTENT`), not the form's: the two
                are equal today, and this wrapper is what keeps them from
                drifting apart silently. */}
            <Box
              modifiers={[
                fillMaxWidth(),
                padding(0, 0, 0, COMPOSE_SHEET_HEADER_TO_CONTENT - FORM_GAP),
              ]}
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
            </Box>

            {/* Cover art at the TOP. A ROUNDED SQUARE, not a disc: this is
                ARTWORK — a picture standing for a recording — and every other
                place the app draws one (the grid cover, the player, the banner)
                is a rounded square at `artworkRadius`. The slot defaults to a
                full circle because that is the shape a PERSON'S photo takes in
                Topper's editors, and this app inherited it; a disc crop of an
                album cover is the one crop this app renders nowhere else.
                RNHostView matchContents sizes the avatar without blanking the
                fields below it. */}
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
                  // Android's own Material shape step — `artworkRadius` returns
                  // the discrete step here rather than iOS's ratio, so the
                  // corner stays on Material's 4/8/12/16/28 scale.
                  radius={artworkRadius(MEDIA_PICKER_SIZE, SHAPE_MD)}
                  emoji="🎵"
                  // Same `ArtImage` the slot rendered internally before it
                  // moved to the package; this keeps its output identical,
                  // tokens and circle included.
                  preview={
                    artPreviewUri ? (
                      <ArtImage
                        uri={artPreviewUri}
                        // Display-sized fetch for an EXISTING sound's remote
                        // cover; a local pick and the ID3 tag's `data:` bytes
                        // pass through `thumbUrl` untouched.
                        displayWidth={MEDIA_PICKER_SIZE}
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

            {/* TWO FIELDS. Album and Release Year are gone (Juan, 2026-08-21)
                — a library that takes any MP3 holds ringtones and voice memos,
                and asking those for an album is asking a question the app has
                no use for. "Artist" became "Subtitle" for the same reason
                "song" became "sound": the second line under a cover is whatever
                the person wants written there. The stored FIELD stays `artist`,
                exactly as the Firestore subcollection stays `songs`. */}
            <OutlinedTextField
              ref={artistFieldRef}
              value={artistState}
              onValueChange={setArtist}
              singleLine
              keyboardOptions={{
                capitalization: 'words',
                imeAction: 'done',
              }}
              keyboardActions={{ onDone: save }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>{t('soundEdit.subtitle.label')}</Text>
              </OutlinedTextField.Label>
              <OutlinedTextField.Placeholder>
                <Text>{t('soundEdit.subtitle.placeholder')}</Text>
              </OutlinedTextField.Placeholder>
            </OutlinedTextField>

            {failure ? <SheetErrorLine message={failure} /> : null}

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
            colors={{
              danger: colors.danger,
              primary: colors.primary,
              surfaceDialog: colors.surfaceDialog,
            }}
            onConfirm={handleDelete}
            onDismiss={() => setDeleteVisible(false)}
          />
        </ThemedHost>
      )}
    </>
  );
}
