import { useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Section } from '@expo/ui/swift-ui';
import {
  artworkRadius,
  confirmDestructiveIos,
  emptyMediaColor,
  SheetFormDestructiveIos,
  SheetFormFieldIos,
  sheetCommitBarOptionsIos,
  SheetFormBodyIos,
  SheetFormMediaIos,
} from '@portfolio/mobile-ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { type PickedSoundFile } from '@/components/sounds/EditSoundSheet';
import { ArtImage } from '@/components/ui/ArtImage';
import {
  MEDIA_PICKER_SIZE,
  MediaPickerAvatar,
} from '@/components/ui/MediaPickerAvatar';
import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { MIN_NAME_LENGTH } from '@/constants/forms';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useCoverPicker, type PickedCover } from '@/hooks/useCoverPicker';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import {
  createSound,
  deleteSound,
  updateSound,
} from '@/services/firebase/sounds';
import { takePendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useSoundsStore } from '@/store/sounds';

// Strip the extension for the name prefill when the file had no ID3 title.
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

// iOS-only route: create/edit a sound as a content-hugging native form sheet
// (Android presents the Compose `EditSoundSheet` in place). Edit mode arrives
// with a `soundId` param; create mode takes the picked file from the
// `pendingUpload` handoff (far too large for a route param). Same save/delete
// behaviour as Android; the destructive confirm is the system `Alert`.
function EditSoundSheetScreen() {
  const { soundId } = useLocalSearchParams<{ soundId?: string }>();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const sounds = useSoundsStore(s => s.sounds);
  const editingSound = soundId
    ? sounds.find(entry => entry.id === soundId)
    : undefined;

  // Taken ONCE on mount — a re-render must not re-take (the handoff clears).
  const pickedRef = useRef<PickedSoundFile | null | undefined>(undefined);
  if (pickedRef.current === undefined)
    pickedRef.current = soundId ? null : takePendingUpload();
  const pickedFile = pickedRef.current;

  const tags = pickedFile?.tags;
  const [name, setName] = useState(
    editingSound?.name ??
      tags?.title ??
      (pickedFile ? nameFromFile(pickedFile.fileName) : ''),
  );
  const [artist, setArtist] = useState(
    editingSound?.artist ?? tags?.artist ?? '',
  );
  const [album, setAlbum] = useState(editingSound?.album ?? tags?.album ?? '');
  const [year, setYear] = useState(
    editingSound?.releaseYear != null
      ? String(editingSound.releaseYear)
      : (tags?.year ?? ''),
  );
  const [isSaving, setIsSaving] = useState(false);
  const { pickCover, uploadCover } = useCoverPicker();
  const [showNameError, setShowNameError] = useState(false);

  // Re-entry guard: the year field's keyboard "done" calls save() directly and
  // isn't gated by the disabled Save button.
  const savingRef = useRef(false);

  /**
   * A cover picked in this session outranks both the file's ID3 art and the
   * one already saved — it is the most recent thing the person said.
   */
  const [pickedCover, setPickedCover] = useState<PickedCover | null>(null);
  const artPreviewUri =
    pickedCover?.uri ??
    (tags?.picture
      ? `data:${tags.picture.mime};base64,${tags.picture.base64}`
      : editingSound?.artUrl || undefined);

  const onPickCover = () => {
    if (isSaving) return;

    void pickCover()
      .then(picked => {
        if (picked) setPickedCover(picked);
      })
      .catch(() => showSnackbar(t('snackbar.sound-save-failed')));
  };

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
      // A NEW COVER MAKES THIS A REAL UPLOAD, so it can no longer be
      // latency-compensated: hold the sheet open behind the Save spinner the
      // way the create path does, and let a failure be retried in place.
      // Metadata alone still closes immediately — that write is instant and a
      // trailing snackbar is the honest confirmation for it.
      if (pickedCover) {
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
          router.back();
        } catch {
          showSnackbar(t('snackbar.sound-save-failed'));
          setIsSaving(false);
          savingRef.current = false;
        }

        return;
      }

      updateSound({
        album: trimmedAlbum,
        artist: trimmedArtist,
        name: trimmedName,
        releaseYear,
        soundId,
      })
        .then(() => showSnackbar(t('snackbar.sound-updated')))
        .catch(() => showSnackbar(t('snackbar.sound-save-failed')));

      router.back();
      return;
    }

    if (!pickedFile) return;

    // Create: the audio (+ art) upload is the one real network wait — hold the
    // sheet open behind the Save spinner so a failure can be retried in place.
    setIsSaving(true);

    try {
      // A picked cover wins over the file's own tag on create too — same rule
      // the preview above follows.
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
      router.back();
    } catch {
      showSnackbar(t('snackbar.sound-save-failed'));
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const runDelete = () => {
    if (!soundId) return;

    haptics.medium();

    // Clear it from the player up front — a deleted sound must not linger in
    // the now-playing banner or stay playable.
    usePlayerStore.getState().soundDeleted(soundId);

    deleteSound(soundId)
      .then(() => showSnackbar(t('snackbar.sound-deleted')))
      .catch(() => showSnackbar(t('snackbar.sound-delete-failed')));

    router.back();
  };

  // Cancel is the PREFERRED action, which is Apple's own treatment for a
  // destructive alert and the reason every one of them in this app comes from
  // `confirmDestructiveIos` rather than a hand-built `Alert.alert` call.
  const confirmDelete = () =>
    confirmDestructiveIos({
      title: t('soundEdit.deleteConfirm.title'),
      message: t('soundEdit.deleteConfirm.message'),
      cancelLabel: t('soundEdit.deleteConfirm.cancel'),
      confirmLabel: t('soundEdit.deleteConfirm.confirm'),
      onConfirm: runDelete,
    });

  // Deep-linked with nothing to edit or create: an empty sheet helps no one.
  if (!editingSound && !pickedFile)
    return <View style={{ backgroundColor: colors.sheet }} />;

  return (
    // `SheetScreen` for the toast: a sheet is presented above the RN root, so
    // this editor's "Sound saved" / "Couldn't save" messages drew BEHIND it and
    // were never seen. See `SnackbarOutlet`.
    <SheetScreen>
      {/* The commit-modal pair lives in the sheet's REAL UIKit bar — Topper's
          standard, and the only arrangement whose Liquid Glass is genuine (the
          authored header this replaced drew its own flat "glass" circles and a
          filled primary ✓ disc). The route table supplies the CREATE title;
          this states the edit case and its own words. */}
      <Stack.Screen
        options={sheetCommitBarOptionsIos({
          title: t(soundId ? 'app.soundEditExisting' : 'app.soundEdit'),
          cancelLabel: t('common.cancel'),
          onCancel: () => router.back(),
          actionLabel: t(soundId ? 'soundEdit.saveExisting' : 'soundEdit.save'),
          actionEnabled: !nameInvalid,
          busy: isSaving,
          onAction: save,
        })}
      />
      <SheetFormBodyIos>
        {/* THE COVER IS PICKABLE — same control, same arrangement, same
            words as Topper's item editor, because it is the same job. It was a
            disabled disc reading the ID3 tag and nothing else, which is wrong
            for what this library actually holds: any MP3 goes in, and a
            ringtone or a voice memo has no embedded art to show, while a person
            may simply want a different picture than the one baked into the
            file.

            The caption therefore lives INSIDE the press target and in the
            accent, which is Topper's arrangement — art and label are one
            control, the way a create tile is. It sat in `SheetFormMediaIos`'s
            own slot before, as a small muted Button, and that is why it read at
            a different size and colour than Topper's "Change Photo": a
            different component, tinted muted because no `onPress` was passed.
            Making the disc press fixes all three differences at once. */}
        <Section>
          <SheetFormMediaIos>
            <View style={styles.mediaSlot}>
              <MediaPickerAvatar
                onPress={onPickCover}
                accessibilityLabel={t('common.pickMedia')}
                disabled={isSaving}
                // THE EMPTY-MEDIA MATERIAL, not a hand-picked pair. This drew
                // `surfaceVariant` / `onSurfaceMuted` — precisely the bug
                // Topper's editor records having fixed, and the token the
                // portfolio's one placeholder material replaces. `sheet`
                // because this sits on a form sheet, where dark steps every
                // grouped colour up one (see `emptyMediaColor`).
                surfaceColor={emptyMediaColor({
                  colors,
                  container: 'sheet',
                  scheme,
                })}
                contentColor={colors.onSurface}
                // THE ART'S REAL CROP, not a circle. The slot defaults to the
                // full circle the Android sheet draws; every cover in this app
                // renders as a rounded square, so previewing one as a disc
                // showed a shape the app never draws.
                radius={artworkRadius(MEDIA_PICKER_SIZE, 0)}
                caption={t(
                  isSaving
                    ? 'soundEdit.uploading'
                    : artPreviewUri
                      ? 'soundEdit.art.change'
                      : 'soundEdit.art.add',
                )}
                captionColor={isSaving ? colors.onSurfaceMuted : colors.primary}
                preview={
                  artPreviewUri ? (
                    <ArtImage uri={artPreviewUri} style={styles.mediaPreview} />
                  ) : null
                }
              />
            </View>
          </SheetFormMediaIos>
        </Section>

        <Section>
          <SheetFormFieldIos
            value={name}
            onChangeText={setName}
            placeholder={t('soundEdit.name.label')}
            error={nameError ? t('soundEdit.name.error') : null}
          />
          <SheetFormFieldIos
            value={artist}
            onChangeText={setArtist}
            placeholder={t('soundEdit.artist.label')}
          />
          <SheetFormFieldIos
            value={album}
            onChangeText={setAlbum}
            placeholder={t('soundEdit.album.label')}
          />
          <SheetFormFieldIos
            value={year}
            onChangeText={setYear}
            placeholder={t('soundEdit.year.label')}
            error={yearInvalid ? t('soundEdit.year.error') : null}
            keyboardType="numberPad"
          />
        </Section>

        {soundId ? (
          <Section>
            <SheetFormDestructiveIos
              label={t('soundEdit.delete')}
              disabled={isSaving}
              onPress={confirmDelete}
            />
          </Section>
        ) : null}
      </SheetFormBodyIos>
    </SheetScreen>
  );
}

export default iosOnlyRoute(EditSoundSheetScreen);

const styles = StyleSheet.create({
  // Full width so the disc centres in the form row; RNHostView measures the
  // RN child and gives it no size of its own.
  mediaSlot: { alignItems: 'center', width: '100%' },
  // The picture fills the slot the package sized and clipped.
  mediaPreview: { height: '100%', width: '100%' },
});
