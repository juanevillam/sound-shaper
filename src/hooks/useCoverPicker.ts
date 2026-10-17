import { useCallback, useRef } from 'react';

import * as ImagePicker from 'expo-image-picker';

import {
  type CloudinaryAsset,
  uploadCoverImage,
} from '@/services/cloudinary/upload';

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

/** Topper's number, so a picture costs the same wherever it is picked — a
 *  cover here, a person's photo in `useOwnProfileEditing`. */
export const IMAGE_QUALITY = 0.8;

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
 * the upload waits for save. Uploading on pick would orphan a Cloudinary asset
 * every time someone changes their mind or cancels; the media Worker
 * (`media-worker/`, deployed 2026-09-12) could delete it, but a best-effort
 * delete for an asset nobody kept is a cost the deferral simply never pays.
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

  /**
   * THE LAST UPLOAD IS KEPT FOR A RETRY. When the upload lands and the save
   * behind it fails, the editor stays open for another go — and uploading the
   * same picture again would orphan the first copy on Cloudinary. So the same
   * picked file (its local uri) returns the asset it already produced; a
   * repick is a different uri and uploads afresh.
   */
  const lastUpload = useRef<{ asset: CloudinaryAsset; uri: string } | null>(
    null,
  );

  const uploadCover = useCallback(
    async ({ uri, mimeType }: PickedCover): Promise<CloudinaryAsset> => {
      if (lastUpload.current?.uri === uri) return lastUpload.current.asset;

      const asset = await uploadCoverImage(uri, mimeType);
      lastUpload.current = { asset, uri };
      return asset;
    },
    [],
  );

  return { pickCover, uploadCover };
};
