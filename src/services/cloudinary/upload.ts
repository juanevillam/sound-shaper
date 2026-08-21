import * as FileSystem from 'expo-file-system/legacy';

// Media (audio + cover art) lives on Cloudinary, NOT Firebase Storage: Storage
// requires the Blaze (paid) plan, and this app stays on Spark (free). Same
// cloud account Topper uses; a dedicated unsigned preset + folder keeps the two
// apps' assets apart. Cloudinary treats an mp3 as a `video` resource (audio is
// a video with no picture), so audio uploads to `/video/upload` and streams
// from its delivery URL; art uploads to `/image/upload` like Topper's images.

const CLOUD_NAME = 'juanevillam';
const UPLOAD_PRESET = 'sound_shaper_unsigned';
const FOLDER = 'sound-shaper';
// Audio files are far bigger than an image, so the socket needs longer than
// Topper's 30s image cap before we give up and surface the failure.
const UPLOAD_TIMEOUT_MS = 120_000;

export type CloudinaryAsset = { publicId: string; url: string };

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
};

type ResourceType = 'image' | 'video';

// Upload a local file to Cloudinary via `FileSystem.uploadAsync` (native
// multipart) rather than `fetch` + `FormData`: this app's global `fetch` is
// Expo's WinterCG implementation, whose FormData converter rejects RN's
// `{ uri, name, type }` file part. `uploadAsync` streams the file natively and
// sidesteps that (see [[expo-winter-fetch-formdata-upload]]).
const uploadFile = async (
  uri: string,
  resourceType: ResourceType,
  mimeType: string,
): Promise<CloudinaryAsset> => {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Cloudinary upload timed out')),
      UPLOAD_TIMEOUT_MS,
    );
  });

  const response = await Promise.race([
    FileSystem.uploadAsync(url, uri, {
      fieldName: 'file',
      httpMethod: 'POST',
      mimeType,
      parameters: { upload_preset: UPLOAD_PRESET, folder: FOLDER },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    }),
    timeout,
  ]).finally(() => clearTimeout(timeoutHandle));

  if (response.status < 200 || response.status >= 300)
    throw new Error(
      `Cloudinary upload failed: ${response.status} ${response.body}`,
    );

  const parsed = JSON.parse(response.body) as CloudinaryUploadResponse;
  return { publicId: parsed.public_id, url: parsed.secure_url };
};

/** Upload the picked .mp3; resolves to its Cloudinary asset (url + public id). */
export const uploadSoundAudio = (uri: string): Promise<CloudinaryAsset> =>
  uploadFile(uri, 'video', 'audio/mpeg');

/**
 * Upload a cover picked from the photo library — already a file on disk, so it
 * goes straight up. The ID3 path below has to write a temp file first because
 * it starts from bytes; this one does not.
 */
export const uploadCoverImage = (
  uri: string,
  mimeType: string,
): Promise<CloudinaryAsset> => uploadFile(uri, 'image', mimeType);

/**
 * Upload the ID3-embedded cover art (base64 bytes). Cloudinary's multipart
 * upload wants a file, so the bytes are written to a temp file first, uploaded,
 * then cleaned up.
 */
export const uploadSoundArt = async (
  base64: string,
  mime: string,
): Promise<CloudinaryAsset> => {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const tempPath = `${FileSystem.cacheDirectory}art-${Date.now()}.${ext}`;

  await FileSystem.writeAsStringAsync(tempPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    return await uploadFile(tempPath, 'image', mime);
  } finally {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
  }
};
