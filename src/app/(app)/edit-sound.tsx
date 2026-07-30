import { useRef, useState } from 'react';

import { Alert, StyleSheet, View } from 'react-native';

import { Section } from '@expo/ui/swift-ui';
import {
  SheetFormDestructiveIos,
  SheetFormFieldIos,
  SheetFormIos,
  SheetFormMediaIos,
} from '@portfolio/mobile-ui';
import { router, useLocalSearchParams } from 'expo-router';

import { type PickedSongFile } from '@/components/songs/EditSongSheet';
import { MediaPickerAvatar } from '@/components/ui/MediaPickerAvatar';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { MIN_NAME_LENGTH } from '@/constants/forms';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { createSong, deleteSong, updateSong } from '@/services/firebase/songs';
import { takePendingUpload } from '@/store/pendingUpload';
import { usePlayerStore } from '@/store/player';
import { useSongsStore } from '@/store/songs';

// Fallback glyph when a file carries no embedded art — same one the Android
// sheet uses, so the two platforms show the same placeholder.
const SONG_EMOJI = '🎵';

const noop = () => {};

// Strip the extension for the name prefill when the file had no ID3 title.
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

// iOS-only route: create/edit a song as a content-hugging native form sheet
// (Android presents the Compose `EditSongSheet` in place). Edit mode arrives
// with a `songId` param; create mode takes the picked file from the
// `pendingUpload` handoff (far too large for a route param). Same save/delete
// behaviour as Android; the destructive confirm is the system `Alert`.
function EditSoundSheetScreen() {
  const { songId } = useLocalSearchParams<{ songId?: string }>();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const songs = useSongsStore(s => s.songs);
  const editingSong = songId
    ? songs.find(entry => entry.id === songId)
    : undefined;

  // Taken ONCE on mount — a re-render must not re-take (the handoff clears).
  const pickedRef = useRef<PickedSongFile | null | undefined>(undefined);
  if (pickedRef.current === undefined)
    pickedRef.current = songId ? null : takePendingUpload();
  const pickedFile = pickedRef.current;

  const tags = pickedFile?.tags;
  const [name, setName] = useState(
    editingSong?.name ??
      tags?.title ??
      (pickedFile ? nameFromFile(pickedFile.fileName) : ''),
  );
  const [artist, setArtist] = useState(
    editingSong?.artist ?? tags?.artist ?? '',
  );
  const [album, setAlbum] = useState(editingSong?.album ?? tags?.album ?? '');
  const [year, setYear] = useState(
    editingSong?.releaseYear != null
      ? String(editingSong.releaseYear)
      : (tags?.year ?? ''),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showNameError, setShowNameError] = useState(false);

  // Re-entry guard: the year field's keyboard "done" calls save() directly and
  // isn't gated by the disabled Save button.
  const savingRef = useRef(false);

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

      router.back();
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
      router.back();
    } catch {
      showSnackbar(t('snackbar.song-save-failed'));
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const runDelete = () => {
    if (!songId) return;

    haptics.medium();

    // Clear it from the player up front — a deleted song must not linger in
    // the now-playing banner or stay playable.
    usePlayerStore.getState().songDeleted(songId);

    deleteSong(songId)
      .then(() => showSnackbar(t('snackbar.song-deleted')))
      .catch(() => showSnackbar(t('snackbar.song-delete-failed')));

    router.back();
  };

  const confirmDelete = () =>
    Alert.alert(
      t('songEdit.deleteConfirm.title'),
      t('songEdit.deleteConfirm.message'),
      [
        { text: t('songEdit.deleteConfirm.cancel'), style: 'cancel' },
        {
          text: t('songEdit.deleteConfirm.confirm'),
          style: 'destructive',
          onPress: runDelete,
        },
      ],
    );

  // Deep-linked with nothing to edit or create: an empty sheet helps no one.
  if (!editingSong && !pickedFile)
    return <View style={{ backgroundColor: colors.sheet }} />;

  return (
    <SheetFormIos
      title={t(songId ? 'app.songEditExisting' : 'app.songEdit')}
      actionLabel={t(songId ? 'songEdit.saveExisting' : 'songEdit.save')}
      actionEnabled={!nameInvalid}
      busy={isSaving}
      onAction={save}
    >
      {/* Cover art is a read-only preview: it comes from the file's ID3 tag,
          never hand-picked, so the disc is disabled rather than a picker.
          Same disc, same block, same caption slot as Topper's editor and as
          this app's own Android sheet — only the tappability differs. */}
      <Section>
        <SheetFormMediaIos
          caption={t(
            isSaving
              ? 'songEdit.uploading'
              : artPreviewUri
                ? 'songEdit.art.embedded'
                : 'songEdit.art.none',
          )}
        >
          <View style={styles.mediaSlot}>
            <MediaPickerAvatar
              onPress={noop}
              disabled
              surfaceColor={colors.surfaceVariant}
              contentColor={colors.onSurfaceMuted}
              emoji={SONG_EMOJI}
              imageUrl={artPreviewUri}
            />
          </View>
        </SheetFormMediaIos>
      </Section>

      <Section>
        <SheetFormFieldIos
          value={name}
          onChangeText={setName}
          placeholder={t('songEdit.name.label')}
          error={nameError ? t('songEdit.name.error') : null}
        />
        <SheetFormFieldIos
          value={artist}
          onChangeText={setArtist}
          placeholder={t('songEdit.artist.label')}
        />
        <SheetFormFieldIos
          value={album}
          onChangeText={setAlbum}
          placeholder={t('songEdit.album.label')}
        />
        <SheetFormFieldIos
          value={year}
          onChangeText={setYear}
          placeholder={t('songEdit.year.label')}
          error={yearInvalid ? t('songEdit.year.error') : null}
          keyboardType="numberPad"
        />
      </Section>

      {songId ? (
        <Section>
          <SheetFormDestructiveIos
            label={t('songEdit.delete')}
            disabled={isSaving}
            onPress={confirmDelete}
          />
        </Section>
      ) : null}
    </SheetFormIos>
  );
}

export default iosOnlyRoute(EditSoundSheetScreen);

const styles = StyleSheet.create({
  // Full width so the disc centres in the form row; RNHostView measures the
  // RN child and gives it no size of its own.
  mediaSlot: { alignItems: 'center', width: '100%' },
});
