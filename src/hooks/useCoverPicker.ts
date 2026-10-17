import { useCallback } from 'react';

import * as ImagePicker from 'expo-image-picker';

import { uploadCoverImage } from '@/services/cloudinary/upload';

/** A picked-but-not-yet-uploaded local cover. */
export type PickedCover = {
  uri: string;
  mimeType: string;
};

type UseCoverPickerReturn = {
  pickCover: () => Promise<PickedCover | null>;
  uploadCover: (cover: PickedCover) => Promise<{
    publicId: string;
    url: string;
  }>;
};

/** Topper's number, so a cover costs the same wherever it is picked. */
const IMAGE_QUALITY = 0.8;

/**
 * COVER ART IS THE PERSON'S TO CHOOSE — the picker this app was missing.
 *
 * A sound's artwork came from its ID3 tag and from nowhere else, so a file
 * without one showed a permanent placeholder and there was no way to fix it.
 * That is wrong for what this app actually holds: the library takes any MP3,
 * and a ringtone or a voice memo has no embedded art to read, while a person
 * may simply want a different picture than the one baked into the file.
 *
 * TWO STEPS, DEFERRED — Topper's `useImageUpload` shape, and for its reason:
 * picking is cheap and reversible (a repick just replaces the local file), so
 * the upload waits for save. Uploading on pick orphans a Cloudinary asset every
 * time someone changes their mind or cancels, and this app has no signed
 * backend call to delete one with.
 */
export const useCoverPicker = (): UseCoverPickerReturn => {
  const pickCover = useCallback(async (): Promise<PickedCover | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: IMAGE_QUALITY,
    });

    const asset = result.canceled ? null : (result.assets[0] ?? null);

    if (!asset) return null;

    return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
  }, []);

  const uploadCover = useCallback(
    async ({ uri, mimeType }: PickedCover) => uploadCoverImage(uri, mimeType),
    [],
  );

  return { pickCover, uploadCover };
};
