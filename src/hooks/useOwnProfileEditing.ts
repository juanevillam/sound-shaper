import { useCallback, useState } from 'react';

import { ActionSheetIOS } from 'react-native';

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { IMAGE_QUALITY } from '@/hooks/useCoverPicker';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { profilePhotoDisplayUrls } from '@/lib/profilePhoto';
import { uploadCoverImage } from '@/services/cloudinary/upload';
import { setOwnName, setOwnPhoto } from '@/services/firebase/ownProfile';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';
import { type SettingsUsernameEditor, useSnackbar } from '@/ui';

/**
 * Edit the signed-in person's name and photo from the Account sheet.
 *
 * The auth and profile STORES are updated by hand after each write: an
 * `updateProfile` does not fire `onAuthStateChanged`, so nothing else would
 * tell Settings' banner or this sheet that the name or the face changed.
 */
export const useOwnProfileEditing = () => {
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const user = useAuthStore(s => s.user);
  const [photoBusy, setPhotoBusy] = useState(false);
  /** A freshly picked local file, shown while it uploads. */
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

  const patchStores = useCallback(
    (patch: { displayName?: string; photoUrl?: string | null }) => {
      const auth = useAuthStore.getState();
      if (auth.user) auth.setUser({ ...auth.user, ...patch });
      const profileStore = useProfileStore.getState();
      if (profileStore.profile)
        profileStore.setProfile({ ...profileStore.profile, ...patch });
    },
    [],
  );

  /**
   * The Name row's editor — the shared native text alert. A blank name is
   * refused by rejecting, which re-presents the alert with the text kept.
   */
  const nameEditor: SettingsUsernameEditor = {
    currentValue: user?.displayName ?? '',
    dialog: {
      title: t('settings.manageAccount.nameDialog.title'),
      fieldLabel: t('settings.manageAccount.nameDialog.fieldLabel'),
      confirm: t('settings.manageAccount.nameDialog.confirm'),
      cancel: t('settings.manageAccount.nameDialog.cancel'),
    },
    onSubmit: async (name: string) => {
      if (!name) throw new Error('empty-name');
      if (name === user?.displayName) return;
      try {
        await setOwnName(name);
        patchStores({ displayName: name });
        haptics.selection();
      } catch {
        showSnackbar(t('snackbar.profile-name-failed'));
      }
    },
  };

  const applyPhoto = useCallback(
    async (uri: string | null, mimeType = 'image/jpeg') => {
      setPhotoBusy(true);
      setPendingPhoto(uri);
      try {
        const asset = uri ? await uploadCoverImage(uri, mimeType) : null;
        await setOwnPhoto(asset);
        // WARM BOTH AVATARS BEFORE THE LOCAL FILE GOES. The pending photo is
        // what both slots show while this runs; clearing it hands them the new
        // display-sized urls, which used to be fetched cold — so the face
        // blinked out and back in. Awaited so the swap lands on a warm cache;
        // a failed prefetch only means the old cold fetch.
        if (asset) {
          await Image.prefetch(
            profilePhotoDisplayUrls(asset.url),
            'memory-disk',
          ).catch(() => false);
        }
        patchStores({ photoUrl: asset?.url ?? null });
      } catch {
        showSnackbar(t('snackbar.profile-photo-failed'));
      } finally {
        setPhotoBusy(false);
        setPendingPhoto(null);
      }
    },
    [patchStores, showSnackbar, t],
  );

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // A person's photo is a square cropped to a circle everywhere it shows;
      // the system cropper lets them choose which square, as Contacts does.
      allowsEditing: true,
      aspect: [1, 1],
      quality: IMAGE_QUALITY,
    });
    const asset = result.canceled ? null : (result.assets[0] ?? null);
    if (asset) await applyPhoto(asset.uri, asset.mimeType ?? 'image/jpeg');
  }, [applyPhoto]);

  /** Tap on the photo: pick one, or — when there is one — Change or Remove. */
  const editPhoto = useCallback(() => {
    if (photoBusy) return;
    if (!user?.photoUrl) {
      void pickPhoto();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t('settings.manageAccount.photo.change'),
          t('settings.manageAccount.photo.remove'),
          t('settings.manageAccount.photo.cancel'),
        ],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) void pickPhoto();
        else if (index === 1) void applyPhoto(null);
      },
    );
  }, [applyPhoto, photoBusy, pickPhoto, t, user?.photoUrl]);

  return {
    editPhoto,
    nameEditor,
    pendingPhoto,
    photoBusy,
  };
};
