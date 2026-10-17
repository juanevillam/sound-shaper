import * as FileSystem from 'expo-file-system/legacy';

import { userMediaFolder } from '@/services/cloudinary/folders';
import { requireUid } from '@/services/firebase/auth';

// Media (audio + cover art) lives on Cloudinary, NOT Firebase Storage: Storage
// requires the Blaze (paid) plan, and this app stays on Spark (free). Same
// cloud account Topper uses; a dedicated unsigned preset + folder keeps the two
// apps' assets apart. Cloudinary treats an mp3 as a `video` resource (audio is
// a video with no picture), so audio uploads to `/video/upload` and streams
// from its delivery URL; art uploads to `/image/upload` like Topper's images.

const CLOUD_NAME = 'juanevillam';
const UPLOAD_PRESET = 'sound_shaper_unsigned';
// Audio files are far bigger than an image, so the socket needs longer than
// Topper's 30s image cap before we give up and surface the failure.
const UPLOAD_TIMEOUT_MS = 120_000;

export type CloudinaryAsset = { publicId: string; url: string };

/** An uploaded mp3 also carries its length, when Cloudinary measured one. */
export type CloudinaryAudioAsset = CloudinaryAsset & {
  durationMs: number | null;
};

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  /** Seconds, as a float — present on a `video` (i.e. audio) upload. */
  duration?: number;
};

type ResourceType = 'image' | 'video';

// Upload a local file to Cloudinary via `FileSystem.uploadAsync` (native
// multipart) rather than `fetch` + `FormData`: this app's global `fetch` is
// Expo's WinterCG implementation, whose FormData converter rejects RN's
// `{ uri, name, type }` file part. `uploadAsync` streams the file natively and
// sidesteps that (see [[expo-winter-fetch-formdata-upload]]).
//
// THE FOLDER IS READ HERE, NOT PASSED IN. Every asset goes to
// `sound-shaper/{uid}/`, and that uid must equal the one the media worker
// derives from the caller's ID token — path IS ownership there. Taking it from
// the same `requireUid` every data path uses makes the two agree by
// construction; threading it through `createSound` and the cover picker would
// be two chances for them to disagree.
const uploadFile = async (
  uri: string,
  resourceType: ResourceType,
  mimeType: string,
): Promise<CloudinaryUploadResponse> => {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const folder = userMediaFolder(requireUid());

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
      parameters: { upload_preset: UPLOAD_PRESET, folder },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    }),
    timeout,
  ]).finally(() => clearTimeout(timeoutHandle));

  if (response.status < 200 || response.status >= 300)
    throw new Error(
      `Cloudinary upload failed: ${response.status} ${response.body}`,
    );

  return JSON.parse(response.body) as CloudinaryUploadResponse;
};

const toAsset = (parsed: CloudinaryUploadResponse): CloudinaryAsset => ({
  publicId: parsed.public_id,
  url: parsed.secure_url,
});

/**
 * Upload the picked .mp3; resolves to its Cloudinary asset (url + public id)
 * and its duration.
 *
 * THE LENGTH COMES BACK WITH THE UPLOAD. Cloudinary measures every `video`
 * resource and puts `duration` (seconds) in the response, so a new sound's
 * document can carry `durationMs` from its first write — it was dropped here,
 * which left every fresh upload reading `-:--` on its first play and paying a
 * separate banking write once the engine reported it. Absent or nonsense, it
 * is `null` and the engine learns it as before.
 */
export const uploadSoundAudio = async (
  uri: string,
): Promise<CloudinaryAudioAsset> => {
  const parsed = await uploadFile(uri, 'video', 'audio/mpeg');
  const seconds = parsed.duration;
  return {
    ...toAsset(parsed),
    durationMs:
      typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
        ? Math.round(seconds * 1000)
        : null,
  };
};

/**
 * Upload a cover picked from the photo library — already a file on disk, so it
 * goes straight up. The ID3 path below has to write a temp file first because
 * it starts from bytes; this one does not.
 */
export const uploadCoverImage = (
  uri: string,
  mimeType: string,
): Promise<CloudinaryAsset> => uploadFile(uri, 'image', mimeType).then(toAsset);

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
    return toAsset(await uploadFile(tempPath, 'image', mime));
  } finally {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
  }
};
