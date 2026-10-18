import * as FileSystem from 'expo-file-system/legacy';

import { withTimeout } from '@/lib/withTimeout';
import { reported } from '@/services/firebase/crashlytics';
import { signUpload } from '@/services/firebase/functions';

// Media (audio + cover art) lives on Cloudinary, NOT Firebase Storage: Storage
// requires the Blaze (paid) plan, and this app stays on Spark (free). Same
// cloud account Topper uses; a dedicated unsigned preset + folder keeps the two
// apps' assets apart. Cloudinary treats an mp3 as a `video` resource (audio is
// a video with no picture), so audio uploads to `/video/upload` and streams
// from its delivery URL; art uploads to `/image/upload` like Topper's images.
//
// EVERY UPLOAD IS SIGNED BY THE MEDIA WORKER (since 1.0.1, 2026-10-18). 1.0.0
// posted to an UNSIGNED preset, `sound_shaper_unsigned`, which any script
// could use with no account at all, and which shares the cloud's 25 free
// credits with every app on it. The Worker's signature names the public id —
// a fresh one under `sound-shaper/{uid}/` — so the folder is the Worker's to
// choose rather than ours, and it refuses past the per-person caps
// (`docs/telemetry-and-abuse.md`). Delete the preset once 1.0.0 is gone.
// Audio files are far bigger than an image, so the socket needs longer than
// Topper's 30s image cap before we give up and surface the failure.
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * The per-file half of the caps. A signature cannot carry a size, so the app
 * is where an honest upload is turned away; the Worker bounds a dishonest one
 * by the library's total. 20 MB is ~3.5× the measured average mp3 (5.79 MB),
 * so it refuses a long mix or a lossless rip, not a song.
 */
export const MAX_UPLOAD_BYTES = {
  image: 5_000_000,
  video: 20_000_000,
} as const;

/** Thrown before anything is sent, for a file over `MAX_UPLOAD_BYTES`. */
export class FileTooLargeError extends Error {
  constructor(readonly resourceType: ResourceType) {
    super(`Upload refused: ${resourceType} over the size limit`);
    this.name = 'FileTooLargeError';
  }
}

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
// THE FOLDER IS NOT OURS TO NAME. Every asset goes to `sound-shaper/{uid}/`,
// and that uid must equal the one the media worker derives from the caller's
// ID token — path IS ownership there. The Worker writes the path into the
// signed public id itself, so the two agree by construction.
const uploadFile = async (
  uri: string,
  resourceType: ResourceType,
  mimeType: string,
): Promise<CloudinaryUploadResponse> => {
  const info = await FileSystem.getInfoAsync(uri);

  if (info.exists && info.size > MAX_UPLOAD_BYTES[resourceType])
    throw new FileTooLargeError(resourceType);

  const { apiKey, cloudName, params, signature } =
    await signUpload(resourceType);
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  // AN UPLOAD TASK, NOT `uploadAsync`, so a timed-out upload can be CANCELLED.
  // Racing the plain call against a timer only stopped WAITING for it: the
  // native upload carried on in the background and could still land an asset
  // nobody would ever reference.
  const task = FileSystem.createUploadTask(url, uri, {
    fieldName: 'file',
    httpMethod: 'POST',
    mimeType,
    parameters: { ...params, api_key: apiKey, signature },
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  });

  const response = await withTimeout(
    task.uploadAsync(),
    UPLOAD_TIMEOUT_MS,
    'Cloudinary upload timed out',
    () => void task.cancelAsync().catch(() => {}),
  );

  if (!response) throw new Error('Cloudinary upload was cancelled');

  // The STATUS only. Cloudinary's error body can echo the request — the
  // public id, i.e. the uid — and this message reaches Crashlytics.
  if (response.status < 200 || response.status >= 300)
    throw new Error(`Cloudinary upload failed: HTTP ${response.status}`);

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
 * goes straight up. Reported here because its callers (the sound editors, the
 * Account photo) call it directly; the audio and ID3-art uploads run inside
 * `createSound`, which reports for them. The ID3 path below has to write a temp file first because
 * it starts from bytes; this one does not.
 */
export const uploadCoverImage = reported(
  'cloudinary.uploadCoverImage',
  (uri: string, mimeType: string): Promise<CloudinaryAsset> =>
    uploadFile(uri, 'image', mimeType).then(toAsset),
);

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
