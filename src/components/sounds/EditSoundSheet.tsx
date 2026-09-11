import { useRef, useState } from 'react';

import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  ListItem,
  ModalBottomSheet,
  OutlinedTextField,
  RNHostView,
  Text,
  useNativeState,
  type ModalBottomSheetRef,
  type TextFieldRef,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  artworkRadius,
  COMPOSE_SHEET_GUTTER,
  COMPOSE_SHEET_HEADER_TO_CONTENT,
  composeSheetBottomPadding,
  DestructiveConfirmDialog,
  emptyMediaColor,
  groupRowShape,
  iconSource,
  menuContainer,
  sheetContainer,
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
import { useProfileStore } from '@/store/profile';
import { nextAppendPosition, useSoundsStore } from '@/store/sounds';
import { SECTION_GAP } from '@/styles/metrics';
import { SHAPE_MD } from '@/styles/shape';

/** The picture fills the slot the package sized and clipped. */
const MENU_ICON_SIZE = 24;
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
  const { colors, scheme } = useAppTheme();
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
  /** Artwork removed this session — the preview hides and Save writes the
   *  clear. Deferred like the pick; the iOS route's own state. */
  const [artCleared, setArtCleared] = useState(false);
  // Change / Remove, offered on the picture itself — the twin of the iOS
  // route's action sheet (Topper's item editor made the same move,
  // 2026-09-07).
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
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
        if (picked) {
          setPickedCover(picked);
          setArtCleared(false);
        }
      })
      .catch(() => setFailure(t('snackbar.sound-save-failed')));
  };

  // The preview: a picked cover, else the ID3-embedded picture (create) or the
  // uploaded art (edit) — unless this session removed it.
  const artPreviewUri = artCleared
    ? (pickedCover?.uri ?? undefined)
    : (pickedCover?.uri ??
      (tags?.picture
        ? `data:${tags.picture.mime};base64,${tags.picture.base64}`
        : editingSound?.artUrl || undefined));

  // With art present the press OFFERS (menu); with none it picks. Same branch
  // the iOS route takes before opening its action sheet.
  const openMedia = () => {
    if (isSaving) return;
    if (artPreviewUri) setMediaMenuOpen(true);
    else onPickCover();
  };

  const removeCover = () => {
    setPickedCover(null);
    setArtCleared(true);
  };

  const nameInvalid = name.trim().length < MIN_NAME_LENGTH;

  const save = async () => {
    if (savingRef.current) return;

    // TOO SHORT A NAME DISABLES SAVE, AND SAYS NOTHING ELSE — Apple's
    // commit-modal rule (Topper's editors adopted it first); this branch is
    // only reachable through the keyboard's Done, which declines the same
    // silent way.
    if (nameInvalid) return;

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
        ...(artCleared ? { cover: null } : {}),
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
        // The END of the grid — an upload never displaces an order somebody
        // arranged by hand. See `nextAppendPosition`.
        position: nextAppendPosition(
          useProfileStore.getState().profile?.addTilePosition ?? null,
        ),
        art:
          tags?.picture && !artCleared
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
          // The family's one ground, stated — see `sheetContainer`.
          containerColor={sheetContainer(colors, scheme)}
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

            {/* Cover art at the TOP — a rounded square (artwork, not a
                person's disc; the corner is Material's own step), the caption
                INSIDE the press target and in the ACCENT, exactly the iOS
                route's arrangement (and Topper's item editor's). With art
                present the press OFFERS Change / Remove through a Material
                DropdownMenu — the twin of the iOS ActionSheet on the same tap
                — and with none it picks straight away. */}
            <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
              <DropdownMenu
                color={menuContainer(colors, scheme)}
                expanded={mediaMenuOpen}
                onDismissRequest={() => setMediaMenuOpen(false)}
              >
                <DropdownMenu.Trigger>
                  <RNHostView matchContents>
                    <MediaPickerAvatar
                      onPress={openMedia}
                      accessibilityLabel={t('common.pickMedia')}
                      disabled={isSaving}
                      // THE EMPTY-MEDIA MATERIAL, the shared term — this drew
                      // `surfaceVariant` by hand, the exact drift the term
                      // exists to kill (the iOS route already imports it).
                      surfaceColor={emptyMediaColor({
                        colors,
                        container: 'sheet',
                        scheme,
                      })}
                      contentColor={colors.onSurface}
                      radius={artworkRadius(MEDIA_PICKER_SIZE, SHAPE_MD)}
                      caption={t(
                        isSaving
                          ? 'soundEdit.uploading'
                          : artPreviewUri
                            ? 'soundEdit.art.change'
                            : 'soundEdit.art.add',
                      )}
                      // The accent says it's the action (a text action keeps
                      // its tint); muted while the sheet commits.
                      captionColor={
                        isSaving ? colors.onSurfaceMuted : colors.primary
                      }
                      preview={
                        artPreviewUri ? (
                          <ArtImage
                            uri={artPreviewUri}
                            // Display-sized fetch for an EXISTING sound's
                            // remote cover; a local pick and the ID3 tag's
                            // `data:` bytes pass through `thumbUrl` untouched.
                            displayWidth={MEDIA_PICKER_SIZE}
                            style={MEDIA_PREVIEW_FILL}
                          />
                        ) : null
                      }
                    />
                  </RNHostView>
                </DropdownMenu.Trigger>
                <DropdownMenu.Items>
                  <DropdownMenuItem
                    onClick={() => {
                      setMediaMenuOpen(false);
                      onPickCover();
                    }}
                  >
                    <DropdownMenuItem.Text>
                      <Text color={colors.onSurface}>
                        {t('soundEdit.art.change')}
                      </Text>
                    </DropdownMenuItem.Text>
                    <DropdownMenuItem.LeadingIcon>
                      <Icon
                        source={iconSource('image')}
                        size={MENU_ICON_SIZE}
                        tint={colors.onSurface}
                      />
                    </DropdownMenuItem.LeadingIcon>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setMediaMenuOpen(false);
                      removeCover();
                    }}
                  >
                    <DropdownMenuItem.Text>
                      <Text color={colors.danger}>
                        {t('soundEdit.art.remove')}
                      </Text>
                    </DropdownMenuItem.Text>
                    <DropdownMenuItem.LeadingIcon>
                      <Icon
                        source={iconSource('delete')}
                        size={MENU_ICON_SIZE}
                        tint={colors.danger}
                      />
                    </DropdownMenuItem.LeadingIcon>
                  </DropdownMenuItem>
                </DropdownMenu.Items>
              </DropdownMenu>
            </Column>

            <OutlinedTextField
              value={nameState}
              onValueChange={setName}
              singleLine
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
              /* DELETE is the Account screen's destructive row — a red label
                 in its own headerless grouped card on a SECTION break — the
                 shape Topper's editors already take; the outlined button it
                 replaces was a control Material spends on secondary actions,
                 not destructions. */
              <Column
                modifiers={[
                  fillMaxWidth(),
                  padding(0, SECTION_GAP - FORM_GAP, 0, 0),
                ]}
              >
                <ListItem
                  colors={{
                    containerColor: colors.surfaceContainer,
                    contentColor: colors.danger,
                  }}
                  modifiers={[
                    fillMaxWidth(),
                    clip(groupRowShape(0, 1)),
                    ...(isSaving
                      ? []
                      : [clickable(() => setDeleteVisible(true))]),
                  ]}
                >
                  <ListItem.HeadlineContent>
                    <Text color={colors.danger}>{t('soundEdit.delete')}</Text>
                  </ListItem.HeadlineContent>
                </ListItem>
              </Column>
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
