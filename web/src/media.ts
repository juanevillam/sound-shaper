import { getToken } from 'firebase/app-check';

import { MAX_UPLOAD_BYTES } from '@app/services/cloudinary/limits';

import { appCheck, auth } from './firebase';

/**
 * The app's media calls (`services/firebase/functions.ts` and
 * `services/cloudinary/upload.ts`) on the web: the same Worker, the same
 * signed uploads into `sound-shaper/{uid}/`, the same caps. The Worker lets
 * this origin through CORS; the ID token and App Check are what it trusts.
 */
const FUNCTIONS_BASE =
  'https://sound-shaper-media-worker.juanesvillamendoza.workers.dev';

/** An audio upload can take a while; the app gives up at the same two minutes. */
const UPLOAD_TIMEOUT_MS = 120_000;

type ResourceType = 'image' | 'video';

/** A refusal the Worker named — a cap, or a missing App Check token. */
export class BackendRefusal extends Error {
  constructor(readonly reason: string) {
    super(`refused: ${reason}`);
    this.name = 'BackendRefusal';
  }
}

/** Thrown before anything is sent, for a file over the app's caps. */
export class FileTooLargeError extends Error {
  constructor(readonly resourceType: ResourceType) {
    super(`${resourceType} over the size limit`);
    this.name = 'FileTooLargeError';
  }
}

const callBackend = async <T>(name: string, data: unknown = {}): Promise<T> => {
  const user = auth.currentUser;

  if (!user) throw new Error('Not signed in');

  const [token, check] = await Promise.all([
    user.getIdToken(),
    getToken(appCheck).then(
      result => result.token,
      () => null,
    ),
  ]);
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(check ? { 'X-Firebase-AppCheck': check } : {}),
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;

    throw typeof body?.error === 'string'
      ? new BackendRefusal(body.error)
      : new Error(`${name} failed: HTTP ${response.status}`);
  }

  return ((await response.json()) as { result: T }).result;
};

type SignedUpload = {
  apiKey: string;
  cloudName: string;
  params: Record<string, string>;
  signature: string;
};

export type Asset = { publicId: string; url: string };

const upload = async (
  file: Blob,
  resourceType: ResourceType,
): Promise<Asset & { duration?: number }> => {
  if (file.size > MAX_UPLOAD_BYTES[resourceType])
    throw new FileTooLargeError(resourceType);

  const { apiKey, cloudName, params, signature } =
    await callBackend<SignedUpload>('signUpload', { resourceType });
  const form = new FormData();

  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append('api_key', apiKey);
  form.append('signature', signature);
  form.append('file', file);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: form,
      // A timed-out upload is CANCELLED, not merely abandoned, so it cannot
      // land an asset nobody will reference.
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    },
  );

  // The status only: Cloudinary's error body can echo the public id.
  if (!response.ok)
    throw new Error(`Cloudinary upload failed: HTTP ${response.status}`);

  const parsed = (await response.json()) as {
    public_id: string;
    secure_url: string;
    duration?: number;
  };

  return {
    publicId: parsed.public_id,
    url: parsed.secure_url,
    duration: parsed.duration,
  };
};

/** The picked mp3, with the length Cloudinary measured while taking it. */
export const uploadAudio = async (
  file: Blob,
): Promise<Asset & { durationMs: number | null }> => {
  const { duration, ...asset } = await upload(file, 'video');

  return {
    ...asset,
    durationMs:
      typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? Math.round(duration * 1000)
        : null,
  };
};

export const uploadImage = async (file: Blob): Promise<Asset> => {
  const { publicId, url } = await upload(file, 'image');

  return { publicId, url };
};

/**
 * Destroy one asset this account owns. Best-effort, as in the app: an orphan
 * is the old status quo, a delete that refuses to finish is a new defect.
 */
export const destroyAsset = (publicId: string, resourceType: ResourceType) =>
  publicId
    ? callBackend('destroyMyAsset', { publicId, resourceType }).catch(error =>
        console.warn('destroyMyAsset', error),
      )
    : Promise.resolve();

/** The app's `uploadFailureKey`: refused uploads say why; the rest, retry. */
export const uploadFailureKey = (error: unknown, fallback: string): string => {
  if (error instanceof FileTooLargeError)
    return error.resourceType === 'video'
      ? 'snackbar.sound-too-large'
      : 'snackbar.picture-too-large';

  if (error instanceof BackendRefusal)
    switch (error.reason) {
      case 'library-full':
      case 'storage-full':
        return 'snackbar.library-full';
      case 'daily-limit':
        return 'snackbar.daily-limit';
    }

  return fallback;
};

/**
 * Destroy every asset under this account's folder, in one sweep — the first
 * step of deleting an account. NOT best-effort: a failure stops the delete
 * before any document goes, so nothing is left unreachable.
 */
export const cleanupMyMedia = () =>
  callBackend<{ destroyed: number }>('cleanupMyMedia');
