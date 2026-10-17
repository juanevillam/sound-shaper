import { requireUser } from '@/services/firebase/auth';

/**
 * Thin fetch-based client for the portfolio's media-cleanup Worker (POST
 * {data} + the caller's Firebase ID token; 200 {result} back). The Worker
 * deletes only the caller's own Cloudinary assets and does nothing else — see
 * services/media-worker (the `sound-shaper` environment).
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
// Deployed 2026-09-12 from services/media-worker
// (`npm run deploy:sound-shaper`). Re-deploying does not change this URL; only
// renaming the Worker or the account's workers.dev subdomain would.
const FUNCTIONS_BASE =
  'https://sound-shaper-media-worker.juanesvillamendoza.workers.dev';

const callBackend = async <T>(name: string, data: unknown = {}): Promise<T> => {
  const token = await requireUser().getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) throw new Error(`${name} failed: HTTP ${response.status}`);

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

/**
 * Destroy one asset the caller is deleting or replacing. Call BEFORE the doc
 * stops referencing it — ownership is the path prefix, and the document is
 * what told us the id.
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
