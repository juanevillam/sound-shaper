import { appCheckToken } from '@/services/firebase/appCheck';
import { requireUser } from '@/services/firebase/auth';

/**
 * Thin fetch-based client for the media-cleanup Worker (POST {data} + the
 * caller's Firebase ID token and App Check token; 200 {result} back). The
 * Worker deletes the caller's own Cloudinary assets and signs their uploads,
 * and does nothing else — see `media-worker/` (the `sound-shaper`
 * environment).
 *
 * IT IS THE BACKEND THIS APP'S DOCBLOCKS SAID IT "DELIBERATELY DOESN'T HAVE".
 * That was true, and it cost three orphans: a deleted sound kept its audio and
 * artwork on Cloudinary forever, replacing a cover stranded the old one, and
 * deleting an account left the whole library behind. Destroying an asset needs
 * the Cloudinary API secret, which cannot ship in an app — the Worker holds it
 * instead, and proves ownership from the per-user upload path alone.
 *
 * Every call here is best-effort from the app's point of view: callers catch
 * and degrade (the asset orphans, exactly as before) rather than block the
 * flow. Apple token revocation is NOT here — Firebase's managed
 * `getAuth().revokeToken` handles it with no backend of ours.
 */
// Deployed 2026-09-12 from `media-worker/`
// (`npm run deploy`). Re-deploying does not change this URL; only
// renaming the Worker or the account's workers.dev subdomain would.
const FUNCTIONS_BASE =
  'https://sound-shaper-media-worker.juanesvillamendoza.workers.dev';

/**
 * A refusal the Worker NAMED — a cap or a missing App Check token — carried
 * as its own type so a caller can tell "you are at your limit" from "the
 * network failed" and say the right words for each.
 */
export class BackendRefusal extends Error {
  constructor(
    readonly route: string,
    readonly status: number,
    readonly reason: string,
  ) {
    super(`${route} refused: HTTP ${status} ${reason}`);
    this.name = 'BackendRefusal';
  }
}

const callBackend = async <T>(name: string, data: unknown = {}): Promise<T> => {
  const [token, appCheck] = await Promise.all([
    requireUser().getIdToken(),
    appCheckToken(),
  ]);
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;

    throw typeof body?.error === 'string'
      ? new BackendRefusal(name, response.status, body.error)
      : new Error(`${name} failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { result: T };

  return payload.result;
};

/**
 * Destroy every Cloudinary asset the caller owns — audio and artwork both, in
 * one sweep of `sound-shaper/{uid}/`.
 *
 * Unlike Topper's, this does NOT need the documents to still exist: the Worker
 * deletes by PREFIX rather than by enumerating ids, so the order against the
 * Firestore sweep is a free choice. It still runs first, to match Topper and
 * because a failure then leaves a recoverable state rather than a library of
 * documents pointing at assets that are gone.
 */
export const cleanupMyMedia = (): Promise<{ destroyed: number }> =>
  callBackend('cleanupMyMedia');

/** What `signUpload` hands back: everything a signed upload must send. */
export type SignedUpload = {
  apiKey: string;
  cloudName: string;
  /** The signed parameters, sent verbatim — `public_id` among them. */
  params: Record<string, string>;
  signature: string;
};

/**
 * Ask the Worker to sign ONE upload into the caller's own folder. It refuses
 * past the caps (`library-full`, `storage-full`, `daily-limit`) and without an
 * App Check token (`app-check`) — each a `BackendRefusal`. Unlike the delete
 * routes this is NOT best-effort: without a signature there is no upload.
 */
export const signUpload = (
  resourceType: 'image' | 'video',
): Promise<SignedUpload> => callBackend('signUpload', { resourceType });

/**
 * Destroy one asset the caller is deleting or replacing. Read its id off the
 * document first — ownership is the path prefix, and the document is what
 * tells us the id — but call this only AFTER the write that stops referencing
 * it, so an offline write can never leave a document naming a dead asset
 * (`sounds.ts`'s `destroySoundMedia` has the argument).
 *
 * The resource type is Cloudinary's own split, not ours: an mp3 is filed as a
 * `video` (audio is a video with no picture) and a cover as an `image`, and
 * the Admin API is keyed by that. Naming the wrong one deletes nothing.
 */
const destroyMyAsset = (
  publicId: string,
  resourceType: 'image' | 'video',
): Promise<{ destroyed: boolean }> =>
  callBackend('destroyMyAsset', { publicId, resourceType });

/** Destroy a sound's audio file. */
export const destroySoundAudio = (
  publicId: string,
): Promise<{ destroyed: boolean }> => destroyMyAsset(publicId, 'video');

/** Destroy a sound's cover artwork. */
export const destroySoundArt = (
  publicId: string,
): Promise<{ destroyed: boolean }> => destroyMyAsset(publicId, 'image');

/** Destroy a profile photo this app uploaded (never a provider's own URL). */
export const destroyProfilePhoto = (
  publicId: string,
): Promise<{ destroyed: boolean }> => destroyMyAsset(publicId, 'image');
